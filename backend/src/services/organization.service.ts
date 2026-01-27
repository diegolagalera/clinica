import { eq, and, ilike, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
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
export const getOrganizations = async (
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
export const getOrganizationById = async (
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
export const getOrganizationBySlug = async (
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
export const createOrganization = async (
    input: CreateOrganizationInput
): Promise<ServiceResult<OrganizationType>> => {
    // Check if slug is unique
    const existing = await getOrganizationBySlug(input.slug);
    if (existing) {
        throw new ConflictError('Organization slug already exists');
    }

    const [org] = await db
        .insert(organizations)
        .values({
            name: input.name,
            slug: input.slug.toLowerCase(),
            email: input.email,
            phone: input.phone,
            address: input.address,
            logoUrl: input.logoUrl,
        })
        .returning();

    return { success: true, data: org! };
};

/**
 * Update an organization
 */
export const updateOrganization = async (
    id: string,
    input: UpdateOrganizationInput
): Promise<ServiceResult<OrganizationType>> => {
    const existing = await getOrganizationById(id);
    if (!existing) {
        throw new NotFoundError('Organization not found');
    }

    // Check slug uniqueness if changing
    if (input.slug && input.slug !== existing.slug) {
        const slugExists = await getOrganizationBySlug(input.slug);
        if (slugExists) {
            throw new ConflictError('Organization slug already exists');
        }
    }

    const [updated] = await db
        .update(organizations)
        .set({
            ...input,
            slug: input.slug?.toLowerCase(),
            updatedAt: new Date(),
        })
        .where(eq(organizations.id, id))
        .returning();

    return { success: true, data: updated! };
};

/**
 * Delete an organization
 */
export const deleteOrganization = async (id: string): Promise<boolean> => {
    const existing = await getOrganizationById(id);
    if (!existing) {
        throw new NotFoundError('Organization not found');
    }

    await db.delete(organizations).where(eq(organizations.id, id));
    return true;
};

/**
 * Get organization statistics
 */
export const getOrganizationStats = async (id: string) => {
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
