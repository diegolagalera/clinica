"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyEmail = exports.resetPassword = exports.requestPasswordReset = exports.disable2FA = exports.verify2FA = exports.setup2FA = exports.logout = exports.refreshAccessToken = exports.login = exports.register = exports.generateRefreshToken = exports.generateAccessToken = exports.verifyPassword = exports.hashPassword = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const drizzle_orm_1 = require("drizzle-orm");
const otplib_1 = require("otplib");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const env_js_1 = require("../config/env.js");
const errors_js_1 = require("../utils/errors.js");
const SALT_ROUNDS = 12;
/**
 * Hash a password using bcrypt
 */
const hashPassword = async (password) => {
    return bcrypt_1.default.hash(password, SALT_ROUNDS);
};
exports.hashPassword = hashPassword;
/**
 * Verify a password against a hash
 */
const verifyPassword = async (password, hash) => {
    return bcrypt_1.default.compare(password, hash);
};
exports.verifyPassword = verifyPassword;
/**
 * Generate access token
 */
const generateAccessToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, env_js_1.config.jwt.accessSecret, {
        expiresIn: env_js_1.config.jwt.accessExpiry,
    });
};
exports.generateAccessToken = generateAccessToken;
/**
 * Generate refresh token
 */
const generateRefreshToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, env_js_1.config.jwt.refreshSecret, {
        expiresIn: env_js_1.config.jwt.refreshExpiry,
    });
};
exports.generateRefreshToken = generateRefreshToken;
/**
 * Parse expiry string to seconds
 */
const parseExpiry = (expiry) => {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match)
        return 900; // Default 15 minutes
    const value = parseInt(match[1], 10);
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
const register = async (input) => {
    try {
        // Check if email already exists
        const existingUser = await index_js_1.db.query.users.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_js_1.users.email, input.email.toLowerCase()),
        });
        if (existingUser) {
            throw new errors_js_1.ConflictError('Email already registered');
        }
        // Hash password
        const passwordHash = await (0, exports.hashPassword)(input.password);
        // Generate verification token
        const emailVerificationToken = crypto.randomUUID();
        // Create user
        const [user] = await index_js_1.db.insert(schema_js_1.users)
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
                    role: user.role,
                    organizationId: user.organizationId,
                    clinicId: user.clinicId,
                    twoFactorEnabled: user.twoFactorEnabled,
                    emailVerified: user.emailVerified,
                },
                requiresVerification: true,
            },
        };
    }
    catch (error) {
        if (error instanceof errors_js_1.ConflictError) {
            return { success: false, error: error.message, code: 'CONFLICT' };
        }
        throw error;
    }
};
exports.register = register;
/**
 * Login user
 */
const login = async (input) => {
    // Find user
    const user = await index_js_1.db.query.users.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.users.email, input.email.toLowerCase()), (0, drizzle_orm_1.eq)(schema_js_1.users.isActive, true)),
    });
    if (!user) {
        throw new errors_js_1.UnauthorizedError('Invalid email or password');
    }
    // Verify password
    const isValidPassword = await (0, exports.verifyPassword)(input.password, user.passwordHash);
    if (!isValidPassword) {
        throw new errors_js_1.UnauthorizedError('Invalid email or password');
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
                        role: user.role,
                        organizationId: user.organizationId,
                        clinicId: user.clinicId,
                        twoFactorEnabled: user.twoFactorEnabled,
                        emailVerified: user.emailVerified,
                    },
                    requires2FA: true,
                },
            };
        }
        const isValid2FA = otplib_1.authenticator.verify({
            token: input.twoFactorCode,
            secret: user.twoFactorSecret,
        });
        if (!isValid2FA) {
            throw new errors_js_1.UnauthorizedError('Invalid 2FA code');
        }
    }
    // Generate tokens
    const accessPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        clinicId: user.clinicId,
    };
    const refreshPayload = {
        userId: user.id,
        tokenVersion: user.tokenVersion,
    };
    const accessToken = (0, exports.generateAccessToken)(accessPayload);
    const refreshToken = (0, exports.generateRefreshToken)(refreshPayload);
    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    await index_js_1.db.insert(schema_js_1.refreshTokens).values({
        userId: user.id,
        token: refreshToken,
        expiresAt,
    });
    // Update last login
    await index_js_1.db.update(schema_js_1.users)
        .set({ lastLoginAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, user.id));
    return {
        success: true,
        data: {
            tokens: {
                accessToken,
                refreshToken,
                expiresIn: parseExpiry(env_js_1.config.jwt.accessExpiry),
            },
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                organizationId: user.organizationId,
                clinicId: user.clinicId,
                twoFactorEnabled: user.twoFactorEnabled,
                emailVerified: user.emailVerified,
            },
        },
    };
};
exports.login = login;
/**
 * Refresh access token
 */
const refreshAccessToken = async (token) => {
    try {
        // Verify refresh token
        const decoded = jsonwebtoken_1.default.verify(token, env_js_1.config.jwt.refreshSecret);
        // Find token in database
        const storedToken = await index_js_1.db.query.refreshTokens.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.refreshTokens.token, token), (0, drizzle_orm_1.eq)(schema_js_1.refreshTokens.userId, decoded.userId)),
            with: {
                user: true,
            },
        });
        if (!storedToken || storedToken.revokedAt) {
            throw new errors_js_1.UnauthorizedError('Invalid refresh token');
        }
        if (new Date() > storedToken.expiresAt) {
            throw new errors_js_1.UnauthorizedError('Refresh token expired');
        }
        const user = storedToken.user;
        // Check token version
        if (user.tokenVersion !== decoded.tokenVersion) {
            throw new errors_js_1.UnauthorizedError('Token version mismatch');
        }
        // Generate new tokens
        const accessPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
            clinicId: user.clinicId,
        };
        const refreshPayload = {
            userId: user.id,
            tokenVersion: user.tokenVersion,
        };
        const newAccessToken = (0, exports.generateAccessToken)(accessPayload);
        const newRefreshToken = (0, exports.generateRefreshToken)(refreshPayload);
        // Rotate refresh token
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await index_js_1.db.transaction(async (tx) => {
            // Revoke old token
            await tx.update(schema_js_1.refreshTokens)
                .set({
                revokedAt: new Date(),
                replacedByToken: newRefreshToken,
            })
                .where((0, drizzle_orm_1.eq)(schema_js_1.refreshTokens.id, storedToken.id));
            // Store new token
            await tx.insert(schema_js_1.refreshTokens).values({
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
                expiresIn: parseExpiry(env_js_1.config.jwt.accessExpiry),
            },
        };
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            throw new errors_js_1.UnauthorizedError('Invalid refresh token');
        }
        throw error;
    }
};
exports.refreshAccessToken = refreshAccessToken;
/**
 * Logout user (revoke refresh token)
 */
const logout = async (userId, token) => {
    if (token) {
        // Revoke specific token
        await index_js_1.db.update(schema_js_1.refreshTokens)
            .set({ revokedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.refreshTokens.userId, userId), (0, drizzle_orm_1.eq)(schema_js_1.refreshTokens.token, token)));
    }
    else {
        // Revoke all tokens for user
        await index_js_1.db.update(schema_js_1.refreshTokens)
            .set({ revokedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_js_1.refreshTokens.userId, userId));
    }
};
exports.logout = logout;
/**
 * Setup 2FA for user
 */
const setup2FA = async (userId) => {
    const user = await index_js_1.db.query.users.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.users.id, userId),
    });
    if (!user) {
        throw new errors_js_1.NotFoundError('User not found');
    }
    const secret = otplib_1.authenticator.generateSecret();
    const otpAuthUrl = otplib_1.authenticator.keyuri(user.email, 'DentalERP', secret);
    // Store secret temporarily (not enabled yet)
    await index_js_1.db.update(schema_js_1.users)
        .set({ twoFactorSecret: secret })
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, userId));
    return {
        success: true,
        data: {
            secret,
            qrCodeUrl: otpAuthUrl,
        },
    };
};
exports.setup2FA = setup2FA;
/**
 * Verify and enable 2FA
 */
const verify2FA = async (userId, code) => {
    const user = await index_js_1.db.query.users.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.users.id, userId),
    });
    if (!user || !user.twoFactorSecret) {
        throw new errors_js_1.BadRequestError('2FA not set up');
    }
    const isValid = otplib_1.authenticator.verify({
        token: code,
        secret: user.twoFactorSecret,
    });
    if (!isValid) {
        throw new errors_js_1.BadRequestError('Invalid 2FA code');
    }
    await index_js_1.db.update(schema_js_1.users)
        .set({ twoFactorEnabled: true })
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, userId));
    return { success: true, data: true };
};
exports.verify2FA = verify2FA;
/**
 * Disable 2FA
 */
const disable2FA = async (userId, code) => {
    const user = await index_js_1.db.query.users.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.users.id, userId),
    });
    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
        throw new errors_js_1.BadRequestError('2FA not enabled');
    }
    const isValid = otplib_1.authenticator.verify({
        token: code,
        secret: user.twoFactorSecret,
    });
    if (!isValid) {
        throw new errors_js_1.BadRequestError('Invalid 2FA code');
    }
    await index_js_1.db.update(schema_js_1.users)
        .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, userId));
    return { success: true, data: true };
};
exports.disable2FA = disable2FA;
/**
 * Request password reset
 */
const requestPasswordReset = async (email) => {
    const user = await index_js_1.db.query.users.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.users.email, email.toLowerCase()),
    });
    // Always return success to prevent email enumeration
    if (!user) {
        return { success: true, data: true };
    }
    const resetToken = crypto.randomUUID();
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry
    await index_js_1.db.update(schema_js_1.users)
        .set({
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, user.id));
    // TODO: Send email with reset link
    // await sendPasswordResetEmail(user.email, resetToken);
    return { success: true, data: true };
};
exports.requestPasswordReset = requestPasswordReset;
/**
 * Reset password
 */
const resetPassword = async (token, newPassword) => {
    const user = await index_js_1.db.query.users.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.users.passwordResetToken, token),
    });
    if (!user || !user.passwordResetExpires || new Date() > user.passwordResetExpires) {
        throw new errors_js_1.BadRequestError('Invalid or expired reset token');
    }
    const passwordHash = await (0, exports.hashPassword)(newPassword);
    await index_js_1.db.update(schema_js_1.users)
        .set({
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        tokenVersion: user.tokenVersion + 1, // Invalidate all existing tokens
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, user.id));
    return { success: true, data: true };
};
exports.resetPassword = resetPassword;
/**
 * Verify email
 */
const verifyEmail = async (token) => {
    const user = await index_js_1.db.query.users.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.users.emailVerificationToken, token),
    });
    if (!user) {
        throw new errors_js_1.BadRequestError('Invalid verification token');
    }
    await index_js_1.db.update(schema_js_1.users)
        .set({
        emailVerified: true,
        emailVerificationToken: null,
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, user.id));
    return { success: true, data: true };
};
exports.verifyEmail = verifyEmail;
//# sourceMappingURL=auth.service.js.map