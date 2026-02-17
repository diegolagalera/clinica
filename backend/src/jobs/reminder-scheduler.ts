import cron from 'node-cron';
import type { Database } from '../db/index.js';
import { appointments, clinics, emailSettings, notificationLogs, whatsappSettings, patients, users } from '../db/schema.js';
import { and, eq, gte, lte, isNull, ne, desc, sql } from 'drizzle-orm';
import { sendAppointmentNotification } from '../services/notification.service.js';
import { ChatbotConversationService } from '../services/chatbot-conversation.service.js';
import { processPendingNotifications } from '../services/pending-notification.service.js';
import { logger } from '../utils/logger.js';
import { centralDb } from '../db/central-db.js';
import { tenants } from '../db/central-schema.js';
import { tenantManager } from '../db/tenant-manager.js';

/**
 * Check if reminder was already sent for this appointment
 */
const wasReminderSent = async (db: Database, appointmentId: string, templateType: string, channel?: string): Promise<boolean> => {
    const conditions = [
        eq(notificationLogs.appointmentId, appointmentId),
        eq(notificationLogs.templateType, templateType as any),
        eq(notificationLogs.status, 'SENT'),
    ];
    if (channel) {
        conditions.push(eq(notificationLogs.channel, channel as any));
    }
    const existing = await db.query.notificationLogs.findFirst({
        where: and(...conditions),
    });
    return !!existing;
};

/**
 * Process appointment reminders for a single tenant
 */
const processRemindersForTenant = async (db: Database, tenantSlug: string) => {
    const now = new Date();

    // Get clinics with enabled notifications
    const activeSettings = await db.query.emailSettings.findMany({
        where: and(
            eq(emailSettings.isEnabled, true),
            eq(emailSettings.isConfigured, true)
        ),
    });

    if (activeSettings.length === 0) return;

    logger.info(`[${tenantSlug}] Found ${activeSettings.length} clinics with active notifications`);

    for (const settings of activeSettings) {
        try {
            // 24h reminder (check if enabled, default to true if undefined)
            const reminder24hEnabled = settings.reminder24hEnabled !== false;
            if (reminder24hEnabled) {
                await processReminderType(db, settings.clinicId, '24h', now);
            }

            // 1h reminder (check if enabled, default to true if undefined)
            const reminder1hEnabled = settings.reminder1hEnabled !== false;
            if (reminder1hEnabled) {
                await processReminderType(db, settings.clinicId, '1h', now);
            }
        } catch (err: any) {
            logger.error(`Error processing reminders for clinic ${settings.clinicId}: ${err.message}`);
        }
    }

    // Also process WhatsApp reminders for clinics that have WA enabled
    await processWhatsAppReminders(db, now);
};

/**
 * Process appointment reminders across all tenants
 */
export const processReminders = async () => {
    logger.info('Processing appointment reminders...');

    try {
        const activeTenants = await centralDb.query.tenants.findMany({
            where: eq(tenants.isActive, true),
        });

        for (const tenant of activeTenants) {
            try {
                const db = await tenantManager.getConnection(tenant.slug);
                await processRemindersForTenant(db, tenant.slug);
            } catch (error: any) {
                logger.error({ tenantSlug: tenant.slug, error: error.message }, 'Failed to process reminders for tenant');
            }
        }
    } catch (error: any) {
        logger.error('Error in reminder processor:', error);
    }

    logger.info('Reminder processing complete');
};

/**
 * Process a specific reminder type for a clinic
 */
const processReminderType = async (db: Database, clinicId: string, type: '24h' | '1h', now: Date) => {
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
            const alreadySent = await wasReminderSent(db, appointment.id, reminderType);
            if (alreadySent) {
                logger.info(`Reminder ${type} already sent for appointment ${appointment.id}, skipping`);
                continue;
            }

            await sendAppointmentNotification(db, {
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
 * Process WhatsApp reminders for all clinics that have WA notifications enabled
 */
const processWhatsAppReminders = async (db: Database, now: Date) => {
    // Get clinics with WA notifications enabled
    const waSettingsList = await db.query.whatsappSettings.findMany({
        where: and(
            eq(whatsappSettings.isEnabled, true),
            eq(whatsappSettings.isConfigured, true),
            eq(whatsappSettings.waNotifyEnabled, true),
        ),
    });

    for (const waSettings of waSettingsList) {
        try {
            // 24h WhatsApp reminder
            if (waSettings.waReminder24hEnabled && waSettings.waTemplateReminder24h) {
                await processWaReminderType(db, waSettings.clinicId, '24h', now, waSettings.waTemplateReminder24h, waSettings.waTemplateMappingReminder24h as Record<string, string> | null);
            }

            // 1h WhatsApp reminder
            if (waSettings.waReminder1hEnabled && waSettings.waTemplateReminder1h) {
                await processWaReminderType(db, waSettings.clinicId, '1h', now, waSettings.waTemplateReminder1h, waSettings.waTemplateMappingReminder1h as Record<string, string> | null);
            }
        } catch (err: any) {
            logger.error(`Error processing WA reminders for clinic ${waSettings.clinicId}: ${err.message}`);
        }
    }
};

/**
 * Process WhatsApp reminder for a specific type
 */
const processWaReminderType = async (db: Database, clinicId: string, type: '24h' | '1h', now: Date, templateName: string, mapping: Record<string, string> | null) => {
    const hoursBefore = type === '24h' ? 24 : 1;
    const reminderType = type === '24h' ? 'APPOINTMENT_REMINDER_24H' : 'APPOINTMENT_REMINDER_1H';

    const targetTimeStart = new Date(now);
    targetTimeStart.setHours(targetTimeStart.getHours() + hoursBefore);

    const targetTimeEnd = new Date(targetTimeStart);
    targetTimeEnd.setMinutes(targetTimeEnd.getMinutes() + 10);

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

    if (pendingAppointments.length === 0) return;

    // Get clinic data for template variables
    const clinic = await db.query.clinics.findFirst({
        where: eq(clinics.id, clinicId),
    });

    for (const appointment of pendingAppointments) {
        try {
            // Check if WA reminder was already sent for this appointment+type
            const alreadySent = await wasReminderSent(db, appointment.id, reminderType, 'whatsapp');
            if (alreadySent) {
                logger.info(`WA reminder ${type} already sent for appointment ${appointment.id}, skipping`);
                continue;
            }

            // Get patient with phone
            const patient = await db.query.patients.findFirst({
                where: eq(patients.id, appointment.patientId),
            });

            if (!patient?.phone) {
                logger.info(`No phone for patient ${appointment.patientId}, skipping WA reminder`);
                continue;
            }

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

            // Format date/time
            const dateFormatter = new Intl.DateTimeFormat('es-ES', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Madrid',
            });
            const timeFormatter = new Intl.DateTimeFormat('es-ES', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
            });

            const appointmentDate = dateFormatter.format(new Date(appointment.startTime));
            const appointmentTime = timeFormatter.format(new Date(appointment.startTime));

            // Define all available system variables
            const variableValues: Record<string, string> = {
                patient_name: `${patient.firstName} ${patient.lastName}`,
                appointment_date: appointmentDate,
                appointment_time: appointmentTime,
                clinic_name: clinic?.name || 'Clínica',
                doctor_name: doctorName,
                clinic_phone: clinic?.phone || '',
            };

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

            const reminderLabel = type === '24h' ? '⏰ Recordatorio 24h' : '⏰ Recordatorio 1h';
            const templateBody = `${reminderLabel}\n📅 ${appointmentDate}\n🕐 ${appointmentTime}\n👤 ${patient.firstName} ${patient.lastName}\n🏥 ${clinic?.name || 'Clínica'}\n👨‍⚕️ ${doctorName}`;

            // Send via ChatbotConversationService (userId null for automated)
            await ChatbotConversationService.sendTemplateMessage(
                db,
                clinicId,
                '', // system-sent, no user id
                patient.phone,
                templateName,
                'es',
                components,
                templateBody
            );

            // Log in notification_logs
            await db.insert(notificationLogs).values({
                clinicId,
                patientId: appointment.patientId,
                appointmentId: appointment.id,
                templateType: reminderType as any,
                channel: 'whatsapp',
                recipient: patient.phone,
                subject: templateName,
                status: 'SENT',
                sentAt: new Date(),
            });

            logger.info(`WA ${type} reminder sent for appointment ${appointment.id}`);
        } catch (err: any) {
            logger.error(`Failed to send WA reminder for appointment ${appointment.id}: ${err.message}`);
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
            // Process pending notifications for all active tenants
            const activeTenants = await centralDb.query.tenants.findMany({
                where: eq(tenants.isActive, true),
            });

            for (const tenant of activeTenants) {
                try {
                    const db = await tenantManager.getConnection(tenant.slug);
                    const count = await processPendingNotifications(db);
                    if (count > 0) {
                        logger.info(`[${tenant.slug}] Processed ${count} pending notification(s)`);
                    }
                } catch (err: any) {
                    logger.error(`[${tenant.slug}] Pending notifications processor error: ${err.message}`);
                }
            }
        } catch (err: any) {
            logger.error(`Pending notifications processor error: ${err.message}`);
        }
    });

    logger.info('Pending notifications processor started (runs every minute)');
};
