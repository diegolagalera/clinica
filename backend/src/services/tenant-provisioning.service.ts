import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import bcrypt from 'bcrypt';
import { centralDb } from '../db/central-db.js';
import { tenants, globalUsers, superadmins } from '../db/central-schema.js';
import { tenantManager } from '../db/tenant-manager.js';
import * as schema from '../db/schema.js';
import { logger } from '../utils/logger.js';
import * as storage from './storage.service.js';
import type { Database } from '../db/index.js';

const SALT_ROUNDS = 12;

// ============================================================================
// Types
// ============================================================================

export interface ProvisionTenantInput {
    /** Company name (e.g. "Vitaldent") */
    name: string;
    /** URL-safe slug (e.g. "vitaldent") — used in JWT + routing */
    slug: string;
    /** PostgreSQL connection URL for the NEW tenant database */
    databaseUrl: string;
    /** Database name (e.g. "cuspia_vitaldent") */
    databaseName: string;
    /** Subscription plan */
    plan?: string;
    /** Max clinics allowed */
    maxClinics?: number;
    /** Contact email for the company */
    contactEmail?: string;
    /** Contact phone for the company */
    contactPhone?: string;
    /** Initial admin user to create */
    adminUser: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        phone?: string;
    };
    /** Initial organization info */
    organization: {
        name: string;
        email?: string;
        phone?: string;
    };
    /** Initial clinic info (optional) */
    clinic?: {
        name: string;
        email?: string;
        phone?: string;
        address?: string;
        city?: string;
        timezone?: string;
    };
}

export interface ProvisionResult {
    success: boolean;
    tenantId?: string;
    slug?: string;
    adminUserId?: string;
    error?: string;
}

// ============================================================================
// Provisioning Service
// ============================================================================

/**
 * Provision a new tenant:
 * 1. Register tenant in central DB
 * 2. Create the tenant database (if it doesn't exist)
 * 3. Push the schema to the new database
 * 4. Seed initial data (organization, clinic, admin user)
 * 5. Register admin in global_users for login routing
 */
export async function provisionTenant(input: ProvisionTenantInput): Promise<ProvisionResult> {
    logger.info({ slug: input.slug }, 'Starting tenant provisioning...');

    try {
        // Step 1: Check slug uniqueness
        const existing = await centralDb.query.tenants.findFirst({
            where: eq(tenants.slug, input.slug),
        });

        if (existing) {
            return { success: false, error: `Tenant slug "${input.slug}" already exists` };
        }

        // Step 2: Register tenant in central DB
        const [tenant] = await centralDb
            .insert(tenants)
            .values({
                name: input.name,
                slug: input.slug,
                databaseUrl: input.databaseUrl,
                databaseName: input.databaseName,
                plan: input.plan || 'basic',
                maxClinics: input.maxClinics || 5,
                contactEmail: input.contactEmail ?? null,
                contactPhone: input.contactPhone ?? null,
                isActive: true,
            })
            .returning();

        logger.info({ tenantId: tenant!.id, slug: input.slug }, 'Tenant registered in central DB');

        // Step 2.5: Ensure S3 storage is ready for tenant
        try {
            await storage.ensureBucketExists(input.slug);
            logger.info({ slug: input.slug }, 'Tenant storage bucket created');
        } catch (err) {
            logger.error({ slug: input.slug, err }, 'Failed to create tenant bucket — continuing provisioning');
        }

        // Step 3: Create the database if it doesn't exist
        await createDatabaseIfNotExists(input.databaseName, input.databaseUrl);

        // Step 4: Enable extensions BEFORE schema push (migrations need pgvector type)
        await enableExtensions(input.databaseUrl);
        logger.info({ slug: input.slug }, 'Extensions enabled on tenant DB');

        // Step 5: Push schema to tenant DB using migrations
        await pushSchemaToTenantDb(input.databaseUrl);

        // Step 6: Get a connection to the new tenant DB
        const tenantDb = await tenantManager.getConnectionByUrl(input.slug, input.databaseUrl);

        // Step 7: Seed initial data
        const result = await seedTenantData(tenantDb, input);

        // Step 8: Register admin in global_users
        await centralDb.insert(globalUsers).values({
            email: input.adminUser.email.toLowerCase(),
            tenantId: tenant!.id,
            userId: result.adminUserId,
            role: 'ADMIN',
            isActive: true,
        });

        logger.info({ slug: input.slug, adminEmail: input.adminUser.email }, 'Admin registered in global_users');

        logger.info({ slug: input.slug }, '✅ Tenant provisioning complete!');

        return {
            success: true,
            tenantId: tenant!.id,
            slug: input.slug,
            adminUserId: result.adminUserId,
        };
    } catch (error: any) {
        logger.error({ error: error.message, slug: input.slug }, 'Tenant provisioning failed');
        return { success: false, error: error.message };
    }
}

// ============================================================================
// Create Database
// ============================================================================

/**
 * Create a PostgreSQL database if it doesn't already exist.
 * Connects to the 'postgres' maintenance database to issue CREATE DATABASE.
 */
async function createDatabaseIfNotExists(dbName: string, targetUrl: string): Promise<void> {
    // Parse the target URL to get host/port/user/password, then connect to 'postgres' DB
    const url = new URL(targetUrl);
    const maintenanceUrl = `${url.protocol}//${url.username}:${url.password}@${url.host}/postgres`;

    const maintenanceSql = postgres(maintenanceUrl, { max: 1 });

    try {
        // Check if database exists
        const result = await maintenanceSql`
            SELECT 1 FROM pg_database WHERE datname = ${dbName}
        `;

        if (result.length === 0) {
            // Create the database — must use unsafe() because CREATE DATABASE can't be parameterized
            await maintenanceSql.unsafe(`CREATE DATABASE "${dbName}"`);
            logger.info({ dbName }, 'Tenant database created');
        } else {
            logger.info({ dbName }, 'Tenant database already exists');
        }
    } finally {
        await maintenanceSql.end();
    }
}

// ============================================================================
// Enable Extensions
// ============================================================================

/**
 * Enable required PostgreSQL extensions on a tenant database.
 * Must run BEFORE schema push since migrations use pgvector types.
 */
async function enableExtensions(databaseUrl: string): Promise<void> {
    const extSql = postgres(databaseUrl, { max: 1 });
    const extDb = drizzle(extSql);

    try {
        await extDb.execute(sql`CREATE EXTENSION IF NOT EXISTS unaccent`);
        await extDb.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    } finally {
        await extSql.end();
    }
}

// ============================================================================
// Push Schema
// ============================================================================

/**
 * Push the Drizzle schema to a tenant database using drizzle-kit push.
 * This runs the equivalent of `drizzle-kit push:pg` programmatically.
 */
async function pushSchemaToTenantDb(databaseUrl: string): Promise<void> {
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    const path = await import('path');

    logger.info('Pushing schema to tenant database...');

    // Create a temporary connection for migration
    const migrationSql = postgres(databaseUrl, { max: 1 });
    const migrationDb = drizzle(migrationSql);

    try {
        // Resolve migrations folder relative to project root
        const migrationsFolder = path.resolve(process.cwd(), 'migrations');

        await migrate(migrationDb as any, { migrationsFolder });
        logger.info('Schema pushed successfully via migrations');
    } finally {
        await migrationSql.end();
    }
}

// ============================================================================
// Seed Initial Data
// ============================================================================

/**
 * Seed a new tenant database with the initial organization, clinic, and admin user.
 */
async function seedTenantData(
    db: Database,
    input: ProvisionTenantInput,
): Promise<{ adminUserId: string; organizationId: string; clinicId?: string }> {
    const passwordHash = await bcrypt.hash(input.adminUser.password, SALT_ROUNDS);

    // Create organization
    const [organization] = await db
        .insert(schema.organizations)
        .values({
            name: input.organization.name,
            slug: input.slug,
            email: input.organization.email ?? null,
            phone: input.organization.phone ?? null,
            isActive: true,
        })
        .returning();

    logger.info({ orgId: organization!.id }, 'Organization created');

    // Create clinic (if provided)
    let clinicId: string | undefined;
    if (input.clinic) {
        const [clinic] = await db
            .insert(schema.clinics)
            .values({
                organizationId: organization!.id,
                name: input.clinic.name,
                slug: input.slug,
                email: input.clinic.email ?? null,
                phone: input.clinic.phone ?? null,
                address: input.clinic.address ?? null,
                city: input.clinic.city ?? null,
                timezone: input.clinic.timezone || 'Europe/Madrid',
                isActive: true,
            })
            .returning();
        clinicId = clinic!.id;
        logger.info({ clinicId }, 'Default clinic created');
    }

    // Create admin user
    const [adminUser] = await db
        .insert(schema.users)
        .values({
            email: input.adminUser.email.toLowerCase(),
            passwordHash,
            firstName: input.adminUser.firstName,
            lastName: input.adminUser.lastName,
            phone: input.adminUser.phone ?? null,
            role: 'ADMIN',
            organizationId: organization!.id,
            clinicId: clinicId ?? null,
            emailVerified: true,
            isActive: true,
        })
        .returning();

    logger.info({ adminUserId: adminUser!.id }, 'Admin user created');

    // Create workerClinics entry for admin if clinic exists
    if (clinicId) {
        await db.insert(schema.workerClinics).values({
            userId: adminUser!.id,
            clinicId,
            role: 'Administrador',
            isActive: true,
        });
    }

    return {
        adminUserId: adminUser!.id,
        organizationId: organization!.id,
        ...(clinicId !== undefined && { clinicId }),
    };
}

// ============================================================================
// Sync Existing Users to Central DB
// ============================================================================

/**
 * Sync all users from a tenant database to global_users in central DB.
 * Used during migration of existing single-tenant setup to multi-tenant.
 */
export async function syncTenantUsersToCentral(
    tenantDb: Database,
    tenantId: string,
): Promise<{ synced: number; skipped: number }> {
    // Get all active users from the tenant DB
    const allUsers = await tenantDb.query.users.findMany({
        columns: { id: true, email: true, role: true, isActive: true },
    });

    let synced = 0;
    let skipped = 0;

    for (const user of allUsers) {
        // Skip SUPERADMIN users — they live in the superadmins table
        if (user.role === 'SUPERADMIN') {
            skipped++;
            continue;
        }

        // Check if already exists in global_users
        const existing = await centralDb.query.globalUsers.findFirst({
            where: and(
                eq(globalUsers.email, user.email),
                eq(globalUsers.tenantId, tenantId),
            ),
        });

        if (existing) {
            skipped++;
            continue;
        }

        // Insert into global_users
        await centralDb.insert(globalUsers).values({
            email: user.email,
            tenantId,
            userId: user.id,
            role: user.role,
            isActive: user.isActive,
        });

        synced++;
    }

    return { synced, skipped };
}

// ============================================================================
// Provision SUPERADMIN in Central DB
// ============================================================================

/**
 * Create a SUPERADMIN in the central database.
 * SUPERADMIN accounts are separate from tenant users.
 */
export async function provisionSuperadmin(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const existing = await centralDb.query.superadmins.findFirst({
            where: eq(superadmins.email, input.email.toLowerCase()),
        });

        if (existing) {
            return { success: false, error: 'Superadmin email already exists' };
        }

        const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

        const [sa] = await centralDb
            .insert(superadmins)
            .values({
                email: input.email.toLowerCase(),
                passwordHash,
                firstName: input.firstName,
                lastName: input.lastName,
                isActive: true,
            })
            .returning();

        logger.info({ id: sa!.id, email: input.email }, 'Superadmin created');

        return { success: true, id: sa!.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ============================================================================
// List & Manage Tenants
// ============================================================================

/**
 * Get all tenants from central DB.
 */
export async function listTenants() {
    return centralDb.query.tenants.findMany({
        orderBy: (t, { asc }) => [asc(t.name)],
    });
}

/**
 * Deactivate a tenant (does not delete the database).
 */
export async function deactivateTenant(slug: string): Promise<boolean> {
    const [updated] = await centralDb
        .update(tenants)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(tenants.slug, slug))
        .returning();

    if (updated) {
        // Close the connection pool for this tenant
        await tenantManager.closeConnection(slug);
        logger.info({ slug }, 'Tenant deactivated');
    }

    return !!updated;
}

/**
 * Reactivate a tenant.
 */
export async function reactivateTenant(slug: string): Promise<boolean> {
    const [updated] = await centralDb
        .update(tenants)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(tenants.slug, slug))
        .returning();

    return !!updated;
}
