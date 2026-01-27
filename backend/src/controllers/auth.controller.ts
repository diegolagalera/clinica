import type { Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

// Validation schemas
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    twoFactorCode: z.string().length(6).optional(),
});

export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(100),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().max(50).optional(),
});

export const refreshSchema = z.object({
    refreshToken: z.string().min(1),
});

export const passwordResetRequestSchema = z.object({
    email: z.string().email(),
});

export const passwordResetSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8).max(100),
});

export const verifyEmailSchema = z.object({
    token: z.string().min(1),
});

export const verify2FASchema = z.object({
    code: z.string().length(6),
});

/**
 * POST /auth/login
 */
export const login = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email, password, twoFactorCode } = loginSchema.parse(req.body);

    const result = await authService.login({ email, password, twoFactorCode });

    if (result.success) {
        res.json(success(result.data));
    } else {
        res.status(401).json({ success: false, message: result.error });
    }
});

/**
 * POST /auth/register
 * Patient self-registration
 */
export const register = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = registerSchema.parse(req.body);

    const result = await authService.register({
        ...input,
        role: 'USER' as const,
    });

    if (result.success) {
        res.status(201).json(success(result.data, 'Registration successful. Please verify your email.'));
    } else {
        res.status(409).json({ success: false, message: result.error });
    }
});

/**
 * POST /auth/refresh
 */
export const refreshToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);

    const result = await authService.refreshAccessToken(refreshToken);

    if (result.success) {
        res.json(success(result.data));
    } else {
        res.status(401).json({ success: false, message: result.error });
    }
});

/**
 * POST /auth/logout
 */
export const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const refreshToken = req.body.refreshToken;
    await authService.logout(req.user.userId, refreshToken);
    res.json(success(null, 'Logged out successfully'));
});

/**
 * POST /auth/forgot-password
 */
export const forgotPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email } = passwordResetRequestSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    res.json(success(null, 'If your email is registered, you will receive a password reset link.'));
});

/**
 * POST /auth/reset-password
 */
export const resetPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { token, password } = passwordResetSchema.parse(req.body);
    await authService.resetPassword(token, password);
    res.json(success(null, 'Password reset successful'));
});

/**
 * POST /auth/verify-email
 */
export const verifyEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { token } = verifyEmailSchema.parse(req.body);
    await authService.verifyEmail(token);
    res.json(success(null, 'Email verified successfully'));
});

/**
 * POST /auth/2fa/setup
 */
export const setup2FA = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await authService.setup2FA(req.user.userId);
    if (result.success) {
        res.json(success(result.data));
    }
});

/**
 * POST /auth/2fa/verify
 */
export const verify2FA = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code } = verify2FASchema.parse(req.body);
    await authService.verify2FA(req.user.userId, code);
    res.json(success(null, '2FA enabled successfully'));
});

/**
 * POST /auth/2fa/disable
 */
export const disable2FA = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code } = verify2FASchema.parse(req.body);
    await authService.disable2FA(req.user.userId, code);
    res.json(success(null, '2FA disabled successfully'));
});

/**
 * GET /auth/me
 */
export const getCurrentUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json(success({
        id: req.user.userId,
        email: req.user.email,
        role: req.user.role,
        organizationId: req.user.organizationId,
        clinicId: req.user.clinicId,
    }));
});
