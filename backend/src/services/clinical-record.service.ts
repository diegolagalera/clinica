import { eq, and, desc, sql, ilike, or } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { clinicalRecords, patients, users, appointments } from '../db/schema.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import type { PaginationParams, ServiceResult } from '../types/index.js';

export interface CreateClinicalRecordInput {
    clinicId: string;
    patientId: string;
    appointmentId?: string;
    createdById: string;
    recordType: string;
    title?: string;
    content?: string;
    vitalSigns?: Record<string, unknown>;
    procedures?: Array<Record<string, unknown>>;
    diagnosis?: string;
    treatment?: string;
    prescriptions?: Array<Record<string, unknown>>;
    toothChart?: Record<string, unknown>;
    attachments?: Array<Record<string, unknown>>;
}

export interface UpdateClinicalRecordInput {
    title?: string;
    content?: string;
    vitalSigns?: Record<string, unknown>;
    procedures?: Array<Record<string, unknown>>;
    diagnosis?: string;
    treatment?: string;
    prescriptions?: Array<Record<string, unknown>>;
    toothChart?: Record<string, unknown>;
    attachments?: Array<Record<string, unknown>>;
}

export type ClinicalRecordType = typeof clinicalRecords.$inferSelect;

/**
 * Get clinical records by patient
 */
export const getRecordsByPatient = async (db: Database,
    patientId: string,
    clinicId: string,
    params: PaginationParams,
    filters?: { recordType?: string; search?: string }
): Promise<{ data: any[]; total: number }> => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const conditions = [
        eq(clinicalRecords.patientId, patientId),
        eq(clinicalRecords.clinicId, clinicId),
    ];

    if (filters?.recordType) {
        conditions.push(eq(clinicalRecords.recordType, filters.recordType));
    }

    if (filters?.search) {
        conditions.push(
            or(
                ilike(clinicalRecords.title!, `%${filters.search}%`),
                ilike(clinicalRecords.content!, `%${filters.search}%`),
                ilike(clinicalRecords.diagnosis!, `%${filters.search}%`)
            )!
        );
    }

    const whereClause = and(...conditions);

    const [data, countResult] = await Promise.all([
        db.query.clinicalRecords.findMany({
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
        db
            .select({ count: sql<number>`count(*)` })
            .from(clinicalRecords)
            .where(whereClause),
    ]);

    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};

/**
 * Get clinical records by clinic
 */
export const getRecordsByClinic = async (db: Database,
    clinicId: string,
    params: PaginationParams,
    filters?: { recordType?: string; search?: string; patientId?: string }
): Promise<{ data: any[]; total: number }> => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const conditions = [eq(clinicalRecords.clinicId, clinicId)];

    if (filters?.patientId) {
        conditions.push(eq(clinicalRecords.patientId, filters.patientId));
    }

    if (filters?.recordType) {
        conditions.push(eq(clinicalRecords.recordType, filters.recordType));
    }

    if (filters?.search) {
        conditions.push(
            or(
                ilike(clinicalRecords.title!, `%${filters.search}%`),
                ilike(clinicalRecords.content!, `%${filters.search}%`),
                ilike(clinicalRecords.diagnosis!, `%${filters.search}%`)
            )!
        );
    }

    const whereClause = and(...conditions);

    const [data, countResult] = await Promise.all([
        db.query.clinicalRecords.findMany({
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
        db
            .select({ count: sql<number>`count(*)` })
            .from(clinicalRecords)
            .where(whereClause),
    ]);

    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};

/**
 * Get clinical record by ID
 */
export const getRecordById = async (db: Database,
    id: string,
    clinicId: string
): Promise<any | null> => {
    const record = await db.query.clinicalRecords.findFirst({
        where: and(
            eq(clinicalRecords.id, id),
            eq(clinicalRecords.clinicId, clinicId)
        ),
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

/**
 * Create a clinical record
 */
export const createRecord = async (db: Database,
    input: CreateClinicalRecordInput
): Promise<ServiceResult<ClinicalRecordType>> => {
    // Verify patient exists and belongs to clinic
    const patient = await db.query.patients.findFirst({
        where: and(
            eq(patients.id, input.patientId),
            eq(patients.clinicId, input.clinicId)
        ),
    });

    if (!patient) {
        throw new NotFoundError('Patient not found in this clinic');
    }

    // Verify appointment if provided
    if (input.appointmentId) {
        const appointment = await db.query.appointments.findFirst({
            where: and(
                eq(appointments.id, input.appointmentId),
                eq(appointments.clinicId, input.clinicId),
                eq(appointments.patientId, input.patientId)
            ),
        });

        if (!appointment) {
            throw new NotFoundError('Appointment not found');
        }
    }

    const [record] = await db
        .insert(clinicalRecords)
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

    return { success: true, data: record! };
};

/**
 * Update a clinical record
 */
export const updateRecord = async (db: Database,
    id: string,
    clinicId: string,
    input: UpdateClinicalRecordInput
): Promise<ServiceResult<any>> => {
    const existing = await getRecordById(db, id, clinicId);
    if (!existing) {
        throw new NotFoundError('Clinical record not found');
    }

    // Cannot update signed records
    if (existing.isSigned) {
        throw new ForbiddenError('Cannot modify a signed clinical record');
    }

    const [updated] = await db
        .update(clinicalRecords)
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
        .where(eq(clinicalRecords.id, id))
        .returning();

    return { success: true, data: await getRecordById(db, id, clinicId) };
};

/**
 * Sign a clinical record (makes it immutable)
 */
export const signRecord = async (db: Database,
    id: string,
    clinicId: string,
    signedById: string
): Promise<ServiceResult<any>> => {
    const existing = await getRecordById(db, id, clinicId);
    if (!existing) {
        throw new NotFoundError('Clinical record not found');
    }

    if (existing.isSigned) {
        throw new ForbiddenError('Record is already signed');
    }

    await db
        .update(clinicalRecords)
        .set({
            isSigned: true,
            signedAt: new Date(),
            signedById,
            updatedAt: new Date(),
        })
        .where(eq(clinicalRecords.id, id));

    return { success: true, data: await getRecordById(db, id, clinicId) };
};

/**
 * Delete a clinical record (only if not signed)
 */
export const deleteRecord = async (db: Database,
    id: string,
    clinicId: string
): Promise<boolean> => {
    const existing = await getRecordById(db, id, clinicId);
    if (!existing) {
        throw new NotFoundError('Clinical record not found');
    }

    if (existing.isSigned) {
        throw new ForbiddenError('Cannot delete a signed clinical record');
    }

    await db.delete(clinicalRecords).where(eq(clinicalRecords.id, id));
    return true;
};

/**
 * Get record types (for dropdowns)
 */
export const getRecordTypes = () => [
    { value: 'NOTE', label: 'Nota clínica' },
    { value: 'PROCEDURE', label: 'Procedimiento' },
    { value: 'DIAGNOSIS', label: 'Diagnóstico' },
    { value: 'TREATMENT_PLAN', label: 'Plan de tratamiento' },
    { value: 'PRESCRIPTION', label: 'Receta' },
    { value: 'EXAM', label: 'Examen' },
    { value: 'FOLLOW_UP', label: 'Seguimiento' },
];
