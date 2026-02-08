import type { AccessTokenPayload, RefreshTokenPayload, ServiceResult, Role } from '../types/index.js';
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
export declare const hashPassword: (password: string) => Promise<string>;
/**
 * Verify a password against a hash
 */
export declare const verifyPassword: (password: string, hash: string) => Promise<boolean>;
/**
 * Generate access token
 */
export declare const generateAccessToken: (payload: AccessTokenPayload) => string;
/**
 * Generate refresh token
 */
export declare const generateRefreshToken: (payload: RefreshTokenPayload) => string;
/**
 * Register a new user
 */
export declare const register: (input: RegisterInput) => ServiceResult<{
    user: UserInfo;
    requiresVerification: boolean;
}>;
/**
 * Login user
 */
export declare const login: (input: LoginInput) => Promise<ServiceResult<{
    tokens: AuthTokens;
    user: UserInfo;
    requires2FA?: boolean;
}>>;
/**
 * Refresh access token
 */
export declare const refreshAccessToken: (token: string) => Promise<ServiceResult<AuthTokens>>;
/**
 * Logout user (revoke refresh token)
 */
export declare const logout: (userId: string, token?: string) => Promise<void>;
/**
 * Setup 2FA for user
 */
export declare const setup2FA: (userId: string) => Promise<ServiceResult<{
    secret: string;
    qrCodeUrl: string;
}>>;
/**
 * Verify and enable 2FA
 */
export declare const verify2FA: (userId: string, code: string) => Promise<ServiceResult<boolean>>;
/**
 * Disable 2FA
 */
export declare const disable2FA: (userId: string, code: string) => Promise<ServiceResult<boolean>>;
/**
 * Request password reset
 */
export declare const requestPasswordReset: (email: string) => Promise<ServiceResult<boolean>>;
/**
 * Reset password
 */
export declare const resetPassword: (token: string, newPassword: string) => Promise<ServiceResult<boolean>>;
/**
 * Verify email
 */
export declare const verifyEmail: (token: string) => Promise<ServiceResult<boolean>>;
//# sourceMappingURL=auth.service.d.ts.map