import { Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { success } from '../utils/response.js';
import * as smsService from '../services/sms.service.js';

// Validation schemas
const settingsSchema = z.object({
    accountSid: z.string().optional(),
    authToken: z.string().optional(),
    fromNumber: z.string().optional(),
    isEnabled: z.boolean().optional(),
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
        'CUSTOM',
    ]),
    name: z.string().min(1),
    content: z.string().min(1),
    isActive: z.boolean().optional(),
});

const testSmsSchema = z.object({
    phone: z.string().min(9),
});

// ============================================================================
// SETTINGS
// ============================================================================

/**
 * GET /sms/settings
 */
export const getSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const settings = await smsService.getSmsSettings(req.db!, clinicId);

    res.json(success({
        ...(settings || {
            isEnabled: false,
            isConfigured: false,
            sendOnCreate: true,
            sendOnCancel: true,
            reminder24hEnabled: true,
            reminder1hEnabled: true,
        }),
        authToken: settings?.authToken ? '********' : null,
    }));
});

/**
 * PUT /sms/settings
 */
export const updateSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const input = settingsSchema.parse(req.body);
    const settings = await smsService.updateSmsSettings(req.db!, clinicId, input as any);

    res.json(success({
        ...settings,
        authToken: settings?.authToken ? '********' : null,
    }, 'Configuración actualizada'));
});

/**
 * POST /sms/settings/test
 */
export const testConnection = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const result = await smsService.testConnection(req.db!, clinicId);

    if (result.success) {
        res.json(success(null, 'Conexión exitosa con Twilio'));
    } else {
        res.status(400).json({ success: false, message: result.error });
    }
});

/**
 * POST /sms/settings/test-sms
 */
export const sendTestSms = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const { phone } = testSmsSchema.parse(req.body);
    const result = await smsService.sendTestSms(req.db!, clinicId, phone);

    if (result.success) {
        res.json(success(null, 'SMS de prueba enviado'));
    } else {
        res.status(400).json({ success: false, message: result.error });
    }
});

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 * GET /sms/templates
 */
export const getTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const templates = await smsService.getSmsTemplates(req.db!, clinicId);
    res.json(success(templates));
});

/**
 * GET /sms/templates/defaults
 */
export const getDefaultTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const defaults = smsService.getDefaultSmsTemplates();
    res.json(success(defaults));
});

/**
 * GET /sms/templates/variables
 */
export const getVariables = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json(success(smsService.SMS_VARIABLES));
});

/**
 * POST /sms/templates
 */
export const createTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }

    const input = templateSchema.parse(req.body);
    const template = await smsService.createSmsTemplate(req.db!, clinicId, input as any);

    res.status(201).json(success(template, 'Plantilla creada'));
});

/**
 * PUT /sms/templates/:id
 */
export const updateTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = templateSchema.partial().parse(req.body);
    const template = await smsService.updateSmsTemplate(req.db!, id!, input as any);

    res.json(success(template, 'Plantilla actualizada'));
});

/**
 * DELETE /sms/templates/:id
 */
export const deleteTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    await smsService.deleteSmsTemplate(req.db!, id!);

    res.json(success(null, 'Plantilla eliminada'));
});
