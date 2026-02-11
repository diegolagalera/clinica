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
    tenantSlug: z.string().optional(), // For multi-tenant login when user has multiple tenants
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
 * Multi-tenant login: checks central DB first, then tenant DB.
 * If email exists in multiple tenants, returns availableTenants for selection.
 */
export const login = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email, password, twoFactorCode, tenantSlug } = loginSchema.parse(req.body);

    const result = await authService.login({ email, password, twoFactorCode, tenantSlug });

    if (result.success) {
        res.json(success(result.data));
    } else {
        res.status(401).json({ success: false, message: result.error });
    }
});

/**
 * POST /auth/register
 * Patient self-registration (requires tenant context)
 */
export const register = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = registerSchema.parse(req.body);

    // For self-registration, tenant context must come from somewhere
    // Usually this would be a public endpoint with tenant slug in the URL
    const tenantSlug = req.headers['x-tenant-slug'] as string;
    if (!tenantSlug) {
        res.status(400).json({ success: false, message: 'Tenant context required for registration' });
        return;
    }

    // TODO: Resolve tenantId from tenantSlug via centralDb for self-registration
    // For now, this endpoint requires an authenticated admin to create users
    res.status(501).json({ success: false, message: 'Self-registration not yet implemented for multi-tenant' });
});

/**
 * POST /auth/refresh
 */
export const refreshToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);

    // For refresh, we need to determine which tenant DB to use
    // We decode the refresh token to get the user, then look up their tenant
    // For now, use req.db! if available (from a previous auth middleware call)
    const result = await authService.refreshAccessToken(
        req.db!,
        refreshToken,
        req.user?.tenantSlug,
    );

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
    await authService.logout(req.db!, req.user.userId, refreshToken);
    res.json(success(null, 'Logged out successfully'));
});

/**
 * POST /auth/forgot-password
 * Searches across all tenants — no auth required
 */
export const forgotPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email } = passwordResetRequestSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    res.json(success(null, 'If your email is registered, you will receive a password reset link.'));
});

/**
 * POST /auth/reset-password
 * Searches across all tenants — no auth required
 */
export const resetPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { token, password } = passwordResetSchema.parse(req.body);
    await authService.resetPassword(token, password);
    res.json(success(null, 'Password reset successful'));
});

/**
 * POST /auth/verify-email
 * Searches across all tenants — no auth required
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
    const result = await authService.setup2FA(req.db!, req.user.userId);
    if (result.success) {
        res.json(success(result.data));
    }
});

/**
 * POST /auth/2fa/verify
 */
export const verify2FA = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code } = verify2FASchema.parse(req.body);
    await authService.verify2FA(req.db!, req.user.userId, code);
    res.json(success(null, '2FA enabled successfully'));
});

/**
 * POST /auth/2fa/disable
 */
export const disable2FA = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code } = verify2FASchema.parse(req.body);
    await authService.disable2FA(req.db!, req.user.userId, code);
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
        tenantSlug: req.user.tenantSlug,
    }));
});

// Schemas for profile updates
export const updateMyInfoSchema = z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z.string().max(50).optional(),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(100),
});

/**
 * PUT /auth/me
 * Update current user's basic info
 */
export const updateMyInfo = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = updateMyInfoSchema.parse(req.body);

    const updated = await authService.updateUserInfo(req.db!, req.user.userId, data);

    res.json(success(updated, 'Información actualizada'));
});

/**
 * PUT /auth/change-password
 * Change current user's password
 */
export const changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    await authService.changePassword(req.db!, req.user.userId, currentPassword, newPassword);

    res.json(success(null, 'Contraseña cambiada correctamente'));
});
