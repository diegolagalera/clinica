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
export declare const queueNotification: (data: QueueNotificationData) => Promise<void>;
/**
 * Cancel a pending notification for an appointment.
 * Called when appointment is cancelled (we send cancellation immediately instead).
 */
export declare const cancelPendingNotification: (appointmentId: string) => Promise<void>;
/**
 * Process all pending notifications that are due.
 * Called by the CRON scheduler every minute.
 */
export declare const processPendingNotifications: () => Promise<number>;
export {};
//# sourceMappingURL=pending-notification.service.d.ts.map