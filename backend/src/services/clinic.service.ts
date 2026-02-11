import { eq, and, ilike, sql } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { clinics, patients, appointments, users, workerClinics } from '../db/schema.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import type { PaginationParams, ServiceResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

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
export const getClinicsByOrganization = async (db: Database,
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
export const getAllClinics = async (db: Database,
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
export const getClinicById = async (db: Database,
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
export const createClinic = async (db: Database,
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

    const values: Record<string, any> = {
        organizationId: input.organizationId,
        name: input.name,
        slug: input.slug.toLowerCase(),
        country: input.country || 'ES',
        timezone: input.timezone || 'Europe/Madrid',
    };
    if (input.email !== undefined) values.email = input.email;
    if (input.phone !== undefined) values.phone = input.phone;
    if (input.address !== undefined) values.address = input.address;
    if (input.city !== undefined) values.city = input.city;
    if (input.postalCode !== undefined) values.postalCode = input.postalCode;

    const [clinic] = await db
        .insert(clinics)
        .values(values as any)
        .returning();

    // Auto-assign all organization admins to the new clinic
    try {
        const orgAdmins = await db.query.users.findMany({
            where: and(
                eq(users.organizationId, input.organizationId),
                eq(users.role, 'ADMIN'),
                eq(users.isActive, true)
            ),
        });

        for (const admin of orgAdmins) {
            await db.insert(workerClinics).values({
                userId: admin.id,
                clinicId: clinic!.id,
                role: 'Administrador',
            }).onConflictDoNothing();
        }

        logger.info(`Auto-assigned ${orgAdmins.length} admins to new clinic ${clinic!.name}`);
    } catch (error) {
        logger.warn('Failed to auto-assign admins to clinic', { clinicId: clinic!.id, error });
    }

    return { success: true, data: clinic! };
};

/**
 * Update a clinic
 */
export const updateClinic = async (db: Database,
    id: string,
    input: UpdateClinicInput
): Promise<ServiceResult<ClinicType>> => {
    const existing = await getClinicById(db, id);
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

    const updateData: Record<string, any> = { ...input, updatedAt: new Date() };
    if (input.slug) {
        updateData.slug = input.slug.toLowerCase();
    } else {
        delete updateData.slug;
    }
    for (const key of Object.keys(updateData)) {
        if (updateData[key] === undefined) delete updateData[key];
    }

    const [updated] = await db
        .update(clinics)
        .set(updateData)
        .where(eq(clinics.id, id))
        .returning();

    return { success: true, data: updated! };
};

/**
 * Delete a clinic
 */
export const deleteClinic = async (db: Database, id: string): Promise<boolean> => {
    const existing = await getClinicById(db, id);
    if (!existing) {
        throw new NotFoundError('Clinic not found');
    }

    await db.delete(clinics).where(eq(clinics.id, id));
    return true;
};

/**
 * Get clinic statistics
 */
export const getClinicStats = async (db: Database, clinicId: string) => {
    const clinic = await getClinicById(db, clinicId);
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
