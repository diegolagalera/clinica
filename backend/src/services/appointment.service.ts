import { eq, and, gte, lte, sql, or, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { appointments, patients, users, appointmentWorkers } from '../db/schema.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import type { PaginationParams, ServiceResult, TenantContext } from '../types/index.js';
import { AppointmentType, AppointmentStatus } from '../types/enums.js';

export interface CreateAppointmentInput {
    clinicId: string;
    patientId: string;
    workerId?: string | undefined;
    workerIds?: string[] | undefined; // New: multiple workers
    type: AppointmentType;
    title?: string | undefined;
    description?: string | undefined;
    startTime: Date;
    endTime: Date;
    notes?: string | undefined;
    createdById: string;
}

export interface UpdateAppointmentInput {
    patientId?: string | undefined;
    workerId?: string | undefined;
    workerIds?: string[] | undefined; // New: multiple workers
    type?: AppointmentType | undefined;
    status?: AppointmentStatus | undefined;
    title?: string | undefined;
    description?: string | undefined;
    startTime?: Date | undefined;
    endTime?: Date | undefined;
    notes?: string | undefined;
}

export type AppointmentType_ = typeof appointments.$inferSelect;

/**
 * Get appointments for a date range
 * If workerIds provided, returns appointments where ANY of the workers are assigned
 */
export const getAppointments = async (
    clinicId: string,
    startDate: Date,
    endDate: Date,
    workerId?: string,
    workerIds?: string[]
): Promise<AppointmentType_[]> => {
    // Base where clause
    let whereClause = and(
        eq(appointments.clinicId, clinicId),
        gte(appointments.startTime, startDate),
        lte(appointments.startTime, endDate)
    );

    // Get all appointments in date range first
    const data = await db.query.appointments.findMany({
        where: whereClause,
        orderBy: (a, { asc }) => [asc(a.startTime)],
        with: {
            patient: true,
            worker: true,
            appointmentWorkers: {
                with: {
                    user: true,
                },
            },
        },
    });

    // Filter by workerIds if provided (appointment must have at least one matching worker)
    const effectiveWorkerIds = workerIds?.length ? workerIds : (workerId ? [workerId] : null);

    if (effectiveWorkerIds && effectiveWorkerIds.length > 0) {
        return data.filter(apt => {
            // Check if any of the assigned workers matches
            const assignedWorkerIds = apt.appointmentWorkers.map(aw => aw.userId);
            // Also check legacy workerId field
            if (apt.workerId && effectiveWorkerIds.includes(apt.workerId)) {
                return true;
            }
            return assignedWorkerIds.some(id => effectiveWorkerIds.includes(id));
        });
    }

    return data;
};

/**
 * Get appointments for today
 */
export const getTodayAppointments = async (
    clinicId: string,
    workerId?: string
) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return getAppointments(clinicId, today, tomorrow, workerId);
};

/**
 * Get upcoming appointments for a patient
 */
export const getPatientAppointments = async (
    patientId: string,
    tenantContext: TenantContext,
    params: PaginationParams
): Promise<{ data: AppointmentType_[]; total: number }> => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    // Build where clause with tenant validation
    let whereClause = eq(appointments.patientId, patientId);

    if (tenantContext.clinicIds.length > 0) {
        whereClause = and(
            whereClause,
            sql`${appointments.clinicId} IN (${sql.join(
                tenantContext.clinicIds.map(id => sql`${id}`),
                sql`, `
            )})`
        )!;
    }

    const [data, countResult] = await Promise.all([
        db.query.appointments.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: (a, { desc }) => [desc(a.startTime)],
            with: {
                worker: true,
                clinic: true,
                appointmentWorkers: {
                    with: {
                        user: true,
                    },
                },
            },
        }),
        db
            .select({ count: sql<number>`count(*)` })
            .from(appointments)
            .where(whereClause),
    ]);

    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};

/**
 * Get appointment by ID
 */
export const getAppointmentById = async (
    id: string,
    tenantContext: TenantContext
): Promise<AppointmentType_ | null> => {
    const appointment = await db.query.appointments.findFirst({
        where: eq(appointments.id, id),
        with: {
            patient: true,
            worker: true,
            clinic: true,
            appointmentWorkers: {
                with: {
                    user: true,
                },
            },
        },
    });

    if (!appointment) {
        return null;
    }

    // Validate tenant access
    if (tenantContext.clinicIds.length > 0 && !tenantContext.clinicIds.includes(appointment.clinicId)) {
        throw new ForbiddenError('Access denied to this appointment');
    }

    return appointment;
};

/**
 * Check for scheduling conflicts
 */
export const checkConflicts = async (
    workerId: string,
    startTime: Date,
    endTime: Date,
    excludeAppointmentId?: string
): Promise<boolean> => {
    let whereClause = and(
        eq(appointments.workerId, workerId),
        or(
            // New appointment starts during existing
            and(gte(sql`${startTime}`, appointments.startTime), lte(sql`${startTime}`, appointments.endTime)),
            // New appointment ends during existing
            and(gte(sql`${endTime}`, appointments.startTime), lte(sql`${endTime}`, appointments.endTime)),
            // New appointment contains existing
            and(lte(sql`${startTime}`, appointments.startTime), gte(sql`${endTime}`, appointments.endTime))
        ),
        // Exclude cancelled/no-show
        sql`${appointments.status} NOT IN ('CANCELLED', 'NO_SHOW')`
    );

    if (excludeAppointmentId) {
        whereClause = and(whereClause, sql`${appointments.id} != ${excludeAppointmentId}`);
    }

    const conflicts = await db.query.appointments.findFirst({
        where: whereClause,
    });

    return !!conflicts;
};

/**
 * Create a new appointment
 */
export const createAppointment = async (
    input: CreateAppointmentInput
): Promise<ServiceResult<AppointmentType_>> => {
    // Validate patient exists and belongs to clinic
    const patient = await db.query.patients.findFirst({
        where: and(
            eq(patients.id, input.patientId),
            eq(patients.clinicId, input.clinicId)
        ),
    });

    if (!patient) {
        throw new BadRequestError('Patient not found in this clinic');
    }

    // Determine workers: prefer workerIds array, fallback to single workerId, then createdById
    const effectiveWorkerIds = input.workerIds?.length
        ? input.workerIds
        : (input.workerId ? [input.workerId] : [input.createdById]);

    // Validate all workers exist and belong to clinic
    for (const wId of effectiveWorkerIds) {
        const worker = await db.query.users.findFirst({
            where: and(
                eq(users.id, wId),
                eq(users.clinicId, input.clinicId),
                sql`${users.role} IN ('ADMIN', 'WORKER')`
            ),
        });
        if (!worker) {
            throw new BadRequestError(`Worker ${wId} not found in this clinic`);
        }
    }

    // Check for conflicts with any of the assigned workers
    for (const wId of effectiveWorkerIds) {
        const hasConflict = await checkConflicts(wId, input.startTime, input.endTime);
        if (hasConflict) {
            throw new BadRequestError('This time slot conflicts with an existing appointment for one of the workers');
        }
    }

    // Calculate duration
    const duration = Math.round((input.endTime.getTime() - input.startTime.getTime()) / 60000);

    // Use first worker as the primary (for backwards compatibility with workerId column)
    const primaryWorkerId = effectiveWorkerIds[0]!;

    const [appointment] = await db
        .insert(appointments)
        .values({
            clinicId: input.clinicId,
            patientId: input.patientId,
            workerId: primaryWorkerId, // Keep for backwards compatibility
            type: input.type,
            status: 'SCHEDULED',
            title: input.title ?? null,
            description: input.description ?? null,
            startTime: input.startTime,
            endTime: input.endTime,
            duration,
            notes: input.notes ?? null,
            createdById: input.createdById,
        })
        .returning();

    // Insert into appointment_workers junction table
    const workerInserts = effectiveWorkerIds.map((wId, index) => ({
        appointmentId: appointment!.id,
        userId: wId,
        isPrimary: index === 0, // First worker is primary
    }));

    await db.insert(appointmentWorkers).values(workerInserts);

    return { success: true, data: appointment! };
};

/**
 * Update an appointment
 */
export const updateAppointment = async (
    id: string,
    input: UpdateAppointmentInput,
    tenantContext: TenantContext
): Promise<ServiceResult<AppointmentType_>> => {
    const existing = await getAppointmentById(id, tenantContext);
    if (!existing) {
        throw new NotFoundError('Appointment not found');
    }

    // Determine new workers if provided
    const newWorkerIds = input.workerIds?.length
        ? input.workerIds
        : (input.workerId ? [input.workerId] : null);

    // If time is changing or workers are changing, check for conflicts
    if (input.startTime || input.endTime || newWorkerIds) {
        const startTime = input.startTime || existing.startTime;
        const endTime = input.endTime || existing.endTime;
        const workerIdsToCheck = newWorkerIds || (existing.workerId ? [existing.workerId] : []);

        for (const wId of workerIdsToCheck) {
            const hasConflict = await checkConflicts(wId, startTime, endTime, id);
            if (hasConflict) {
                throw new BadRequestError('This time slot conflicts with an existing appointment for one of the workers');
            }
        }
    }

    // Calculate new duration if times changed
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    // Copy allowed fields (excluding workerIds which is handled separately)
    if (input.patientId !== undefined) updateData['patientId'] = input.patientId;
    if (input.type !== undefined) updateData['type'] = input.type;
    if (input.status !== undefined) updateData['status'] = input.status;
    if (input.title !== undefined) updateData['title'] = input.title;
    if (input.description !== undefined) updateData['description'] = input.description;
    if (input.startTime !== undefined) updateData['startTime'] = input.startTime;
    if (input.endTime !== undefined) updateData['endTime'] = input.endTime;
    if (input.notes !== undefined) updateData['notes'] = input.notes;

    if (input.startTime || input.endTime) {
        const startTime = input.startTime || existing.startTime;
        const endTime = input.endTime || existing.endTime;
        updateData['duration'] = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    }

    // Update primary workerId for backwards compatibility
    if (newWorkerIds && newWorkerIds.length > 0) {
        updateData['workerId'] = newWorkerIds[0];
    }

    const [updated] = await db
        .update(appointments)
        .set(updateData)
        .where(eq(appointments.id, id))
        .returning();

    // Sync appointment_workers if workerIds provided
    if (newWorkerIds && newWorkerIds.length > 0) {
        // Delete existing workers for this appointment
        await db.delete(appointmentWorkers).where(eq(appointmentWorkers.appointmentId, id));

        // Insert new workers
        const workerInserts = newWorkerIds.map((wId, index) => ({
            appointmentId: id,
            userId: wId,
            isPrimary: index === 0,
        }));
        await db.insert(appointmentWorkers).values(workerInserts);
    }

    return { success: true, data: updated! };
};

/**
 * Cancel an appointment
 */
export const cancelAppointment = async (
    id: string,
    tenantContext: TenantContext
): Promise<boolean> => {
    const existing = await getAppointmentById(id, tenantContext);
    if (!existing) {
        throw new NotFoundError('Appointment not found');
    }

    await db
        .update(appointments)
        .set({ status: 'CANCELLED', updatedAt: new Date() })
        .where(eq(appointments.id, id));

    return true;
};

/**
 * Get worker schedule summary
 */
export const getWorkerSchedule = async (
    workerId: string,
    clinicId: string,
    date: Date
) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const dayAppointments = await db.query.appointments.findMany({
        where: and(
            eq(appointments.workerId, workerId),
            eq(appointments.clinicId, clinicId),
            gte(appointments.startTime, dayStart),
            lte(appointments.startTime, dayEnd),
            sql`${appointments.status} NOT IN ('CANCELLED', 'NO_SHOW')`
        ),
        orderBy: (a, { asc }) => [asc(a.startTime)],
        with: {
            patient: true,
        },
    });

    return {
        date: date.toISOString().split('T')[0],
        appointments: dayAppointments,
        totalAppointments: dayAppointments.length,
    };
};
