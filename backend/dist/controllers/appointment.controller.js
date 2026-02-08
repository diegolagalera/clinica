"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeAppointment = exports.resumeAppointment = exports.pauseAppointment = exports.startAppointment = exports.getActiveAppointments = exports.getWorkerSchedule = exports.cancelAppointment = exports.updateAppointment = exports.createAppointment = exports.getAppointment = exports.getPatientAppointments = exports.getTodayAppointments = exports.listAppointments = exports.updateAppointmentSchema = exports.createAppointmentSchema = void 0;
const zod_1 = require("zod");
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const appointmentService = __importStar(require("../services/appointment.service.js"));
const notificationService = __importStar(require("../services/notification.service.js"));
const ratingService = __importStar(require("../services/rating.service.js"));
const pending_notification_service_js_1 = require("../services/pending-notification.service.js");
const response_js_1 = require("../utils/response.js");
const index_js_2 = require("../middleware/index.js");
const errors_js_1 = require("../utils/errors.js");
const enums_js_1 = require("../types/enums.js");
const logger_js_1 = require("../utils/logger.js");
// Validation schemas
exports.createAppointmentSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid(),
    workerId: zod_1.z.string().uuid().optional(),
    workerIds: zod_1.z.array(zod_1.z.string().uuid()).optional(), // Multiple workers
    type: zod_1.z.nativeEnum(enums_js_1.AppointmentType),
    title: zod_1.z.string().max(255).optional(),
    description: zod_1.z.string().optional(),
    startTime: zod_1.z.string().transform(s => new Date(s)),
    endTime: zod_1.z.string().transform(s => new Date(s)),
    notes: zod_1.z.string().optional(),
});
exports.updateAppointmentSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid().optional(),
    workerId: zod_1.z.string().uuid().optional(),
    workerIds: zod_1.z.array(zod_1.z.string().uuid()).optional(), // Multiple workers
    type: zod_1.z.nativeEnum(enums_js_1.AppointmentType).optional(),
    status: zod_1.z.nativeEnum(enums_js_1.AppointmentStatus).optional(),
    title: zod_1.z.string().max(255).optional(),
    description: zod_1.z.string().optional(),
    startTime: zod_1.z.string().transform(s => new Date(s)).optional(),
    endTime: zod_1.z.string().transform(s => new Date(s)).optional(),
    notes: zod_1.z.string().optional(),
});
const dateQuerySchema = zod_1.z.object({
    start: zod_1.z.string().optional(),
    end: zod_1.z.string().optional(),
    workerId: zod_1.z.string().uuid().optional(),
});
/**
 * GET /appointments
 * List appointments for date range
 */
exports.listAppointments = (0, index_js_2.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
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
    const data = await appointmentService.getAppointments(req.tenantContext.clinicId, startDate, endDate, workerId);
    res.json((0, response_js_1.success)(data));
});
/**
 * GET /appointments/today
 * Get today's appointments
 */
exports.getTodayAppointments = (0, index_js_2.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    // If worker, show only their appointments
    const workerId = req.user.role === 'WORKER' ? req.user.userId : undefined;
    const data = await appointmentService.getTodayAppointments(req.tenantContext.clinicId, workerId);
    res.json((0, response_js_1.success)(data));
});
/**
 * GET /appointments/patient/:patientId
 * Get appointments for a specific patient
 */
exports.getPatientAppointments = (0, index_js_2.asyncHandler)(async (req, res) => {
    const { patientId } = req.params;
    const params = (0, response_js_1.parsePaginationParams)(req.query);
    const { data, total } = await appointmentService.getPatientAppointments(patientId, req.tenantContext, params);
    res.json((0, response_js_1.success)((0, response_js_1.paginated)(data, total, params)));
});
/**
 * GET /appointments/:id
 * Get appointment by ID
 */
exports.getAppointment = (0, index_js_2.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const appointment = await appointmentService.getAppointmentById(id, req.tenantContext);
    res.json((0, response_js_1.success)(appointment));
});
/**
 * POST /appointments
 * Create new appointment
 */
exports.createAppointment = (0, index_js_2.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const input = exports.createAppointmentSchema.parse(req.body);
    // Validate times
    if (input.startTime >= input.endTime) {
        throw new errors_js_1.BadRequestError('End time must be after start time');
    }
    const result = await appointmentService.createAppointment({
        ...input,
        clinicId: req.tenantContext.clinicId,
        createdById: req.user.userId,
    });
    if (result.success) {
        // Queue confirmation notification (5 min delay for debouncing)
        (0, pending_notification_service_js_1.queueNotification)({
            appointmentId: result.data.id,
            clinicId: req.tenantContext.clinicId,
            patientId: input.patientId,
            type: 'APPOINTMENT_CREATED',
        }).catch(err => logger_js_1.logger.error(`Failed to queue appointment notification: ${err.message}`));
        res.status(201).json((0, response_js_1.success)(result.data, 'Appointment created successfully'));
    }
});
/**
 * PUT /appointments/:id
 * Update appointment
 */
exports.updateAppointment = (0, index_js_2.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const input = exports.updateAppointmentSchema.parse(req.body);
    // Validate times if both provided
    if (input.startTime && input.endTime && input.startTime >= input.endTime) {
        throw new errors_js_1.BadRequestError('End time must be after start time');
    }
    // Get current appointment to check for status changes
    const currentAppointment = await appointmentService.getAppointmentById(id, req.tenantContext);
    // Validate stock requirement when marking as COMPLETED
    if (input.status === 'COMPLETED' && currentAppointment?.status !== 'COMPLETED') {
        // Check if clinic requires stock on completion
        const [clinic] = await index_js_1.db
            .select({ settings: schema_js_1.clinics.settings })
            .from(schema_js_1.clinics)
            .where((0, drizzle_orm_1.eq)(schema_js_1.clinics.id, req.tenantContext.clinicId));
        const settings = clinic?.settings;
        if (settings?.requireStockOnCompletion) {
            // Check if there's any stock usage for this appointment
            const stockUsageCount = await index_js_1.db
                .select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_js_1.appointmentStockUsage)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointmentStockUsage.appointmentId, id), (0, drizzle_orm_1.eq)(schema_js_1.appointmentStockUsage.clinicId, req.tenantContext.clinicId)));
            if (!stockUsageCount[0]?.count || stockUsageCount[0].count === 0) {
                throw new errors_js_1.BadRequestError('Debe registrar el stock utilizado antes de completar la cita');
            }
        }
    }
    const result = await appointmentService.updateAppointment(id, input, req.tenantContext);
    if (result.success && req.tenantContext.clinicId) {
        // Determine which notification to send based on what changed
        let notificationType = null;
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
            const timeChanged = (input.startTime && new Date(input.startTime).getTime() !== new Date(currentAppointment?.startTime || 0).getTime()) ||
                (input.endTime && new Date(input.endTime).getTime() !== new Date(currentAppointment?.endTime || 0).getTime());
            if (timeChanged) {
                notificationType = 'APPOINTMENT_CREATED';
            }
        }
        // Queue notification if needed (debounced - 5 min delay)
        if (notificationType === 'APPOINTMENT_CREATED') {
            (0, pending_notification_service_js_1.queueNotification)({
                appointmentId: result.data.id,
                clinicId: req.tenantContext.clinicId,
                patientId: result.data.patientId,
                type: notificationType,
            }).catch(err => logger_js_1.logger.error(`Failed to queue appointment notification: ${err.message}`));
        }
        else if (notificationType === 'APPOINTMENT_CANCELLED') {
            // Cancellations are sent immediately, also cancel any pending notification
            (0, pending_notification_service_js_1.cancelPendingNotification)(result.data.id).catch(err => logger_js_1.logger.error(`Failed to cancel pending notification: ${err.message}`));
            notificationService.sendAppointmentNotification({
                appointmentId: result.data.id,
                clinicId: req.tenantContext.clinicId,
                patientId: result.data.patientId,
                type: notificationType,
            }).catch(err => logger_js_1.logger.error(`Failed to send cancellation notification: ${err.message}`));
        }
        // Create rating request when appointment is marked as COMPLETED
        if (input.status === 'COMPLETED' && currentAppointment?.status !== 'COMPLETED') {
            ratingService.createRatingRequest(result.data.id, req.tenantContext.clinicId, result.data.patientId).catch(err => logger_js_1.logger.error(`Failed to create rating request: ${err.message}`));
        }
        res.json((0, response_js_1.success)(result.data, 'Appointment updated successfully'));
    }
});
/**
 * DELETE /appointments/:id
 * Cancel appointment
 */
exports.cancelAppointment = (0, index_js_2.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    // Get appointment data before cancelling for email
    const appointment = await appointmentService.getAppointmentById(id, req.tenantContext);
    await appointmentService.cancelAppointment(id, req.tenantContext);
    // Send cancellation immediately (no debounce for cancellations)
    // Also cancel any pending notifications for this appointment
    if (appointment && req.tenantContext.clinicId) {
        (0, pending_notification_service_js_1.cancelPendingNotification)(id).catch(err => logger_js_1.logger.error(`Failed to cancel pending notification: ${err.message}`));
        notificationService.sendAppointmentNotification({
            appointmentId: id,
            clinicId: req.tenantContext.clinicId,
            patientId: appointment.patientId,
            type: 'APPOINTMENT_CANCELLED',
        }).catch(err => logger_js_1.logger.error(`Failed to send cancellation email: ${err.message}`));
    }
    res.json((0, response_js_1.success)(null, 'Appointment cancelled successfully'));
});
/**
 * GET /appointments/worker/:workerId/schedule
 * Get worker's schedule for a specific date
 */
exports.getWorkerSchedule = (0, index_js_2.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const { workerId } = req.params;
    const dateStr = req.query['date'];
    const date = dateStr ? new Date(dateStr) : new Date();
    const schedule = await appointmentService.getWorkerSchedule(workerId, req.tenantContext.clinicId, date);
    res.json((0, response_js_1.success)(schedule));
});
// ============================================================================
// ACTIVE APPOINTMENT MANAGEMENT
// ============================================================================
/**
 * GET /appointments/active
 * Get all active (IN_PROGRESS) appointments for the current user
 */
exports.getActiveAppointments = (0, index_js_2.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const activeAppointments = await appointmentService.getActiveAppointments(req.tenantContext.clinicId, req.user.userId);
    res.json((0, response_js_1.success)(activeAppointments));
});
/**
 * POST /appointments/:id/start
 * Start an appointment (set status to IN_PROGRESS)
 */
exports.startAppointment = (0, index_js_2.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const { id } = req.params;
    const result = await appointmentService.startAppointment(id, req.user.userId, req.tenantContext);
    res.json((0, response_js_1.success)(result, 'Cita iniciada'));
});
/**
 * POST /appointments/:id/pause
 * Pause an active appointment
 */
exports.pauseAppointment = (0, index_js_2.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const result = await appointmentService.pauseAppointment(id, req.tenantContext);
    res.json((0, response_js_1.success)(result, 'Cita pausada'));
});
/**
 * POST /appointments/:id/resume
 * Resume a paused appointment
 */
exports.resumeAppointment = (0, index_js_2.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const result = await appointmentService.resumeAppointment(id, req.tenantContext);
    res.json((0, response_js_1.success)(result, 'Cita reanudada'));
});
/**
 * POST /appointments/:id/complete
 * Complete an active appointment (validates stock requirement)
 */
exports.completeAppointment = (0, index_js_2.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const { id } = req.params;
    // Check if clinic requires stock on completion
    const [clinic] = await index_js_1.db
        .select({ settings: schema_js_1.clinics.settings })
        .from(schema_js_1.clinics)
        .where((0, drizzle_orm_1.eq)(schema_js_1.clinics.id, req.tenantContext.clinicId));
    if (clinic?.settings && typeof clinic.settings === 'object' &&
        'requireStockOnCompletion' in clinic.settings &&
        clinic.settings.requireStockOnCompletion === true) {
        // Check if any stock has been used
        const usageCount = await index_js_1.db
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_js_1.appointmentStockUsage)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointmentStockUsage.appointmentId, id), (0, drizzle_orm_1.eq)(schema_js_1.appointmentStockUsage.clinicId, req.tenantContext.clinicId)));
        if (!usageCount?.[0]?.count || usageCount[0].count === 0) {
            throw new errors_js_1.BadRequestError('Debe registrar el stock utilizado antes de completar la cita');
        }
    }
    const result = await appointmentService.completeAppointment(id, req.tenantContext);
    // Create rating request after completion
    if (result) {
        ratingService.createRatingRequest(id, req.tenantContext.clinicId, result.patientId).catch((err) => logger_js_1.logger.error(`Failed to create rating request: ${err.message}`));
    }
    res.json((0, response_js_1.success)(result, 'Cita completada'));
});
//# sourceMappingURL=appointment.controller.js.map