"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClinicStats = exports.deleteClinic = exports.updateClinic = exports.createClinic = exports.getClinicById = exports.getAllClinics = exports.getClinicsByOrganization = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const errors_js_1 = require("../utils/errors.js");
/**
 * Get clinics by organization with pagination
 */
const getClinicsByOrganization = async (organizationId, params, search) => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;
    const whereClause = search
        ? (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.clinics.organizationId, organizationId), (0, drizzle_orm_1.ilike)(schema_js_1.clinics.name, `%${search}%`))
        : (0, drizzle_orm_1.eq)(schema_js_1.clinics.organizationId, organizationId);
    const [data, countResult] = await Promise.all([
        index_js_1.db.query.clinics.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: (c, { desc }) => [desc(c.createdAt)],
        }),
        index_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.clinics)
            .where(whereClause),
    ]);
    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};
exports.getClinicsByOrganization = getClinicsByOrganization;
/**
 * Get all clinics (for Super Admin)
 */
const getAllClinics = async (params, search) => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;
    const whereClause = search
        ? (0, drizzle_orm_1.ilike)(schema_js_1.clinics.name, `%${search}%`)
        : undefined;
    const [data, countResult] = await Promise.all([
        index_js_1.db.query.clinics.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: (c, { desc }) => [desc(c.createdAt)],
            with: {
                organization: true,
            },
        }),
        index_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.clinics)
            .where(whereClause),
    ]);
    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};
exports.getAllClinics = getAllClinics;
/**
 * Get clinic by ID
 */
const getClinicById = async (id) => {
    const clinic = await index_js_1.db.query.clinics.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.clinics.id, id),
        with: {
            organization: true,
        },
    });
    return clinic ?? null;
};
exports.getClinicById = getClinicById;
/**
 * Create a new clinic
 */
const createClinic = async (input) => {
    // Check if slug is unique within organization
    const existing = await index_js_1.db.query.clinics.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.clinics.organizationId, input.organizationId), (0, drizzle_orm_1.eq)(schema_js_1.clinics.slug, input.slug.toLowerCase())),
    });
    if (existing) {
        throw new errors_js_1.ConflictError('Clinic slug already exists in this organization');
    }
    const [clinic] = await index_js_1.db
        .insert(schema_js_1.clinics)
        .values({
        organizationId: input.organizationId,
        name: input.name,
        slug: input.slug.toLowerCase(),
        email: input.email,
        phone: input.phone,
        address: input.address,
        city: input.city,
        postalCode: input.postalCode,
        country: input.country || 'ES',
        timezone: input.timezone || 'Europe/Madrid',
    })
        .returning();
    return { success: true, data: clinic };
};
exports.createClinic = createClinic;
/**
 * Update a clinic
 */
const updateClinic = async (id, input) => {
    const existing = await (0, exports.getClinicById)(id);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Clinic not found');
    }
    // Check slug uniqueness if changing
    if (input.slug && input.slug !== existing.slug) {
        const slugExists = await index_js_1.db.query.clinics.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.clinics.organizationId, existing.organizationId), (0, drizzle_orm_1.eq)(schema_js_1.clinics.slug, input.slug.toLowerCase())),
        });
        if (slugExists) {
            throw new errors_js_1.ConflictError('Clinic slug already exists in this organization');
        }
    }
    const [updated] = await index_js_1.db
        .update(schema_js_1.clinics)
        .set({
        ...input,
        slug: input.slug?.toLowerCase(),
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.clinics.id, id))
        .returning();
    return { success: true, data: updated };
};
exports.updateClinic = updateClinic;
/**
 * Delete a clinic
 */
const deleteClinic = async (id) => {
    const existing = await (0, exports.getClinicById)(id);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Clinic not found');
    }
    await index_js_1.db.delete(schema_js_1.clinics).where((0, drizzle_orm_1.eq)(schema_js_1.clinics.id, id));
    return true;
};
exports.deleteClinic = deleteClinic;
/**
 * Get clinic statistics
 */
const getClinicStats = async (clinicId) => {
    const clinic = await (0, exports.getClinicById)(clinicId);
    if (!clinic) {
        throw new errors_js_1.NotFoundError('Clinic not found');
    }
    const [patientsCount, staffCount, todayAppointments] = await Promise.all([
        index_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.patients)
            .where((0, drizzle_orm_1.eq)(schema_js_1.patients.clinicId, clinicId)),
        index_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.users)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.users.clinicId, clinicId), (0, drizzle_orm_1.sql) `${schema_js_1.users.role} IN ('ADMIN', 'WORKER')`)),
        index_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.appointments)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointments.clinicId, clinicId), (0, drizzle_orm_1.sql) `DATE(${schema_js_1.appointments.startTime}) = CURRENT_DATE`)),
    ]);
    return {
        clinic,
        patientsCount: Number(patientsCount[0]?.count ?? 0),
        staffCount: Number(staffCount[0]?.count ?? 0),
        todayAppointments: Number(todayAppointments[0]?.count ?? 0),
    };
};
exports.getClinicStats = getClinicStats;
//# sourceMappingURL=clinic.service.js.map