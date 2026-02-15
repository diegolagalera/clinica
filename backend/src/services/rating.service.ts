import { eq, and, lte, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import {
    ratingRequests,
    visitRatings,
    workerRatings,
    appointments,
    patients,
    appointmentWorkers,
    clinics,
} from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

// Constants
const HOURS_DELAY = 24; // Hours after completion to send email
const DAYS_VALID = 7; // Days the token is valid

/**
 * Create a rating request when an appointment is marked as COMPLETED
 */
export const createRatingRequest = async (db: Database,
    appointmentId: string,
    clinicId: string,
    patientId: string
): Promise<{ success: boolean; requestId?: string; skipped?: boolean; error?: string }> => {
    try {
        // Check if patient has an email
        const patient = await db.query.patients.findFirst({
            where: eq(patients.id, patientId),
        });

        if (!patient?.email) {
            logger.info(`Rating request skipped for appointment ${appointmentId}: Patient has no email`);
            // Create a SKIPPED record for tracking
            const [request] = await db
                .insert(ratingRequests)
                .values({
                    clinicId,
                    appointmentId,
                    patientId,
                    token: nanoid(64),
                    status: 'SKIPPED',
                    scheduledFor: new Date(),
                    expiresAt: new Date(),
                })
                .returning();
            return { success: true, requestId: request!.id, skipped: true };
        }

        // Check if a request already exists for this appointment
        const existingRequest = await db.query.ratingRequests.findFirst({
            where: eq(ratingRequests.appointmentId, appointmentId),
        });

        if (existingRequest) {
            logger.info(`Rating request already exists for appointment ${appointmentId}`);
            return { success: true, requestId: existingRequest.id };
        }

        // Get appointment to use its endTime for scheduling
        const appointment = await db.query.appointments.findFirst({
            where: eq(appointments.id, appointmentId),
        });

        // Calculate scheduled time based on appointment end time (not now)
        // This ensures the email arrives ~24h after the actual visit
        const now = new Date();
        const appointmentEnd = appointment?.endTime ? new Date(appointment.endTime) : now;
        const scheduledFor = new Date(appointmentEnd);
        scheduledFor.setHours(scheduledFor.getHours() + HOURS_DELAY);

        // If scheduledFor is already in the past (admin completed late), send in 1h
        if (scheduledFor.getTime() < now.getTime()) {
            scheduledFor.setTime(now.getTime() + 60 * 60 * 1000); // now + 1h
        }

        // Calculate expiration time (scheduledFor + 7 days)
        const expiresAt = new Date(scheduledFor);
        expiresAt.setDate(expiresAt.getDate() + DAYS_VALID);

        // Generate secure token
        const token = nanoid(64);

        // Create the rating request
        const [request] = await db
            .insert(ratingRequests)
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

        logger.info(`Created rating request ${request!.id} for appointment ${appointmentId}, scheduled for ${scheduledFor.toISOString()}`);

        return { success: true, requestId: request!.id };
    } catch (error: any) {
        logger.error(`Failed to create rating request: ${error.message}`);
        return { success: false, error: error.message };
    }
};

/**
 * Validate a rating token and return the request data
 */
export const validateToken = async (db: Database,
    token: string
): Promise<{
    valid: boolean;
    status?: 'pending' | 'valid' | 'completed' | 'expired' | 'not_found';
    request?: typeof ratingRequests.$inferSelect;
    clinicName?: string;
}> => {
    try {
        const request = await db.query.ratingRequests.findFirst({
            where: eq(ratingRequests.token, token),
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
                await db
                    .update(ratingRequests)
                    .set({ status: 'EXPIRED' })
                    .where(eq(ratingRequests.id, request.id));
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
            clinicName: (request as any).clinic?.name || 'Clínica',
        };
    } catch (error: any) {
        logger.error(`Failed to validate token: ${error.message}`);
        return { valid: false, status: 'not_found' };
    }
};

/**
 * Submit a rating for a visit
 */
export const submitRating = async (db: Database,
    token: string,
    rating: number,
    comment?: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        // Validate the token first
        const validation = await validateToken(db, token);
        if (!validation.valid || !validation.request) {
            return { success: false, error: validation.status || 'Invalid token' };
        }

        const request = validation.request;

        // Validate rating is 1-5
        if (rating < 1 || rating > 5) {
            return { success: false, error: 'Rating must be between 1 and 5' };
        }

        // Start a transaction
        return await db.transaction(async (tx) => {
            // Create the visit rating
            const [visitRating] = await tx
                .insert(visitRatings)
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
                where: eq(appointmentWorkers.appointmentId, request.appointmentId),
            });

            // Also check the legacy workerId field on the appointment
            const appointment = await tx.query.appointments.findFirst({
                where: eq(appointments.id, request.appointmentId),
            });

            // Collect all worker IDs (both from junction table and legacy field)
            const workerIds = new Set<string>();
            assignedWorkers.forEach((aw) => workerIds.add(aw.userId));
            if (appointment?.workerId) {
                workerIds.add(appointment.workerId);
            }

            // Create worker ratings for each assigned worker
            if (workerIds.size > 0) {
                const workerRatingValues = Array.from(workerIds).map((workerId) => ({
                    visitRatingId: visitRating!.id,
                    workerId,
                    appointmentId: request.appointmentId,
                    rating,
                }));

                await tx.insert(workerRatings).values(workerRatingValues);

                logger.info(`Created ${workerIds.size} worker ratings for visit rating ${visitRating!.id}`);
            }

            // Mark the request as completed
            await tx
                .update(ratingRequests)
                .set({
                    status: 'COMPLETED',
                    completedAt: new Date(),
                })
                .where(eq(ratingRequests.id, request.id));

            logger.info(`Rating ${rating}/5 submitted for appointment ${request.appointmentId}`);

            return { success: true };
        });
    } catch (error: any) {
        logger.error(`Failed to submit rating: ${error.message}`);
        return { success: false, error: error.message };
    }
};

/**
 * Get pending rating requests that are ready to be sent
 */
export const getPendingRequests = async (db: Database): Promise<(typeof ratingRequests.$inferSelect)[]> => {
    const now = new Date();
    return await db.query.ratingRequests.findMany({
        where: and(
            eq(ratingRequests.status, 'PENDING'),
            lte(ratingRequests.scheduledFor, now)
        ),
        with: {
            patient: true,
            appointment: true,
            clinic: true,
        },
    });
};

/**
 * Mark a request as sent
 */
export const markRequestAsSent = async (db: Database, requestId: string): Promise<void> => {
    await db
        .update(ratingRequests)
        .set({
            status: 'SENT',
            sentAt: new Date(),
        })
        .where(eq(ratingRequests.id, requestId));
};

/**
 * Mark expired requests
 */
export const markExpiredRequests = async (db: Database): Promise<number> => {
    const now = new Date();
    const result = await db
        .update(ratingRequests)
        .set({ status: 'EXPIRED' })
        .where(
            and(
                eq(ratingRequests.status, 'SENT'),
                lte(ratingRequests.expiresAt, now)
            )
        );
    return 0; // Drizzle doesn't return affected rows count easily
};

/**
 * Get rating statistics for a clinic
 */
export const getClinicRatingStats = async (db: Database, clinicId: string) => {
    const ratings = await db.query.visitRatings.findMany({
        where: eq(visitRatings.clinicId, clinicId),
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
        distribution[rating.rating as 1 | 2 | 3 | 4 | 5]++;
    }

    return {
        totalRatings: ratings.length,
        averageRating: Math.round((sum / ratings.length) * 10) / 10,
        distribution,
    };
};

/**
 * Get rating statistics for a specific worker
 */
export const getWorkerRatingStats = async (db: Database, workerId: string, clinicId?: string) => {
    const whereClause = clinicId
        ? and(
            eq(workerRatings.workerId, workerId),
            // We need to join with visitRatings to filter by clinic
            // For now, just filter by workerId
        )
        : eq(workerRatings.workerId, workerId);

    const ratings = await db.query.workerRatings.findMany({
        where: eq(workerRatings.workerId, workerId),
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
        distribution[rating.rating as 1 | 2 | 3 | 4 | 5]++;
    }

    return {
        totalRatings: filteredRatings.length,
        averageRating: Math.round((sum / filteredRatings.length) * 10) / 10,
        distribution,
    };
};

/**
 * Get recent ratings for a clinic with comments
 */
export const getRecentRatings = async (db: Database,
    clinicId: string,
    limit: number = 10
) => {
    return await db.query.visitRatings.findMany({
        where: eq(visitRatings.clinicId, clinicId),
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
        orderBy: [desc(visitRatings.createdAt)],
        limit,
    });
};

/**
 * Get all rating requests for a clinic
 */
export const getClinicRatingRequests = async (db: Database, clinicId: string) => {
    return await db.query.ratingRequests.findMany({
        where: eq(ratingRequests.clinicId, clinicId),
        with: {
            patient: true,
            appointment: true,
        },
        orderBy: [desc(ratingRequests.createdAt)],
        limit: 100,
    });
};

/**
 * Send a rating request email immediately (for testing)
 * Creates the request if it doesn't exist, or uses existing one
 */
export const sendRatingEmailNow = async (db: Database,
    appointmentId: string,
    clinicId: string
): Promise<{ success: boolean; error?: string; ratingUrl?: string; token?: string }> => {
    try {
        // Get the appointment
        const appointment = await db.query.appointments.findFirst({
            where: and(
                eq(appointments.id, appointmentId),
                eq(appointments.clinicId, clinicId)
            ),
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
        let request = await db.query.ratingRequests.findFirst({
            where: eq(ratingRequests.appointmentId, appointmentId),
        });

        const frontendUrl = config.frontend.url;

        if (!request) {
            // Create a new request that's immediately ready
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + DAYS_VALID);

            const token = nanoid(64);
            const [newRequest] = await db
                .insert(ratingRequests)
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
        } else if (request.status === 'COMPLETED') {
            return { success: false, error: 'Esta cita ya fue valorada' };
        } else if (request.status === 'EXPIRED') {
            return { success: false, error: 'El enlace de valoración ha expirado' };
        }

        // Import and use email services
        const { getEmailSettings, sendEmail } = await import('./email.service.js');
        const { getActiveTemplate, renderBlocksToHtml, replaceVariables } = await import('./email-template.service.js');

        // Check if clinic has email configured
        const emailSettings = await getEmailSettings(db, clinicId);
        if (!emailSettings?.isEnabled || !emailSettings?.isConfigured) {
            // Return the URL even if email not configured - for testing
            const ratingUrl = `${frontendUrl}/rate/${request!.token}`;
            return {
                success: true,
                ratingUrl,
                token: request!.token,
                error: 'Email no configurado, pero puedes usar este enlace directamente'
            };
        }

        // Generate rating URL
        const ratingUrl = `${frontendUrl}/rate/${request!.token}`;

        // Format appointment date
        const appointmentDate = new Date(appointment.startTime).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        // Try to get custom template, otherwise use default
        const template = await getActiveTemplate(db, clinicId, 'VISIT_RATING_REQUEST');

        let subject: string;
        let htmlContent: string;

        if (template) {
            const variables = {
                patient_name: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
                clinic_name: appointment.clinic.name,
                clinic_phone: appointment.clinic.phone || '',
                appointment_date: appointmentDate,
                rating_url: ratingUrl,
            };
            subject = replaceVariables(template.subject, variables);
            htmlContent = replaceVariables(renderBlocksToHtml(template.blocks as any[]), variables);
        } else {
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
        const result = await sendEmail(db, clinicId, {
            to: appointment.patient.email,
            subject,
            html: htmlContent,
        });

        if (result.success) {
            // Update status to SENT if not already
            if (request!.status === 'PENDING') {
                await db
                    .update(ratingRequests)
                    .set({ status: 'SENT', sentAt: new Date() })
                    .where(eq(ratingRequests.id, request!.id));
            }
            logger.info(`Test rating email sent to ${appointment.patient.email}`);
            return { success: true, ratingUrl, token: request!.token };
        } else {
            return { success: false, error: result.error || 'Error al enviar el email' };
        }
    } catch (error: any) {
        logger.error(`Error sending test rating email: ${error.message}`);
        return { success: false, error: error.message };
    }
};

// Helper function for default email
const generateDefaultEmail = (data: {
    patientName: string;
    clinicName: string;
    appointmentDate: string;
    ratingUrl: string;
}): string => {
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
