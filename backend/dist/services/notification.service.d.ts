import { type EmailTemplateType } from './email-template.service.js';
interface AppointmentNotificationData {
    appointmentId: string;
    clinicId: string;
    patientId: string;
    type: EmailTemplateType;
}
/**
 * Send appointment notification email
 */
export declare const sendAppointmentNotification: (data: AppointmentNotificationData) => Promise<{
    success: boolean;
    logId?: string;
    error?: string;
}>;
/**
 * Get notification logs for a clinic
 */
export declare const getNotificationLogs: (clinicId: string, options?: {
    limit?: number;
    offset?: number;
}) => Promise<{
    status: "PENDING" | "FAILED" | "SENT" | "BOUNCED";
    id: string;
    createdAt: Date;
    clinicId: string;
    patientId: string | null;
    appointmentId: string | null;
    errorMessage: string | null;
    subject: string | null;
    templateId: string | null;
    templateType: "APPOINTMENT_CREATED" | "APPOINTMENT_REMINDER_24H" | "APPOINTMENT_REMINDER_1H" | "APPOINTMENT_CANCELLED" | "DOCUMENT_SIGNED" | "VISIT_RATING_REQUEST" | "CUSTOM";
    channel: string;
    recipient: string;
    sentAt: Date | null;
    patient: {
        email: string | null;
        firstName: string;
        lastName: string;
    } | null;
}[]>;
/**
 * Get notification stats for a clinic
 */
export declare const getNotificationStats: (clinicId: string) => Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
}>;
export {};
//# sourceMappingURL=notification.service.d.ts.map