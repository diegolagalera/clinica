import { eq, lte, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pendingNotifications, appointments, patients } from '../db/schema.js';
import { sendAppointmentNotification } from './notification.service.js';
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
                // Send the notification
                await sendAppointmentNotification({
                    appointmentId: notification.appointmentId,
                    clinicId: notification.clinicId,
                    patientId: notification.patientId,
                    type: notification.type as EmailTemplateType,
                });

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
