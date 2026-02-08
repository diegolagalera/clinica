"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCustomEmail = exports.sendTestEmail = exports.testConnection = exports.sendEmail = exports.createTransporter = exports.updateEmailSettings = exports.getEmailSettings = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const logger_js_1 = require("../utils/logger.js");
/**
 * Get email settings for a clinic
 */
const getEmailSettings = async (clinicId) => {
    const settings = await index_js_1.db.query.emailSettings.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.emailSettings.clinicId, clinicId),
    });
    return settings;
};
exports.getEmailSettings = getEmailSettings;
/**
 * Update or create email settings for a clinic
 */
const updateEmailSettings = async (clinicId, data) => {
    const existing = await (0, exports.getEmailSettings)(clinicId);
    // Clean smtpPass - remove spaces (Google shows app passwords with spaces: xxxx xxxx xxxx xxxx)
    // Also ignore masked passwords (********) - don't overwrite real password with asterisks
    const isMaskedPassword = data.smtpPass && /^\*+$/.test(data.smtpPass);
    const cleanedData = {
        ...data,
        smtpPass: isMaskedPassword ? undefined : data.smtpPass?.replace(/\s/g, ''),
    };
    // Determine if fully configured (fromEmail optional, will use smtpUser)
    const isConfigured = Boolean((cleanedData.smtpUser || existing?.smtpUser) &&
        (cleanedData.smtpPass || existing?.smtpPass));
    if (existing) {
        const [updated] = await index_js_1.db
            .update(schema_js_1.emailSettings)
            .set({
            ...cleanedData,
            isConfigured,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_js_1.emailSettings.clinicId, clinicId))
            .returning();
        return updated;
    }
    else {
        const [created] = await index_js_1.db
            .insert(schema_js_1.emailSettings)
            .values({
            clinicId,
            ...cleanedData,
            isConfigured,
        })
            .returning();
        return created;
    }
};
exports.updateEmailSettings = updateEmailSettings;
/**
 * Create a nodemailer transporter for a clinic
 */
const createTransporter = async (clinicId) => {
    const settings = await (0, exports.getEmailSettings)(clinicId);
    if (!settings || !settings.isConfigured || !settings.isEnabled) {
        logger_js_1.logger.warn(`Email not configured for clinic ${clinicId}`);
        return null;
    }
    try {
        const transporter = nodemailer_1.default.createTransport({
            host: settings.smtpHost || 'smtp.gmail.com',
            port: settings.smtpPort || 587,
            secure: settings.smtpPort === 465,
            auth: {
                user: settings.smtpUser,
                pass: settings.smtpPass,
            },
        });
        return transporter;
    }
    catch (error) {
        logger_js_1.logger.error(`Failed to create email transporter: ${error.message}`);
        return null;
    }
};
exports.createTransporter = createTransporter;
/**
 * Send an email using clinic's SMTP settings
 */
const sendEmail = async (clinicId, options) => {
    const settings = await (0, exports.getEmailSettings)(clinicId);
    if (!settings || !settings.isConfigured || !settings.isEnabled) {
        return {
            success: false,
            error: 'Email no configurado para esta clínica',
        };
    }
    const transporter = await (0, exports.createTransporter)(clinicId);
    if (!transporter) {
        return {
            success: false,
            error: 'No se pudo crear el transportador de email',
        };
    }
    try {
        // Use fromEmail if set, otherwise use smtpUser (Gmail requires them to be the same)
        const senderEmail = settings.fromEmail || settings.smtpUser;
        const fromAddress = options.from || `"${settings.fromName || 'Clínica'}" <${senderEmail}>`;
        const result = await transporter.sendMail({
            from: fromAddress,
            to: options.to,
            subject: options.subject,
            html: options.html,
        });
        logger_js_1.logger.info(`Email sent successfully to ${options.to}, messageId: ${result.messageId}`);
        return {
            success: true,
            messageId: result.messageId,
        };
    }
    catch (error) {
        logger_js_1.logger.error(`Failed to send email: ${error.message}`);
        return {
            success: false,
            error: error.message,
        };
    }
};
exports.sendEmail = sendEmail;
/**
 * Test SMTP connection
 */
const testConnection = async (clinicId) => {
    const transporter = await (0, exports.createTransporter)(clinicId);
    if (!transporter) {
        return {
            success: false,
            error: 'Email no configurado',
        };
    }
    try {
        await transporter.verify();
        return { success: true };
    }
    catch (error) {
        return {
            success: false,
            error: error.message,
        };
    }
};
exports.testConnection = testConnection;
/**
 * Send a test email
 */
const sendTestEmail = async (clinicId, to) => {
    return (0, exports.sendEmail)(clinicId, {
        to,
        subject: '🧪 Prueba de correo - Sistema de Notificaciones',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #0891b2;">✅ Conexión exitosa</h2>
                <p>Este es un correo de prueba del sistema de notificaciones.</p>
                <p>Si recibes este mensaje, la configuración SMTP está funcionando correctamente.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #6b7280; font-size: 12px;">
                    Este correo fue enviado automáticamente por el sistema de notificaciones.
                </p>
            </div>
        `,
    });
};
exports.sendTestEmail = sendTestEmail;
/**
 * Send a custom HTML email (for template preview)
 */
const sendCustomEmail = async (clinicId, to, subject, html) => {
    return (0, exports.sendEmail)(clinicId, {
        to,
        subject,
        html,
    });
};
exports.sendCustomEmail = sendCustomEmail;
//# sourceMappingURL=email.service.js.map