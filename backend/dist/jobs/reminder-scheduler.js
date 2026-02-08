"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReminderScheduler = exports.processReminders = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const drizzle_orm_1 = require("drizzle-orm");
const notification_service_js_1 = require("../services/notification.service.js");
const pending_notification_service_js_1 = require("../services/pending-notification.service.js");
const logger_js_1 = require("../utils/logger.js");
/**
 * Check if reminder was already sent for this appointment
 */
const wasReminderSent = async (appointmentId, templateType) => {
    const existing = await index_js_1.db.query.notificationLogs.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.notificationLogs.appointmentId, appointmentId), (0, drizzle_orm_1.eq)(schema_js_1.notificationLogs.templateType, templateType), (0, drizzle_orm_1.eq)(schema_js_1.notificationLogs.status, 'SENT')),
    });
    return !!existing;
};
/**
 * Process appointment reminders
 * Runs every 5 minutes
 */
const processReminders = async () => {
    logger_js_1.logger.info('Processing appointment reminders...');
    const now = new Date();
    logger_js_1.logger.info(`Current time: ${now.toISOString()}`);
    // Get clinics with enabled notifications
    const activeSettings = await index_js_1.db.query.emailSettings.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.emailSettings.isEnabled, true), (0, drizzle_orm_1.eq)(schema_js_1.emailSettings.isConfigured, true)),
    });
    logger_js_1.logger.info(`Found ${activeSettings.length} clinics with active notifications`);
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
        }
        catch (err) {
            logger_js_1.logger.error(`Error processing reminders for clinic ${settings.clinicId}: ${err.message}`);
        }
    }
    logger_js_1.logger.info('Reminder processing complete');
};
exports.processReminders = processReminders;
/**
 * Process a specific reminder type for a clinic
 */
const processReminderType = async (clinicId, type, now) => {
    const hoursBefore = type === '24h' ? 24 : 1;
    const reminderType = type === '24h' ? 'APPOINTMENT_REMINDER_24H' : 'APPOINTMENT_REMINDER_1H';
    // Calculate time window - look for appointments starting between now+Xh and now+Xh+10min
    // Wider window to avoid missing appointments due to timing
    const targetTimeStart = new Date(now);
    targetTimeStart.setHours(targetTimeStart.getHours() + hoursBefore);
    const targetTimeEnd = new Date(targetTimeStart);
    targetTimeEnd.setMinutes(targetTimeEnd.getMinutes() + 10); // 10 minute window
    logger_js_1.logger.info(`Looking for ${type} reminders: appointments between ${targetTimeStart.toISOString()} and ${targetTimeEnd.toISOString()}`);
    // Find appointments needing reminders
    const pendingAppointments = await index_js_1.db.query.appointments.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.appointments.clinicId, clinicId), (0, drizzle_orm_1.gte)(schema_js_1.appointments.startTime, targetTimeStart), (0, drizzle_orm_1.lte)(schema_js_1.appointments.startTime, targetTimeEnd), (0, drizzle_orm_1.ne)(schema_js_1.appointments.status, 'CANCELLED'), (0, drizzle_orm_1.ne)(schema_js_1.appointments.status, 'NO_SHOW'), (0, drizzle_orm_1.ne)(schema_js_1.appointments.status, 'COMPLETED')),
    });
    logger_js_1.logger.info(`Found ${pendingAppointments.length} appointments for ${type} reminder`);
    for (const appointment of pendingAppointments) {
        try {
            // Check if reminder was already sent
            const alreadySent = await wasReminderSent(appointment.id, reminderType);
            if (alreadySent) {
                logger_js_1.logger.info(`Reminder ${type} already sent for appointment ${appointment.id}, skipping`);
                continue;
            }
            await (0, notification_service_js_1.sendAppointmentNotification)({
                appointmentId: appointment.id,
                clinicId,
                patientId: appointment.patientId,
                type: reminderType,
            });
            logger_js_1.logger.info(`Sent ${type} reminder for appointment ${appointment.id}`);
        }
        catch (err) {
            logger_js_1.logger.error(`Failed to send reminder for appointment ${appointment.id}: ${err.message}`);
        }
    }
};
/**
 * Start the reminder scheduler (runs every 5 minutes)
 */
const startReminderScheduler = () => {
    logger_js_1.logger.info('Starting reminder scheduler...');
    // Run immediately on startup
    (0, exports.processReminders)().catch(err => {
        logger_js_1.logger.error(`Initial reminder processing failed: ${err.message}`);
    });
    // Then run every 5 minutes
    node_cron_1.default.schedule('*/5 * * * *', async () => {
        try {
            await (0, exports.processReminders)();
        }
        catch (err) {
            logger_js_1.logger.error(`Reminder scheduler error: ${err.message}`);
        }
    });
    logger_js_1.logger.info('Reminder scheduler started (runs every 5 minutes)');
    // ============ PENDING NOTIFICATIONS QUEUE ============
    // Process debounced notifications every minute
    logger_js_1.logger.info('Starting pending notifications processor...');
    node_cron_1.default.schedule('* * * * *', async () => {
        try {
            const count = await (0, pending_notification_service_js_1.processPendingNotifications)();
            if (count > 0) {
                logger_js_1.logger.info(`Processed ${count} pending notification(s)`);
            }
        }
        catch (err) {
            logger_js_1.logger.error(`Pending notifications processor error: ${err.message}`);
        }
    });
    logger_js_1.logger.info('Pending notifications processor started (runs every minute)');
};
exports.startReminderScheduler = startReminderScheduler;
//# sourceMappingURL=reminder-scheduler.js.map