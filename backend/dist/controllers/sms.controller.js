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
exports.deleteTemplate = exports.updateTemplate = exports.createTemplate = exports.getVariables = exports.getDefaultTemplates = exports.getTemplates = exports.sendTestSms = exports.testConnection = exports.updateSettings = exports.getSettings = void 0;
const zod_1 = require("zod");
const error_middleware_js_1 = require("../middleware/error.middleware.js");
const response_js_1 = require("../utils/response.js");
const smsService = __importStar(require("../services/sms.service.js"));
// Validation schemas
const settingsSchema = zod_1.z.object({
    accountSid: zod_1.z.string().optional(),
    authToken: zod_1.z.string().optional(),
    fromNumber: zod_1.z.string().optional(),
    isEnabled: zod_1.z.boolean().optional(),
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
        'CUSTOM',
    ]),
    name: zod_1.z.string().min(1),
    content: zod_1.z.string().min(1),
    isActive: zod_1.z.boolean().optional(),
});
const testSmsSchema = zod_1.z.object({
    phone: zod_1.z.string().min(9),
});
// ============================================================================
// SETTINGS
// ============================================================================
/**
 * GET /sms/settings
 */
exports.getSettings = (0, error_middleware_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const settings = await smsService.getSmsSettings(clinicId);
    res.json((0, response_js_1.success)({
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
exports.updateSettings = (0, error_middleware_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const input = settingsSchema.parse(req.body);
    const settings = await smsService.updateSmsSettings(clinicId, input);
    res.json((0, response_js_1.success)({
        ...settings,
        authToken: settings?.authToken ? '********' : null,
    }, 'Configuración actualizada'));
});
/**
 * POST /sms/settings/test
 */
exports.testConnection = (0, error_middleware_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const result = await smsService.testConnection(clinicId);
    if (result.success) {
        res.json((0, response_js_1.success)(null, 'Conexión exitosa con Twilio'));
    }
    else {
        res.status(400).json({ success: false, message: result.error });
    }
});
/**
 * POST /sms/settings/test-sms
 */
exports.sendTestSms = (0, error_middleware_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const { phone } = testSmsSchema.parse(req.body);
    const result = await smsService.sendTestSms(clinicId, phone);
    if (result.success) {
        res.json((0, response_js_1.success)(null, 'SMS de prueba enviado'));
    }
    else {
        res.status(400).json({ success: false, message: result.error });
    }
});
// ============================================================================
// TEMPLATES
// ============================================================================
/**
 * GET /sms/templates
 */
exports.getTemplates = (0, error_middleware_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const templates = await smsService.getSmsTemplates(clinicId);
    res.json((0, response_js_1.success)(templates));
});
/**
 * GET /sms/templates/defaults
 */
exports.getDefaultTemplates = (0, error_middleware_js_1.asyncHandler)(async (req, res) => {
    const defaults = smsService.getDefaultSmsTemplates();
    res.json((0, response_js_1.success)(defaults));
});
/**
 * GET /sms/templates/variables
 */
exports.getVariables = (0, error_middleware_js_1.asyncHandler)(async (_req, res) => {
    res.json((0, response_js_1.success)(smsService.SMS_VARIABLES));
});
/**
 * POST /sms/templates
 */
exports.createTemplate = (0, error_middleware_js_1.asyncHandler)(async (req, res) => {
    const clinicId = req.tenantContext?.clinicId;
    if (!clinicId) {
        res.status(400).json({ success: false, message: 'Clinic context required' });
        return;
    }
    const input = templateSchema.parse(req.body);
    const template = await smsService.createSmsTemplate(clinicId, input);
    res.status(201).json((0, response_js_1.success)(template, 'Plantilla creada'));
});
/**
 * PUT /sms/templates/:id
 */
exports.updateTemplate = (0, error_middleware_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const input = templateSchema.partial().parse(req.body);
    const template = await smsService.updateSmsTemplate(id, input);
    res.json((0, response_js_1.success)(template, 'Plantilla actualizada'));
});
/**
 * DELETE /sms/templates/:id
 */
exports.deleteTemplate = (0, error_middleware_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await smsService.deleteSmsTemplate(id);
    res.json((0, response_js_1.success)(null, 'Plantilla eliminada'));
});
//# sourceMappingURL=sms.controller.js.map