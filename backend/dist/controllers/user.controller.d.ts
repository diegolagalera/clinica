import type { Response } from 'express';
import { z } from 'zod';
export declare const createUserSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    role: z.ZodEnum<["SUPERADMIN", "ADMIN", "WORKER", "USER"]>;
    organizationId: z.ZodOptional<z.ZodString>;
    clinicId: z.ZodOptional<z.ZodString>;
    clinicIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    licenseNumber: z.ZodOptional<z.ZodString>;
    specialty: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    role: "SUPERADMIN" | "ADMIN" | "WORKER" | "USER";
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    phone?: string | undefined;
    organizationId?: string | undefined;
    clinicId?: string | undefined;
    licenseNumber?: string | undefined;
    specialty?: string | undefined;
    clinicIds?: string[] | undefined;
}, {
    role: "SUPERADMIN" | "ADMIN" | "WORKER" | "USER";
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    phone?: string | undefined;
    organizationId?: string | undefined;
    clinicId?: string | undefined;
    licenseNumber?: string | undefined;
    specialty?: string | undefined;
    clinicIds?: string[] | undefined;
}>;
export declare const updateUserSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["SUPERADMIN", "ADMIN", "WORKER", "USER"]>>;
    organizationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    clinicId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    clinicIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    licenseNumber: z.ZodOptional<z.ZodString>;
    specialty: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    role?: "SUPERADMIN" | "ADMIN" | "WORKER" | "USER" | undefined;
    phone?: string | undefined;
    isActive?: boolean | undefined;
    organizationId?: string | null | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    clinicId?: string | null | undefined;
    licenseNumber?: string | undefined;
    specialty?: string | undefined;
    bio?: string | undefined;
    clinicIds?: string[] | undefined;
}, {
    role?: "SUPERADMIN" | "ADMIN" | "WORKER" | "USER" | undefined;
    phone?: string | undefined;
    isActive?: boolean | undefined;
    organizationId?: string | null | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    clinicId?: string | null | undefined;
    licenseNumber?: string | undefined;
    specialty?: string | undefined;
    bio?: string | undefined;
    clinicIds?: string[] | undefined;
}>;
export declare const resetPasswordSchema: z.ZodObject<{
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    newPassword: string;
}, {
    newPassword: string;
}>;
/**
 * GET /users
 * List all users (SUPERADMIN only)
 */
export declare const listUsers: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /users/:id
 * Get user by ID
 */
export declare const getUser: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /users
 * Create new user
 */
export declare const createUser: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /users/:id
 * Update user
 */
export declare const updateUser: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /users/:id/reset-password
 * Reset user password
 */
export declare const resetPassword: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /users/:id
 * Delete user
 */
export declare const deleteUser: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /users/:id/deactivate
 * Deactivate user
 */
export declare const deactivateUser: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /users/clinics
 * Get available clinics for user assignment
 */
export declare const getAvailableClinics: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /users/org
 * List users in organization (ADMIN only)
 * Only returns ADMIN and WORKER roles (staff), not patients (USER)
 */
export declare const listOrgUsers: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /users/org/:id
 * Get user by ID in organization
 */
export declare const getOrgUser: (req: any, res: Response, next: import("express").NextFunction) => void;
export declare const createOrgUserSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    role: z.ZodEnum<["ADMIN", "WORKER", "USER"]>;
    clinicId: z.ZodOptional<z.ZodString>;
    clinicIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    licenseNumber: z.ZodOptional<z.ZodString>;
    specialty: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    role: "ADMIN" | "WORKER" | "USER";
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    phone?: string | undefined;
    clinicId?: string | undefined;
    licenseNumber?: string | undefined;
    specialty?: string | undefined;
    clinicIds?: string[] | undefined;
}, {
    role: "ADMIN" | "WORKER" | "USER";
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    phone?: string | undefined;
    clinicId?: string | undefined;
    licenseNumber?: string | undefined;
    specialty?: string | undefined;
    clinicIds?: string[] | undefined;
}>;
/**
 * POST /users/org
 * Create user in organization (ADMIN only)
 */
export declare const createOrgUser: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /users/org/:id
 * Update user in organization
 */
export declare const updateOrgUser: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /users/org/:id/reset-password
 * Reset password for user in organization
 */
export declare const resetOrgPassword: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /users/org/:id
 * Delete user in organization
 */
export declare const deleteOrgUser: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /users/org/:id/toggle-status
 * Toggle user active status in organization
 */
export declare const toggleOrgUserStatus: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=user.controller.d.ts.map