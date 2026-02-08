"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotificationStats = exports.getNotificationLogs = exports.sendAppointmentNotification = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const email_service_js_1 = require("./email.service.js");
const email_template_service_js_1 = require("./email-template.service.js");
const sms_service_js_1 = require("./sms.service.js");
const logger_js_1 = require("../utils/logger.js");
/**
 * Send appointment notification email
 */
const sendAppointmentNotification = async (data) => {
    try {
        // Check if notifications are enabled for this type
        const settings = await (0, email_service_js_1.getEmailSettings)(data.clinicId);
        if (!settings?.isEnabled || !settings?.isConfigured) {
            logger_js_1.logger.info(`Notifications disabled for clinic ${data.clinicId}`);
            return { success: false, error: 'Notificaciones deshabilitadas' };
        }
        // Check specific toggles based on notification type
        const sendOnCreate = settings.sendOnCreate ?? true;
        const sendOnCancel = settings.sendOnCancel ?? true;
        const reminder24hEnabled = settings.reminder24hEnabled ?? true;
        const reminder1hEnabled = settings.reminder1hEnabled ?? true;
        if (data.type === 'APPOINTMENT_CREATED' && !sendOnCreate) {
            logger_js_1.logger.info('APPOINTMENT_CREATED notifications disabled');
            return { success: false, error: 'Notificación de confirmación deshabilitada' };
        }
        if (data.type === 'APPOINTMENT_CANCELLED' && !sendOnCancel) {
            logger_js_1.logger.info('APPOINTMENT_CANCELLED notifications disabled');
            return { success: false, error: 'Notificación de cancelación deshabilitada' };
        }
        if (data.type === 'APPOINTMENT_REMINDER_24H' && !reminder24hEnabled) {
            logger_js_1.logger.info('APPOINTMENT_REMINDER_24H notifications disabled');
            return { success: false, error: 'Recordatorio 24h deshabilitado' };
        }
        if (data.type === 'APPOINTMENT_REMINDER_1H' && !reminder1hEnabled) {
            logger_js_1.logger.info('APPOINTMENT_REMINDER_1H notifications disabled');
            return { success: false, error: 'Recordatorio 1h deshabilitado' };
        }
        // Get appointment details
        const appointment = await index_js_1.db.query.appointments.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_js_1.appointments.id, data.appointmentId),
            with: {
                patient: true,
                worker: true,
            },
        });
        if (!appointment) {
            return { success: false, error: 'Cita no encontrada' };
        }
        // Get patient email
        const patient = await index_js_1.db.query.patients.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_js_1.patients.id, data.patientId),
        });
        if (!patient?.email) {
            return { success: false, error: 'Paciente sin email' };
        }
        // Get clinic details
        const clinic = await index_js_1.db.query.clinics.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_js_1.clinics.id, data.clinicId),
        });
        // Get worker name
        let doctorName = 'Equipo médico';
        if (appointment.workerId) {
            const worker = await index_js_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_js_1.users.id, appointment.workerId),
            });
            if (worker) {
                doctorName = `${worker.firstName} ${worker.lastName}`;
            }
        }
        // Get template
        const template = await (0, email_template_service_js_1.getActiveTemplate)(data.clinicId, data.type);
        logger_js_1.logger.info(`Using template for ${data.type}: ${template.name} (id: ${template.id || 'default'}, type: ${template.type})`);
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
        const variables = {
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
        const html = (0, email_template_service_js_1.renderBlocksToHtml)(template.blocks);
        const finalHtml = (0, email_template_service_js_1.replaceVariables)(html, variables);
        const finalSubject = (0, email_template_service_js_1.replaceVariables)(template.subject, variables);
        // Create log entry
        const [log] = await index_js_1.db
            .insert(schema_js_1.notificationLogs)
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
        const result = await (0, email_service_js_1.sendEmail)(data.clinicId, {
            to: patient.email,
            subject: finalSubject,
            html: finalHtml,
        });
        // Update log
        if (log) {
            await index_js_1.db
                .update(schema_js_1.notificationLogs)
                .set({
                status: result.success ? 'SENT' : 'FAILED',
                errorMessage: result.error || null,
                sentAt: result.success ? new Date() : null,
            })
                .where((0, drizzle_orm_1.eq)(schema_js_1.notificationLogs.id, log.id));
        }
        // ==================== SMS NOTIFICATION ====================
        // Also send SMS if patient has phone and SMS is enabled
        if (patient.phone) {
            try {
                const smsSettings = await (0, sms_service_js_1.getSmsSettings)(data.clinicId);
                // Check if SMS is enabled for this notification type
                const shouldSendSms = smsSettings?.isEnabled &&
                    smsSettings?.isConfigured &&
                    ((data.type === 'APPOINTMENT_CREATED' && smsSettings.sendOnCreate) ||
                        (data.type === 'APPOINTMENT_CANCELLED' && smsSettings.sendOnCancel) ||
                        (data.type === 'APPOINTMENT_REMINDER_24H' && smsSettings.reminder24hEnabled) ||
                        (data.type === 'APPOINTMENT_REMINDER_1H' && smsSettings.reminder1hEnabled));
                if (shouldSendSms) {
                    // Map email template type to SMS template type
                    const smsTemplateType = data.type;
                    const smsTemplate = await (0, sms_service_js_1.getActiveSmsTemplate)(data.clinicId, smsTemplateType);
                    if (smsTemplate) {
                        const smsContent = (0, sms_service_js_1.renderSmsContent)(smsTemplate.content, variables);
                        // Create SMS log entry
                        const [smsLog] = await index_js_1.db
                            .insert(schema_js_1.notificationLogs)
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
                        const smsResult = await (0, sms_service_js_1.sendSms)(data.clinicId, patient.phone, smsContent);
                        // Update SMS log
                        if (smsLog) {
                            await index_js_1.db
                                .update(schema_js_1.notificationLogs)
                                .set({
                                status: smsResult.success ? 'SENT' : 'FAILED',
                                errorMessage: smsResult.error || null,
                                sentAt: smsResult.success ? new Date() : null,
                            })
                                .where((0, drizzle_orm_1.eq)(schema_js_1.notificationLogs.id, smsLog.id));
                        }
                        logger_js_1.logger.info(`SMS notification ${smsResult.success ? 'sent' : 'failed'} for ${data.type}`);
                    }
                }
            }
            catch (smsError) {
                // Don't fail the whole notification if SMS fails
                logger_js_1.logger.error(`SMS notification failed: ${smsError.message}`);
            }
        }
        return {
            success: result.success,
            ...(log?.id && { logId: log.id }),
            ...(result.error && { error: result.error }),
        };
    }
    catch (error) {
        logger_js_1.logger.error(`Failed to send notification: ${error.message}`);
        return { success: false, error: error.message };
    }
};
exports.sendAppointmentNotification = sendAppointmentNotification;
/**
 * Get notification logs for a clinic
 */
const getNotificationLogs = async (clinicId, options = {}) => {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const logs = await index_js_1.db.query.notificationLogs.findMany({
        where: (0, drizzle_orm_1.eq)(schema_js_1.notificationLogs.clinicId, clinicId),
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
exports.getNotificationLogs = getNotificationLogs;
/**
 * Get notification stats for a clinic
 */
const getNotificationStats = async (clinicId) => {
    const logs = await index_js_1.db.query.notificationLogs.findMany({
        where: (0, drizzle_orm_1.eq)(schema_js_1.notificationLogs.clinicId, clinicId),
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
exports.getNotificationStats = getNotificationStats;
//# sourceMappingURL=notification.service.js.map