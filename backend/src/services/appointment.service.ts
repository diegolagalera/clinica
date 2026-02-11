import { eq, and, gte, lte, sql, or, inArray } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { appointments, patients, users, appointmentWorkers, auditLogs, ratingRequests, workerClinics } from '../db/schema.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import type { PaginationParams, ServiceResult, TenantContext } from '../types/index.js';
import { AppointmentType, AppointmentStatus } from '../types/enums.js';
import { appointmentEvents } from '../websocket.js';

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
 * Helper to get all worker IDs assigned to an appointment
 * Includes both legacy workerId and new appointmentWorkers
 */
async function getAppointmentWorkerIds(db: Database, appointmentId: string): Promise<string[]> {
    const appointment = await db.query.appointments.findFirst({
        where: eq(appointments.id, appointmentId),
        columns: { workerId: true },
        with: {
            appointmentWorkers: {
                columns: { userId: true },
            },
        },
    });

    if (!appointment) return [];

    const workerIds = new Set<string>();

    // Add legacy workerId if exists
    if (appointment.workerId) {
        workerIds.add(appointment.workerId);
    }

    // Add all appointmentWorkers
    for (const aw of appointment.appointmentWorkers) {
        workerIds.add(aw.userId);
    }

    return Array.from(workerIds);
}

/**
 * Get appointments for a date range
 * If workerIds provided, returns appointments where ANY of the workers are assigned
 */
export const getAppointments = async (db: Database,
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
export const getTodayAppointments = async (db: Database,
    clinicId: string,
    workerId?: string
) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return getAppointments(db, clinicId, today, tomorrow, workerId);
};

/**
 * Get upcoming appointments for a patient
 */
export const getPatientAppointments = async (db: Database,
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
export const getAppointmentById = async (db: Database,
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
export const checkConflicts = async (db: Database,
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
        // Exclude completed/cancelled/no-show - only SCHEDULED and IN_PROGRESS block the slot
        sql`${appointments.status} NOT IN ('CANCELLED', 'NO_SHOW', 'COMPLETED')`
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
export const createAppointment = async (db: Database,
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

    // Validate all workers exist and belong to clinic (via direct clinicId OR workerClinics table)
    for (const wId of effectiveWorkerIds) {
        // First check if user exists with correct role
        const worker = await db.query.users.findFirst({
            where: and(
                eq(users.id, wId),
                sql`${users.role} IN ('ADMIN', 'WORKER')`
            ),
        });

        if (!worker) {
            throw new BadRequestError(`Worker ${wId} not found`);
        }

        // Check if worker is assigned to this clinic (via direct clinicId OR worker_clinics)
        const hasDirectClinic = worker.clinicId === input.clinicId;

        if (!hasDirectClinic) {
            const workerClinicAssignment = await db.query.workerClinics.findFirst({
                where: and(
                    eq(workerClinics.userId, wId),
                    eq(workerClinics.clinicId, input.clinicId),
                    eq(workerClinics.isActive, true)
                ),
            });

            if (!workerClinicAssignment) {
                throw new BadRequestError(`Worker ${wId} not assigned to this clinic`);
            }
        }
    }

    // Check for conflicts with any of the assigned workers
    for (const wId of effectiveWorkerIds) {
        const hasConflict = await checkConflicts(db, wId, input.startTime, input.endTime);
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
export const updateAppointment = async (db: Database,
    id: string,
    input: UpdateAppointmentInput,
    tenantContext: TenantContext
): Promise<ServiceResult<AppointmentType_>> => {
    const existing = await getAppointmentById(db, id, tenantContext);
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
            const hasConflict = await checkConflicts(db, wId, startTime, endTime, id);
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
export const cancelAppointment = async (db: Database,
    id: string,
    tenantContext: TenantContext
): Promise<boolean> => {
    const existing = await getAppointmentById(db, id, tenantContext);
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
export const getWorkerSchedule = async (db: Database,
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

// ============================================================================
// ACTIVE APPOINTMENT MANAGEMENT
// ============================================================================

/**
 * Get all active (IN_PROGRESS) appointments for a user
 * Returns appointments where the user is one of the assigned workers
 */
export const getActiveAppointments = async (db: Database,
    clinicId: string,
    userId: string
): Promise<AppointmentType_[]> => {
    const activeAppts = await db.query.appointments.findMany({
        where: and(
            eq(appointments.clinicId, clinicId),
            eq(appointments.status, 'IN_PROGRESS')
        ),
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

    // Filter to only appointments where this user is assigned
    return activeAppts.filter(apt => {
        const assignedWorkerIds = apt.appointmentWorkers.map(aw => aw.userId);
        return assignedWorkerIds.includes(userId) || apt.workerId === userId;
    });
};

/**
 * Start an appointment (transition to IN_PROGRESS)
 */
export const startAppointment = async (db: Database,
    id: string,
    startedById: string,
    tenantContext: TenantContext
): Promise<AppointmentType_> => {
    const existing = await getAppointmentById(db, id, tenantContext);
    if (!existing) {
        throw new NotFoundError('Appointment not found');
    }

    if (existing.status !== 'SCHEDULED') {
        throw new BadRequestError(`Cannot start appointment with status ${existing.status}`);
    }

    // Check if patient already has an active appointment
    const patientActiveAppointment = await db.query.appointments.findFirst({
        where: and(
            eq(appointments.patientId, existing.patientId),
            eq(appointments.status, 'IN_PROGRESS'),
            eq(appointments.clinicId, existing.clinicId)
        ),
    });

    if (patientActiveAppointment) {
        throw new BadRequestError('Este paciente ya tiene una cita activa en curso. Debe finalizar la cita actual antes de iniciar otra.');
    }

    await db
        .update(appointments)
        .set({
            status: 'IN_PROGRESS',
            realStartTime: new Date(),
            startedById,
            updatedAt: new Date(),
        })
        .where(eq(appointments.id, id));

    // Re-fetch with full relations for frontend
    const updated = await db.query.appointments.findFirst({
        where: eq(appointments.id, id),
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

    // Emit WebSocket event only to assigned workers
    const workerIds = await getAppointmentWorkerIds(db, id);
    appointmentEvents.started(workerIds, updated);

    return updated!;
};

/**
 * Pause an active appointment
 * Note: pausedDuration tracks cumulative paused time in minutes
 */
export const pauseAppointment = async (db: Database,
    id: string,
    tenantContext: TenantContext
): Promise<AppointmentType_> => {
    const existing = await getAppointmentById(db, id, tenantContext);
    if (!existing) {
        throw new NotFoundError('Appointment not found');
    }

    if (existing.status !== 'IN_PROGRESS') {
        throw new BadRequestError('Can only pause active appointments');
    }

    // We store the pause timestamp in notes temporarily (simple approach)
    // The pausedDuration will be updated when resumed
    const [updated] = await db
        .update(appointments)
        .set({
            notes: existing.notes
                ? `${existing.notes}\n[PAUSED:${new Date().toISOString()}]`
                : `[PAUSED:${new Date().toISOString()}]`,
            updatedAt: new Date(),
        })
        .where(eq(appointments.id, id))
        .returning();

    // Emit WebSocket event only to assigned workers
    const workerIds = await getAppointmentWorkerIds(db, id);
    appointmentEvents.updated(workerIds, updated);

    return updated!;
};

/**
 * Resume a paused appointment
 */
export const resumeAppointment = async (db: Database,
    id: string,
    tenantContext: TenantContext
): Promise<AppointmentType_> => {
    const existing = await getAppointmentById(db, id, tenantContext);
    if (!existing) {
        throw new NotFoundError('Appointment not found');
    }

    if (existing.status !== 'IN_PROGRESS') {
        throw new BadRequestError('Can only resume active appointments');
    }

    // Calculate paused duration from the pause timestamp in notes
    let additionalPausedMinutes = 0;
    if (existing.notes) {
        const pauseMatch = existing.notes.match(/\[PAUSED:([^\]]+)\]/);
        if (pauseMatch) {
            const pauseTime = new Date(pauseMatch[1]!);
            additionalPausedMinutes = Math.round((Date.now() - pauseTime.getTime()) / 60000);
        }
    }

    // Remove pause marker and update paused duration
    const cleanNotes = existing.notes?.replace(/\n?\[PAUSED:[^\]]+\]/g, '') || null;
    const newPausedDuration = (existing.pausedDuration || 0) + additionalPausedMinutes;

    const [updated] = await db
        .update(appointments)
        .set({
            pausedDuration: newPausedDuration,
            notes: cleanNotes,
            updatedAt: new Date(),
        })
        .where(eq(appointments.id, id))
        .returning();

    // Emit WebSocket event only to assigned workers
    const workerIds = await getAppointmentWorkerIds(db, id);
    appointmentEvents.updated(workerIds, updated);

    return updated!;
};

/**
 * Complete an active appointment
 */
export const completeAppointment = async (db: Database,
    id: string,
    tenantContext: TenantContext
): Promise<AppointmentType_> => {
    const existing = await getAppointmentById(db, id, tenantContext);
    if (!existing) {
        throw new NotFoundError('Appointment not found');
    }

    if (existing.status !== 'IN_PROGRESS') {
        throw new BadRequestError('Can only complete active appointments');
    }

    const [updated] = await db
        .update(appointments)
        .set({
            status: 'COMPLETED',
            realEndTime: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(appointments.id, id))
        .returning();

    // Emit WebSocket event only to assigned workers
    const workerIds = await getAppointmentWorkerIds(db, id);
    appointmentEvents.completed(workerIds, id);

    return updated!;
};

// ============================================================================
// ADMIN: REAL TIME MANAGEMENT
// ============================================================================

export interface UpdateRealTimeInput {
    realStartTime?: Date | undefined;
    realEndTime?: Date | undefined;
    pausedDuration?: number | undefined;
}

/**
 * Update real time fields (Admin only)
 * Allows correcting errors when workers start/end appointments incorrectly
 */
export const updateRealTime = async (db: Database,
    id: string,
    input: UpdateRealTimeInput,
    adminUserId: string,
    tenantContext: TenantContext
): Promise<AppointmentType_> => {
    const existing = await getAppointmentById(db, id, tenantContext);
    if (!existing) {
        throw new NotFoundError('Appointment not found');
    }

    // Validate times if both provided
    if (input.realStartTime && input.realEndTime && input.realEndTime <= input.realStartTime) {
        throw new BadRequestError('El tiempo de fin debe ser posterior al tiempo de inicio');
    }

    // Store old values for audit
    const oldValues = {
        realStartTime: existing.realStartTime,
        realEndTime: existing.realEndTime,
        pausedDuration: existing.pausedDuration,
    };

    // Build update object
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.realStartTime !== undefined) updateData['realStartTime'] = input.realStartTime;
    if (input.realEndTime !== undefined) updateData['realEndTime'] = input.realEndTime;
    if (input.pausedDuration !== undefined) updateData['pausedDuration'] = input.pausedDuration;

    const [updated] = await db
        .update(appointments)
        .set(updateData)
        .where(eq(appointments.id, id))
        .returning();

    // Create audit log
    await db.insert(auditLogs).values({
        clinicId: existing.clinicId,
        userId: adminUserId,
        action: 'UPDATE',
        entityType: 'appointment',
        entityId: id,
        oldValues,
        newValues: {
            realStartTime: input.realStartTime ?? existing.realStartTime,
            realEndTime: input.realEndTime ?? existing.realEndTime,
            pausedDuration: input.pausedDuration ?? existing.pausedDuration,
        },
        metadata: { adminAction: 'edit_real_time' },
    });

    return updated!;
};

/**
 * Reset real time fields (Admin only)
 * Clears realStartTime, realEndTime, pausedDuration, reverts status to SCHEDULED
 * Also cancels any pending rating requests
 */
export const resetRealTime = async (db: Database,
    id: string,
    adminUserId: string,
    tenantContext: TenantContext
): Promise<AppointmentType_> => {
    const existing = await getAppointmentById(db, id, tenantContext);
    if (!existing) {
        throw new NotFoundError('Appointment not found');
    }

    // Only allow reset if appointment was started (has realStartTime)
    if (!existing.realStartTime) {
        throw new BadRequestError('Esta cita no tiene tiempo real registrado para resetear');
    }

    // Store old values for audit
    const oldValues = {
        status: existing.status,
        realStartTime: existing.realStartTime,
        realEndTime: existing.realEndTime,
        pausedDuration: existing.pausedDuration,
        startedById: existing.startedById,
    };

    // Clean up pause markers from notes if any
    const cleanNotes = existing.notes?.replace(/\n?\[PAUSED:[^\]]+\]/g, '') || null;

    // Reset all real time fields and status
    const [updated] = await db
        .update(appointments)
        .set({
            status: 'SCHEDULED',
            realStartTime: null,
            realEndTime: null,
            pausedDuration: 0,
            startedById: null,
            notes: cleanNotes,
            updatedAt: new Date(),
        })
        .where(eq(appointments.id, id))
        .returning();

    // Cancel any pending rating request for this appointment
    await db
        .update(ratingRequests)
        .set({ status: 'EXPIRED' })
        .where(and(
            eq(ratingRequests.appointmentId, id),
            sql`${ratingRequests.status} IN ('PENDING', 'SENT')`
        ));

    // Create audit log
    await db.insert(auditLogs).values({
        clinicId: existing.clinicId,
        userId: adminUserId,
        action: 'UPDATE',
        entityType: 'appointment',
        entityId: id,
        oldValues,
        newValues: {
            status: 'SCHEDULED',
            realStartTime: null,
            realEndTime: null,
            pausedDuration: 0,
            startedById: null,
        },
        metadata: { adminAction: 'reset_real_time' },
    });

    return updated!;
};

/**
 * Cancel an active (IN_PROGRESS) appointment
 * Clears realStartTime, realEndTime, pausedDuration and sets status to CANCELLED
 */
export const cancelActiveAppointment = async (db: Database,
    id: string,
    cancelledById: string,
    tenantContext: TenantContext
): Promise<AppointmentType_> => {
    const existing = await getAppointmentById(db, id, tenantContext);
    if (!existing) {
        throw new NotFoundError('Appointment not found');
    }

    // Only allow cancellation of active appointments
    if (existing.status !== 'IN_PROGRESS') {
        throw new BadRequestError('Solo se pueden cancelar citas que están en curso');
    }

    // Store old values for audit
    const oldValues = {
        status: existing.status,
        realStartTime: existing.realStartTime,
        realEndTime: existing.realEndTime,
        pausedDuration: existing.pausedDuration,
        startedById: existing.startedById,
    };

    // Clean up pause markers from notes if any
    const cleanNotes = existing.notes?.replace(/\n?\[PAUSED:[^\]]+\]/g, '') || null;

    // Clear real time data and set status to CANCELLED
    const [updated] = await db
        .update(appointments)
        .set({
            status: 'CANCELLED',
            realStartTime: null,
            realEndTime: null,
            pausedDuration: 0,
            startedById: null,
            notes: cleanNotes,
            updatedAt: new Date(),
        })
        .where(eq(appointments.id, id))
        .returning();

    // Create audit log
    await db.insert(auditLogs).values({
        clinicId: existing.clinicId,
        userId: cancelledById,
        action: 'UPDATE',
        entityType: 'appointment',
        entityId: id,
        oldValues,
        newValues: {
            status: 'CANCELLED',
            realStartTime: null,
            realEndTime: null,
            pausedDuration: 0,
            startedById: null,
        },
        metadata: { action: 'cancel_active_appointment' },
    });

    return updated!;
};
