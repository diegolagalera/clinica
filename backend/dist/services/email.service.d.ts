import type { Transporter } from 'nodemailer';
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
export declare const getEmailSettings: (clinicId: string) => Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    clinicId: string;
    smtpHost: string | null;
    smtpPort: number | null;
    smtpUser: string | null;
    smtpPass: string | null;
    fromName: string | null;
    fromEmail: string | null;
    isEnabled: boolean;
    isConfigured: boolean;
    sendOnCreate: boolean;
    sendOnCancel: boolean;
    reminder24hEnabled: boolean;
    reminder1hEnabled: boolean;
} | undefined>;
/**
 * Update or create email settings for a clinic
 */
export declare const updateEmailSettings: (clinicId: string, data: {
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    fromName?: string;
    fromEmail?: string;
    isEnabled?: boolean;
    sendOnCreate?: boolean;
    sendOnCancel?: boolean;
    reminder24hEnabled?: boolean;
    reminder1hEnabled?: boolean;
}) => Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    clinicId: string;
    smtpHost: string | null;
    smtpPort: number | null;
    smtpUser: string | null;
    smtpPass: string | null;
    fromName: string | null;
    fromEmail: string | null;
    isEnabled: boolean;
    isConfigured: boolean;
    sendOnCreate: boolean;
    sendOnCancel: boolean;
    reminder24hEnabled: boolean;
    reminder1hEnabled: boolean;
} | undefined>;
/**
 * Create a nodemailer transporter for a clinic
 */
export declare const createTransporter: (clinicId: string) => Promise<Transporter | null>;
/**
 * Send an email using clinic's SMTP settings
 */
export declare const sendEmail: (clinicId: string, options: EmailOptions) => Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
}>;
/**
 * Test SMTP connection
 */
export declare const testConnection: (clinicId: string) => Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Send a test email
 */
export declare const sendTestEmail: (clinicId: string, to: string) => Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Send a custom HTML email (for template preview)
 */
export declare const sendCustomEmail: (clinicId: string, to: string, subject: string, html: string) => Promise<{
    success: boolean;
    error?: string;
}>;
//# sourceMappingURL=email.service.d.ts.map