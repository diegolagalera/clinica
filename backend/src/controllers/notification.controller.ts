import type { Response } from 'express';
import { z } from 'zod';
import * as emailService from '../services/email.service.js';
import * as templateService from '../services/email-template.service.js';
import * as notificationService from '../services/notification.service.js';
import * as aiService from '../services/ai.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

// Validation schemas
const settingsSchema = z.object({
    smtpHost: z.string().optional(),
    smtpPort: z.number().optional(),
    smtpUser: z.string().email().optional(),
    smtpPass: z.string().optional(),
    fromName: z.string().optional(),
    fromEmail: z.union([z.string().email(), z.literal(''), z.null()]).optional().transform(val => (val === '' || val === null) ? undefined : val),
    isEnabled: z.boolean().optional(),
    // Notification toggles
    sendOnCreate: z.boolean().optional(),
    sendOnCancel: z.boolean().optional(),
    reminder24hEnabled: z.boolean().optional(),
    reminder1hEnabled: z.boolean().optional(),
});

const templateSchema = z.object({
    type: z.enum([
        'APPOINTMENT_CREATED',
        'APPOINTMENT_REMINDER_24H',
        'APPOINTMENT_REMINDER_1H',
        'APPOINTMENT_CANCELLED',
        'DOCUMENT_SIGNED',
        'CUSTOM',
    ]),
    name: z.string().min(1).max(100),
    subject: z.string().min(1).max(255),
    blocks: z.array(z.any()),
    isActive: z.boolean().optional(),
});

/**
 * GET /notifications/status
 * Check if email notifications are enabled (available to all authenticated users)
 */
export const getStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.json(success({ emailEnabled: false, smsEnabled: false }));
        return;
    }

    const settings = await emailService.getEmailSettings(clinicId);
    const emailEnabled = settings?.isEnabled && !!settings?.smtpHost && !!settings?.smtpUser;

    res.json(success({
        emailEnabled: !!emailEnabled,
        smsEnabled: false, // TODO: add SMS status check
    }));
});

/**
 * GET /notifications/settings
 */
export const getSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const settings = await emailService.getEmailSettings(clinicId);

    // Don't expose password
    const safeSettings = settings ? {
        ...settings,
        smtpPass: settings.smtpPass ? '********' : null,
    } : null;

    res.json(success(safeSettings));
});

/**
 * PUT /notifications/settings
 */
export const updateSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const input = settingsSchema.parse(req.body);
    const settings = await emailService.updateEmailSettings(clinicId, input);

    res.json(success({
        ...settings,
        smtpPass: settings.smtpPass ? '********' : null,
    }, 'Configuración actualizada'));
});

/**
 * POST /notifications/settings/test
 */
export const testConnection = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const result = await emailService.testConnection(clinicId);

    if (result.success) {
        res.json(success(null, 'Conexión exitosa'));
    } else {
        res.status(400).json({ success: false, message: result.error });
    }
});

/**
 * POST /notifications/settings/test-email
 */
export const sendTestEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const { email } = req.body;
    if (!email) {
        res.status(400).json({ success: false, message: 'Email requerido' });
        return;
    }

    const result = await emailService.sendTestEmail(clinicId, email);

    if (result.success) {
        res.json(success(null, 'Email de prueba enviado'));
    } else {
        res.status(400).json({ success: false, message: result.error });
    }
});

/**
 * POST /notifications/send-test (custom HTML test)
 */
export const sendCustomTestEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const { email, subject, html } = req.body;
    if (!email || !html) {
        res.status(400).json({ success: false, message: 'Email y HTML requeridos' });
        return;
    }

    const result = await emailService.sendCustomEmail(clinicId, email, subject || 'Email de prueba', html);

    if (result.success) {
        res.json(success(null, 'Email de prueba enviado'));
    } else {
        res.status(400).json({ success: false, message: result.error });
    }
});

/**
 * GET /notifications/templates
 */
export const getTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const templates = await templateService.getTemplates(clinicId);
    res.json(success(templates));
});

/**
 * GET /notifications/templates/types
 */
export const getTemplateTypes = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const types = templateService.getTemplateTypes();
    res.json(success(types));
});

/**
 * GET /notifications/templates/default/:type
 */
export const getDefaultTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { type } = req.params;
    const template = templateService.getDefaultTemplate(type as templateService.EmailTemplateType);
    res.json(success(template));
});

/**
 * GET /notifications/templates/:id
 */
export const getTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    const { id } = req.params;

    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const template = await templateService.getTemplateById(id!, clinicId);

    if (!template) {
        res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
        return;
    }

    res.json(success(template));
});

/**
 * POST /notifications/templates
 */
export const createTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const input = templateSchema.parse(req.body);
    const template = await templateService.createTemplate(clinicId, input);

    res.status(201).json(success(template, 'Plantilla creada'));
});

/**
 * PUT /notifications/templates/:id
 */
export const updateTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    const { id } = req.params;

    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const input = templateSchema.partial().parse(req.body);
    const template = await templateService.updateTemplate(id!, clinicId, input);

    if (!template) {
        res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
        return;
    }

    res.json(success(template, 'Plantilla actualizada'));
});

/**
 * DELETE /notifications/templates/:id
 */
export const deleteTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    const { id } = req.params;

    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    await templateService.deleteTemplate(id!, clinicId);
    res.json(success(null, 'Plantilla eliminada'));
});

/**
 * POST /notifications/templates/:id/preview
 */
export const previewTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    const { id } = req.params;

    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    let template;
    if (id === 'default') {
        const { type } = req.body;
        template = templateService.getDefaultTemplate(type || 'APPOINTMENT_CREATED');
    } else {
        template = await templateService.getTemplateById(id!, clinicId);
    }

    if (!template) {
        res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
        return;
    }

    // Sample data for preview
    const sampleVariables = {
        patient_name: 'María García López',
        patient_email: 'maria@ejemplo.com',
        appointment_date: 'lunes, 27 de enero de 2026',
        appointment_time: '10:30',
        appointment_type: 'Revisión dental',
        clinic_name: 'Clínica Dental Centro',
        clinic_phone: '+34 612 345 678',
        clinic_address: 'Calle Principal 123, Madrid',
        doctor_name: 'Dr. Juan Pérez',
    };

    const html = templateService.renderBlocksToHtml(template.blocks as templateService.TemplateBlock[]);
    const finalHtml = templateService.replaceVariables(html, sampleVariables);
    const finalSubject = templateService.replaceVariables(template.subject, sampleVariables);

    res.json(success({ html: finalHtml, subject: finalSubject }));
});

/**
 * POST /notifications/templates/:id/test
 */
export const testTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    const { id } = req.params;
    const { email } = req.body;

    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    if (!email) {
        res.status(400).json({ success: false, message: 'Email requerido' });
        return;
    }

    let template;
    if (id === 'default') {
        const { type } = req.body;
        template = templateService.getDefaultTemplate(type || 'APPOINTMENT_CREATED');
    } else {
        template = await templateService.getTemplateById(id!, clinicId);
    }

    if (!template) {
        res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
        return;
    }

    // Sample data for test
    const sampleVariables = {
        patient_name: 'María García López',
        patient_email: email,
        appointment_date: 'lunes, 27 de enero de 2026',
        appointment_time: '10:30',
        appointment_type: 'Revisión dental',
        clinic_name: 'Clínica Dental Centro',
        clinic_phone: '+34 612 345 678',
        clinic_address: 'Calle Principal 123, Madrid',
        doctor_name: 'Dr. Juan Pérez',
    };

    const html = templateService.renderBlocksToHtml(template.blocks as templateService.TemplateBlock[]);
    const finalHtml = templateService.replaceVariables(html, sampleVariables);
    const finalSubject = templateService.replaceVariables(template.subject, sampleVariables);

    const result = await emailService.sendEmail(clinicId, {
        to: email,
        subject: `[PRUEBA] ${finalSubject}`,
        html: finalHtml,
    });

    if (result.success) {
        res.json(success(null, 'Email de prueba enviado'));
    } else {
        res.status(400).json({ success: false, message: result.error });
    }
});

/**
 * GET /notifications/logs
 */
export const getLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const limit = parseInt(req.query['limit'] as string) || 50;
    const offset = parseInt(req.query['offset'] as string) || 0;

    const logs = await notificationService.getNotificationLogs(clinicId, { limit, offset });
    res.json(success(logs));
});

/**
 * GET /notifications/stats
 */
export const getStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const stats = await notificationService.getNotificationStats(clinicId);
    res.json(success(stats));
});

/**
 * POST /notifications/templates/generate (AI generation)
 */
export const generateTemplateWithAI = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Check if AI is available
    if (!aiService.isAIAvailable()) {
        res.status(503).json({
            success: false,
            message: 'El servicio de IA no está disponible.',
            code: 'API_KEY_MISSING'
        });
        return;
    }

    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({
            success: false,
            message: 'Se requiere una descripción de la plantilla.',
            code: 'INVALID_REQUEST'
        });
        return;
    }

    const clinicId = req.tenantContext?.clinicId || undefined;
    const result = await aiService.generateEmailTemplate(prompt, clinicId);

    if (!result.success) {
        const statusCode = result.code === 'INVALID_REQUEST' ? 400 :
            result.code === 'RATE_LIMIT' ? 429 :
                result.code === 'API_KEY_MISSING' ? 503 : 500;

        res.status(statusCode).json({
            success: false,
            message: result.error,
            code: result.code
        });
        return;
    }

    res.json(success(result.data, 'Plantilla generada con IA'));
});
