import { eq, lte, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pendingNotifications, appointments, patients, whatsappSettings, clinics, users, notificationLogs } from '../db/schema.js';
import { sendAppointmentNotification } from './notification.service.js';
import { ChatbotConversationService } from './chatbot-conversation.service.js';
import { logger } from '../utils/logger.js';
import type { EmailTemplateType } from './email-template.service.js';

// Delay in minutes before sending notification
const NOTIFICATION_DELAY_MINUTES = 5;

interface QueueNotificationData {
    appointmentId: string;
    clinicId: string;
    patientId: string;
    type: 'APPOINTMENT_CREATED' | 'APPOINTMENT_CANCELLED';
}

/**
 * Queue a notification for sending after a delay.
 * If a pending notification already exists for this appointment, it will be updated (upsert).
 */
export const queueNotification = async (data: QueueNotificationData): Promise<void> => {
    const scheduledFor = new Date();
    scheduledFor.setMinutes(scheduledFor.getMinutes() + NOTIFICATION_DELAY_MINUTES);

    try {
        // Try to insert, if conflict on appointmentId, update the existing entry
        await db
            .insert(pendingNotifications)
            .values({
                appointmentId: data.appointmentId,
                clinicId: data.clinicId,
                patientId: data.patientId,
                type: data.type,
                scheduledFor,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: pendingNotifications.appointmentId,
                set: {
                    type: data.type,
                    scheduledFor,
                    updatedAt: new Date(),
                },
            });

        logger.info(`Notification queued for appointment ${data.appointmentId}, scheduled for ${scheduledFor.toISOString()}`);
    } catch (error: any) {
        logger.error(`Failed to queue notification: ${error.message}`);
        throw error;
    }
};

/**
 * Cancel a pending notification for an appointment.
 * Called when appointment is cancelled (we send cancellation immediately instead).
 */
export const cancelPendingNotification = async (appointmentId: string): Promise<void> => {
    try {
        await db
            .delete(pendingNotifications)
            .where(eq(pendingNotifications.appointmentId, appointmentId));

        logger.info(`Cancelled pending notification for appointment ${appointmentId}`);
    } catch (error: any) {
        logger.error(`Failed to cancel pending notification: ${error.message}`);
    }
};

/**
 * Send WhatsApp notification for an appointment event (CREATED/MODIFIED/CANCELLED).
 * Checks if WA is configured, template exists, and patient has phone.
 */
export const sendWaAppointmentNotification = async (
    appointmentId: string,
    clinicId: string,
    patientId: string,
    eventType: 'CREATED' | 'MODIFIED' | 'CANCELLED',
    queuedAt?: Date // When the pending notification was last queued/updated
): Promise<void> => {
    try {
        // Check WhatsApp settings
        const waSettings = await db.query.whatsappSettings.findFirst({
            where: eq(whatsappSettings.clinicId, clinicId),
        });

        if (!waSettings?.isConfigured || !waSettings?.isEnabled) {
            logger.debug(`WA notification skipped: WhatsApp not configured for clinic ${clinicId}`);
            return;
        }

        // Resolve template name for this event type
        const templateMap: Record<string, string | null> = {
            CREATED: waSettings.waTemplateCreated,
            MODIFIED: waSettings.waTemplateModified,
            CANCELLED: waSettings.waTemplateCancelled,
        };
        const templateName = templateMap[eventType];

        if (!templateName) {
            logger.debug(`WA notification skipped: no template configured for event ${eventType}`);
            return;
        }

        // Get appointment data
        const appointment = await db.query.appointments.findFirst({
            where: eq(appointments.id, appointmentId),
            with: { patient: true, worker: true },
        });

        if (!appointment) {
            logger.warn(`WA notification skipped: appointment ${appointmentId} not found`);
            return;
        }

        // If WA was already sent AFTER this notification was queued (e.g. manually via modal), don't send again
        // But if waNotificationSentAt is from before the queue time, it means the appointment was modified
        // after the last WA was sent, so we should send the update
        if (appointment.waNotificationSentAt && queuedAt) {
            const waSentTime = new Date(appointment.waNotificationSentAt).getTime();
            const queuedTime = queuedAt.getTime();
            if (waSentTime >= queuedTime) {
                logger.info(`WA notification skipped: already sent for appointment ${appointmentId} after notification was queued`);
                return;
            }
        } else if (appointment.waNotificationSentAt && !queuedAt) {
            // Called directly (not from cron), skip if already sent
            logger.info(`WA notification skipped: already sent for appointment ${appointmentId}`);
            return;
        }

        // Get patient phone
        const patient = await db.query.patients.findFirst({
            where: eq(patients.id, patientId),
        });

        if (!patient?.phone) {
            logger.debug(`WA notification skipped: patient ${patientId} has no phone`);
            return;
        }

        // Skip if this patient's number is known to not be on WhatsApp (retry after 1 day)
        if (patient.whatsappAvailable === false) {
            const daysSinceCheck = patient.whatsappCheckedAt
                ? (Date.now() - new Date(patient.whatsappCheckedAt).getTime()) / (1000 * 60 * 60 * 24)
                : 999; // No timestamp = always retry
            if (daysSinceCheck < 1) {
                logger.debug(`WA notification skipped: patient ${patientId} not on WhatsApp (checked ${Math.round(daysSinceCheck * 24)}h ago)`);
                return;
            }
            logger.info(`WA notification: retrying patient ${patientId} after ${Math.round(daysSinceCheck)}d since last check`);
        }

        // Get clinic details
        const clinic = await db.query.clinics.findFirst({
            where: eq(clinics.id, clinicId),
        });

        // Get worker name
        let doctorName = 'Equipo médico';
        if (appointment.workerId) {
            const worker = await db.query.users.findFirst({
                where: eq(users.id, appointment.workerId),
            });
            if (worker) {
                doctorName = `${worker.firstName} ${worker.lastName}`;
            }
        }

        // Format date and time
        const dateFormatter = new Intl.DateTimeFormat('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        const timeFormatter = new Intl.DateTimeFormat('es-ES', {
            hour: '2-digit', minute: '2-digit',
        });

        const appointmentDate = dateFormatter.format(new Date(appointment.startTime));
        const appointmentTime = timeFormatter.format(new Date(appointment.startTime));

        // Variable values for template
        const variableValues: Record<string, string> = {
            patient_name: `${patient.firstName} ${patient.lastName}`,
            appointment_date: appointmentDate,
            appointment_time: appointmentTime,
            clinic_name: clinic?.name || 'Clínica',
            doctor_name: doctorName,
            clinic_phone: clinic?.phone || '',
        };

        // Resolve stored mapping for this event type
        const mappingMap: Record<string, any> = {
            CREATED: waSettings.waTemplateMappingCreated,
            MODIFIED: waSettings.waTemplateMappingModified,
            CANCELLED: waSettings.waTemplateMappingCancelled,
        };
        const mapping = mappingMap[eventType] as Record<string, string> | null;

        // Build template components from mapping
        let components: any[] = [];
        if (mapping && typeof mapping === 'object') {
            const sortedKeys = Object.keys(mapping).sort((a, b) => parseInt(a) - parseInt(b));
            const bodyParams = sortedKeys.map(key => {
                const variableKey = mapping[key] ?? '';
                const value = variableValues[variableKey] || '';
                return { type: 'text', text: value };
            });
            if (bodyParams.length > 0) {
                components = [{ type: 'body', parameters: bodyParams }];
            }
        }

        // Build readable preview for the chat message
        const eventLabels: Record<string, string> = {
            'CREATED': '✅ Cita confirmada',
            'MODIFIED': '📝 Cita modificada',
            'CANCELLED': '❌ Cita cancelada',
        };
        const templateBody = `${eventLabels[eventType]}\n📅 ${appointmentDate}\n🕐 ${appointmentTime}\n👤 ${patient.firstName} ${patient.lastName}\n🏥 ${clinic?.name || 'Clínica'}\n👨‍⚕️ ${doctorName}`;

        // Send via ChatbotConversationService
        try {
            await ChatbotConversationService.sendTemplateMessage(
                clinicId,
                undefined, // No userId in background job
                patient.phone,
                templateName,
                'es', // Default language
                components,
                templateBody
            );
        } catch (sendError: any) {
            // Check if it's a "not on WhatsApp" error (131026 = undeliverable, 131047 = not WA user)
            const code = sendError.errorCode;
            if (code === 131026 || code === 131047) {
                logger.warn({ patientId, errorCode: code }, 'Patient phone not on WhatsApp, marking as unavailable');
                await db.update(patients)
                    .set({ whatsappAvailable: false, whatsappCheckedAt: new Date(), updatedAt: new Date() })
                    .where(eq(patients.id, patientId));
            }
            throw sendError; // Re-throw so the outer catch logs it
        }

        // Mark patient as confirmed on WhatsApp (first successful send or after retry)
        if (patient.whatsappAvailable !== true) {
            await db.update(patients)
                .set({ whatsappAvailable: true, whatsappCheckedAt: new Date(), updatedAt: new Date() })
                .where(eq(patients.id, patientId));
        }

        // Log in notification_logs
        await db.insert(notificationLogs).values({
            clinicId,
            patientId,
            appointmentId,
            templateType: eventType === 'CREATED' ? 'APPOINTMENT_CREATED'
                : eventType === 'CANCELLED' ? 'APPOINTMENT_CANCELLED'
                    : 'APPOINTMENT_CREATED', // MODIFIED reuses CREATED type
            channel: 'whatsapp',
            recipient: patient.phone,
            subject: templateName,
            status: 'SENT',
            sentAt: new Date(),
        });

        // Update waNotificationSentAt on appointment
        await db.update(appointments)
            .set({ waNotificationSentAt: new Date(), updatedAt: new Date() })
            .where(eq(appointments.id, appointmentId));

        logger.info({ appointmentId, eventType, templateName }, 'WhatsApp appointment notification sent (debounced)');
    } catch (error: any) {
        logger.error(`Failed to send WA appointment notification: ${error.message}`);
        // Don't throw — WA failure should not block email notifications
    }
};

/**
 * Process all pending notifications that are due.
 * Called by the CRON scheduler every minute.
 */
export const processPendingNotifications = async (): Promise<number> => {
    const now = new Date();
    let processedCount = 0;

    try {
        // Get all notifications that should be sent now
        const pending = await db.query.pendingNotifications.findMany({
            where: lte(pendingNotifications.scheduledFor, now),
        });

        if (pending.length === 0) {
            return 0;
        }

        logger.info(`Processing ${pending.length} pending notification(s)`);

        for (const notification of pending) {
            try {
                // Send email notification
                await sendAppointmentNotification({
                    appointmentId: notification.appointmentId,
                    clinicId: notification.clinicId,
                    patientId: notification.patientId,
                    type: notification.type as EmailTemplateType,
                });

                // Also send WhatsApp notification (if configured)
                // Determine if this is a new appointment or a modification
                // by checking appointment creation time vs notification queue time
                let waEventType: 'CREATED' | 'MODIFIED' | 'CANCELLED' = 'MODIFIED';
                if (notification.type === 'APPOINTMENT_CANCELLED') {
                    waEventType = 'CANCELLED';
                } else {
                    // Check if the appointment was created recently (within debounce window + buffer)
                    const apt = await db.query.appointments.findFirst({
                        where: eq(appointments.id, notification.appointmentId),
                    });
                    if (apt) {
                        const createdAt = new Date(apt.createdAt).getTime();
                        const queuedAt = new Date(notification.createdAt).getTime();
                        const tenMinutesMs = 10 * 60 * 1000;
                        // If the appointment was created around the same time it was queued, it's new
                        if (Math.abs(queuedAt - createdAt) < tenMinutesMs) {
                            waEventType = 'CREATED';
                        }
                    }
                }
                await sendWaAppointmentNotification(
                    notification.appointmentId,
                    notification.clinicId,
                    notification.patientId,
                    waEventType,
                    new Date(notification.updatedAt) // Pass queue time for smart duplicate check
                );

                // Remove from pending queue
                await db
                    .delete(pendingNotifications)
                    .where(eq(pendingNotifications.id, notification.id));

                processedCount++;
                logger.info(`Sent notification for appointment ${notification.appointmentId}`);
            } catch (error: any) {
                logger.error(`Failed to process notification ${notification.id}: ${error.message}`);
                // Don't remove failed notifications - they'll be retried
            }
        }

        return processedCount;
    } catch (error: any) {
        logger.error('Failed to process pending notifications:', error);
        return processedCount;
    }
};
