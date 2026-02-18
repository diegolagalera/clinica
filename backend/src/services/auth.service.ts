import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { authenticator } from 'otplib';
import type { Database } from '../db/index.js';
import { centralDb } from '../db/central-db.js';
import { superadmins, globalUsers } from '../db/central-schema.js';
import { tenantManager } from '../db/tenant-manager.js';
import { users, refreshTokens } from '../db/schema.js';
import { config } from '../config/env.js';
import { UnauthorizedError, BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';
import type { AccessTokenPayload, RefreshTokenPayload, ServiceResult, Role } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { sendPasswordResetEmail } from './email.service.js';

const SALT_ROUNDS = 12;

export interface RegisterInput {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role?: Role;
    organizationId?: string;
    clinicId?: string;
    tenantSlug?: string; // Required for multi-tenant registration
}

export interface LoginInput {
    email: string;
    password: string;
    twoFactorCode?: string | undefined;
    tenantSlug?: string | undefined; // When user selects a specific tenant
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface UserInfo {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    role: Role;
    organizationId: string | null;
    clinicId: string | null;
    twoFactorEnabled: boolean;
    emailVerified: boolean;
    tenantSlug?: string | undefined;
}

export interface LoginResult {
    tokens: AuthTokens;
    user: UserInfo;
    requires2FA?: boolean;
}

/**
 * Hash a password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
    return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Verify a password against a hash
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(password, hash);
};

/**
 * Generate access token
 */
export const generateAccessToken = (payload: AccessTokenPayload): string => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return jwt.sign(payload as any, config.jwt.accessSecret, {
        expiresIn: config.jwt.accessExpiry as any,
    });
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return jwt.sign(payload as any, config.jwt.refreshSecret, {
        expiresIn: config.jwt.refreshExpiry as any,
    });
};

/**
 * Parse expiry string to seconds
 */
const parseExpiry = (expiry: string): number => {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1]!, 10);
    const unit = match[2];

    switch (unit) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 3600;
        case 'd': return value * 86400;
        default: return 900;
    }
};

/**
 * Build a UserInfo object from a user record
 */
const buildUserInfo = (user: any, tenantSlug?: string): UserInfo => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role as Role,
    organizationId: user.organizationId ?? null,
    clinicId: user.clinicId ?? null,
    twoFactorEnabled: user.twoFactorEnabled,
    emailVerified: user.emailVerified ?? true,
    tenantSlug,
});

// ============================================================================
// LOGIN — Multi-tenant flow
// ============================================================================

/**
 * Login user (subdomain-based multi-tenant)
 *
 * Flow:
 * 1. If tenantSlug provided (from subdomain header) → go directly to tenant DB
 * 2. If no tenantSlug (admin subdomain) → check SUPERADMIN first, then global_users
 */
export const login = async (input: LoginInput): Promise<ServiceResult<LoginResult>> => {
    const emailLower = input.email.toLowerCase();

    // ── Direct tenant login (subdomain provides the slug) ────
    if (input.tenantSlug) {
        const tenantDb = await tenantManager.getConnection(input.tenantSlug);
        return loginAgainstTenantDb(tenantDb, emailLower, input.password, input.twoFactorCode, input.tenantSlug);
    }

    // ── No tenant slug = admin subdomain → check SUPERADMIN ──
    const superadmin = await centralDb.query.superadmins.findFirst({
        where: and(
            eq(superadmins.email, emailLower),
            eq(superadmins.isActive, true),
        ),
    });

    if (superadmin) {
        return loginAsSuperadmin(superadmin, input.password, input.twoFactorCode);
    }

    throw new UnauthorizedError('Invalid email or password');
};

/**
 * Login as SUPERADMIN (against central DB)
 */
const loginAsSuperadmin = async (
    superadmin: typeof superadmins.$inferSelect,
    password: string,
    twoFactorCode?: string,
): Promise<ServiceResult<LoginResult>> => {
    const isValidPassword = await verifyPassword(password, superadmin.passwordHash);
    if (!isValidPassword) {
        throw new UnauthorizedError('Invalid email or password');
    }

    // 2FA check
    if (superadmin.twoFactorEnabled && superadmin.twoFactorSecret) {
        if (!twoFactorCode) {
            return {
                success: true,
                data: {
                    tokens: { accessToken: '', refreshToken: '', expiresIn: 0 },
                    user: buildUserInfo({
                        ...superadmin,
                        role: 'SUPERADMIN',
                        organizationId: null,
                        clinicId: null,
                    }),
                    requires2FA: true,
                },
            };
        }

        const isValid2FA = authenticator.verify({
            token: twoFactorCode,
            secret: superadmin.twoFactorSecret,
        });

        if (!isValid2FA) {
            throw new UnauthorizedError('Invalid 2FA code');
        }
    }

    // Generate tokens — SUPERADMIN has no tenantSlug
    const accessPayload: AccessTokenPayload = {
        userId: superadmin.id,
        email: superadmin.email,
        role: 'SUPERADMIN' as Role,
        organizationId: null,
        clinicId: null,
        // No tenantSlug for SUPERADMIN
    };

    const refreshPayload: RefreshTokenPayload = {
        userId: superadmin.id,
        tokenVersion: 0,
        jti: crypto.randomUUID(),
    };

    const accessToken = generateAccessToken(accessPayload);
    const refreshToken = generateRefreshToken(refreshPayload);

    return {
        success: true,
        data: {
            tokens: {
                accessToken,
                refreshToken,
                expiresIn: parseExpiry(config.jwt.accessExpiry),
            },
            user: buildUserInfo({
                ...superadmin,
                role: 'SUPERADMIN',
                organizationId: null,
                clinicId: null,
            }),
        },
    };
};

/**
 * Login against a specific tenant database
 */
const loginAgainstTenantDb = async (
    db: Database,
    email: string,
    password: string,
    twoFactorCode: string | undefined,
    tenantSlug: string,
): Promise<ServiceResult<LoginResult>> => {
    const user = await db.query.users.findFirst({
        where: and(
            eq(users.email, email),
            eq(users.isActive, true),
        ),
    });

    if (!user) {
        throw new UnauthorizedError('Invalid email or password');
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
        throw new UnauthorizedError('La contraseña no es correcta para esta empresa');
    }

    // 2FA check
    if (user.twoFactorEnabled && user.twoFactorSecret) {
        if (!twoFactorCode) {
            return {
                success: true,
                data: {
                    tokens: { accessToken: '', refreshToken: '', expiresIn: 0 },
                    user: buildUserInfo(user, tenantSlug),
                    requires2FA: true,
                },
            };
        }

        const isValid2FA = authenticator.verify({
            token: twoFactorCode,
            secret: user.twoFactorSecret,
        });

        if (!isValid2FA) {
            throw new UnauthorizedError('Invalid 2FA code');
        }
    }

    // Generate tokens with tenantSlug
    const accessPayload: AccessTokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role as Role,
        organizationId: user.organizationId,
        clinicId: user.clinicId,
        tenantSlug,
    };

    const refreshPayload: RefreshTokenPayload = {
        userId: user.id,
        tokenVersion: user.tokenVersion,
        jti: crypto.randomUUID(),
        tenantSlug,
    };

    const accessToken = generateAccessToken(accessPayload);
    const refreshToken = generateRefreshToken(refreshPayload);

    // Store refresh token in tenant DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.insert(refreshTokens).values({
        userId: user.id,
        token: refreshToken,
        expiresAt,
    });

    // Update last login
    await db.update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

    return {
        success: true,
        data: {
            tokens: {
                accessToken,
                refreshToken,
                expiresIn: parseExpiry(config.jwt.accessExpiry),
            },
            user: buildUserInfo(user, tenantSlug),
        },
    };
};

// ============================================================================
// REGISTER — Multi-tenant
// ============================================================================

/**
 * Register a new user (creates in tenant DB + global_users in central DB)
 */
export const register = async (db: Database, input: RegisterInput, tenantSlug: string, tenantId: string): Promise<ServiceResult<{ user: UserInfo; requiresVerification: boolean }>> => {
    try {
        const emailLower = input.email.toLowerCase();

        // Check if email already exists in this tenant (global_users)
        const existingGlobal = await centralDb.query.globalUsers.findFirst({
            where: and(
                eq(globalUsers.email, emailLower),
                eq(globalUsers.tenantId, tenantId),
            ),
        });

        if (existingGlobal) {
            throw new ConflictError('Email already registered');
        }

        // Reserve email in central DB first
        const [globalUserRecord] = await centralDb.insert(globalUsers)
            .values({
                email: emailLower,
                tenantId,
                role: input.role || 'USER',
                isActive: true,
            })
            .returning();

        try {
            // Hash password
            const passwordHash = await hashPassword(input.password);

            // Generate verification token
            const emailVerificationToken = crypto.randomUUID();

            // Create user in tenant DB
            const [user] = await db.insert(users)
                .values({
                    email: emailLower,
                    passwordHash,
                    firstName: input.firstName,
                    lastName: input.lastName,
                    phone: input.phone ?? null,
                    role: input.role || 'USER',
                    organizationId: input.organizationId ?? null,
                    clinicId: input.clinicId ?? null,
                    emailVerificationToken,
                    emailVerified: false,
                })
                .returning();

            if (!user) {
                throw new Error('Failed to create user');
            }

            // Update global_users with the tenant user ID
            if (globalUserRecord) {
                await centralDb.update(globalUsers)
                    .set({ userId: user.id })
                    .where(eq(globalUsers.id, globalUserRecord.id));
            }

            return {
                success: true,
                data: {
                    user: buildUserInfo(user, tenantSlug),
                    requiresVerification: true,
                },
            };
        } catch (error) {
            // Rollback: remove from global_users if tenant DB insert fails
            if (globalUserRecord) {
                await centralDb.delete(globalUsers)
                    .where(eq(globalUsers.id, globalUserRecord.id));
            }
            throw error;
        }
    } catch (error) {
        if (error instanceof ConflictError) {
            return { success: false, error: error.message, code: 'CONFLICT' };
        }
        throw error;
    }
};

// ============================================================================
// TOKEN REFRESH — Multi-tenant
// ============================================================================

/**
 * Refresh access token
 */
export const refreshAccessToken = async (db: Database, token: string, tenantSlug?: string): Promise<ServiceResult<AuthTokens>> => {
    try {
        const decoded = jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;
        logger.info({ userId: decoded.userId, jti: decoded.jti, tenantSlug: decoded.tenantSlug }, '[TOKEN REFRESH] JWT verified, looking up in DB');

        const storedToken = await db.query.refreshTokens.findFirst({
            where: and(
                eq(refreshTokens.token, token),
                eq(refreshTokens.userId, decoded.userId)
            ),
            with: {
                user: true,
            },
        });

        if (!storedToken) {
            logger.warn({ userId: decoded.userId, jti: decoded.jti }, '[TOKEN REFRESH] Token NOT found in DB — possible DB cleanup or server restart');
            throw new UnauthorizedError('Invalid refresh token');
        }

        // Handle race condition: token already revoked by another tab
        if (storedToken.revokedAt) {
            logger.warn({ userId: decoded.userId, jti: decoded.jti, revokedAt: storedToken.revokedAt, hasReplacement: !!storedToken.replacedByToken }, '[TOKEN REFRESH] Token is REVOKED, attempting recovery');
            if (storedToken.replacedByToken) {
                const replacementToken = await db.query.refreshTokens.findFirst({
                    where: and(
                        eq(refreshTokens.token, storedToken.replacedByToken),
                        eq(refreshTokens.userId, decoded.userId)
                    ),
                    with: {
                        user: true,
                    },
                });

                if (replacementToken && !replacementToken.revokedAt && new Date() < replacementToken.expiresAt) {
                    const user = replacementToken.user;
                    if (user.tokenVersion === decoded.tokenVersion) {
                        logger.info({ userId: decoded.userId }, '[TOKEN REFRESH] Recovery SUCCESS — using replacement token');
                        const accessPayload: AccessTokenPayload = {
                            userId: user.id,
                            email: user.email,
                            role: user.role as Role,
                            organizationId: user.organizationId,
                            clinicId: user.clinicId,
                            tenantSlug,
                        };
                        const newAccessToken = generateAccessToken(accessPayload);

                        return {
                            success: true,
                            data: {
                                accessToken: newAccessToken,
                                refreshToken: storedToken.replacedByToken,
                                expiresIn: parseExpiry(config.jwt.accessExpiry),
                            },
                        };
                    }
                    logger.warn({ userId: decoded.userId, dbVersion: user.tokenVersion, jwtVersion: decoded.tokenVersion }, '[TOKEN REFRESH] Recovery FAILED — tokenVersion mismatch');
                } else {
                    logger.warn({ userId: decoded.userId, replacementExists: !!replacementToken, replacementRevoked: !!replacementToken?.revokedAt, replacementExpired: replacementToken ? new Date() >= replacementToken.expiresAt : null }, '[TOKEN REFRESH] Recovery FAILED — replacement token invalid');
                }
            }
            throw new UnauthorizedError('Refresh token has been revoked');
        }

        if (new Date() > storedToken.expiresAt) {
            logger.warn({ userId: decoded.userId, expiresAt: storedToken.expiresAt, now: new Date() }, '[TOKEN REFRESH] Token EXPIRED in DB');
            throw new UnauthorizedError('Refresh token expired');
        }

        const user = storedToken.user;

        if (user.tokenVersion !== decoded.tokenVersion) {
            logger.warn({ userId: decoded.userId, dbVersion: user.tokenVersion, jwtVersion: decoded.tokenVersion }, '[TOKEN REFRESH] tokenVersion MISMATCH — password was changed?');
            throw new UnauthorizedError('Token version mismatch');
        }

        const accessPayload: AccessTokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role as Role,
            organizationId: user.organizationId,
            clinicId: user.clinicId,
            tenantSlug,
        };

        const refreshPayload: RefreshTokenPayload = {
            userId: user.id,
            tokenVersion: user.tokenVersion,
            jti: crypto.randomUUID(),
            tenantSlug,
        };

        const newAccessToken = generateAccessToken(accessPayload);
        const newRefreshToken = generateRefreshToken(refreshPayload);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await db.transaction(async (tx) => {
            await tx.update(refreshTokens)
                .set({
                    revokedAt: new Date(),
                    replacedByToken: newRefreshToken,
                })
                .where(eq(refreshTokens.id, storedToken.id));

            await tx.insert(refreshTokens).values({
                userId: user.id,
                token: newRefreshToken,
                expiresAt,
            });
        });

        logger.info({ userId: decoded.userId }, '[TOKEN REFRESH] SUCCESS — tokens rotated');

        return {
            success: true,
            data: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                expiresIn: parseExpiry(config.jwt.accessExpiry),
            },
        };
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            logger.error({ error: error.message }, '[TOKEN REFRESH] JWT verification FAILED — signature/secret mismatch');
            throw new UnauthorizedError('Invalid refresh token');
        }
        throw error;
    }
};

// ============================================================================
// LOGOUT
// ============================================================================

/**
 * Logout user (revoke refresh token)
 */
export const logout = async (db: Database, userId: string, token?: string): Promise<void> => {
    if (token) {
        await db.update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(and(
                eq(refreshTokens.userId, userId),
                eq(refreshTokens.token, token)
            ));
    } else {
        await db.update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(eq(refreshTokens.userId, userId));
    }
};

// ============================================================================
// 2FA
// ============================================================================

/**
 * Setup 2FA for user
 */
export const setup2FA = async (db: Database, userId: string): Promise<ServiceResult<{ secret: string; qrCodeUrl: string }>> => {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (!user) {
        throw new NotFoundError('User not found');
    }

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(user.email, 'DentalERP', secret);

    await db.update(users)
        .set({ twoFactorSecret: secret })
        .where(eq(users.id, userId));

    return {
        success: true,
        data: {
            secret,
            qrCodeUrl: otpAuthUrl,
        },
    };
};

/**
 * Verify and enable 2FA
 */
export const verify2FA = async (db: Database, userId: string, code: string): Promise<ServiceResult<boolean>> => {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (!user || !user.twoFactorSecret) {
        throw new BadRequestError('2FA not set up');
    }

    const isValid = authenticator.verify({
        token: code,
        secret: user.twoFactorSecret,
    });

    if (!isValid) {
        throw new BadRequestError('Invalid 2FA code');
    }

    await db.update(users)
        .set({ twoFactorEnabled: true })
        .where(eq(users.id, userId));

    return { success: true, data: true };
};

/**
 * Disable 2FA
 */
export const disable2FA = async (db: Database, userId: string, code: string): Promise<ServiceResult<boolean>> => {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
        throw new BadRequestError('2FA not enabled');
    }

    const isValid = authenticator.verify({
        token: code,
        secret: user.twoFactorSecret,
    });

    if (!isValid) {
        throw new BadRequestError('Invalid 2FA code');
    }

    await db.update(users)
        .set({
            twoFactorEnabled: false,
            twoFactorSecret: null,
        })
        .where(eq(users.id, userId));

    return { success: true, data: true };
};

// ============================================================================
// PASSWORD RESET
// ============================================================================

/**
 * Request password reset
 * When tenantSlug is provided (from subdomain), only search that tenant.
 * When no tenantSlug, searches across all tenants via global_users.
 */
export const requestPasswordReset = async (email: string, tenantSlug?: string): Promise<ServiceResult<boolean>> => {
    const emailLower = email.toLowerCase();

    const resetToken = crypto.randomUUID();
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1);

    if (tenantSlug) {
        // Subdomain-scoped: only reset in this tenant
        try {
            const tenantDb = await tenantManager.getConnection(tenantSlug);
            await tenantDb.update(users)
                .set({
                    passwordResetToken: resetToken,
                    passwordResetExpires: resetExpires,
                })
                .where(eq(users.email, emailLower));
        } catch (err) {
            logger.warn({ tenant: tenantSlug, err }, 'Failed to set reset token in tenant DB');
        }
    } else {
        // No subdomain (admin or fallback): search all tenants
        const globalUserRecords = await centralDb.query.globalUsers.findMany({
            where: eq(globalUsers.email, emailLower),
            with: { tenant: true },
        });

        if (globalUserRecords.length === 0) {
            return { success: true, data: true };
        }

        for (const gu of globalUserRecords) {
            if (!gu.tenant.isActive) continue;
            try {
                const tenantDb = await tenantManager.getConnection(gu.tenant.slug);
                await tenantDb.update(users)
                    .set({
                        passwordResetToken: resetToken,
                        passwordResetExpires: resetExpires,
                    })
                    .where(eq(users.email, emailLower));
            } catch (err) {
                logger.warn({ tenant: gu.tenant.slug, err }, 'Failed to set reset token in tenant DB');
            }
        }
    }

    // Send password reset email (include tenantSlug for subdomain-aware link)
    const emailResult = await sendPasswordResetEmail(email, resetToken, tenantSlug);
    if (!emailResult.success) {
        logger.warn(`Failed to send password reset email to ${email}: ${emailResult.error}`);
    }

    return { success: true, data: true };
};




/**
 * Reset password
 * If tenantSlug is provided, reset only in that tenant.
 * If not provided and token exists in exactly one tenant, reset there.
 * If not provided and token exists in multiple tenants, return error asking to specify tenant.
 */
export const resetPassword = async (token: string, newPassword: string, tenantSlug?: string): Promise<ServiceResult<boolean>> => {
    const allTenants = await centralDb.query.tenants.findMany({
        where: eq((await import('../db/central-schema.js')).tenants.isActive, true),
    });

    // If tenantSlug provided, only check that specific tenant
    const tenantsToCheck = tenantSlug
        ? allTenants.filter((t) => t.slug === tenantSlug)
        : allTenants;

    for (const tenant of tenantsToCheck) {
        try {
            const tenantDb = await tenantManager.getConnection(tenant.slug);
            const user = await tenantDb.query.users.findFirst({
                where: eq(users.passwordResetToken, token),
            });

            if (user && user.passwordResetExpires && new Date() <= user.passwordResetExpires) {
                const passwordHash = await hashPassword(newPassword);
                await tenantDb.update(users)
                    .set({
                        passwordHash,
                        passwordResetToken: null,
                        passwordResetExpires: null,
                        tokenVersion: user.tokenVersion + 1,
                    })
                    .where(eq(users.id, user.id));

                // Clear the reset token from other tenant DBs too
                for (const otherTenant of allTenants) {
                    if (otherTenant.slug === tenant.slug) continue;
                    try {
                        const otherDb = await tenantManager.getConnection(otherTenant.slug);
                        await otherDb.update(users)
                            .set({ passwordResetToken: null, passwordResetExpires: null })
                            .where(eq(users.passwordResetToken, token));
                    } catch {
                        // Ignore errors clearing tokens in other tenants
                    }
                }

                return { success: true, data: true };
            }
        } catch (err) {
            logger.warn({ tenant: tenant.slug, err }, 'Error checking reset token in tenant');
        }
    }

    throw new BadRequestError('Invalid or expired reset token');
};

/**
 * Verify email
 * Note: Token could belong to any tenant, so we search all
 */
export const verifyEmail = async (token: string): Promise<ServiceResult<boolean>> => {
    const allTenants = await centralDb.query.tenants.findMany({
        where: eq((await import('../db/central-schema.js')).tenants.isActive, true),
    });

    for (const tenant of allTenants) {
        try {
            const tenantDb = await tenantManager.getConnection(tenant.slug);
            const user = await tenantDb.query.users.findFirst({
                where: eq(users.emailVerificationToken, token),
            });

            if (user) {
                await tenantDb.update(users)
                    .set({
                        emailVerified: true,
                        emailVerificationToken: null,
                    })
                    .where(eq(users.id, user.id));

                return { success: true, data: true };
            }
        } catch (err) {
            logger.warn({ tenant: tenant.slug, err }, 'Error checking email token in tenant');
        }
    }

    throw new BadRequestError('Invalid verification token');
};

// ============================================================================
// USER PROFILE
// ============================================================================

/**
 * Update user's basic info (firstName, lastName, phone)
 */
export const updateUserInfo = async (
    db: Database,
    userId: string,
    data: { firstName?: string | undefined; lastName?: string | undefined; phone?: string | undefined }
): Promise<UserInfo> => {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (!user) {
        throw new NotFoundError('User not found');
    }

    const [updated] = await db.update(users)
        .set({
            ...(data.firstName && { firstName: data.firstName }),
            ...(data.lastName && { lastName: data.lastName }),
            ...(data.phone !== undefined && { phone: data.phone }),
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

    return buildUserInfo(updated!);
};

/**
 * Change user's password (requires current password verification)
 */
export const changePassword = async (
    db: Database,
    userId: string,
    currentPassword: string,
    newPassword: string
): Promise<ServiceResult<boolean>> => {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (!user) {
        throw new NotFoundError('User not found');
    }

    const isValidPassword = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
        throw new BadRequestError('La contraseña actual es incorrecta');
    }

    const passwordHash = await hashPassword(newPassword);

    await db.update(users)
        .set({
            passwordHash,
            tokenVersion: user.tokenVersion + 1,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

    return { success: true, data: true };
};
