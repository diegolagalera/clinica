"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeAppointment = exports.resumeAppointment = exports.pauseAppointment = exports.startAppointment = exports.getActiveAppointments = exports.getWorkerSchedule = exports.cancelAppointment = exports.updateAppointment = exports.createAppointment = exports.checkConflicts = exports.getAppointmentById = exports.getPatientAppointments = exports.getTodayAppointments = exports.getAppointments = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const errors_js_1 = require("../utils/errors.js");
/**
 * Get appointments for a date range
 * If workerIds provided, returns appointments where ANY of the workers are assigned
 */
const getAppointments = async (clinicId, startDate, endDate, workerId, workerIds) => {
    // Base where clause
    let whereClause = (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointments.clinicId, clinicId), (0, drizzle_orm_1.gte)(schema_js_1.appointments.startTime, startDate), (0, drizzle_orm_1.lte)(schema_js_1.appointments.startTime, endDate));
    // Get all appointments in date range first
    const data = await index_js_1.db.query.appointments.findMany({
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
exports.getAppointments = getAppointments;
/**
 * Get appointments for today
 */
const getTodayAppointments = async (clinicId, workerId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return (0, exports.getAppointments)(clinicId, today, tomorrow, workerId);
};
exports.getTodayAppointments = getTodayAppointments;
/**
 * Get upcoming appointments for a patient
 */
const getPatientAppointments = async (patientId, tenantContext, params) => {
    const { page, limit } = params;
    const offset = (page - 1) * limit;
    // Build where clause with tenant validation
    let whereClause = (0, drizzle_orm_1.eq)(schema_js_1.appointments.patientId, patientId);
    if (tenantContext.clinicIds.length > 0) {
        whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.sql) `${schema_js_1.appointments.clinicId} IN (${drizzle_orm_1.sql.join(tenantContext.clinicIds.map(id => (0, drizzle_orm_1.sql) `${id}`), (0, drizzle_orm_1.sql) `, `)})`);
    }
    const [data, countResult] = await Promise.all([
        index_js_1.db.query.appointments.findMany({
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
        index_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.appointments)
            .where(whereClause),
    ]);
    return {
        data,
        total: Number(countResult[0]?.count ?? 0),
    };
};
exports.getPatientAppointments = getPatientAppointments;
/**
 * Get appointment by ID
 */
const getAppointmentById = async (id, tenantContext) => {
    const appointment = await index_js_1.db.query.appointments.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.appointments.id, id),
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
        throw new errors_js_1.ForbiddenError('Access denied to this appointment');
    }
    return appointment;
};
exports.getAppointmentById = getAppointmentById;
/**
 * Check for scheduling conflicts
 */
const checkConflicts = async (workerId, startTime, endTime, excludeAppointmentId) => {
    let whereClause = (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointments.workerId, workerId), (0, drizzle_orm_1.or)(
    // New appointment starts during existing
    (0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)((0, drizzle_orm_1.sql) `${startTime}`, schema_js_1.appointments.startTime), (0, drizzle_orm_1.lte)((0, drizzle_orm_1.sql) `${startTime}`, schema_js_1.appointments.endTime)), 
    // New appointment ends during existing
    (0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)((0, drizzle_orm_1.sql) `${endTime}`, schema_js_1.appointments.startTime), (0, drizzle_orm_1.lte)((0, drizzle_orm_1.sql) `${endTime}`, schema_js_1.appointments.endTime)), 
    // New appointment contains existing
    (0, drizzle_orm_1.and)((0, drizzle_orm_1.lte)((0, drizzle_orm_1.sql) `${startTime}`, schema_js_1.appointments.startTime), (0, drizzle_orm_1.gte)((0, drizzle_orm_1.sql) `${endTime}`, schema_js_1.appointments.endTime))), 
    // Exclude cancelled/no-show
    (0, drizzle_orm_1.sql) `${schema_js_1.appointments.status} NOT IN ('CANCELLED', 'NO_SHOW')`);
    if (excludeAppointmentId) {
        whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.sql) `${schema_js_1.appointments.id} != ${excludeAppointmentId}`);
    }
    const conflicts = await index_js_1.db.query.appointments.findFirst({
        where: whereClause,
    });
    return !!conflicts;
};
exports.checkConflicts = checkConflicts;
/**
 * Create a new appointment
 */
const createAppointment = async (input) => {
    // Validate patient exists and belongs to clinic
    const patient = await index_js_1.db.query.patients.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.patients.id, input.patientId), (0, drizzle_orm_1.eq)(schema_js_1.patients.clinicId, input.clinicId)),
    });
    if (!patient) {
        throw new errors_js_1.BadRequestError('Patient not found in this clinic');
    }
    // Determine workers: prefer workerIds array, fallback to single workerId, then createdById
    const effectiveWorkerIds = input.workerIds?.length
        ? input.workerIds
        : (input.workerId ? [input.workerId] : [input.createdById]);
    // Validate all workers exist and belong to clinic
    for (const wId of effectiveWorkerIds) {
        const worker = await index_js_1.db.query.users.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.users.id, wId), (0, drizzle_orm_1.eq)(schema_js_1.users.clinicId, input.clinicId), (0, drizzle_orm_1.sql) `${schema_js_1.users.role} IN ('ADMIN', 'WORKER')`),
        });
        if (!worker) {
            throw new errors_js_1.BadRequestError(`Worker ${wId} not found in this clinic`);
        }
    }
    // Check for conflicts with any of the assigned workers
    for (const wId of effectiveWorkerIds) {
        const hasConflict = await (0, exports.checkConflicts)(wId, input.startTime, input.endTime);
        if (hasConflict) {
            throw new errors_js_1.BadRequestError('This time slot conflicts with an existing appointment for one of the workers');
        }
    }
    // Calculate duration
    const duration = Math.round((input.endTime.getTime() - input.startTime.getTime()) / 60000);
    // Use first worker as the primary (for backwards compatibility with workerId column)
    const primaryWorkerId = effectiveWorkerIds[0];
    const [appointment] = await index_js_1.db
        .insert(schema_js_1.appointments)
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
        appointmentId: appointment.id,
        userId: wId,
        isPrimary: index === 0, // First worker is primary
    }));
    await index_js_1.db.insert(schema_js_1.appointmentWorkers).values(workerInserts);
    return { success: true, data: appointment };
};
exports.createAppointment = createAppointment;
/**
 * Update an appointment
 */
const updateAppointment = async (id, input, tenantContext) => {
    const existing = await (0, exports.getAppointmentById)(id, tenantContext);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Appointment not found');
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
            const hasConflict = await (0, exports.checkConflicts)(wId, startTime, endTime, id);
            if (hasConflict) {
                throw new errors_js_1.BadRequestError('This time slot conflicts with an existing appointment for one of the workers');
            }
        }
    }
    // Calculate new duration if times changed
    const updateData = { updatedAt: new Date() };
    // Copy allowed fields (excluding workerIds which is handled separately)
    if (input.patientId !== undefined)
        updateData['patientId'] = input.patientId;
    if (input.type !== undefined)
        updateData['type'] = input.type;
    if (input.status !== undefined)
        updateData['status'] = input.status;
    if (input.title !== undefined)
        updateData['title'] = input.title;
    if (input.description !== undefined)
        updateData['description'] = input.description;
    if (input.startTime !== undefined)
        updateData['startTime'] = input.startTime;
    if (input.endTime !== undefined)
        updateData['endTime'] = input.endTime;
    if (input.notes !== undefined)
        updateData['notes'] = input.notes;
    if (input.startTime || input.endTime) {
        const startTime = input.startTime || existing.startTime;
        const endTime = input.endTime || existing.endTime;
        updateData['duration'] = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    }
    // Update primary workerId for backwards compatibility
    if (newWorkerIds && newWorkerIds.length > 0) {
        updateData['workerId'] = newWorkerIds[0];
    }
    const [updated] = await index_js_1.db
        .update(schema_js_1.appointments)
        .set(updateData)
        .where((0, drizzle_orm_1.eq)(schema_js_1.appointments.id, id))
        .returning();
    // Sync appointment_workers if workerIds provided
    if (newWorkerIds && newWorkerIds.length > 0) {
        // Delete existing workers for this appointment
        await index_js_1.db.delete(schema_js_1.appointmentWorkers).where((0, drizzle_orm_1.eq)(schema_js_1.appointmentWorkers.appointmentId, id));
        // Insert new workers
        const workerInserts = newWorkerIds.map((wId, index) => ({
            appointmentId: id,
            userId: wId,
            isPrimary: index === 0,
        }));
        await index_js_1.db.insert(schema_js_1.appointmentWorkers).values(workerInserts);
    }
    return { success: true, data: updated };
};
exports.updateAppointment = updateAppointment;
/**
 * Cancel an appointment
 */
const cancelAppointment = async (id, tenantContext) => {
    const existing = await (0, exports.getAppointmentById)(id, tenantContext);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Appointment not found');
    }
    await index_js_1.db
        .update(schema_js_1.appointments)
        .set({ status: 'CANCELLED', updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.appointments.id, id));
    return true;
};
exports.cancelAppointment = cancelAppointment;
/**
 * Get worker schedule summary
 */
const getWorkerSchedule = async (workerId, clinicId, date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const dayAppointments = await index_js_1.db.query.appointments.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointments.workerId, workerId), (0, drizzle_orm_1.eq)(schema_js_1.appointments.clinicId, clinicId), (0, drizzle_orm_1.gte)(schema_js_1.appointments.startTime, dayStart), (0, drizzle_orm_1.lte)(schema_js_1.appointments.startTime, dayEnd), (0, drizzle_orm_1.sql) `${schema_js_1.appointments.status} NOT IN ('CANCELLED', 'NO_SHOW')`),
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
exports.getWorkerSchedule = getWorkerSchedule;
// ============================================================================
// ACTIVE APPOINTMENT MANAGEMENT
// ============================================================================
/**
 * Get all active (IN_PROGRESS) appointments for a user
 * Returns appointments where the user is one of the assigned workers
 */
const getActiveAppointments = async (clinicId, userId) => {
    const activeAppts = await index_js_1.db.query.appointments.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointments.clinicId, clinicId), (0, drizzle_orm_1.eq)(schema_js_1.appointments.status, 'IN_PROGRESS')),
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
exports.getActiveAppointments = getActiveAppointments;
/**
 * Start an appointment (transition to IN_PROGRESS)
 */
const startAppointment = async (id, startedById, tenantContext) => {
    const existing = await (0, exports.getAppointmentById)(id, tenantContext);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Appointment not found');
    }
    if (existing.status !== 'SCHEDULED') {
        throw new errors_js_1.BadRequestError(`Cannot start appointment with status ${existing.status}`);
    }
    const [updated] = await index_js_1.db
        .update(schema_js_1.appointments)
        .set({
        status: 'IN_PROGRESS',
        realStartTime: new Date(),
        startedById,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.appointments.id, id))
        .returning();
    return updated;
};
exports.startAppointment = startAppointment;
/**
 * Pause an active appointment
 * Note: pausedDuration tracks cumulative paused time in minutes
 */
const pauseAppointment = async (id, tenantContext) => {
    const existing = await (0, exports.getAppointmentById)(id, tenantContext);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Appointment not found');
    }
    if (existing.status !== 'IN_PROGRESS') {
        throw new errors_js_1.BadRequestError('Can only pause active appointments');
    }
    // We store the pause timestamp in notes temporarily (simple approach)
    // The pausedDuration will be updated when resumed
    const [updated] = await index_js_1.db
        .update(schema_js_1.appointments)
        .set({
        notes: existing.notes
            ? `${existing.notes}\n[PAUSED:${new Date().toISOString()}]`
            : `[PAUSED:${new Date().toISOString()}]`,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.appointments.id, id))
        .returning();
    return updated;
};
exports.pauseAppointment = pauseAppointment;
/**
 * Resume a paused appointment
 */
const resumeAppointment = async (id, tenantContext) => {
    const existing = await (0, exports.getAppointmentById)(id, tenantContext);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Appointment not found');
    }
    if (existing.status !== 'IN_PROGRESS') {
        throw new errors_js_1.BadRequestError('Can only resume active appointments');
    }
    // Calculate paused duration from the pause timestamp in notes
    let additionalPausedMinutes = 0;
    if (existing.notes) {
        const pauseMatch = existing.notes.match(/\[PAUSED:([^\]]+)\]/);
        if (pauseMatch) {
            const pauseTime = new Date(pauseMatch[1]);
            additionalPausedMinutes = Math.round((Date.now() - pauseTime.getTime()) / 60000);
        }
    }
    // Remove pause marker and update paused duration
    const cleanNotes = existing.notes?.replace(/\n?\[PAUSED:[^\]]+\]/g, '') || null;
    const newPausedDuration = (existing.pausedDuration || 0) + additionalPausedMinutes;
    const [updated] = await index_js_1.db
        .update(schema_js_1.appointments)
        .set({
        pausedDuration: newPausedDuration,
        notes: cleanNotes,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.appointments.id, id))
        .returning();
    return updated;
};
exports.resumeAppointment = resumeAppointment;
/**
 * Complete an active appointment
 */
const completeAppointment = async (id, tenantContext) => {
    const existing = await (0, exports.getAppointmentById)(id, tenantContext);
    if (!existing) {
        throw new errors_js_1.NotFoundError('Appointment not found');
    }
    if (existing.status !== 'IN_PROGRESS') {
        throw new errors_js_1.BadRequestError('Can only complete active appointments');
    }
    const [updated] = await index_js_1.db
        .update(schema_js_1.appointments)
        .set({
        status: 'COMPLETED',
        realEndTime: new Date(),
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.appointments.id, id))
        .returning();
    return updated;
};
exports.completeAppointment = completeAppointment;
//# sourceMappingURL=appointment.service.js.map