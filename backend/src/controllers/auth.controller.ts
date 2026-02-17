import type { Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import * as authService from '../services/auth.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../middleware/index.js';
import { BadRequestError } from '../utils/errors.js';
import { config } from '../config/env.js';
import { tenantManager } from '../db/tenant-manager.js';
import { centralDb } from '../db/central-db.js';
import { superadmins } from '../db/central-schema.js';
import { users } from '../db/schema.js';
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
 * Subdomain-based login: tenant is resolved from X-Tenant-Slug header.
 * SuperAdmin (admin subdomain) has no tenant slug → checks central DB.
 */
export const login = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email, password, twoFactorCode } = loginSchema.parse(req.body);
    const tenantSlug = req.headers['x-tenant-slug'] as string | undefined;

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

    let tenantSlug: string | undefined;
    let decoded: any;

    try {
        decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
        tenantSlug = decoded.tenantSlug;
    } catch {
        throw new BadRequestError('Invalid refresh token');
    }

    // ── SUPERADMIN: stateless refresh (no tenantSlug in JWT) ──
    if (!tenantSlug) {
        const sa = await centralDb.query.superadmins.findFirst({
            where: and(
                eq(superadmins.id, decoded.userId),
                eq(superadmins.isActive, true),
            ),
        });

        if (!sa) {
            throw new BadRequestError('Superadmin account not found or deactivated');
        }

        // Re-issue tokens statelessly
        const newAccessToken = authService.generateAccessToken({
            userId: sa.id,
            email: sa.email,
            role: 'SUPERADMIN' as any,
            organizationId: null,
            clinicId: null,
        });

        const newRefreshToken = authService.generateRefreshToken({
            userId: sa.id,
            tokenVersion: 0,
            jti: crypto.randomUUID(),
        });

        return res.json(success({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn: 3600, // 1h default, matches config.jwt.accessExpiry
        }));
    }

    // ── Tenant user: use tenant DB ──
    const db = await tenantManager.getConnection(tenantSlug);

    const result = await authService.refreshAccessToken(
        db,
        refreshToken,
        tenantSlug,
    );

    if (result.success) {
        return res.json(success(result.data));
    } else {
        return res.status(401).json(result);
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
 * Tenant-scoped: uses X-Tenant-Slug header to determine which tenant to search.
 * If no slug (admin domain), searches across all tenants.
 */
export const forgotPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email } = passwordResetRequestSchema.parse(req.body);
    const tenantSlug = req.headers['x-tenant-slug'] as string | undefined;
    await authService.requestPasswordReset(email, tenantSlug);
    res.json(success(null, 'If your email is registered, you will receive a password reset link.'));
});

/**
 * POST /auth/reset-password
 * Tenant-scoped via X-Tenant-Slug header
 */
export const resetPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { token, password } = passwordResetSchema.parse(req.body);
    const tenantSlug = req.headers['x-tenant-slug'] as string | undefined;
    await authService.resetPassword(token, password, tenantSlug);
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
    const db = req.db!;
    const user = await db.query.users.findFirst({
        where: eq(users.id, req.user.userId),
        columns: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            organizationId: true,
            clinicId: true,
        },
    });

    if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }

    res.json(success({
        ...user,
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
