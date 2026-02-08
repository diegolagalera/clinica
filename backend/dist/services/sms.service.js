"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultSmsTemplates = exports.renderSmsContent = exports.deleteSmsTemplate = exports.updateSmsTemplate = exports.createSmsTemplate = exports.getActiveSmsTemplate = exports.getSmsTemplates = exports.sendSms = exports.sendTestSms = exports.testConnection = exports.updateSmsSettings = exports.getSmsSettings = exports.SMS_VARIABLES = void 0;
const twilio_1 = __importDefault(require("twilio"));
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const logger_js_1 = require("../utils/logger.js");
// Template variables
exports.SMS_VARIABLES = {
    patient_name: 'Nombre del paciente',
    appointment_date: 'Fecha de la cita',
    appointment_time: 'Hora de la cita',
    clinic_name: 'Nombre de la clínica',
    clinic_phone: 'Teléfono de la clínica',
    doctor_name: 'Nombre del profesional',
};
// Default templates
const DEFAULT_TEMPLATES = {
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
const sanitizeSenderId = (senderId) => {
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
const getSmsSettings = async (clinicId) => {
    return index_js_1.db.query.smsSettings.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.smsSettings.clinicId, clinicId),
    });
};
exports.getSmsSettings = getSmsSettings;
/**
 * Update or create SMS settings
 */
const updateSmsSettings = async (clinicId, data) => {
    const existing = await (0, exports.getSmsSettings)(clinicId);
    // Mask auth token if it's already saved and user sends asterisks
    const isMaskedToken = data.authToken && /^\*+$/.test(data.authToken);
    // Sanitize Sender ID if provided
    const sanitizedFromNumber = data.fromNumber ? sanitizeSenderId(data.fromNumber) : undefined;
    // Build cleanedData excluding undefined values to avoid TypeScript errors with Drizzle
    const cleanedData = { ...data };
    // Handle authToken
    if (isMaskedToken) {
        delete cleanedData.authToken;
    }
    // Handle fromNumber
    if (sanitizedFromNumber) {
        cleanedData.fromNumber = sanitizedFromNumber;
    }
    else {
        delete cleanedData.fromNumber;
    }
    // Determine if fully configured
    const isConfigured = Boolean((cleanedData.accountSid || existing?.accountSid) &&
        (cleanedData.authToken || existing?.authToken) &&
        (cleanedData.fromNumber || existing?.fromNumber));
    if (existing) {
        const [updated] = await index_js_1.db
            .update(schema_js_1.smsSettings)
            .set({
            ...cleanedData,
            isConfigured,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_js_1.smsSettings.clinicId, clinicId))
            .returning();
        return updated;
    }
    else {
        const [created] = await index_js_1.db
            .insert(schema_js_1.smsSettings)
            .values({
            clinicId,
            ...cleanedData,
            isConfigured,
        })
            .returning();
        return created;
    }
};
exports.updateSmsSettings = updateSmsSettings;
/**
 * Create Twilio client for a clinic
 */
const getTwilioClient = async (clinicId) => {
    const settings = await (0, exports.getSmsSettings)(clinicId);
    if (!settings?.accountSid || !settings?.authToken) {
        throw new Error('Twilio not configured');
    }
    return (0, twilio_1.default)(settings.accountSid, settings.authToken);
};
/**
 * Test Twilio connection
 */
const testConnection = async (clinicId) => {
    try {
        const client = await getTwilioClient(clinicId);
        // Verify account by fetching account info
        await client.api.accounts(client.accountSid).fetch();
        return { success: true };
    }
    catch (err) {
        logger_js_1.logger.error('Twilio connection test failed', { error: err.message });
        return { success: false, error: err.message || 'Error de conexión' };
    }
};
exports.testConnection = testConnection;
/**
 * Send test SMS
 */
const sendTestSms = async (clinicId, toNumber) => {
    try {
        const settings = await (0, exports.getSmsSettings)(clinicId);
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
        logger_js_1.logger.info('Test SMS sent', { sid: result.sid, to: toNumber });
        return { success: true };
    }
    catch (err) {
        logger_js_1.logger.error('Test SMS failed', { error: err.message });
        return { success: false, error: err.message || 'Error al enviar SMS' };
    }
};
exports.sendTestSms = sendTestSms;
/**
 * Send SMS
 */
const sendSms = async (clinicId, toNumber, content) => {
    try {
        const settings = await (0, exports.getSmsSettings)(clinicId);
        if (!settings?.isEnabled || !settings?.isConfigured) {
            return { success: false, error: 'SMS no habilitado o configurado' };
        }
        // Sanitize the fromNumber in case it has legacy bad values
        const sanitizedFrom = sanitizeSenderId(settings.fromNumber);
        const client = await getTwilioClient(clinicId);
        const result = await client.messages.create({
            body: content,
            from: sanitizedFrom,
            to: toNumber,
        });
        logger_js_1.logger.info('SMS sent', { sid: result.sid, to: toNumber });
        return { success: true, sid: result.sid };
    }
    catch (err) {
        logger_js_1.logger.error('SMS send failed', { error: err.message, to: toNumber });
        return { success: false, error: err.message };
    }
};
exports.sendSms = sendSms;
// ============================================================================
// SMS TEMPLATES
// ============================================================================
/**
 * Get all SMS templates for a clinic
 */
const getSmsTemplates = async (clinicId) => {
    return index_js_1.db.query.smsTemplates.findMany({
        where: (0, drizzle_orm_1.eq)(schema_js_1.smsTemplates.clinicId, clinicId),
        orderBy: [(0, drizzle_orm_1.desc)(schema_js_1.smsTemplates.createdAt)],
    });
};
exports.getSmsTemplates = getSmsTemplates;
/**
 * Get active SMS template by type
 */
const getActiveSmsTemplate = async (clinicId, type) => {
    // First try to get an active custom template
    const customTemplate = await index_js_1.db.query.smsTemplates.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.smsTemplates.clinicId, clinicId), (0, drizzle_orm_1.eq)(schema_js_1.smsTemplates.type, type), (0, drizzle_orm_1.eq)(schema_js_1.smsTemplates.isActive, true)),
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
exports.getActiveSmsTemplate = getActiveSmsTemplate;
/**
 * Create SMS template
 */
const createSmsTemplate = async (clinicId, data) => {
    const [template] = await index_js_1.db
        .insert(schema_js_1.smsTemplates)
        .values({
        clinicId,
        ...data,
    })
        .returning();
    return template;
};
exports.createSmsTemplate = createSmsTemplate;
/**
 * Update SMS template
 */
const updateSmsTemplate = async (templateId, data) => {
    const [updated] = await index_js_1.db
        .update(schema_js_1.smsTemplates)
        .set({
        ...data,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.smsTemplates.id, templateId))
        .returning();
    return updated;
};
exports.updateSmsTemplate = updateSmsTemplate;
/**
 * Delete SMS template
 */
const deleteSmsTemplate = async (templateId) => {
    await index_js_1.db.delete(schema_js_1.smsTemplates).where((0, drizzle_orm_1.eq)(schema_js_1.smsTemplates.id, templateId));
};
exports.deleteSmsTemplate = deleteSmsTemplate;
/**
 * Render SMS content with variables
 */
const renderSmsContent = (content, variables) => {
    let rendered = content;
    for (const [key, value] of Object.entries(variables)) {
        rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return rendered;
};
exports.renderSmsContent = renderSmsContent;
/**
 * Get default templates list
 */
const getDefaultSmsTemplates = () => {
    return Object.entries(DEFAULT_TEMPLATES)
        .filter(([type]) => type !== 'CUSTOM')
        .map(([type, template]) => ({
        type,
        name: template.name,
        content: template.content,
        isDefault: true,
    }));
};
exports.getDefaultSmsTemplates = getDefaultSmsTemplates;
//# sourceMappingURL=sms.service.js.map