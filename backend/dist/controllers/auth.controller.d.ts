import type { Response } from 'express';
import { z } from 'zod';
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    twoFactorCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    twoFactorCode?: string | undefined;
}, {
    email: string;
    password: string;
    twoFactorCode?: string | undefined;
}>;
export declare const registerSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    phone?: string | undefined;
}, {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    phone?: string | undefined;
}>;
export declare const refreshSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export declare const passwordResetRequestSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const passwordResetSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
    password: string;
}, {
    token: string;
    password: string;
}>;
export declare const verifyEmailSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
export declare const verify2FASchema: z.ZodObject<{
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
/**
 * POST /auth/login
 */
export declare const login: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /auth/register
 * Patient self-registration
 */
export declare const register: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /auth/refresh
 */
export declare const refreshToken: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /auth/logout
 */
export declare const logout: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /auth/forgot-password
 */
export declare const forgotPassword: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /auth/reset-password
 */
export declare const resetPassword: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /auth/verify-email
 */
export declare const verifyEmail: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /auth/2fa/setup
 */
export declare const setup2FA: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /auth/2fa/verify
 */
export declare const verify2FA: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /auth/2fa/disable
 */
export declare const disable2FA: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /auth/me
 */
export declare const getCurrentUser: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=auth.controller.d.ts.map