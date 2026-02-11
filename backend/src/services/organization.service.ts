import { eq, and, ilike, sql } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { organizations } from '../db/schema.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import type { PaginationParams, ServiceResult } from '../types/index.js';

export interface CreateOrganizationInput {
    name: string;
    slug: string;
    email?: string;
    phone?: string;
    address?: string;
    logoUrl?: string;
}

export interface UpdateOrganizationInput {
    name?: string;
    slug?: string;
    email?: string;
    phone?: string;
    address?: string;
    logoUrl?: string;
    isActive?: boolean;
    settings?: Record<string, unknown>;
}

export type OrganizationType = typeof organizations.$inferSelect;

/**
 * Get all organizations with pagination
 */
export const getOrganizations = async (db: Database,
    params: PaginationParams,
    search?: string
): Promise<{ data: OrganizationType[]; total: number }> => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const whereClause = search
        ? ilike(organizations.name, `%${search}%`)
        : undefined;

    const [data, countResult] = await Promise.all([
        db.query.organizations.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: (orgs, { desc }) => [desc(orgs.createdAt)],
        }),
        db
            .select({ count: sql<number>`count(*)` })
            .from(organizations)
            .where(whereClause),
    ]);

    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};

/**
 * Get organization by ID
 */
export const getOrganizationById = async (db: Database,
    id: string
): Promise<OrganizationType | null> => {
    const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, id),
    });
    return org ?? null;
};

/**
 * Get organization by slug
 */
export const getOrganizationBySlug = async (db: Database,
    slug: string
): Promise<OrganizationType | null> => {
    const org = await db.query.organizations.findFirst({
        where: eq(organizations.slug, slug),
    });
    return org ?? null;
};

/**
 * Create a new organization
 */
export const createOrganization = async (db: Database,
    input: CreateOrganizationInput
): Promise<ServiceResult<OrganizationType>> => {
    // Check if slug is unique
    const existing = await getOrganizationBySlug(db, input.slug);
    if (existing) {
        throw new ConflictError('Organization slug already exists');
    }

    const values: Record<string, any> = {
        name: input.name,
        slug: input.slug.toLowerCase(),
    };
    if (input.email !== undefined) values.email = input.email;
    if (input.phone !== undefined) values.phone = input.phone;
    if (input.address !== undefined) values.address = input.address;
    if (input.logoUrl !== undefined) values.logoUrl = input.logoUrl;

    const [org] = await db
        .insert(organizations)
        .values(values as any)
        .returning();

    return { success: true, data: org! };
};

/**
 * Update an organization
 */
export const updateOrganization = async (db: Database,
    id: string,
    input: UpdateOrganizationInput
): Promise<ServiceResult<OrganizationType>> => {
    const existing = await getOrganizationById(db, id);
    if (!existing) {
        throw new NotFoundError('Organization not found');
    }

    // Check slug uniqueness if changing
    if (input.slug && input.slug !== existing.slug) {
        const slugExists = await getOrganizationBySlug(db, input.slug);
        if (slugExists) {
            throw new ConflictError('Organization slug already exists');
        }
    }

    const updateData: Record<string, any> = { ...input, updatedAt: new Date() };
    if (input.slug) {
        updateData.slug = input.slug.toLowerCase();
    } else {
        delete updateData.slug;
    }
    // Remove undefined values
    for (const key of Object.keys(updateData)) {
        if (updateData[key] === undefined) delete updateData[key];
    }

    const [updated] = await db
        .update(organizations)
        .set(updateData)
        .where(eq(organizations.id, id))
        .returning();

    return { success: true, data: updated! };
};

/**
 * Delete an organization
 */
export const deleteOrganization = async (db: Database, id: string): Promise<boolean> => {
    const existing = await getOrganizationById(db, id);
    if (!existing) {
        throw new NotFoundError('Organization not found');
    }

    await db.delete(organizations).where(eq(organizations.id, id));
    return true;
};

/**
 * Get organization statistics
 */
export const getOrganizationStats = async (db: Database, id: string) => {
    const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, id),
        with: {
            clinics: true,
            users: true,
        },
    });

    if (!org) {
        throw new NotFoundError('Organization not found');
    }

    return {
        organization: org,
        clinicsCount: org.clinics.length,
        usersCount: org.users.length,
    };
};
