import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { authenticator } from 'otplib';
import { db } from '../db/index.js';
import { users, refreshTokens, organizations, clinics } from '../db/schema.js';
import { config } from '../config/env.js';
import { UnauthorizedError, BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';
import type { AccessTokenPayload, RefreshTokenPayload, ServiceResult, Role } from '../types/index.js';

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
}

export interface LoginInput {
    email: string;
    password: string;
    twoFactorCode?: string;
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
    role: Role;
    organizationId: string | null;
    clinicId: string | null;
    twoFactorEnabled: boolean;
    emailVerified: boolean;
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
    return jwt.sign(payload, config.jwt.accessSecret, {
        expiresIn: config.jwt.accessExpiry,
    });
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
    return jwt.sign(payload, config.jwt.refreshSecret, {
        expiresIn: config.jwt.refreshExpiry,
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
 * Register a new user
 */
export const register = async (input: RegisterInput): ServiceResult<{ user: UserInfo; requiresVerification: boolean }> => {
    try {
        // Check if email already exists
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, input.email.toLowerCase()),
        });

        if (existingUser) {
            throw new ConflictError('Email already registered');
        }

        // Hash password
        const passwordHash = await hashPassword(input.password);

        // Generate verification token
        const emailVerificationToken = crypto.randomUUID();

        // Create user
        const [user] = await db.insert(users)
            .values({
                email: input.email.toLowerCase(),
                passwordHash,
                firstName: input.firstName,
                lastName: input.lastName,
                phone: input.phone,
                role: input.role || 'USER',
                organizationId: input.organizationId,
                clinicId: input.clinicId,
                emailVerificationToken,
                emailVerified: false,
            })
            .returning();

        if (!user) {
            throw new Error('Failed to create user');
        }

        return {
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role as Role,
                    organizationId: user.organizationId,
                    clinicId: user.clinicId,
                    twoFactorEnabled: user.twoFactorEnabled,
                    emailVerified: user.emailVerified,
                },
                requiresVerification: true,
            },
        };
    } catch (error) {
        if (error instanceof ConflictError) {
            return { success: false, error: error.message, code: 'CONFLICT' };
        }
        throw error;
    }
};

/**
 * Login user
 */
export const login = async (input: LoginInput): Promise<ServiceResult<{ tokens: AuthTokens; user: UserInfo; requires2FA?: boolean }>> => {
    // Find user
    const user = await db.query.users.findFirst({
        where: and(
            eq(users.email, input.email.toLowerCase()),
            eq(users.isActive, true)
        ),
    });

    if (!user) {
        throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await verifyPassword(input.password, user.passwordHash);
    if (!isValidPassword) {
        throw new UnauthorizedError('Invalid email or password');
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
        if (!input.twoFactorCode) {
            return {
                success: true,
                data: {
                    tokens: { accessToken: '', refreshToken: '', expiresIn: 0 },
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        role: user.role as Role,
                        organizationId: user.organizationId,
                        clinicId: user.clinicId,
                        twoFactorEnabled: user.twoFactorEnabled,
                        emailVerified: user.emailVerified,
                    },
                    requires2FA: true,
                },
            };
        }

        const isValid2FA = authenticator.verify({
            token: input.twoFactorCode,
            secret: user.twoFactorSecret,
        });

        if (!isValid2FA) {
            throw new UnauthorizedError('Invalid 2FA code');
        }
    }

    // Generate tokens
    const accessPayload: AccessTokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role as Role,
        organizationId: user.organizationId,
        clinicId: user.clinicId,
    };

    const refreshPayload: RefreshTokenPayload = {
        userId: user.id,
        tokenVersion: user.tokenVersion,
    };

    const accessToken = generateAccessToken(accessPayload);
    const refreshToken = generateRefreshToken(refreshPayload);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

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
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role as Role,
                organizationId: user.organizationId,
                clinicId: user.clinicId,
                twoFactorEnabled: user.twoFactorEnabled,
                emailVerified: user.emailVerified,
            },
        },
    };
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (token: string): Promise<ServiceResult<AuthTokens>> => {
    try {
        // Verify refresh token
        const decoded = jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;

        // Find token in database
        const storedToken = await db.query.refreshTokens.findFirst({
            where: and(
                eq(refreshTokens.token, token),
                eq(refreshTokens.userId, decoded.userId)
            ),
            with: {
                user: true,
            },
        });

        if (!storedToken || storedToken.revokedAt) {
            throw new UnauthorizedError('Invalid refresh token');
        }

        if (new Date() > storedToken.expiresAt) {
            throw new UnauthorizedError('Refresh token expired');
        }

        const user = storedToken.user;

        // Check token version
        if (user.tokenVersion !== decoded.tokenVersion) {
            throw new UnauthorizedError('Token version mismatch');
        }

        // Generate new tokens
        const accessPayload: AccessTokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role as Role,
            organizationId: user.organizationId,
            clinicId: user.clinicId,
        };

        const refreshPayload: RefreshTokenPayload = {
            userId: user.id,
            tokenVersion: user.tokenVersion,
        };

        const newAccessToken = generateAccessToken(accessPayload);
        const newRefreshToken = generateRefreshToken(refreshPayload);

        // Rotate refresh token
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await db.transaction(async (tx) => {
            // Revoke old token
            await tx.update(refreshTokens)
                .set({
                    revokedAt: new Date(),
                    replacedByToken: newRefreshToken,
                })
                .where(eq(refreshTokens.id, storedToken.id));

            // Store new token
            await tx.insert(refreshTokens).values({
                userId: user.id,
                token: newRefreshToken,
                expiresAt,
            });
        });

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
            throw new UnauthorizedError('Invalid refresh token');
        }
        throw error;
    }
};

/**
 * Logout user (revoke refresh token)
 */
export const logout = async (userId: string, token?: string): Promise<void> => {
    if (token) {
        // Revoke specific token
        await db.update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(and(
                eq(refreshTokens.userId, userId),
                eq(refreshTokens.token, token)
            ));
    } else {
        // Revoke all tokens for user
        await db.update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(eq(refreshTokens.userId, userId));
    }
};

/**
 * Setup 2FA for user
 */
export const setup2FA = async (userId: string): Promise<ServiceResult<{ secret: string; qrCodeUrl: string }>> => {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (!user) {
        throw new NotFoundError('User not found');
    }

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(user.email, 'DentalERP', secret);

    // Store secret temporarily (not enabled yet)
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
export const verify2FA = async (userId: string, code: string): Promise<ServiceResult<boolean>> => {
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
export const disable2FA = async (userId: string, code: string): Promise<ServiceResult<boolean>> => {
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

/**
 * Request password reset
 */
export const requestPasswordReset = async (email: string): Promise<ServiceResult<boolean>> => {
    const user = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
    });

    // Always return success to prevent email enumeration
    if (!user) {
        return { success: true, data: true };
    }

    const resetToken = crypto.randomUUID();
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry

    await db.update(users)
        .set({
            passwordResetToken: resetToken,
            passwordResetExpires: resetExpires,
        })
        .where(eq(users.id, user.id));

    // TODO: Send email with reset link
    // await sendPasswordResetEmail(user.email, resetToken);

    return { success: true, data: true };
};

/**
 * Reset password
 */
export const resetPassword = async (token: string, newPassword: string): Promise<ServiceResult<boolean>> => {
    const user = await db.query.users.findFirst({
        where: eq(users.passwordResetToken, token),
    });

    if (!user || !user.passwordResetExpires || new Date() > user.passwordResetExpires) {
        throw new BadRequestError('Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(newPassword);

    await db.update(users)
        .set({
            passwordHash,
            passwordResetToken: null,
            passwordResetExpires: null,
            tokenVersion: user.tokenVersion + 1, // Invalidate all existing tokens
        })
        .where(eq(users.id, user.id));

    return { success: true, data: true };
};

/**
 * Verify email
 */
export const verifyEmail = async (token: string): Promise<ServiceResult<boolean>> => {
    const user = await db.query.users.findFirst({
        where: eq(users.emailVerificationToken, token),
    });

    if (!user) {
        throw new BadRequestError('Invalid verification token');
    }

    await db.update(users)
        .set({
            emailVerified: true,
            emailVerificationToken: null,
        })
        .where(eq(users.id, user.id));

    return { success: true, data: true };
};
