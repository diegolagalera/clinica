import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/index.js';
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
export const getEmailSettings = async (db: Database, clinicId: string) => {
    const settings = await db.query.emailSettings.findFirst({
        where: eq(emailSettings.clinicId, clinicId),
    });
    return settings;
};

/**
 * Update or create email settings for a clinic
 */
export const updateEmailSettings = async (
    db: Database,
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
    const existing = await getEmailSettings(db, clinicId);

    // Clean smtpPass - remove spaces (Google shows app passwords with spaces: xxxx xxxx xxxx xxxx)
    // Also ignore masked passwords (********) - don't overwrite real password with asterisks
    const isMaskedPassword = data.smtpPass && /^\*+$/.test(data.smtpPass);
    const cleanedData: Record<string, any> = { ...data };
    if (isMaskedPassword) {
        delete cleanedData.smtpPass;
    } else if (data.smtpPass) {
        cleanedData.smtpPass = data.smtpPass.replace(/\s/g, '');
    }

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
export const createTransporter = async (db: Database, clinicId: string): Promise<Transporter | null> => {
    const settings = await getEmailSettings(db, clinicId);

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
    db: Database,
    clinicId: string,
    options: EmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    const settings = await getEmailSettings(db, clinicId);

    if (!settings || !settings.isConfigured || !settings.isEnabled) {
        return {
            success: false,
            error: 'Email no configurado para esta clínica',
        };
    }

    const transporter = await createTransporter(db, clinicId);

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
    db: Database,
    clinicId: string
): Promise<{ success: boolean; error?: string }> => {
    const transporter = await createTransporter(db, clinicId);

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
    db: Database,
    clinicId: string,
    to: string
): Promise<{ success: boolean; error?: string }> => {
    return sendEmail(db, clinicId, {
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
    db: Database,
    clinicId: string,
    to: string,
    subject: string,
    html: string
): Promise<{ success: boolean; error?: string }> => {
    return sendEmail(db, clinicId, {
        to,
        subject,
        html,
    });
};

// ==========================================
// SYSTEM-LEVEL EMAIL (ERP Platform)
// Uses global env vars, not clinic-specific
// ==========================================

import { config } from '../config/env.js';

/**
 * Create a transporter for system-level emails (password reset, etc.)
 * Uses global SMTP configuration from environment variables
 */
export const createSystemTransporter = (): Transporter | null => {
    const { host, port, user, pass, from } = config.email;

    if (!user || !pass) {
        logger.warn('System SMTP not configured - missing SMTP_USER or SMTP_PASS');
        return null;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: host || 'smtp.gmail.com',
            port: port || 587,
            secure: port === 465,
            auth: {
                user,
                pass,
            },
        });

        return transporter;
    } catch (error: any) {
        logger.error(`Failed to create system email transporter: ${error.message}`);
        return null;
    }
};

/**
 * Send a system-level email (password reset, verification, etc.)
 */
export const sendSystemEmail = async (
    options: EmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    const transporter = createSystemTransporter();

    if (!transporter) {
        return {
            success: false,
            error: 'System SMTP not configured',
        };
    }

    try {
        const { from } = config.email;
        const fromAddress = options.from || `"Cuspia" <${from}>`;

        const result = await transporter.sendMail({
            from: fromAddress,
            to: options.to,
            subject: options.subject,
            html: options.html,
        });

        logger.info(`System email sent to ${options.to}, messageId: ${result.messageId}`);

        return {
            success: true,
            messageId: result.messageId,
        };
    } catch (error: any) {
        logger.error(`Failed to send system email: ${error.message}`);
        return {
            success: false,
            error: error.message,
        };
    }
};
/**
 * Send password reset email with embedded logo using CID
 */
export const sendPasswordResetEmail = async (
    email: string,
    resetToken: string
): Promise<{ success: boolean; error?: string }> => {
    const transporter = createSystemTransporter();

    if (!transporter) {
        return {
            success: false,
            error: 'System SMTP not configured',
        };
    }

    const frontendUrl = config.frontend.url || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Read logo file for CID attachment
    let logoAttachment;

    try {
        const fs = await import('fs');
        const path = await import('path');
        // Resolve path relative to project root
        const projectRoot = path.resolve(process.cwd(), '..');
        const absoluteLogoPath = path.join(projectRoot, 'frontend/src/assets/img/logo_comprimidov2.jpg');

        if (fs.existsSync(absoluteLogoPath)) {
            logoAttachment = {
                filename: 'logo.jpg',
                path: absoluteLogoPath,
                cid: 'cuspia-logo'
            };
        }
    } catch (e) {
        logger.warn('Could not load logo for email');
    }

    const htmlContent = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8fafc;">
            <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <div style="text-align: center; margin-bottom: 30px;">
                    ${logoAttachment
            ? '<img src="cid:cuspia-logo" alt="CUSPIA" style="width: 100px; height: 100px; border-radius: 16px; object-fit: cover;" />'
            : '<div style="display: inline-block; background: linear-gradient(135deg, #0891b2, #06b6d4); width: 80px; height: 80px; border-radius: 20px; line-height: 80px;"><span style="color: white; font-size: 32px; font-weight: bold;">C</span></div>'
        }
                    <h1 style="color: #0f172a; margin: 20px 0 10px; font-size: 24px;">Restablecer Contraseña</h1>
                </div>
                
                <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                    Hemos recibido una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" 
                       style="display: inline-block; background: linear-gradient(135deg, #0891b2, #06b6d4); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        Restablecer Contraseña
                    </a>
                </div>
                
                <p style="color: #94a3b8; font-size: 14px; margin-top: 30px;">
                    Este enlace expirará en <strong>1 hora</strong>. Si no solicitaste el cambio, ignora este correo.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                    Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                    <a href="${resetLink}" style="color: #0891b2; word-break: break-all;">${resetLink}</a>
                </p>
            </div>
            
            <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 20px;">
                © ${new Date().getFullYear()} Cuspia. Todos los derechos reservados.
            </p>
        </div>
    `;

    try {
        const { from } = config.email;
        const fromAddress = `"Cuspia" <${from}>`;

        const mailOptions: any = {
            from: fromAddress,
            to: email,
            subject: '🔐 Restablecer tu contraseña - Cuspia',
            html: htmlContent,
        };

        if (logoAttachment) {
            mailOptions.attachments = [logoAttachment];
        }

        const result = await transporter.sendMail(mailOptions);

        logger.info(`Password reset email sent to ${email}, messageId: ${result.messageId}`);

        return {
            success: true,
        };
    } catch (error: any) {
        logger.error(`Failed to send password reset email: ${error.message}`);
        return {
            success: false,
            error: error.message,
        };
    }
};

// ==========================================
// BUG REPORT EMAIL
// ==========================================

interface BugReportEmailData {
    reportId: string;
    title: string;
    description: string;
    category: string;
    pageUrl: string;
    userAgent: string;
    userName: string;
    userEmail: string;
    clinicName: string;
    organizationName: string;
    createdAt: Date;
}

/**
 * Send a bug report email to the support team
 */
export const sendBugReportEmail = async (data: BugReportEmailData): Promise<{ success: boolean; error?: string }> => {
    try {
        const transporter = createSystemTransporter();

        if (!transporter) {
            logger.warn('System email transporter not configured, skipping bug report email');
            return { success: false, error: 'Email transporter not configured' };
        }

        const supportEmail = config.support.email;
        const from = config.email.from || config.email.user;

        const categoryLabels: Record<string, string> = {
            'UI': '🎨 Interfaz de Usuario',
            'FUNCTIONALITY': '⚙️ Funcionalidad',
            'DATA': '💾 Datos',
            'PERFORMANCE': '🚀 Rendimiento',
            'OTHER': '📋 Otro',
        };

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 24px; }
        .field { margin-bottom: 16px; }
        .label { font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
        .value { color: #111827; font-size: 14px; padding: 8px 12px; background: #f9fafb; border-radius: 6px; border-left: 3px solid #0284c7; }
        .description { white-space: pre-wrap; }
        .category-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: #fef3c7; color: #92400e; }
        .footer { padding: 16px 24px; background: #f9fafb; text-align: center; font-size: 12px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐛 Nuevo Reporte de Error</h1>
        </div>
        <div class="content">
            <div class="field">
                <div class="label">ID del Reporte</div>
                <div class="value" style="font-family: monospace;">${data.reportId}</div>
            </div>
            <div class="field">
                <div class="label">Categoría</div>
                <div class="value"><span class="category-badge">${categoryLabels[data.category] || data.category}</span></div>
            </div>
            <div class="field">
                <div class="label">Título</div>
                <div class="value"><strong>${data.title}</strong></div>
            </div>
            <div class="field">
                <div class="label">Descripción</div>
                <div class="value description">${data.description}</div>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <div class="field">
                <div class="label">Reportado por</div>
                <div class="value">${data.userName} (${data.userEmail})</div>
            </div>
            <div class="field">
                <div class="label">Organización / Clínica</div>
                <div class="value">${data.organizationName} / ${data.clinicName}</div>
            </div>
            <div class="field">
                <div class="label">URL de la página</div>
                <div class="value" style="word-break: break-all;">${data.pageUrl}</div>
            </div>
            <div class="field">
                <div class="label">Navegador / Dispositivo</div>
                <div class="value" style="font-size: 11px; word-break: break-all;">${data.userAgent}</div>
            </div>
            <div class="field">
                <div class="label">Fecha del reporte</div>
                <div class="value">${data.createdAt.toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}</div>
            </div>
        </div>
        <div class="footer">
            Este email fue generado automáticamente por CUSPIA ERP
        </div>
    </div>
</body>
</html>
`;

        await transporter.sendMail({
            from: `"CUSPIA - Reporte de Error" <${from}>`,
            to: supportEmail,
            subject: `🐛 [Bug Report] ${data.category}: ${data.title}`,
            html: htmlContent,
        });

        logger.info('Bug report email sent', { reportId: data.reportId, to: supportEmail });
        return { success: true };
    } catch (error: any) {
        logger.error('Failed to send bug report email', { error: error.message });
        return { success: false, error: error.message };
    }
};

