"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTemplateWithAI = exports.getStats = exports.getLogs = exports.testTemplate = exports.previewTemplate = exports.deleteTemplate = exports.updateTemplate = exports.createTemplate = exports.getTemplate = exports.getDefaultTemplate = exports.getTemplateTypes = exports.getTemplates = exports.sendCustomTestEmail = exports.sendTestEmail = exports.testConnection = exports.updateSettings = exports.getSettings = void 0;
const zod_1 = require("zod");
const emailService = __importStar(require("../services/email.service.js"));
const templateService = __importStar(require("../services/email-template.service.js"));
const notificationService = __importStar(require("../services/notification.service.js"));
const aiService = __importStar(require("../services/ai.service.js"));
const response_js_1 = require("../utils/response.js");
const index_js_1 = require("../middleware/index.js");
// Validation schemas
const settingsSchema = zod_1.z.object({
    smtpHost: zod_1.z.string().optional(),
    smtpPort: zod_1.z.number().optional(),
    smtpUser: zod_1.z.string().email().optional(),
    smtpPass: zod_1.z.string().optional(),
    fromName: zod_1.z.string().optional(),
    fromEmail: zod_1.z.union([zod_1.z.string().email(), zod_1.z.literal(''), zod_1.z.null()]).optional().transform(val => (val === '' || val === null) ? undefined : val),
    isEnabled: zod_1.z.boolean().optional(),
    // Notification toggles
    sendOnCreate: zod_1.z.boolean().optional(),
    sendOnCancel: zod_1.z.boolean().optional(),
    reminder24hEnabled: zod_1.z.boolean().optional(),
    reminder1hEnabled: zod_1.z.boolean().optional(),
});
const templateSchema = zod_1.z.object({
    type: zod_1.z.enum([
        'APPOINTMENT_CREATED',
        'APPOINTMENT_REMINDER_24H',
        'APPOINTMENT_REMINDER_1H',
        'APPOINTMENT_CANCELLED',
        'DOCUMENT_SIGNED',
        'CUSTOM',
    ]),
    name: zod_1.z.string().min(1).max(100),
    subject: zod_1.z.string().min(1).max(255),
    blocks: zod_1.z.array(zod_1.z.any()),
    isActive: zod_1.z.boolean().optional(),
});
/**
 * GET /notifications/settings
 */
exports.getSettings = (0, index_js_1.asyncHandler)(async (req, res) => {
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
    res.json((0, response_js_1.success)(safeSettings));
});
/**
 * PUT /notifications/settings
 */
exports.updateSettings = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const input = settingsSchema.parse(req.body);
    const settings = await emailService.updateEmailSettings(clinicId, input);
    res.json((0, response_js_1.success)({
        ...settings,
        smtpPass: settings.smtpPass ? '********' : null,
    }, 'Configuración actualizada'));
});
/**
 * POST /notifications/settings/test
 */
exports.testConnection = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const result = await emailService.testConnection(clinicId);
    if (result.success) {
        res.json((0, response_js_1.success)(null, 'Conexión exitosa'));
    }
    else {
        res.status(400).json({ success: false, message: result.error });
    }
});
/**
 * POST /notifications/settings/test-email
 */
exports.sendTestEmail = (0, index_js_1.asyncHandler)(async (req, res) => {
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
        res.json((0, response_js_1.success)(null, 'Email de prueba enviado'));
    }
    else {
        res.status(400).json({ success: false, message: result.error });
    }
});
/**
 * POST /notifications/send-test (custom HTML test)
 */
exports.sendCustomTestEmail = (0, index_js_1.asyncHandler)(async (req, res) => {
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
        res.json((0, response_js_1.success)(null, 'Email de prueba enviado'));
    }
    else {
        res.status(400).json({ success: false, message: result.error });
    }
});
/**
 * GET /notifications/templates
 */
exports.getTemplates = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const templates = await templateService.getTemplates(clinicId);
    res.json((0, response_js_1.success)(templates));
});
/**
 * GET /notifications/templates/types
 */
exports.getTemplateTypes = (0, index_js_1.asyncHandler)(async (_req, res) => {
    const types = templateService.getTemplateTypes();
    res.json((0, response_js_1.success)(types));
});
/**
 * GET /notifications/templates/default/:type
 */
exports.getDefaultTemplate = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { type } = req.params;
    const template = templateService.getDefaultTemplate(type);
    res.json((0, response_js_1.success)(template));
});
/**
 * GET /notifications/templates/:id
 */
exports.getTemplate = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    const { id } = req.params;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const template = await templateService.getTemplateById(id, clinicId);
    if (!template) {
        res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
        return;
    }
    res.json((0, response_js_1.success)(template));
});
/**
 * POST /notifications/templates
 */
exports.createTemplate = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const input = templateSchema.parse(req.body);
    const template = await templateService.createTemplate(clinicId, input);
    res.status(201).json((0, response_js_1.success)(template, 'Plantilla creada'));
});
/**
 * PUT /notifications/templates/:id
 */
exports.updateTemplate = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    const { id } = req.params;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const input = templateSchema.partial().parse(req.body);
    const template = await templateService.updateTemplate(id, clinicId, input);
    if (!template) {
        res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
        return;
    }
    res.json((0, response_js_1.success)(template, 'Plantilla actualizada'));
});
/**
 * DELETE /notifications/templates/:id
 */
exports.deleteTemplate = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    const { id } = req.params;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    await templateService.deleteTemplate(id, clinicId);
    res.json((0, response_js_1.success)(null, 'Plantilla eliminada'));
});
/**
 * POST /notifications/templates/:id/preview
 */
exports.previewTemplate = (0, index_js_1.asyncHandler)(async (req, res) => {
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
    }
    else {
        template = await templateService.getTemplateById(id, clinicId);
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
    const html = templateService.renderBlocksToHtml(template.blocks);
    const finalHtml = templateService.replaceVariables(html, sampleVariables);
    const finalSubject = templateService.replaceVariables(template.subject, sampleVariables);
    res.json((0, response_js_1.success)({ html: finalHtml, subject: finalSubject }));
});
/**
 * POST /notifications/templates/:id/test
 */
exports.testTemplate = (0, index_js_1.asyncHandler)(async (req, res) => {
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
    }
    else {
        template = await templateService.getTemplateById(id, clinicId);
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
    const html = templateService.renderBlocksToHtml(template.blocks);
    const finalHtml = templateService.replaceVariables(html, sampleVariables);
    const finalSubject = templateService.replaceVariables(template.subject, sampleVariables);
    const result = await emailService.sendEmail(clinicId, {
        to: email,
        subject: `[PRUEBA] ${finalSubject}`,
        html: finalHtml,
    });
    if (result.success) {
        res.json((0, response_js_1.success)(null, 'Email de prueba enviado'));
    }
    else {
        res.status(400).json({ success: false, message: result.error });
    }
});
/**
 * GET /notifications/logs
 */
exports.getLogs = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const limit = parseInt(req.query['limit']) || 50;
    const offset = parseInt(req.query['offset']) || 0;
    const logs = await notificationService.getNotificationLogs(clinicId, { limit, offset });
    res.json((0, response_js_1.success)(logs));
});
/**
 * GET /notifications/stats
 */
exports.getStats = (0, index_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const stats = await notificationService.getNotificationStats(clinicId);
    res.json((0, response_js_1.success)(stats));
});
/**
 * POST /notifications/templates/generate (AI generation)
 */
exports.generateTemplateWithAI = (0, index_js_1.asyncHandler)(async (req, res) => {
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
    const result = await aiService.generateEmailTemplate(prompt);
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
    res.json((0, response_js_1.success)(result.data, 'Plantilla generada con IA'));
});
//# sourceMappingURL=notification.controller.js.map