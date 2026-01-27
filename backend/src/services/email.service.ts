import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { emailSettings } from '../db/schema.js';
import { logger } from '../utils/logger.js';

export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    from?: string;
}

export interface SmtpConfig {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    fromName: string;
    fromEmail: string;
}

/**
 * Get email settings for a clinic
 */
export const getEmailSettings = async (clinicId: string) => {
    const settings = await db.query.emailSettings.findFirst({
        where: eq(emailSettings.clinicId, clinicId),
    });
    return settings;
};

/**
 * Update or create email settings for a clinic
 */
export const updateEmailSettings = async (
    clinicId: string,
    data: {
        smtpHost?: string;
        smtpPort?: number;
        smtpUser?: string;
        smtpPass?: string;
        fromName?: string;
        fromEmail?: string;
        isEnabled?: boolean;
        // Notification toggles
        sendOnCreate?: boolean;
        sendOnCancel?: boolean;
        reminder24hEnabled?: boolean;
        reminder1hEnabled?: boolean;
    }
) => {
    const existing = await getEmailSettings(clinicId);

    // Clean smtpPass - remove spaces (Google shows app passwords with spaces: xxxx xxxx xxxx xxxx)
    // Also ignore masked passwords (********) - don't overwrite real password with asterisks
    const isMaskedPassword = data.smtpPass && /^\*+$/.test(data.smtpPass);
    const cleanedData = {
        ...data,
        smtpPass: isMaskedPassword ? undefined : data.smtpPass?.replace(/\s/g, ''),
    };

    // Determine if fully configured (fromEmail optional, will use smtpUser)
    const isConfigured = Boolean(
        (cleanedData.smtpUser || existing?.smtpUser) &&
        (cleanedData.smtpPass || existing?.smtpPass)
    );

    if (existing) {
        const [updated] = await db
            .update(emailSettings)
            .set({
                ...cleanedData,
                isConfigured,
                updatedAt: new Date(),
            })
            .where(eq(emailSettings.clinicId, clinicId))
            .returning();
        return updated;
    } else {
        const [created] = await db
            .insert(emailSettings)
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
 * Create a nodemailer transporter for a clinic
 */
export const createTransporter = async (clinicId: string): Promise<Transporter | null> => {
    const settings = await getEmailSettings(clinicId);

    if (!settings || !settings.isConfigured || !settings.isEnabled) {
        logger.warn(`Email not configured for clinic ${clinicId}`);
        return null;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: settings.smtpHost || 'smtp.gmail.com',
            port: settings.smtpPort || 587,
            secure: settings.smtpPort === 465,
            auth: {
                user: settings.smtpUser!,
                pass: settings.smtpPass!,
            },
        });

        return transporter;
    } catch (error: any) {
        logger.error(`Failed to create email transporter: ${error.message}`);
        return null;
    }
};

/**
 * Send an email using clinic's SMTP settings
 */
export const sendEmail = async (
    clinicId: string,
    options: EmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    const settings = await getEmailSettings(clinicId);

    if (!settings || !settings.isConfigured || !settings.isEnabled) {
        return {
            success: false,
            error: 'Email no configurado para esta clínica',
        };
    }

    const transporter = await createTransporter(clinicId);

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

        logger.info(`Email sent successfully to ${options.to}, messageId: ${result.messageId}`);

        return {
            success: true,
            messageId: result.messageId,
        };
    } catch (error: any) {
        logger.error(`Failed to send email: ${error.message}`);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Test SMTP connection
 */
export const testConnection = async (
    clinicId: string
): Promise<{ success: boolean; error?: string }> => {
    const transporter = await createTransporter(clinicId);

    if (!transporter) {
        return {
            success: false,
            error: 'Email no configurado',
        };
    }

    try {
        await transporter.verify();
        return { success: true };
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Send a test email
 */
export const sendTestEmail = async (
    clinicId: string,
    to: string
): Promise<{ success: boolean; error?: string }> => {
    return sendEmail(clinicId, {
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

/**
 * Send a custom HTML email (for template preview)
 */
export const sendCustomEmail = async (
    clinicId: string,
    to: string,
    subject: string,
    html: string
): Promise<{ success: boolean; error?: string }> => {
    return sendEmail(clinicId, {
        to,
        subject,
        html,
    });
};
