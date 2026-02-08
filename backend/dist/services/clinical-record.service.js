"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecordTypes = exports.deleteRecord = exports.signRecord = exports.updateRecord = exports.createRecord = exports.getRecordById = exports.getRecordsByClinic = exports.getRecordsByPatient = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const errors_js_1 = require("../utils/errors.js");
/**
 * Get clinical records by patient
 */
const getRecordsByPatient = async (patientId, clinicId, params, filters) => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;
    const conditions = [
        (0, drizzle_orm_1.eq)(schema_js_1.clinicalRecords.patientId, patientId),
        (0, drizzle_orm_1.eq)(schema_js_1.clinicalRecords.clinicId, clinicId),
    ];
    if (filters?.recordType) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.clinicalRecords.recordType, filters.recordType));
    }
    if (filters?.search) {
        conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_js_1.clinicalRecords.title, `%${filters.search}%`), (0, drizzle_orm_1.ilike)(schema_js_1.clinicalRecords.content, `%${filters.search}%`), (0, drizzle_orm_1.ilike)(schema_js_1.clinicalRecords.diagnosis, `%${filters.search}%`)));
    }
    const whereClause = (0, drizzle_orm_1.and)(...conditions);
    const [data, countResult] = await Promise.all([
        index_js_1.db.query.clinicalRecords.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: (r, { desc }) => [desc(r.createdAt)],
            with: {
                createdBy: {
                    columns: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                appointment: {
                    columns: {
                        id: true,
                        startTime: true,
                        title: true,
                    },
                },
            },
        }),
        index_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.clinicalRecords)
            .where(whereClause),
    ]);
    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};
exports.getRecordsByPatient = getRecordsByPatient;
/**
 * Get clinical records by clinic
 */
const getRecordsByClinic = async (clinicId, params, filters) => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;
    const conditions = [(0, drizzle_orm_1.eq)(schema_js_1.clinicalRecords.clinicId, clinicId)];
    if (filters?.patientId) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.clinicalRecords.patientId, filters.patientId));
    }
    if (filters?.recordType) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.clinicalRecords.recordType, filters.recordType));
    }
    if (filters?.search) {
        conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_js_1.clinicalRecords.title, `%${filters.search}%`), (0, drizzle_orm_1.ilike)(schema_js_1.clinicalRecords.content, `%${filters.search}%`), (0, drizzle_orm_1.ilike)(schema_js_1.clinicalRecords.diagnosis, `%${filters.search}%`)));
    }
    const whereClause = (0, drizzle_orm_1.and)(...conditions);
    const [data, countResult] = await Promise.all([
        index_js_1.db.query.clinicalRecords.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: (r, { desc }) => [desc(r.createdAt)],
            with: {
                patient: {
                    columns: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                createdBy: {
                    columns: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        }),
        index_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.clinicalRecords)
            .where(whereClause),
    ]);
    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};
exports.getRecordsByClinic = getRecordsByClinic;
/**
 * Get clinical record by ID
 */
const getRecordById = async (id, clinicId) => {
    const record = await index_js_1.db.query.clinicalRecords.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.clinicalRecords.id, id), (0, drizzle_orm_1.eq)(schema_js_1.clinicalRecords.clinicId, clinicId)),
        with: {
            patient: true,
            createdBy: {
                columns: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                },
            },
            appointment: true,
            signedBy: {
                columns: {
                    id: true,
                    firstName: true,
                    lastName: true,
                },
            },
        },
    });
    return record ?? null;
};
exports.getRecordById = getRecordById;
/**
 * Create a clinical record
 */
const createRecord = async (input) => {
    // Verify patient exists and belongs to clinic
    const patient = await index_js_1.db.query.patients.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.patients.id, input.patientId), (0, drizzle_orm_1.eq)(schema_js_1.patients.clinicId, input.clinicId)),
    });
    if (!patient) {
        throw new errors_js_1.NotFoundError('Patient not found in this clinic');
    }
    // Verify appointment if provided
    if (input.appointmentId) {
        const appointment = await index_js_1.db.query.appointments.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointments.id, input.appointmentId), (0, drizzle_orm_1.eq)(schema_js_1.appointments.clinicId, input.clinicId), (0, drizzle_orm_1.eq)(schema_js_1.appointments.patientId, input.patientId)),
        });
        if (!appointment) {
            throw new errors_js_1.NotFoundError('Appointment not found');
        }
    }
    const [record] = await index_js_1.db
        .insert(schema_js_1.clinicalRecords)
        .values({
        clinicId: input.clinicId,
        patientId: input.patientId,
        appointmentId: input.appointmentId ?? null,
        createdById: input.createdById,
        recordType: input.recordType,
        title: input.title ?? null,
        content: input.content ?? null,
        vitalSigns: input.vitalSigns ?? null,
        procedures: input.procedures ?? null,
        diagnosis: input.diagnosis ?? null,
        treatment: input.treatment ?? null,
        prescriptions: input.prescriptions ?? null,
        toothChart: input.toothChart ?? null,
        attachments: input.attachments ?? null,
    })
        .returning();
    return { success: true, data: record };
};
exports.createRecord = createRecord;
/**
 * Update a clinical record
 */
const updateRecord = async (id, clinicId, input) => {
    const existing = await (0, exports.getRecordById)(id, clinicId);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Clinical record not found');
    }
    // Cannot update signed records
    if (existing.isSigned) {
        throw new errors_js_1.ForbiddenError('Cannot modify a signed clinical record');
    }
    const [updated] = await index_js_1.db
        .update(schema_js_1.clinicalRecords)
        .set({
        title: input.title ?? existing.title,
        content: input.content ?? existing.content,
        vitalSigns: input.vitalSigns ?? existing.vitalSigns,
        procedures: input.procedures ?? existing.procedures,
        diagnosis: input.diagnosis ?? existing.diagnosis,
        treatment: input.treatment ?? existing.treatment,
        prescriptions: input.prescriptions ?? existing.prescriptions,
        toothChart: input.toothChart ?? existing.toothChart,
        attachments: input.attachments ?? existing.attachments,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.clinicalRecords.id, id))
        .returning();
    return { success: true, data: await (0, exports.getRecordById)(id, clinicId) };
};
exports.updateRecord = updateRecord;
/**
 * Sign a clinical record (makes it immutable)
 */
const signRecord = async (id, clinicId, signedById) => {
    const existing = await (0, exports.getRecordById)(id, clinicId);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Clinical record not found');
    }
    if (existing.isSigned) {
        throw new errors_js_1.ForbiddenError('Record is already signed');
    }
    await index_js_1.db
        .update(schema_js_1.clinicalRecords)
        .set({
        isSigned: true,
        signedAt: new Date(),
        signedById,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.clinicalRecords.id, id));
    return { success: true, data: await (0, exports.getRecordById)(id, clinicId) };
};
exports.signRecord = signRecord;
/**
 * Delete a clinical record (only if not signed)
 */
const deleteRecord = async (id, clinicId) => {
    const existing = await (0, exports.getRecordById)(id, clinicId);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Clinical record not found');
    }
    if (existing.isSigned) {
        throw new errors_js_1.ForbiddenError('Cannot delete a signed clinical record');
    }
    await index_js_1.db.delete(schema_js_1.clinicalRecords).where((0, drizzle_orm_1.eq)(schema_js_1.clinicalRecords.id, id));
    return true;
};
exports.deleteRecord = deleteRecord;
/**
 * Get record types (for dropdowns)
 */
const getRecordTypes = () => [
    { value: 'NOTE', label: 'Nota clínica' },
    { value: 'PROCEDURE', label: 'Procedimiento' },
    { value: 'DIAGNOSIS', label: 'Diagnóstico' },
    { value: 'TREATMENT_PLAN', label: 'Plan de tratamiento' },
    { value: 'PRESCRIPTION', label: 'Receta' },
    { value: 'EXAM', label: 'Examen' },
    { value: 'FOLLOW_UP', label: 'Seguimiento' },
];
exports.getRecordTypes = getRecordTypes;
//# sourceMappingURL=clinical-record.service.js.map