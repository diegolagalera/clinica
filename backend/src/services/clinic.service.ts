import { eq, and, ilike, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clinics, patients, appointments, users } from '../db/schema.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import type { PaginationParams, ServiceResult } from '../types/index.js';

export interface CreateClinicInput {
    organizationId: string;
    name: string;
    slug: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    timezone?: string;
}

export interface UpdateClinicInput {
    name?: string;
    slug?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    timezone?: string;
    isActive?: boolean;
    settings?: Record<string, unknown>;
    workingHours?: Record<string, unknown>;
}

export type ClinicType = typeof clinics.$inferSelect;

/**
 * Get clinics by organization with pagination
 */
export const getClinicsByOrganization = async (
    organizationId: string,
    params: PaginationParams,
    search?: string
): Promise<{ data: ClinicType[]; total: number }> => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const whereClause = search
        ? and(
            eq(clinics.organizationId, organizationId),
            ilike(clinics.name, `%${search}%`)
        )
        : eq(clinics.organizationId, organizationId);

    const [data, countResult] = await Promise.all([
        db.query.clinics.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: (c, { desc }) => [desc(c.createdAt)],
        }),
        db
            .select({ count: sql<number>`count(*)` })
            .from(clinics)
            .where(whereClause),
    ]);

    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};

/**
 * Get all clinics (for Super Admin)
 */
export const getAllClinics = async (
    params: PaginationParams,
    search?: string
): Promise<{ data: ClinicType[]; total: number }> => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const whereClause = search
        ? ilike(clinics.name, `%${search}%`)
        : undefined;

    const [data, countResult] = await Promise.all([
        db.query.clinics.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: (c, { desc }) => [desc(c.createdAt)],
            with: {
                organization: true,
            },
        }),
        db
            .select({ count: sql<number>`count(*)` })
            .from(clinics)
            .where(whereClause),
    ]);

    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};

/**
 * Get clinic by ID
 */
export const getClinicById = async (
    id: string
): Promise<ClinicType | null> => {
    const clinic = await db.query.clinics.findFirst({
        where: eq(clinics.id, id),
        with: {
            organization: true,
        },
    });
    return clinic ?? null;
};

/**
 * Create a new clinic
 */
export const createClinic = async (
    input: CreateClinicInput
): Promise<ServiceResult<ClinicType>> => {
    // Check if slug is unique within organization
    const existing = await db.query.clinics.findFirst({
        where: and(
            eq(clinics.organizationId, input.organizationId),
            eq(clinics.slug, input.slug.toLowerCase())
        ),
    });

    if (existing) {
        throw new ConflictError('Clinic slug already exists in this organization');
    }

    const [clinic] = await db
        .insert(clinics)
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

    return { success: true, data: clinic! };
};

/**
 * Update a clinic
 */
export const updateClinic = async (
    id: string,
    input: UpdateClinicInput
): Promise<ServiceResult<ClinicType>> => {
    const existing = await getClinicById(id);
    if (!existing) {
        throw new NotFoundError('Clinic not found');
    }

    // Check slug uniqueness if changing
    if (input.slug && input.slug !== existing.slug) {
        const slugExists = await db.query.clinics.findFirst({
            where: and(
                eq(clinics.organizationId, existing.organizationId),
                eq(clinics.slug, input.slug.toLowerCase())
            ),
        });
        if (slugExists) {
            throw new ConflictError('Clinic slug already exists in this organization');
        }
    }

    const [updated] = await db
        .update(clinics)
        .set({
            ...input,
            slug: input.slug?.toLowerCase(),
            updatedAt: new Date(),
        })
        .where(eq(clinics.id, id))
        .returning();

    return { success: true, data: updated! };
};

/**
 * Delete a clinic
 */
export const deleteClinic = async (id: string): Promise<boolean> => {
    const existing = await getClinicById(id);
    if (!existing) {
        throw new NotFoundError('Clinic not found');
    }

    await db.delete(clinics).where(eq(clinics.id, id));
    return true;
};

/**
 * Get clinic statistics
 */
export const getClinicStats = async (clinicId: string) => {
    const clinic = await getClinicById(clinicId);
    if (!clinic) {
        throw new NotFoundError('Clinic not found');
    }

    const [patientsCount, staffCount, todayAppointments] = await Promise.all([
        db
            .select({ count: sql<number>`count(*)` })
            .from(patients)
            .where(eq(patients.clinicId, clinicId)),
        db
            .select({ count: sql<number>`count(*)` })
            .from(users)
            .where(and(
                eq(users.clinicId, clinicId),
                sql`${users.role} IN ('ADMIN', 'WORKER')`
            )),
        db
            .select({ count: sql<number>`count(*)` })
            .from(appointments)
            .where(and(
                eq(appointments.clinicId, clinicId),
                sql`DATE(${appointments.startTime}) = CURRENT_DATE`
            )),
    ]);

    return {
        clinic,
        patientsCount: Number(patientsCount[0]?.count ?? 0),
        staffCount: Number(staffCount[0]?.count ?? 0),
        todayAppointments: Number(todayAppointments[0]?.count ?? 0),
    };
};
