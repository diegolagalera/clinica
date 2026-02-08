import type { Response } from 'express';
import { z } from 'zod';
import { eq, and, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clinics, appointmentStockUsage } from '../db/schema.js';
import * as appointmentService from '../services/appointment.service.js';
import * as notificationService from '../services/notification.service.js';
import * as ratingService from '../services/rating.service.js';
import { queueNotification, cancelPendingNotification } from '../services/pending-notification.service.js';
import { success, paginated, parsePaginationParams } from '../utils/response.js';
import { asyncHandler } from '../middleware/index.js';
import { BadRequestError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { AppointmentType, AppointmentStatus } from '../types/enums.js';
import { logger } from '../utils/logger.js';

// Validation schemas
export const createAppointmentSchema = z.object({
    patientId: z.string().uuid(),
    workerId: z.string().uuid().optional(),
    workerIds: z.array(z.string().uuid()).optional(), // Multiple workers
    type: z.nativeEnum(AppointmentType),
    title: z.string().max(255).optional(),
    description: z.string().optional(),
    startTime: z.string().transform(s => new Date(s)),
    endTime: z.string().transform(s => new Date(s)),
    notes: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
    patientId: z.string().uuid().optional(),
    workerId: z.string().uuid().optional(),
    workerIds: z.array(z.string().uuid()).optional(), // Multiple workers
    type: z.nativeEnum(AppointmentType).optional(),
    status: z.nativeEnum(AppointmentStatus).optional(),
    title: z.string().max(255).optional(),
    description: z.string().optional(),
    startTime: z.string().transform(s => new Date(s)).optional(),
    endTime: z.string().transform(s => new Date(s)).optional(),
    notes: z.string().optional(),
});

const dateQuerySchema = z.object({
    start: z.string().optional(),
    end: z.string().optional(),
    workerId: z.string().uuid().optional(),
});

/**
 * GET /appointments
 * List appointments for date range
 */
export const listAppointments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const { start, end, workerId } = dateQuerySchema.parse(req.query);

    // Default to current week if no dates provided
    const startDate = start ? new Date(start) : new Date();
    if (!start) {
        startDate.setDate(startDate.getDate() - startDate.getDay()); // Start of week
        startDate.setHours(0, 0, 0, 0);
    }

    const endDate = end ? new Date(end) : new Date(startDate);
    if (!end) {
        endDate.setDate(endDate.getDate() + 7);
    }

    const data = await appointmentService.getAppointments(
        req.tenantContext.clinicId,
        startDate,
        endDate,
        workerId
    );

    res.json(success(data));
});

/**
 * GET /appointments/today
 * Get today's appointments
 */
export const getTodayAppointments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    // If worker, show only their appointments
    const workerId = req.user.role === 'WORKER' ? req.user.userId : undefined;

    const data = await appointmentService.getTodayAppointments(
        req.tenantContext.clinicId,
        workerId
    );

    res.json(success(data));
});

/**
 * GET /appointments/patient/:patientId
 * Get appointments for a specific patient
 */
export const getPatientAppointments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const params = parsePaginationParams(req.query);

    const { data, total } = await appointmentService.getPatientAppointments(
        patientId!,
        req.tenantContext,
        params
    );

    res.json(success(paginated(data, total, params)));
});

/**
 * GET /appointments/:id
 * Get appointment by ID
 */
export const getAppointment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const appointment = await appointmentService.getAppointmentById(id!, req.tenantContext);

    res.json(success(appointment));
});

/**
 * POST /appointments
 * Create new appointment
 */
export const createAppointment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const input = createAppointmentSchema.parse(req.body);

    // Validate times
    if (input.startTime >= input.endTime) {
        throw new BadRequestError('End time must be after start time');
    }

    const result = await appointmentService.createAppointment({
        ...input,
        clinicId: req.tenantContext.clinicId,
        createdById: req.user.userId,
    });

    if (result.success) {
        // Queue confirmation notification (5 min delay for debouncing)
        queueNotification({
            appointmentId: result.data.id,
            clinicId: req.tenantContext.clinicId,
            patientId: input.patientId,
            type: 'APPOINTMENT_CREATED',
        }).catch(err => logger.error(`Failed to queue appointment notification: ${err.message}`));

        res.status(201).json(success(result.data, 'Appointment created successfully'));
    }
});

/**
 * PUT /appointments/:id
 * Update appointment
 */
export const updateAppointment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = updateAppointmentSchema.parse(req.body);

    // Validate times if both provided
    if (input.startTime && input.endTime && input.startTime >= input.endTime) {
        throw new BadRequestError('End time must be after start time');
    }

    // Get current appointment to check for status changes
    const currentAppointment = await appointmentService.getAppointmentById(id!, req.tenantContext);

    // Validate stock requirement when marking as COMPLETED
    if (input.status === 'COMPLETED' && currentAppointment?.status !== 'COMPLETED') {
        // Check if clinic requires stock on completion
        const [clinic] = await db
            .select({ settings: clinics.settings })
            .from(clinics)
            .where(eq(clinics.id, req.tenantContext.clinicId!));

        const settings = clinic?.settings as { requireStockOnCompletion?: boolean } | null;

        if (settings?.requireStockOnCompletion) {
            // Check if there's any stock usage for this appointment
            const stockUsageCount = await db
                .select({ count: count() })
                .from(appointmentStockUsage)
                .where(and(
                    eq(appointmentStockUsage.appointmentId, id!),
                    eq(appointmentStockUsage.clinicId, req.tenantContext.clinicId!)
                ));

            if (!stockUsageCount[0]?.count || stockUsageCount[0].count === 0) {
                throw new BadRequestError('Debe registrar el stock utilizado antes de completar la cita');
            }
        }
    }

    const result = await appointmentService.updateAppointment(id!, input, req.tenantContext);

    if (result.success && req.tenantContext.clinicId) {
        // Determine which notification to send based on what changed
        let notificationType: 'APPOINTMENT_CREATED' | 'APPOINTMENT_CANCELLED' | null = null;

        // Check if status changed to CANCELLED or NO_SHOW
        if (input.status === 'CANCELLED' || input.status === 'NO_SHOW') {
            // Only send cancellation if it wasn't already cancelled/no-show
            if (currentAppointment?.status !== 'CANCELLED' && currentAppointment?.status !== 'NO_SHOW') {
                notificationType = 'APPOINTMENT_CANCELLED';
            }
        }
        // If time changed on an active appointment (not completed, cancelled, or no-show), send updated confirmation
        // Also, only send if the STATUS is not being changed to COMPLETED
        else if ((input.startTime || input.endTime) &&
            input.status !== 'COMPLETED' &&
            result.data.status !== 'CANCELLED' &&
            result.data.status !== 'NO_SHOW' &&
            result.data.status !== 'COMPLETED') {
            // Check if time actually changed (compare with previous values)
            const timeChanged =
                (input.startTime && new Date(input.startTime).getTime() !== new Date(currentAppointment?.startTime || 0).getTime()) ||
                (input.endTime && new Date(input.endTime).getTime() !== new Date(currentAppointment?.endTime || 0).getTime());

            if (timeChanged) {
                notificationType = 'APPOINTMENT_CREATED';
            }
        }

        // Queue notification if needed (debounced - 5 min delay)
        if (notificationType === 'APPOINTMENT_CREATED') {
            queueNotification({
                appointmentId: result.data.id,
                clinicId: req.tenantContext.clinicId,
                patientId: result.data.patientId,
                type: notificationType,
            }).catch(err => logger.error(`Failed to queue appointment notification: ${err.message}`));
        } else if (notificationType === 'APPOINTMENT_CANCELLED') {
            // Cancellations are sent immediately, also cancel any pending notification
            cancelPendingNotification(result.data.id).catch(err => logger.error(`Failed to cancel pending notification: ${err.message}`));
            notificationService.sendAppointmentNotification({
                appointmentId: result.data.id,
                clinicId: req.tenantContext.clinicId,
                patientId: result.data.patientId,
                type: notificationType,
            }).catch(err => logger.error(`Failed to send cancellation notification: ${err.message}`));
        }

        // Create rating request when appointment is marked as COMPLETED
        if (input.status === 'COMPLETED' && currentAppointment?.status !== 'COMPLETED') {
            ratingService.createRatingRequest(
                result.data.id,
                req.tenantContext.clinicId,
                result.data.patientId
            ).catch(err => logger.error(`Failed to create rating request: ${err.message}`));
        }

        res.json(success(result.data, 'Appointment updated successfully'));
    }
});

/**
 * DELETE /appointments/:id
 * Cancel appointment
 */
export const cancelAppointment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    // Get appointment data before cancelling for email
    const appointment = await appointmentService.getAppointmentById(id!, req.tenantContext);

    await appointmentService.cancelAppointment(id!, req.tenantContext);

    // Send cancellation immediately (no debounce for cancellations)
    // Also cancel any pending notifications for this appointment
    if (appointment && req.tenantContext.clinicId) {
        cancelPendingNotification(id!).catch(err => logger.error(`Failed to cancel pending notification: ${err.message}`));
        notificationService.sendAppointmentNotification({
            appointmentId: id!,
            clinicId: req.tenantContext.clinicId,
            patientId: appointment.patientId,
            type: 'APPOINTMENT_CANCELLED',
        }).catch(err => logger.error(`Failed to send cancellation email: ${err.message}`));
    }

    res.json(success(null, 'Appointment cancelled successfully'));
});

/**
 * GET /appointments/worker/:workerId/schedule
 * Get worker's schedule for a specific date
 */
export const getWorkerSchedule = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const { workerId } = req.params;
    const dateStr = req.query['date'] as string;
    const date = dateStr ? new Date(dateStr) : new Date();

    const schedule = await appointmentService.getWorkerSchedule(
        workerId!,
        req.tenantContext.clinicId,
        date
    );

    res.json(success(schedule));
});

// ============================================================================
// ACTIVE APPOINTMENT MANAGEMENT
// ============================================================================

/**
 * GET /appointments/active
 * Get all active (IN_PROGRESS) appointments for the current user
 */
export const getActiveAppointments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const activeAppointments = await appointmentService.getActiveAppointments(
        req.tenantContext.clinicId,
        req.user.userId
    );

    res.json(success(activeAppointments));
});

/**
 * POST /appointments/:id/start
 * Start an appointment (set status to IN_PROGRESS)
 */
export const startAppointment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const { id } = req.params;

    const result = await appointmentService.startAppointment(
        id!,
        req.user.userId,
        req.tenantContext
    );

    res.json(success(result, 'Cita iniciada'));
});

/**
 * POST /appointments/:id/pause
 * Pause an active appointment
 */
export const pauseAppointment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const result = await appointmentService.pauseAppointment(id!, req.tenantContext);

    res.json(success(result, 'Cita pausada'));
});

/**
 * POST /appointments/:id/resume
 * Resume a paused appointment
 */
export const resumeAppointment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const result = await appointmentService.resumeAppointment(id!, req.tenantContext);

    res.json(success(result, 'Cita reanudada'));
});

/**
 * POST /appointments/:id/complete
 * Complete an active appointment (validates stock requirement)
 */
export const completeAppointment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const { id } = req.params;

    // Check if clinic requires stock on completion
    const [clinic] = await db
        .select({ settings: clinics.settings })
        .from(clinics)
        .where(eq(clinics.id, req.tenantContext.clinicId));

    if (clinic?.settings && typeof clinic.settings === 'object' &&
        'requireStockOnCompletion' in clinic.settings &&
        clinic.settings.requireStockOnCompletion === true) {
        // Check if any stock has been used
        const usageCount = await db
            .select({ count: count() })
            .from(appointmentStockUsage)
            .where(and(
                eq(appointmentStockUsage.appointmentId, id!),
                eq(appointmentStockUsage.clinicId, req.tenantContext.clinicId)
            ));

        if (!usageCount?.[0]?.count || usageCount[0].count === 0) {
            throw new BadRequestError('Debe registrar el stock utilizado antes de completar la cita');
        }
    }

    const result = await appointmentService.completeAppointment(id!, req.tenantContext);

    // Create rating request after completion
    if (result) {
        ratingService.createRatingRequest(
            id!,
            req.tenantContext.clinicId,
            result.patientId
        ).catch((err: Error) => logger.error(`Failed to create rating request: ${err.message}`));
    }

    res.json(success(result, 'Cita completada'));
});

// ============================================================================
// ADMIN: REAL TIME MANAGEMENT
// ============================================================================

const updateRealTimeSchema = z.object({
    realStartTime: z.string().transform(s => new Date(s)).optional(),
    realEndTime: z.string().transform(s => new Date(s)).optional(),
    pausedDuration: z.number().min(0).optional(),
});

/**
 * PUT /appointments/:id/real-time
 * Update real time fields (Admin only)
 */
export const updateRealTime = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Only ADMIN can update real time
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
        throw new BadRequestError('Solo los administradores pueden editar el tiempo real');
    }

    const { id } = req.params;
    const input = updateRealTimeSchema.parse(req.body);

    const result = await appointmentService.updateRealTime(
        id!,
        input,
        req.user.userId,
        req.tenantContext
    );

    res.json(success(result, 'Tiempo real actualizado'));
});

/**
 * POST /appointments/:id/reset-time
 * Reset real time fields and revert status to SCHEDULED (Admin only)
 */
export const resetRealTime = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Only ADMIN can reset time
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
        throw new BadRequestError('Solo los administradores pueden resetear el tiempo real');
    }

    const { id } = req.params;

    const result = await appointmentService.resetRealTime(
        id!,
        req.user.userId,
        req.tenantContext
    );

    res.json(success(result, 'Tiempo real reseteado. La cita vuelve a estado Programada'));
});

/**
 * POST /appointments/:id/cancel-active
 * Cancel an active (IN_PROGRESS) appointment
 * Clears real time data and sets status to CANCELLED
 */
export const cancelActiveAppointment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const result = await appointmentService.cancelActiveAppointment(
        id!,
        req.user.userId,
        req.tenantContext
    );

    // Cancel any pending notifications
    if (result && req.tenantContext.clinicId) {
        cancelPendingNotification(id!).catch(err => logger.error(`Failed to cancel pending notification: ${err.message}`));
        notificationService.sendAppointmentNotification({
            appointmentId: id!,
            clinicId: req.tenantContext.clinicId,
            patientId: result.patientId,
            type: 'APPOINTMENT_CANCELLED',
        }).catch(err => logger.error(`Failed to send cancellation notification: ${err.message}`));
    }

    res.json(success(result, 'Cita cancelada'));
});
