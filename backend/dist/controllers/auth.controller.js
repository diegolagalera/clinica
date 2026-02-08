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
exports.getCurrentUser = exports.disable2FA = exports.verify2FA = exports.setup2FA = exports.verifyEmail = exports.resetPassword = exports.forgotPassword = exports.logout = exports.refreshToken = exports.register = exports.login = exports.verify2FASchema = exports.verifyEmailSchema = exports.passwordResetSchema = exports.passwordResetRequestSchema = exports.refreshSchema = exports.registerSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
const authService = __importStar(require("../services/auth.service.js"));
const response_js_1 = require("../utils/response.js");
const index_js_1 = require("../middleware/index.js");
// Validation schemas
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
    twoFactorCode: zod_1.z.string().length(6).optional(),
});
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8).max(100),
    firstName: zod_1.z.string().min(1).max(100),
    lastName: zod_1.z.string().min(1).max(100),
    phone: zod_1.z.string().max(50).optional(),
});
exports.refreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1),
});
exports.passwordResetRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
exports.passwordResetSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    password: zod_1.z.string().min(8).max(100),
});
exports.verifyEmailSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
});
exports.verify2FASchema = zod_1.z.object({
    code: zod_1.z.string().length(6),
});
/**
 * POST /auth/login
 */
exports.login = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { email, password, twoFactorCode } = exports.loginSchema.parse(req.body);
    const result = await authService.login({ email, password, twoFactorCode });
    if (result.success) {
        res.json((0, response_js_1.success)(result.data));
    }
    else {
        res.status(401).json({ success: false, message: result.error });
    }
});
/**
 * POST /auth/register
 * Patient self-registration
 */
exports.register = (0, index_js_1.asyncHandler)(async (req, res) => {
    const input = exports.registerSchema.parse(req.body);
    const result = await authService.register({
        ...input,
        role: 'USER',
    });
    if (result.success) {
        res.status(201).json((0, response_js_1.success)(result.data, 'Registration successful. Please verify your email.'));
    }
    else {
        res.status(409).json({ success: false, message: result.error });
    }
});
/**
 * POST /auth/refresh
 */
exports.refreshToken = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { refreshToken } = exports.refreshSchema.parse(req.body);
    const result = await authService.refreshAccessToken(refreshToken);
    if (result.success) {
        res.json((0, response_js_1.success)(result.data));
    }
    else {
        res.status(401).json({ success: false, message: result.error });
    }
});
/**
 * POST /auth/logout
 */
exports.logout = (0, index_js_1.asyncHandler)(async (req, res) => {
    const refreshToken = req.body.refreshToken;
    await authService.logout(req.user.userId, refreshToken);
    res.json((0, response_js_1.success)(null, 'Logged out successfully'));
});
/**
 * POST /auth/forgot-password
 */
exports.forgotPassword = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { email } = exports.passwordResetRequestSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    res.json((0, response_js_1.success)(null, 'If your email is registered, you will receive a password reset link.'));
});
/**
 * POST /auth/reset-password
 */
exports.resetPassword = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { token, password } = exports.passwordResetSchema.parse(req.body);
    await authService.resetPassword(token, password);
    res.json((0, response_js_1.success)(null, 'Password reset successful'));
});
/**
 * POST /auth/verify-email
 */
exports.verifyEmail = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { token } = exports.verifyEmailSchema.parse(req.body);
    await authService.verifyEmail(token);
    res.json((0, response_js_1.success)(null, 'Email verified successfully'));
});
/**
 * POST /auth/2fa/setup
 */
exports.setup2FA = (0, index_js_1.asyncHandler)(async (req, res) => {
    const result = await authService.setup2FA(req.user.userId);
    if (result.success) {
        res.json((0, response_js_1.success)(result.data));
    }
});
/**
 * POST /auth/2fa/verify
 */
exports.verify2FA = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { code } = exports.verify2FASchema.parse(req.body);
    await authService.verify2FA(req.user.userId, code);
    res.json((0, response_js_1.success)(null, '2FA enabled successfully'));
});
/**
 * POST /auth/2fa/disable
 */
exports.disable2FA = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { code } = exports.verify2FASchema.parse(req.body);
    await authService.disable2FA(req.user.userId, code);
    res.json((0, response_js_1.success)(null, '2FA disabled successfully'));
});
/**
 * GET /auth/me
 */
exports.getCurrentUser = (0, index_js_1.asyncHandler)(async (req, res) => {
    res.json((0, response_js_1.success)({
        id: req.user.userId,
        email: req.user.email,
        role: req.user.role,
        organizationId: req.user.organizationId,
        clinicId: req.user.clinicId,
    }));
});
//# sourceMappingURL=auth.controller.js.map