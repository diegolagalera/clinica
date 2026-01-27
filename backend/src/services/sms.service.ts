import twilio from 'twilio';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { smsSettings, smsTemplates, notificationLogs, patients, appointments, clinics } from '../db/schema.js';
import { logger } from '../utils/logger.js';

// SMS Template types
export type SmsTemplateType =
    | 'APPOINTMENT_CREATED'
    | 'APPOINTMENT_REMINDER_24H'
    | 'APPOINTMENT_REMINDER_1H'
    | 'APPOINTMENT_CANCELLED'
    | 'CUSTOM';

// Template variables
export const SMS_VARIABLES = {
    patient_name: 'Nombre del paciente',
    appointment_date: 'Fecha de la cita',
    appointment_time: 'Hora de la cita',
    clinic_name: 'Nombre de la clínica',
    clinic_phone: 'Teléfono de la clínica',
    doctor_name: 'Nombre del profesional',
};

// Default templates
const DEFAULT_TEMPLATES: Record<SmsTemplateType, { name: string; content: string }> = {
    APPOINTMENT_CREATED: {
        name: 'Cita Confirmada',
        content: 'Hola {{patient_name}}, tu cita en {{clinic_name}} está confirmada para el {{appointment_date}} a las {{appointment_time}}. Tel: {{clinic_phone}}',
    },
    APPOINTMENT_REMINDER_24H: {
        name: 'Recordatorio 24h',
        content: 'Recordatorio: Mañana tienes cita en {{clinic_name}} a las {{appointment_time}}. ¡Te esperamos!',
    },
    APPOINTMENT_REMINDER_1H: {
        name: 'Recordatorio 1h',
        content: 'Tu cita en {{clinic_name}} es en 1 hora ({{appointment_time}}). ¡Nos vemos pronto!',
    },
    APPOINTMENT_CANCELLED: {
        name: 'Cita Cancelada',
        content: 'Tu cita del {{appointment_date}} en {{clinic_name}} ha sido cancelada. Contacta al {{clinic_phone}} para reprogramar.',
    },
    CUSTOM: {
        name: 'Personalizada',
        content: '',
    },
};

/**
 * Sanitize Sender ID for Twilio Alphanumeric Sender ID
 * - Max 11 characters
 * - No spaces
 * - Only alphanumeric characters
 * If it's a phone number (starts with +), leave it as is
 */
const sanitizeSenderId = (senderId: string): string => {
    // If it's a phone number, don't modify it
    if (senderId.startsWith('+')) {
        return senderId;
    }

    // Remove spaces and special characters, keep only alphanumeric
    const cleaned = senderId.replace(/[^a-zA-Z0-9]/g, '');

    // Limit to 11 characters
    return cleaned.substring(0, 11);
};

/**
 * Get SMS settings for a clinic
 */
export const getSmsSettings = async (clinicId: string) => {
    return db.query.smsSettings.findFirst({
        where: eq(smsSettings.clinicId, clinicId),
    });
};

/**
 * Update or create SMS settings
 */
export const updateSmsSettings = async (
    clinicId: string,
    data: {
        accountSid?: string;
        authToken?: string;
        fromNumber?: string;
        isEnabled?: boolean;
        sendOnCreate?: boolean;
        sendOnCancel?: boolean;
        reminder24hEnabled?: boolean;
        reminder1hEnabled?: boolean;
    }
) => {
    const existing = await getSmsSettings(clinicId);

    // Mask auth token if it's already saved and user sends asterisks
    const isMaskedToken = data.authToken && /^\*+$/.test(data.authToken);

    // Sanitize Sender ID if provided
    const sanitizedFromNumber = data.fromNumber ? sanitizeSenderId(data.fromNumber) : undefined;

    // Build cleanedData excluding undefined values to avoid TypeScript errors with Drizzle
    const cleanedData: Record<string, any> = { ...data };

    // Handle authToken
    if (isMaskedToken) {
        delete cleanedData.authToken;
    }

    // Handle fromNumber
    if (sanitizedFromNumber) {
        cleanedData.fromNumber = sanitizedFromNumber;
    } else {
        delete cleanedData.fromNumber;
    }

    // Determine if fully configured
    const isConfigured = Boolean(
        (cleanedData.accountSid || existing?.accountSid) &&
        (cleanedData.authToken || existing?.authToken) &&
        (cleanedData.fromNumber || existing?.fromNumber)
    );

    if (existing) {
        const [updated] = await db
            .update(smsSettings)
            .set({
                ...cleanedData,
                isConfigured,
                updatedAt: new Date(),
            })
            .where(eq(smsSettings.clinicId, clinicId))
            .returning();
        return updated;
    } else {
        const [created] = await db
            .insert(smsSettings)
            .values({
                clinicId,
                ...cleanedData,
                isConfigured,
            })
            .returning();
        return created;
    }
};

/**
 * Create Twilio client for a clinic
 */
const getTwilioClient = async (clinicId: string) => {
    const settings = await getSmsSettings(clinicId);
    if (!settings?.accountSid || !settings?.authToken) {
        throw new Error('Twilio not configured');
    }
    return twilio(settings.accountSid, settings.authToken);
};

/**
 * Test Twilio connection
 */
export const testConnection = async (clinicId: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const client = await getTwilioClient(clinicId);
        // Verify account by fetching account info
        await client.api.accounts(client.accountSid).fetch();
        return { success: true };
    } catch (err: any) {
        logger.error('Twilio connection test failed', { error: err.message });
        return { success: false, error: err.message || 'Error de conexión' };
    }
};

/**
 * Send test SMS
 */
export const sendTestSms = async (clinicId: string, toNumber: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const settings = await getSmsSettings(clinicId);
        if (!settings?.fromNumber) {
            throw new Error('Número de origen no configurado');
        }

        // Sanitize the fromNumber in case it has legacy bad values
        const sanitizedFrom = sanitizeSenderId(settings.fromNumber);

        const client = await getTwilioClient(clinicId);
        const result = await client.messages.create({
            body: '🔔 SMS de prueba desde tu clínica. ¡La configuración de Twilio funciona correctamente!',
            from: sanitizedFrom,
            to: toNumber,
        });

        logger.info('Test SMS sent', { sid: result.sid, to: toNumber });
        return { success: true };
    } catch (err: any) {
        logger.error('Test SMS failed', { error: err.message });
        return { success: false, error: err.message || 'Error al enviar SMS' };
    }
};

/**
 * Send SMS
 */
export const sendSms = async (
    clinicId: string,
    toNumber: string,
    content: string
): Promise<{ success: boolean; sid?: string; error?: string }> => {
    try {
        const settings = await getSmsSettings(clinicId);
        if (!settings?.isEnabled || !settings?.isConfigured) {
            return { success: false, error: 'SMS no habilitado o configurado' };
        }

        // Sanitize the fromNumber in case it has legacy bad values
        const sanitizedFrom = sanitizeSenderId(settings.fromNumber!);

        const client = await getTwilioClient(clinicId);
        const result = await client.messages.create({
            body: content,
            from: sanitizedFrom,
            to: toNumber,
        });

        logger.info('SMS sent', { sid: result.sid, to: toNumber });
        return { success: true, sid: result.sid };
    } catch (err: any) {
        logger.error('SMS send failed', { error: err.message, to: toNumber });
        return { success: false, error: err.message };
    }
};

// ============================================================================
// SMS TEMPLATES
// ============================================================================

/**
 * Get all SMS templates for a clinic
 */
export const getSmsTemplates = async (clinicId: string) => {
    return db.query.smsTemplates.findMany({
        where: eq(smsTemplates.clinicId, clinicId),
        orderBy: [desc(smsTemplates.createdAt)],
    });
};

/**
 * Get active SMS template by type
 */
export const getActiveSmsTemplate = async (clinicId: string, type: SmsTemplateType) => {
    // First try to get an active custom template
    const customTemplate = await db.query.smsTemplates.findFirst({
        where: and(
            eq(smsTemplates.clinicId, clinicId),
            eq(smsTemplates.type, type),
            eq(smsTemplates.isActive, true)
        ),
    });

    if (customTemplate) {
        return customTemplate;
    }

    // Return default template
    const defaultTemplate = DEFAULT_TEMPLATES[type];
    if (defaultTemplate) {
        return {
            id: `default-${type}`,
            type,
            name: defaultTemplate.name,
            content: defaultTemplate.content,
            isActive: true,
            isDefault: true,
        };
    }

    return null;
};

/**
 * Create SMS template
 */
export const createSmsTemplate = async (
    clinicId: string,
    data: {
        type: SmsTemplateType;
        name: string;
        content: string;
        isActive?: boolean;
    }
) => {
    const [template] = await db
        .insert(smsTemplates)
        .values({
            clinicId,
            ...data,
        })
        .returning();
    return template;
};

/**
 * Update SMS template
 */
export const updateSmsTemplate = async (
    templateId: string,
    data: {
        name?: string;
        content?: string;
        isActive?: boolean;
    }
) => {
    const [updated] = await db
        .update(smsTemplates)
        .set({
            ...data,
            updatedAt: new Date(),
        })
        .where(eq(smsTemplates.id, templateId))
        .returning();
    return updated;
};

/**
 * Delete SMS template
 */
export const deleteSmsTemplate = async (templateId: string) => {
    await db.delete(smsTemplates).where(eq(smsTemplates.id, templateId));
};

/**
 * Render SMS content with variables
 */
export const renderSmsContent = (content: string, variables: Record<string, string>): string => {
    let rendered = content;
    for (const [key, value] of Object.entries(variables)) {
        rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return rendered;
};

/**
 * Get default templates list
 */
export const getDefaultSmsTemplates = () => {
    return Object.entries(DEFAULT_TEMPLATES)
        .filter(([type]) => type !== 'CUSTOM')
        .map(([type, template]) => ({
            type,
            name: template.name,
            content: template.content,
            isDefault: true,
        }));
};
