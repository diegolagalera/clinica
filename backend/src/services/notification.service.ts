import { eq } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { notificationLogs, patients, appointments, users, clinics, emailSettings } from '../db/schema.js';
import { sendEmail, getEmailSettings } from './email.service.js';
import {
    getActiveTemplate,
    renderBlocksToHtml,
    replaceVariables,
    type EmailTemplateType,
    type TemplateBlock,
} from './email-template.service.js';
import {
    sendSms as sendSmsMessage,
    getSmsSettings,
    getActiveSmsTemplate,
    renderSmsContent,
    type SmsTemplateType,
} from './sms.service.js';
import { logger } from '../utils/logger.js';

interface AppointmentNotificationData {
    appointmentId: string;
    clinicId: string;
    patientId: string;
    type: EmailTemplateType;
}

/**
 * Send appointment notification email
 */
export const sendAppointmentNotification = async (db: Database, 
    data: AppointmentNotificationData
): Promise<{ success: boolean; logId?: string; error?: string }> => {
    try {
        // Check if notifications are enabled for this type
        const settings = await getEmailSettings(db, data.clinicId);

        if (!settings?.isEnabled || !settings?.isConfigured) {
            logger.info(`Notifications disabled for clinic ${data.clinicId}`);
            return { success: false, error: 'Notificaciones deshabilitadas' };
        }

        // Check specific toggles based on notification type
        const sendOnCreate = settings.sendOnCreate ?? true;
        const sendOnCancel = settings.sendOnCancel ?? true;
        const reminder24hEnabled = settings.reminder24hEnabled ?? true;
        const reminder1hEnabled = settings.reminder1hEnabled ?? true;

        if (data.type === 'APPOINTMENT_CREATED' && !sendOnCreate) {
            logger.info('APPOINTMENT_CREATED notifications disabled');
            return { success: false, error: 'Notificación de confirmación deshabilitada' };
        }

        if (data.type === 'APPOINTMENT_CANCELLED' && !sendOnCancel) {
            logger.info('APPOINTMENT_CANCELLED notifications disabled');
            return { success: false, error: 'Notificación de cancelación deshabilitada' };
        }

        if (data.type === 'APPOINTMENT_REMINDER_24H' && !reminder24hEnabled) {
            logger.info('APPOINTMENT_REMINDER_24H notifications disabled');
            return { success: false, error: 'Recordatorio 24h deshabilitado' };
        }

        if (data.type === 'APPOINTMENT_REMINDER_1H' && !reminder1hEnabled) {
            logger.info('APPOINTMENT_REMINDER_1H notifications disabled');
            return { success: false, error: 'Recordatorio 1h deshabilitado' };
        }
        // Get appointment details
        const appointment = await db.query.appointments.findFirst({
            where: eq(appointments.id, data.appointmentId),
            with: {
                patient: true,
                worker: true,
            },
        });

        if (!appointment) {
            return { success: false, error: 'Cita no encontrada' };
        }

        // Get patient email
        const patient = await db.query.patients.findFirst({
            where: eq(patients.id, data.patientId),
        });

        if (!patient?.email) {
            return { success: false, error: 'Paciente sin email' };
        }

        // Get clinic details
        const clinic = await db.query.clinics.findFirst({
            where: eq(clinics.id, data.clinicId),
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

        // Get template
        const template = await getActiveTemplate(db, data.clinicId, data.type);

        logger.info(`Using template for ${data.type}: ${template.name} (id: ${template.id || 'default'}, type: ${template.type})`);

        // Format date and time
        const dateFormatter = new Intl.DateTimeFormat('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        const timeFormatter = new Intl.DateTimeFormat('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
        });

        // Prepare variables
        const variables: Record<string, string> = {
            patient_name: `${patient.firstName} ${patient.lastName}`,
            patient_email: patient.email,
            appointment_date: dateFormatter.format(new Date(appointment.startTime)),
            appointment_time: timeFormatter.format(new Date(appointment.startTime)),
            appointment_type: appointment.type || 'Consulta',
            clinic_name: clinic?.name || 'Clínica',
            clinic_phone: clinic?.phone || '',
            clinic_address: clinic?.address || '',
            doctor_name: doctorName,
        };

        // Render HTML
        const html = renderBlocksToHtml(template.blocks as TemplateBlock[]);
        const finalHtml = replaceVariables(html, variables);
        const finalSubject = replaceVariables(template.subject, variables);

        // Create log entry
        const [log] = await db
            .insert(notificationLogs)
            .values({
                clinicId: data.clinicId,
                patientId: data.patientId,
                appointmentId: data.appointmentId,
                templateId: template.id || null,
                templateType: data.type,
                channel: 'email',
                recipient: patient.email,
                subject: finalSubject,
                status: 'PENDING',
            })
            .returning();

        // Send email
        const result = await sendEmail(db, data.clinicId, {
            to: patient.email,
            subject: finalSubject,
            html: finalHtml,
        });

        // Update log
        if (log) {
            await db
                .update(notificationLogs)
                .set({
                    status: result.success ? 'SENT' : 'FAILED',
                    errorMessage: result.error || null,
                    sentAt: result.success ? new Date() : null,
                })
                .where(eq(notificationLogs.id, log.id));
        }

        // ==================== SMS NOTIFICATION ====================
        // Also send SMS if patient has phone and SMS is enabled
        if (patient.phone) {
            try {
                const smsSettings = await getSmsSettings(db, data.clinicId);

                // Check if SMS is enabled for this notification type
                const shouldSendSms = smsSettings?.isEnabled &&
                    smsSettings?.isConfigured &&
                    (
                        (data.type === 'APPOINTMENT_CREATED' && smsSettings.sendOnCreate) ||
                        (data.type === 'APPOINTMENT_CANCELLED' && smsSettings.sendOnCancel) ||
                        (data.type === 'APPOINTMENT_REMINDER_24H' && smsSettings.reminder24hEnabled) ||
                        (data.type === 'APPOINTMENT_REMINDER_1H' && smsSettings.reminder1hEnabled)
                    );

                if (shouldSendSms) {
                    // Map email template type to SMS template type
                    const smsTemplateType = data.type as SmsTemplateType;
                    const smsTemplate = await getActiveSmsTemplate(db, data.clinicId, smsTemplateType);

                    if (smsTemplate) {
                        const smsContent = renderSmsContent(smsTemplate.content, variables);

                        // Create SMS log entry
                        const [smsLog] = await db
                            .insert(notificationLogs)
                            .values({
                                clinicId: data.clinicId,
                                patientId: data.patientId,
                                appointmentId: data.appointmentId,
                                templateId: typeof smsTemplate.id === 'string' && !smsTemplate.id.startsWith('default')
                                    ? smsTemplate.id
                                    : null,
                                templateType: data.type,
                                channel: 'sms',
                                recipient: patient.phone,
                                subject: smsTemplate.name,
                                status: 'PENDING',
                            })
                            .returning();

                        // Send SMS
                        const smsResult = await sendSmsMessage(db, data.clinicId, patient.phone, smsContent);

                        // Update SMS log
                        if (smsLog) {
                            await db
                                .update(notificationLogs)
                                .set({
                                    status: smsResult.success ? 'SENT' : 'FAILED',
                                    errorMessage: smsResult.error || null,
                                    sentAt: smsResult.success ? new Date() : null,
                                })
                                .where(eq(notificationLogs.id, smsLog.id));
                        }

                        logger.info(`SMS notification ${smsResult.success ? 'sent' : 'failed'} for ${data.type}`);
                    }
                }
            } catch (smsError: any) {
                // Don't fail the whole notification if SMS fails
                logger.error(`SMS notification failed: ${smsError.message}`);
            }
        }

        return {
            success: result.success,
            ...(log?.id && { logId: log.id }),
            ...(result.error && { error: result.error }),
        };
    } catch (error: any) {
        logger.error(`Failed to send notification: ${error.message}`);
        return { success: false, error: error.message };
    }
};

/**
 * Get notification logs for a clinic
 */
export const getNotificationLogs = async (db: Database, 
    clinicId: string,
    options: { limit?: number; offset?: number } = {}
) => {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const logs = await db.query.notificationLogs.findMany({
        where: eq(notificationLogs.clinicId, clinicId),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        limit,
        offset,
        with: {
            patient: {
                columns: {
                    firstName: true,
                    lastName: true,
                    email: true,
                },
            },
        },
    });

    return logs;
};

/**
 * Get notification stats for a clinic
 */
export const getNotificationStats = async (db: Database, clinicId: string) => {
    const logs = await db.query.notificationLogs.findMany({
        where: eq(notificationLogs.clinicId, clinicId),
        columns: {
            status: true,
        },
    });

    const stats = {
        total: logs.length,
        sent: logs.filter((l) => l.status === 'SENT').length,
        failed: logs.filter((l) => l.status === 'FAILED').length,
        pending: logs.filter((l) => l.status === 'PENDING').length,
    };

    return stats;
};
