"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPendingNotifications = exports.cancelPendingNotification = exports.queueNotification = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const notification_service_js_1 = require("./notification.service.js");
const logger_js_1 = require("../utils/logger.js");
// Delay in minutes before sending notification
const NOTIFICATION_DELAY_MINUTES = 5;
/**
 * Queue a notification for sending after a delay.
 * If a pending notification already exists for this appointment, it will be updated (upsert).
 */
const queueNotification = async (data) => {
    const scheduledFor = new Date();
    scheduledFor.setMinutes(scheduledFor.getMinutes() + NOTIFICATION_DELAY_MINUTES);
    try {
        // Try to insert, if conflict on appointmentId, update the existing entry
        await index_js_1.db
            .insert(schema_js_1.pendingNotifications)
            .values({
            appointmentId: data.appointmentId,
            clinicId: data.clinicId,
            patientId: data.patientId,
            type: data.type,
            scheduledFor,
            updatedAt: new Date(),
        })
            .onConflictDoUpdate({
            target: schema_js_1.pendingNotifications.appointmentId,
            set: {
                type: data.type,
                scheduledFor,
                updatedAt: new Date(),
            },
        });
        logger_js_1.logger.info(`Notification queued for appointment ${data.appointmentId}, scheduled for ${scheduledFor.toISOString()}`);
    }
    catch (error) {
        logger_js_1.logger.error(`Failed to queue notification: ${error.message}`);
        throw error;
    }
};
exports.queueNotification = queueNotification;
/**
 * Cancel a pending notification for an appointment.
 * Called when appointment is cancelled (we send cancellation immediately instead).
 */
const cancelPendingNotification = async (appointmentId) => {
    try {
        await index_js_1.db
            .delete(schema_js_1.pendingNotifications)
            .where((0, drizzle_orm_1.eq)(schema_js_1.pendingNotifications.appointmentId, appointmentId));
        logger_js_1.logger.info(`Cancelled pending notification for appointment ${appointmentId}`);
    }
    catch (error) {
        logger_js_1.logger.error(`Failed to cancel pending notification: ${error.message}`);
    }
};
exports.cancelPendingNotification = cancelPendingNotification;
/**
 * Process all pending notifications that are due.
 * Called by the CRON scheduler every minute.
 */
const processPendingNotifications = async () => {
    const now = new Date();
    let processedCount = 0;
    try {
        // Get all notifications that should be sent now
        const pending = await index_js_1.db.query.pendingNotifications.findMany({
            where: (0, drizzle_orm_1.lte)(schema_js_1.pendingNotifications.scheduledFor, now),
        });
        if (pending.length === 0) {
            return 0;
        }
        logger_js_1.logger.info(`Processing ${pending.length} pending notification(s)`);
        for (const notification of pending) {
            try {
                // Send the notification
                await (0, notification_service_js_1.sendAppointmentNotification)({
                    appointmentId: notification.appointmentId,
                    clinicId: notification.clinicId,
                    patientId: notification.patientId,
                    type: notification.type,
                });
                // Remove from pending queue
                await index_js_1.db
                    .delete(schema_js_1.pendingNotifications)
                    .where((0, drizzle_orm_1.eq)(schema_js_1.pendingNotifications.id, notification.id));
                processedCount++;
                logger_js_1.logger.info(`Sent notification for appointment ${notification.appointmentId}`);
            }
            catch (error) {
                logger_js_1.logger.error(`Failed to process notification ${notification.id}: ${error.message}`);
                // Don't remove failed notifications - they'll be retried
            }
        }
        return processedCount;
    }
    catch (error) {
        logger_js_1.logger.error(`Failed to process pending notifications: ${error.message}`);
        return processedCount;
    }
};
exports.processPendingNotifications = processPendingNotifications;
//# sourceMappingURL=pending-notification.service.js.map