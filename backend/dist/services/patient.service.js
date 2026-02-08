"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatientStats = exports.deletePatient = exports.updatePatient = exports.createPatient = exports.getPatientWithDetails = exports.getPatientById = exports.getPatients = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const errors_js_1 = require("../utils/errors.js");
/**
 * Get patients for a clinic with pagination and search
 */
const getPatients = async (clinicId, params, search) => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;
    let whereClause = (0, drizzle_orm_1.eq)(schema_js_1.patients.clinicId, clinicId);
    if (search) {
        // Use unaccent for accent-insensitive search
        const searchPattern = `%${search}%`;
        whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.sql) `(
                unaccent(lower(${schema_js_1.patients.firstName})) ILIKE unaccent(lower(${searchPattern})) OR
                unaccent(lower(${schema_js_1.patients.lastName})) ILIKE unaccent(lower(${searchPattern})) OR
                ${schema_js_1.patients.email} ILIKE ${searchPattern} OR
                ${schema_js_1.patients.phone} ILIKE ${searchPattern}
            )`);
    }
    const [data, countResult] = await Promise.all([
        index_js_1.db.query.patients.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: (p, { asc }) => [asc(p.lastName), asc(p.firstName)],
        }),
        index_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.patients)
            .where(whereClause),
    ]);
    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};
exports.getPatients = getPatients;
/**
 * Get patient by ID with tenant validation
 */
const getPatientById = async (id, tenantContext) => {
    const patient = await index_js_1.db.query.patients.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.patients.id, id),
    });
    if (!patient) {
        return null;
    }
    // Validate tenant access
    if (tenantContext.clinicIds.length > 0 && !tenantContext.clinicIds.includes(patient.clinicId)) {
        throw new errors_js_1.ForbiddenError('Access denied to this patient');
    }
    return patient;
};
exports.getPatientById = getPatientById;
/**
 * Get patient with full details
 */
const getPatientWithDetails = async (id, tenantContext) => {
    const patient = await index_js_1.db.query.patients.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.patients.id, id),
        with: {
            clinic: true,
            appointments: {
                orderBy: (a, { desc }) => [desc(a.startTime)],
                limit: 10,
                with: {
                    worker: true,
                    appointmentWorkers: {
                        with: {
                            user: true,
                        },
                    },
                },
            },
            radiographs: {
                orderBy: (r, { desc }) => [desc(r.createdAt)],
                limit: 5,
            },
        },
    });
    if (!patient) {
        throw new errors_js_1.NotFoundError('Patient not found');
    }
    // Validate tenant access
    if (tenantContext.clinicIds.length > 0 && !tenantContext.clinicIds.includes(patient.clinicId)) {
        throw new errors_js_1.ForbiddenError('Access denied to this patient');
    }
    return patient;
};
exports.getPatientWithDetails = getPatientWithDetails;
/**
 * Create a new patient
 */
const createPatient = async (input) => {
    const [patient] = await index_js_1.db
        .insert(schema_js_1.patients)
        .values({
        ...input,
        consentGiven: false,
        isActive: true,
    })
        .returning();
    return { success: true, data: patient };
};
exports.createPatient = createPatient;
/**
 * Update a patient
 */
const updatePatient = async (id, input, tenantContext) => {
    const existing = await (0, exports.getPatientById)(id, tenantContext);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Patient not found');
    }
    // Handle consent date
    const updateData = {
        ...input,
        updatedAt: new Date(),
    };
    if (input.consentGiven && !existing.consentGiven) {
        updateData['consentDate'] = new Date();
    }
    const [updated] = await index_js_1.db
        .update(schema_js_1.patients)
        .set(updateData)
        .where((0, drizzle_orm_1.eq)(schema_js_1.patients.id, id))
        .returning();
    return { success: true, data: updated };
};
exports.updatePatient = updatePatient;
/**
 * Delete a patient (soft delete by setting isActive to false)
 */
const deletePatient = async (id, tenantContext) => {
    const existing = await (0, exports.getPatientById)(id, tenantContext);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Patient not found');
    }
    await index_js_1.db
        .update(schema_js_1.patients)
        .set({ isActive: false, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.patients.id, id));
    return true;
};
exports.deletePatient = deletePatient;
/**
 * Get patient statistics
 */
const getPatientStats = async (id, tenantContext) => {
    const patient = await (0, exports.getPatientById)(id, tenantContext);
    if (!patient) {
        throw new errors_js_1.NotFoundError('Patient not found');
    }
    const [appointmentsCount, recordsCount, radiographsCount] = await Promise.all([
        index_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.appointments)
            .where((0, drizzle_orm_1.eq)(schema_js_1.appointments.patientId, id)),
        index_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.clinicalRecords)
            .where((0, drizzle_orm_1.eq)(schema_js_1.clinicalRecords.patientId, id)),
        index_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.radiographs)
            .where((0, drizzle_orm_1.eq)(schema_js_1.radiographs.patientId, id)),
    ]);
    return {
        totalAppointments: Number(appointmentsCount[0]?.count ?? 0),
        totalRecords: Number(recordsCount[0]?.count ?? 0),
        totalRadiographs: Number(radiographsCount[0]?.count ?? 0),
    };
};
exports.getPatientStats = getPatientStats;
//# sourceMappingURL=patient.service.js.map