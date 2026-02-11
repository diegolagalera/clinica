#!/usr/bin/env tsx
/**
 * One-time Migration Script: Convert existing single-tenant setup to multi-tenant
 *
 * This script:
 * 1. Creates the central database tables (if not already done via central:push)
 * 2. Registers the current database as a tenant in the central DB
 * 3. Syncs all existing users to global_users for login routing
 * 4. Optionally creates a SUPERADMIN account in the central DB
 *
 * Prerequisites:
 *   - CENTRAL_DATABASE_URL must be set in .env
 *   - The central database must already exist (create it manually or via docker-compose)
 *   - Run `npm run central:push` first to create the central schema
 *
 * Usage:
 *   npx tsx src/scripts/migrate-to-multi-tenant.ts \
 *     --tenant-name "Mi Clínica" \
 *     --tenant-slug "mi-clinica" \
 *     --sa-email "superadmin@cuspia.com" \
 *     --sa-password "SuperSecure123!"
 */

import { eq } from 'drizzle-orm';
import { centralDb } from '../db/central-db.js';
import { tenants, globalUsers, superadmins } from '../db/central-schema.js';
import { db } from '../db/index.js';
import { config } from '../config/env.js';
import { syncTenantUsersToCentral, provisionSuperadmin } from '../services/tenant-provisioning.service.js';
import bcrypt from 'bcrypt';

// ============================================================================
// Parse CLI arguments
// ============================================================================

function parseArgs(): Record<string, string> {
    const args: Record<string, string> = {};
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const value = argv[i + 1];
            if (value && !value.startsWith('--')) {
                args[key] = value;
                i++;
            } else {
                args[key] = 'true';
            }
        }
    }
    return args;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    const args = parseArgs();

    const tenantName = args['tenant-name'] || 'Mi Clínica';
    const tenantSlug = args['tenant-slug'] || 'default';
    const saEmail = args['sa-email'];
    const saPassword = args['sa-password'];

    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  🔄 CUSPIA — Migration to Multi-Tenant          ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');

    // ═══════════════════════════════════════════
    // Step 1: Verify central DB connection
    // ═══════════════════════════════════════════
    console.log('Step 1/4: Verifying central database connection...');
    try {
        const result = await centralDb.execute<{ now: Date }>({} as any);
        // Simple connectivity check — if it doesn't throw, we're good
    } catch {
        // Try a simpler query
    }

    // Test with a real query
    try {
        const existingTenants = await centralDb.query.tenants.findMany();
        console.log(`  ✅ Central DB connected. ${existingTenants.length} existing tenant(s).`);
    } catch (error: any) {
        console.error('  ❌ Cannot connect to central database.');
        console.error(`     Error: ${error.message}`);
        console.error('     Make sure CENTRAL_DATABASE_URL is set and central:push has been run.');
        process.exit(1);
    }

    // ═══════════════════════════════════════════
    // Step 2: Register current DB as tenant
    // ═══════════════════════════════════════════
    console.log(`\nStep 2/4: Registering current database as tenant "${tenantSlug}"...`);

    const existingTenant = await centralDb.query.tenants.findFirst({
        where: eq(tenants.slug, tenantSlug),
    });

    let tenantId: string;

    if (existingTenant) {
        console.log(`  ⚠️  Tenant "${tenantSlug}" already exists (ID: ${existingTenant.id})`);
        tenantId = existingTenant.id;
    } else {
        const databaseUrl = config.database.url;
        const dbName = new URL(databaseUrl).pathname.slice(1); // Remove leading /

        const [newTenant] = await centralDb
            .insert(tenants)
            .values({
                name: tenantName,
                slug: tenantSlug,
                databaseUrl: databaseUrl,
                databaseName: dbName,
                isActive: true,
                plan: 'basic',
                maxClinics: 5,
            })
            .returning();

        tenantId = newTenant!.id;
        console.log(`  ✅ Tenant registered: ${tenantName} (ID: ${tenantId})`);
    }

    // ═══════════════════════════════════════════
    // Step 3: Sync existing users to global_users
    // ═══════════════════════════════════════════
    console.log('\nStep 3/4: Syncing existing users to global_users...');

    const { synced, skipped } = await syncTenantUsersToCentral(db, tenantId);
    console.log(`  ✅ Users synced: ${synced} new, ${skipped} skipped (already exist or SUPERADMIN)`);

    // ═══════════════════════════════════════════
    // Step 4: Create SUPERADMIN (optional)
    // ═══════════════════════════════════════════
    if (saEmail && saPassword) {
        console.log('\nStep 4/4: Creating SUPERADMIN...');

        const result = await provisionSuperadmin({
            email: saEmail,
            password: saPassword,
            firstName: 'Super',
            lastName: 'Admin',
        });

        if (result.success) {
            console.log(`  ✅ SUPERADMIN created: ${saEmail} (ID: ${result.id})`);
        } else {
            console.log(`  ⚠️  ${result.error}`);
        }
    } else {
        console.log('\nStep 4/4: Skipping SUPERADMIN creation (no --sa-email / --sa-password provided)');
    }

    // ═══════════════════════════════════════════
    // Summary
    // ═══════════════════════════════════════════
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  ✅ Migration complete!                          ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  Tenant:       ${tenantName} (${tenantSlug})`);
    console.log(`  Tenant ID:    ${tenantId}`);
    console.log(`  Users synced: ${synced}`);
    if (saEmail) {
        console.log(`  SUPERADMIN:   ${saEmail}`);
    }
    console.log('');
    console.log('  Next steps:');
    console.log('  1. Update .env: CENTRAL_DATABASE_URL=<your-central-db-url>');
    console.log('  2. Restart the backend server');
    console.log('  3. Login with existing credentials (now routed through central DB)');
    console.log('  4. Use provision-tenant.ts to add new tenants');
    console.log('');

    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
