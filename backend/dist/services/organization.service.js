"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrganizationStats = exports.deleteOrganization = exports.updateOrganization = exports.createOrganization = exports.getOrganizationBySlug = exports.getOrganizationById = exports.getOrganizations = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const errors_js_1 = require("../utils/errors.js");
/**
 * Get all organizations with pagination
 */
const getOrganizations = async (params, search) => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;
    const whereClause = search
        ? (0, drizzle_orm_1.ilike)(schema_js_1.organizations.name, `%${search}%`)
        : undefined;
    const [data, countResult] = await Promise.all([
        index_js_1.db.query.organizations.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: (orgs, { desc }) => [desc(orgs.createdAt)],
        }),
        index_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.organizations)
            .where(whereClause),
    ]);
    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};
exports.getOrganizations = getOrganizations;
/**
 * Get organization by ID
 */
const getOrganizationById = async (id) => {
    const org = await index_js_1.db.query.organizations.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.organizations.id, id),
    });
    return org ?? null;
};
exports.getOrganizationById = getOrganizationById;
/**
 * Get organization by slug
 */
const getOrganizationBySlug = async (slug) => {
    const org = await index_js_1.db.query.organizations.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.organizations.slug, slug),
    });
    return org ?? null;
};
exports.getOrganizationBySlug = getOrganizationBySlug;
/**
 * Create a new organization
 */
const createOrganization = async (input) => {
    // Check if slug is unique
    const existing = await (0, exports.getOrganizationBySlug)(input.slug);
    if (existing) {
        throw new errors_js_1.ConflictError('Organization slug already exists');
    }
    const [org] = await index_js_1.db
        .insert(schema_js_1.organizations)
        .values({
        name: input.name,
        slug: input.slug.toLowerCase(),
        email: input.email,
        phone: input.phone,
        address: input.address,
        logoUrl: input.logoUrl,
    })
        .returning();
    return { success: true, data: org };
};
exports.createOrganization = createOrganization;
/**
 * Update an organization
 */
const updateOrganization = async (id, input) => {
    const existing = await (0, exports.getOrganizationById)(id);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Organization not found');
    }
    // Check slug uniqueness if changing
    if (input.slug && input.slug !== existing.slug) {
        const slugExists = await (0, exports.getOrganizationBySlug)(input.slug);
        if (slugExists) {
            throw new errors_js_1.ConflictError('Organization slug already exists');
        }
    }
    const [updated] = await index_js_1.db
        .update(schema_js_1.organizations)
        .set({
        ...input,
        slug: input.slug?.toLowerCase(),
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.organizations.id, id))
        .returning();
    return { success: true, data: updated };
};
exports.updateOrganization = updateOrganization;
/**
 * Delete an organization
 */
const deleteOrganization = async (id) => {
    const existing = await (0, exports.getOrganizationById)(id);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Organization not found');
    }
    await index_js_1.db.delete(schema_js_1.organizations).where((0, drizzle_orm_1.eq)(schema_js_1.organizations.id, id));
    return true;
};
exports.deleteOrganization = deleteOrganization;
/**
 * Get organization statistics
 */
const getOrganizationStats = async (id) => {
    const org = await index_js_1.db.query.organizations.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.organizations.id, id),
        with: {
            clinics: true,
            users: true,
        },
    });
    if (!org) {
        throw new errors_js_1.NotFoundError('Organization not found');
    }
    return {
        organization: org,
        clinicsCount: org.clinics.length,
        usersCount: org.users.length,
    };
};
exports.getOrganizationStats = getOrganizationStats;
//# sourceMappingURL=organization.service.js.map