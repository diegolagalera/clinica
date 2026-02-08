import { eq, and, or, ilike, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { patients, appointments, clinicalRecords, radiographs } from '../db/schema.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import type { PaginationParams, ServiceResult, TenantContext } from '../types/index.js';

export interface CreatePatientInput {
    clinicId: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    dateOfBirth?: Date;
    gender?: string;
    idNumber?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
    allergies?: string;
    medicalHistory?: string;
    notes?: string;
    insuranceProvider?: string;
    insuranceNumber?: string;
}

export interface UpdatePatientInput {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: Date;
    gender?: string;
    idNumber?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
    allergies?: string;
    medicalHistory?: string;
    notes?: string;
    insuranceProvider?: string;
    insuranceNumber?: string;
    consentGiven?: boolean;
    isActive?: boolean;
    acceptsMarketing?: boolean;
}

export type PatientType = typeof patients.$inferSelect;

/**
 * Get patients for a clinic with pagination and search
 * @param isActive - Optional filter: true = only active, false = only inactive, undefined = all
 */
export const getPatients = async (
    clinicId: string,
    params: PaginationParams,
    search?: string,
    isActive?: boolean
): Promise<{ data: PatientType[]; total: number }> => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    let whereClause = eq(patients.clinicId, clinicId);

    // Filter by active status if specified
    if (isActive !== undefined) {
        whereClause = and(whereClause, eq(patients.isActive, isActive))!;
    }

    if (search) {
        // Use unaccent for accent-insensitive search
        const searchPattern = `%${search}%`;
        whereClause = and(
            whereClause,
            sql`(
                unaccent(lower(${patients.firstName})) ILIKE unaccent(lower(${searchPattern})) OR
                unaccent(lower(${patients.lastName})) ILIKE unaccent(lower(${searchPattern})) OR
                ${patients.email} ILIKE ${searchPattern} OR
                ${patients.phone} ILIKE ${searchPattern}
            )`
        )!;
    }

    const [data, countResult] = await Promise.all([
        db.query.patients.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: (p, { asc }) => [asc(p.lastName), asc(p.firstName)],
        }),
        db
            .select({ count: sql<number>`count(*)` })
            .from(patients)
            .where(whereClause),
    ]);

    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};

/**
 * Get patient by ID with tenant validation
 */
export const getPatientById = async (
    id: string,
    tenantContext: TenantContext
): Promise<PatientType | null> => {
    const patient = await db.query.patients.findFirst({
        where: eq(patients.id, id),
    });

    if (!patient) {
        return null;
    }

    // Validate tenant access
    if (tenantContext.clinicIds.length > 0 && !tenantContext.clinicIds.includes(patient.clinicId)) {
        throw new ForbiddenError('Access denied to this patient');
    }

    return patient;
};

/**
 * Get patient with full details
 */
export const getPatientWithDetails = async (
    id: string,
    tenantContext: TenantContext
) => {
    const patient = await db.query.patients.findFirst({
        where: eq(patients.id, id),
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
        throw new NotFoundError('Patient not found');
    }

    // Validate tenant access
    if (tenantContext.clinicIds.length > 0 && !tenantContext.clinicIds.includes(patient.clinicId)) {
        throw new ForbiddenError('Access denied to this patient');
    }

    return patient;
};

/**
 * Create a new patient
 */
export const createPatient = async (
    input: CreatePatientInput
): Promise<ServiceResult<PatientType>> => {
    const [patient] = await db
        .insert(patients)
        .values({
            ...input,
            consentGiven: false,
            isActive: true,
        })
        .returning();

    return { success: true, data: patient! };
};

/**
 * Update a patient
 */
export const updatePatient = async (
    id: string,
    input: UpdatePatientInput,
    tenantContext: TenantContext
): Promise<ServiceResult<PatientType>> => {
    const existing = await getPatientById(id, tenantContext);
    if (!existing) {
        throw new NotFoundError('Patient not found');
    }

    // Handle consent date
    const updateData: Record<string, unknown> = {
        ...input,
        updatedAt: new Date(),
    };

    if (input.consentGiven && !existing.consentGiven) {
        updateData['consentDate'] = new Date();
    }

    const [updated] = await db
        .update(patients)
        .set(updateData)
        .where(eq(patients.id, id))
        .returning();

    return { success: true, data: updated! };
};

/**
 * Delete a patient (soft delete by setting isActive to false)
 */
export const deletePatient = async (
    id: string,
    tenantContext: TenantContext
): Promise<boolean> => {
    const existing = await getPatientById(id, tenantContext);
    if (!existing) {
        throw new NotFoundError('Patient not found');
    }

    await db
        .update(patients)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(patients.id, id));

    return true;
};

/**
 * Get patient statistics
 */
export const getPatientStats = async (
    id: string,
    tenantContext: TenantContext
) => {
    const patient = await getPatientById(id, tenantContext);
    if (!patient) {
        throw new NotFoundError('Patient not found');
    }

    const [appointmentsCount, recordsCount, radiographsCount] = await Promise.all([
        db
            .select({ count: sql<number>`count(*)` })
            .from(appointments)
            .where(eq(appointments.patientId, id)),
        db
            .select({ count: sql<number>`count(*)` })
            .from(clinicalRecords)
            .where(eq(clinicalRecords.patientId, id)),
        db
            .select({ count: sql<number>`count(*)` })
            .from(radiographs)
            .where(eq(radiographs.patientId, id)),
    ]);

    return {
        totalAppointments: Number(appointmentsCount[0]?.count ?? 0),
        totalRecords: Number(recordsCount[0]?.count ?? 0),
        totalRadiographs: Number(radiographsCount[0]?.count ?? 0),
    };
};
