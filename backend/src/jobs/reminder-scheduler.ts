import cron from 'node-cron';
import { db } from '../db/index.js';
import { appointments, clinics, emailSettings, notificationLogs } from '../db/schema.js';
import { and, eq, gte, lte, isNull, ne, desc, sql } from 'drizzle-orm';
import { sendAppointmentNotification } from '../services/notification.service.js';
import { processPendingNotifications } from '../services/pending-notification.service.js';
import { logger } from '../utils/logger.js';

/**
 * Check if reminder was already sent for this appointment
 */
const wasReminderSent = async (appointmentId: string, templateType: string): Promise<boolean> => {
    const existing = await db.query.notificationLogs.findFirst({
        where: and(
            eq(notificationLogs.appointmentId, appointmentId),
            eq(notificationLogs.templateType, templateType as any),
            eq(notificationLogs.status, 'SENT')
        ),
    });
    return !!existing;
};

/**
 * Process appointment reminders
 * Runs every 5 minutes
 */
export const processReminders = async () => {
    logger.info('Processing appointment reminders...');

    const now = new Date();
    logger.info(`Current time: ${now.toISOString()}`);

    // Get clinics with enabled notifications
    const activeSettings = await db.query.emailSettings.findMany({
        where: and(
            eq(emailSettings.isEnabled, true),
            eq(emailSettings.isConfigured, true)
        ),
    });

    logger.info(`Found ${activeSettings.length} clinics with active notifications`);

    for (const settings of activeSettings) {
        try {
            // 24h reminder (check if enabled, default to true if undefined)
            const reminder24hEnabled = settings.reminder24hEnabled !== false;
            if (reminder24hEnabled) {
                await processReminderType(settings.clinicId, '24h', now);
            }

            // 1h reminder (check if enabled, default to true if undefined)
            const reminder1hEnabled = settings.reminder1hEnabled !== false;
            if (reminder1hEnabled) {
                await processReminderType(settings.clinicId, '1h', now);
            }
        } catch (err: any) {
            logger.error(`Error processing reminders for clinic ${settings.clinicId}: ${err.message}`);
        }
    }

    logger.info('Reminder processing complete');
};

/**
 * Process a specific reminder type for a clinic
 */
const processReminderType = async (clinicId: string, type: '24h' | '1h', now: Date) => {
    const hoursBefore = type === '24h' ? 24 : 1;
    const reminderType = type === '24h' ? 'APPOINTMENT_REMINDER_24H' : 'APPOINTMENT_REMINDER_1H';

    // Calculate time window - look for appointments starting between now+Xh and now+Xh+10min
    // Wider window to avoid missing appointments due to timing
    const targetTimeStart = new Date(now);
    targetTimeStart.setHours(targetTimeStart.getHours() + hoursBefore);

    const targetTimeEnd = new Date(targetTimeStart);
    targetTimeEnd.setMinutes(targetTimeEnd.getMinutes() + 10); // 10 minute window

    logger.info(`Looking for ${type} reminders: appointments between ${targetTimeStart.toISOString()} and ${targetTimeEnd.toISOString()}`);

    // Find appointments needing reminders
    const pendingAppointments = await db.query.appointments.findMany({
        where: and(
            eq(appointments.clinicId, clinicId),
            gte(appointments.startTime, targetTimeStart),
            lte(appointments.startTime, targetTimeEnd),
            ne(appointments.status, 'CANCELLED'),
            ne(appointments.status, 'NO_SHOW'),
            ne(appointments.status, 'COMPLETED'),
        ),
    });

    logger.info(`Found ${pendingAppointments.length} appointments for ${type} reminder`);

    for (const appointment of pendingAppointments) {
        try {
            // Check if reminder was already sent
            const alreadySent = await wasReminderSent(appointment.id, reminderType);
            if (alreadySent) {
                logger.info(`Reminder ${type} already sent for appointment ${appointment.id}, skipping`);
                continue;
            }

            await sendAppointmentNotification({
                appointmentId: appointment.id,
                clinicId,
                patientId: appointment.patientId,
                type: reminderType as any,
            });
            logger.info(`Sent ${type} reminder for appointment ${appointment.id}`);
        } catch (err: any) {
            logger.error(`Failed to send reminder for appointment ${appointment.id}: ${err.message}`);
        }
    }
};

/**
 * Start the reminder scheduler (runs every 5 minutes)
 */
export const startReminderScheduler = () => {
    logger.info('Starting reminder scheduler...');

    // Run immediately on startup
    processReminders().catch(err => {
        logger.error('Initial reminder processing failed:', err);
    });

    // Then run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        try {
            await processReminders();
        } catch (err: any) {
            logger.error(`Reminder scheduler error: ${err.message}`);
        }
    });

    logger.info('Reminder scheduler started (runs every 5 minutes)');

    // ============ PENDING NOTIFICATIONS QUEUE ============
    // Process debounced notifications every minute
    logger.info('Starting pending notifications processor...');

    cron.schedule('* * * * *', async () => {
        try {
            const count = await processPendingNotifications();
            if (count > 0) {
                logger.info(`Processed ${count} pending notification(s)`);
            }
        } catch (err: any) {
            logger.error(`Pending notifications processor error: ${err.message}`);
        }
    });

    logger.info('Pending notifications processor started (runs every minute)');
};
