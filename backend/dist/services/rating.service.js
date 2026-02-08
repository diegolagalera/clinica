"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendRatingEmailNow = exports.getClinicRatingRequests = exports.getRecentRatings = exports.getWorkerRatingStats = exports.getClinicRatingStats = exports.markExpiredRequests = exports.markRequestAsSent = exports.getPendingRequests = exports.submitRating = exports.validateToken = exports.createRatingRequest = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const nanoid_1 = require("nanoid");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const logger_js_1 = require("../utils/logger.js");
// Constants
const HOURS_DELAY = 24; // Hours after completion to send email
const DAYS_VALID = 7; // Days the token is valid
/**
 * Create a rating request when an appointment is marked as COMPLETED
 */
const createRatingRequest = async (appointmentId, clinicId, patientId) => {
    try {
        // Check if patient has an email
        const patient = await index_js_1.db.query.patients.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_js_1.patients.id, patientId),
        });
        if (!patient?.email) {
            logger_js_1.logger.info(`Rating request skipped for appointment ${appointmentId}: Patient has no email`);
            // Create a SKIPPED record for tracking
            const [request] = await index_js_1.db
                .insert(schema_js_1.ratingRequests)
                .values({
                clinicId,
                appointmentId,
                patientId,
                token: (0, nanoid_1.nanoid)(64),
                status: 'SKIPPED',
                scheduledFor: new Date(),
                expiresAt: new Date(),
            })
                .returning();
            return { success: true, requestId: request.id, skipped: true };
        }
        // Check if a request already exists for this appointment
        const existingRequest = await index_js_1.db.query.ratingRequests.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_js_1.ratingRequests.appointmentId, appointmentId),
        });
        if (existingRequest) {
            logger_js_1.logger.info(`Rating request already exists for appointment ${appointmentId}`);
            return { success: true, requestId: existingRequest.id };
        }
        // Calculate scheduled time (now + 24h)
        const now = new Date();
        const scheduledFor = new Date(now);
        scheduledFor.setHours(scheduledFor.getHours() + HOURS_DELAY);
        // Calculate expiration time (scheduledFor + 7 days)
        const expiresAt = new Date(scheduledFor);
        expiresAt.setDate(expiresAt.getDate() + DAYS_VALID);
        // Generate secure token
        const token = (0, nanoid_1.nanoid)(64);
        // Create the rating request
        const [request] = await index_js_1.db
            .insert(schema_js_1.ratingRequests)
            .values({
            clinicId,
            appointmentId,
            patientId,
            token,
            status: 'PENDING',
            scheduledFor,
            expiresAt,
        })
            .returning();
        logger_js_1.logger.info(`Created rating request ${request.id} for appointment ${appointmentId}, scheduled for ${scheduledFor.toISOString()}`);
        return { success: true, requestId: request.id };
    }
    catch (error) {
        logger_js_1.logger.error(`Failed to create rating request: ${error.message}`);
        return { success: false, error: error.message };
    }
};
exports.createRatingRequest = createRatingRequest;
/**
 * Validate a rating token and return the request data
 */
const validateToken = async (token) => {
    try {
        const request = await index_js_1.db.query.ratingRequests.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_js_1.ratingRequests.token, token),
            with: {
                clinic: true,
            },
        });
        if (!request) {
            return { valid: false, status: 'not_found' };
        }
        // Check if already completed
        if (request.status === 'COMPLETED') {
            return { valid: false, status: 'completed', request };
        }
        // Check if expired
        const now = new Date();
        if (now > request.expiresAt) {
            // Mark as expired if not already
            if (request.status !== 'EXPIRED') {
                await index_js_1.db
                    .update(schema_js_1.ratingRequests)
                    .set({ status: 'EXPIRED' })
                    .where((0, drizzle_orm_1.eq)(schema_js_1.ratingRequests.id, request.id));
            }
            return { valid: false, status: 'expired', request };
        }
        // Check if still pending (email not yet sent)
        if (request.status === 'PENDING' && now < request.scheduledFor) {
            return { valid: false, status: 'pending', request };
        }
        return {
            valid: true,
            status: 'valid',
            request,
            clinicName: request.clinic?.name || 'Clínica',
        };
    }
    catch (error) {
        logger_js_1.logger.error(`Failed to validate token: ${error.message}`);
        return { valid: false, status: 'not_found' };
    }
};
exports.validateToken = validateToken;
/**
 * Submit a rating for a visit
 */
const submitRating = async (token, rating, comment) => {
    try {
        // Validate the token first
        const validation = await (0, exports.validateToken)(token);
        if (!validation.valid || !validation.request) {
            return { success: false, error: validation.status || 'Invalid token' };
        }
        const request = validation.request;
        // Validate rating is 1-5
        if (rating < 1 || rating > 5) {
            return { success: false, error: 'Rating must be between 1 and 5' };
        }
        // Start a transaction
        return await index_js_1.db.transaction(async (tx) => {
            // Create the visit rating
            const [visitRating] = await tx
                .insert(schema_js_1.visitRatings)
                .values({
                clinicId: request.clinicId,
                appointmentId: request.appointmentId,
                ratingRequestId: request.id,
                patientId: request.patientId,
                rating,
                comment: comment?.trim() || null,
            })
                .returning();
            // Get all workers assigned to this appointment
            const assignedWorkers = await tx.query.appointmentWorkers.findMany({
                where: (0, drizzle_orm_1.eq)(schema_js_1.appointmentWorkers.appointmentId, request.appointmentId),
            });
            // Also check the legacy workerId field on the appointment
            const appointment = await tx.query.appointments.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_js_1.appointments.id, request.appointmentId),
            });
            // Collect all worker IDs (both from junction table and legacy field)
            const workerIds = new Set();
            assignedWorkers.forEach((aw) => workerIds.add(aw.userId));
            if (appointment?.workerId) {
                workerIds.add(appointment.workerId);
            }
            // Create worker ratings for each assigned worker
            if (workerIds.size > 0) {
                const workerRatingValues = Array.from(workerIds).map((workerId) => ({
                    visitRatingId: visitRating.id,
                    workerId,
                    appointmentId: request.appointmentId,
                    rating,
                }));
                await tx.insert(schema_js_1.workerRatings).values(workerRatingValues);
                logger_js_1.logger.info(`Created ${workerIds.size} worker ratings for visit rating ${visitRating.id}`);
            }
            // Mark the request as completed
            await tx
                .update(schema_js_1.ratingRequests)
                .set({
                status: 'COMPLETED',
                completedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_js_1.ratingRequests.id, request.id));
            logger_js_1.logger.info(`Rating ${rating}/5 submitted for appointment ${request.appointmentId}`);
            return { success: true };
        });
    }
    catch (error) {
        logger_js_1.logger.error(`Failed to submit rating: ${error.message}`);
        return { success: false, error: error.message };
    }
};
exports.submitRating = submitRating;
/**
 * Get pending rating requests that are ready to be sent
 */
const getPendingRequests = async () => {
    const now = new Date();
    return await index_js_1.db.query.ratingRequests.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.ratingRequests.status, 'PENDING'), (0, drizzle_orm_1.lte)(schema_js_1.ratingRequests.scheduledFor, now)),
        with: {
            patient: true,
            appointment: true,
            clinic: true,
        },
    });
};
exports.getPendingRequests = getPendingRequests;
/**
 * Mark a request as sent
 */
const markRequestAsSent = async (requestId) => {
    await index_js_1.db
        .update(schema_js_1.ratingRequests)
        .set({
        status: 'SENT',
        sentAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.ratingRequests.id, requestId));
};
exports.markRequestAsSent = markRequestAsSent;
/**
 * Mark expired requests
 */
const markExpiredRequests = async () => {
    const now = new Date();
    const result = await index_js_1.db
        .update(schema_js_1.ratingRequests)
        .set({ status: 'EXPIRED' })
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.ratingRequests.status, 'SENT'), (0, drizzle_orm_1.lte)(schema_js_1.ratingRequests.expiresAt, now)));
    return 0; // Drizzle doesn't return affected rows count easily
};
exports.markExpiredRequests = markExpiredRequests;
/**
 * Get rating statistics for a clinic
 */
const getClinicRatingStats = async (clinicId) => {
    const ratings = await index_js_1.db.query.visitRatings.findMany({
        where: (0, drizzle_orm_1.eq)(schema_js_1.visitRatings.clinicId, clinicId),
    });
    if (ratings.length === 0) {
        return {
            totalRatings: 0,
            averageRating: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        };
    }
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const rating of ratings) {
        sum += rating.rating;
        distribution[rating.rating]++;
    }
    return {
        totalRatings: ratings.length,
        averageRating: Math.round((sum / ratings.length) * 10) / 10,
        distribution,
    };
};
exports.getClinicRatingStats = getClinicRatingStats;
/**
 * Get rating statistics for a specific worker
 */
const getWorkerRatingStats = async (workerId, clinicId) => {
    const whereClause = clinicId
        ? (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.workerRatings.workerId, workerId))
        : (0, drizzle_orm_1.eq)(schema_js_1.workerRatings.workerId, workerId);
    const ratings = await index_js_1.db.query.workerRatings.findMany({
        where: (0, drizzle_orm_1.eq)(schema_js_1.workerRatings.workerId, workerId),
        with: {
            visitRating: true,
        },
    });
    // Filter by clinic if specified
    const filteredRatings = clinicId
        ? ratings.filter((r) => r.visitRating?.clinicId === clinicId)
        : ratings;
    if (filteredRatings.length === 0) {
        return {
            totalRatings: 0,
            averageRating: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        };
    }
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const rating of filteredRatings) {
        sum += rating.rating;
        distribution[rating.rating]++;
    }
    return {
        totalRatings: filteredRatings.length,
        averageRating: Math.round((sum / filteredRatings.length) * 10) / 10,
        distribution,
    };
};
exports.getWorkerRatingStats = getWorkerRatingStats;
/**
 * Get recent ratings for a clinic with comments
 */
const getRecentRatings = async (clinicId, limit = 10) => {
    return await index_js_1.db.query.visitRatings.findMany({
        where: (0, drizzle_orm_1.eq)(schema_js_1.visitRatings.clinicId, clinicId),
        with: {
            appointment: {
                with: {
                    appointmentWorkers: {
                        with: {
                            user: true,
                        },
                    },
                },
            },
        },
        orderBy: [(0, drizzle_orm_1.desc)(schema_js_1.visitRatings.createdAt)],
        limit,
    });
};
exports.getRecentRatings = getRecentRatings;
/**
 * Get all rating requests for a clinic
 */
const getClinicRatingRequests = async (clinicId) => {
    return await index_js_1.db.query.ratingRequests.findMany({
        where: (0, drizzle_orm_1.eq)(schema_js_1.ratingRequests.clinicId, clinicId),
        with: {
            patient: true,
            appointment: true,
        },
        orderBy: [(0, drizzle_orm_1.desc)(schema_js_1.ratingRequests.createdAt)],
        limit: 100,
    });
};
exports.getClinicRatingRequests = getClinicRatingRequests;
/**
 * Send a rating request email immediately (for testing)
 * Creates the request if it doesn't exist, or uses existing one
 */
const sendRatingEmailNow = async (appointmentId, clinicId) => {
    try {
        // Get the appointment
        const appointment = await index_js_1.db.query.appointments.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointments.id, appointmentId), (0, drizzle_orm_1.eq)(schema_js_1.appointments.clinicId, clinicId)),
            with: {
                patient: true,
                clinic: true,
            },
        });
        if (!appointment) {
            return { success: false, error: 'Cita no encontrada' };
        }
        if (!appointment.patient?.email) {
            return { success: false, error: 'El paciente no tiene email configurado' };
        }
        // Check for existing request or create one
        let request = await index_js_1.db.query.ratingRequests.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_js_1.ratingRequests.appointmentId, appointmentId),
        });
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        if (!request) {
            // Create a new request that's immediately ready
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + DAYS_VALID);
            const token = (0, nanoid_1.nanoid)(64);
            const [newRequest] = await index_js_1.db
                .insert(schema_js_1.ratingRequests)
                .values({
                clinicId,
                appointmentId,
                patientId: appointment.patientId,
                token,
                status: 'SENT', // Mark as sent immediately
                scheduledFor: now,
                expiresAt,
                sentAt: now,
            })
                .returning();
            request = newRequest;
        }
        else if (request.status === 'COMPLETED') {
            return { success: false, error: 'Esta cita ya fue valorada' };
        }
        else if (request.status === 'EXPIRED') {
            return { success: false, error: 'El enlace de valoración ha expirado' };
        }
        // Import and use email services
        const { getEmailSettings, sendEmail } = await import('./email.service.js');
        const { getActiveTemplate, renderBlocksToHtml, replaceVariables } = await import('./email-template.service.js');
        // Check if clinic has email configured
        const emailSettings = await getEmailSettings(clinicId);
        if (!emailSettings?.isEnabled || !emailSettings?.isConfigured) {
            // Return the URL even if email not configured - for testing
            const ratingUrl = `${frontendUrl}/rate/${request.token}`;
            return {
                success: true,
                ratingUrl,
                token: request.token,
                error: 'Email no configurado, pero puedes usar este enlace directamente'
            };
        }
        // Generate rating URL
        const ratingUrl = `${frontendUrl}/rate/${request.token}`;
        // Format appointment date
        const appointmentDate = new Date(appointment.startTime).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        // Try to get custom template, otherwise use default
        const template = await getActiveTemplate(clinicId, 'VISIT_RATING_REQUEST');
        let subject;
        let htmlContent;
        if (template) {
            const variables = {
                patient_name: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
                clinic_name: appointment.clinic.name,
                clinic_phone: appointment.clinic.phone || '',
                appointment_date: appointmentDate,
                rating_url: ratingUrl,
            };
            subject = replaceVariables(template.subject, variables);
            htmlContent = replaceVariables(renderBlocksToHtml(template.blocks), variables);
        }
        else {
            // Use default email
            subject = `¿Cómo fue tu visita en ${appointment.clinic.name}?`;
            htmlContent = generateDefaultEmail({
                patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
                clinicName: appointment.clinic.name,
                appointmentDate,
                ratingUrl,
            });
        }
        // Send the email
        const result = await sendEmail(clinicId, {
            to: appointment.patient.email,
            subject,
            html: htmlContent,
        });
        if (result.success) {
            // Update status to SENT if not already
            if (request.status === 'PENDING') {
                await index_js_1.db
                    .update(schema_js_1.ratingRequests)
                    .set({ status: 'SENT', sentAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(schema_js_1.ratingRequests.id, request.id));
            }
            logger_js_1.logger.info(`Test rating email sent to ${appointment.patient.email}`);
            return { success: true, ratingUrl, token: request.token };
        }
        else {
            return { success: false, error: result.error || 'Error al enviar el email' };
        }
    }
    catch (error) {
        logger_js_1.logger.error(`Error sending test rating email: ${error.message}`);
        return { success: false, error: error.message };
    }
};
exports.sendRatingEmailNow = sendRatingEmailNow;
// Helper function for default email
const generateDefaultEmail = (data) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Valora tu visita</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px;">⭐⭐⭐⭐⭐</div>
                <h1 style="color: #1a1a1a; font-size: 24px; margin: 16px 0 8px;">¡Hola, ${data.patientName}!</h1>
            </div>
            <p>Gracias por visitarnos en <strong>${data.clinicName}</strong> el ${data.appointmentDate}.</p>
            <p>Tu opinión es muy importante para nosotros. ¿Podrías dedicarnos un momento para valorar tu experiencia?</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${data.ratingUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Valorar mi visita</a>
            </div>
            <p style="font-size: 14px; color: #888;">Este enlace es válido durante 7 días y solo puede usarse una vez. Tu valoración es completamente anónima.</p>
            <div style="text-align: center; font-size: 12px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p>Este correo fue enviado por ${data.clinicName}</p>
            </div>
        </div>
    </body>
    </html>
    `;
};
//# sourceMappingURL=rating.service.js.map