import type { Response } from 'express';
import { z } from 'zod';
export declare const assignWorkerSchema: z.ZodObject<{
    userId: z.ZodString;
    clinicId: z.ZodString;
    role: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    clinicId: string;
    userId: string;
    role?: string | undefined;
}, {
    clinicId: string;
    userId: string;
    role?: string | undefined;
}>;
export declare const updateProfileSchema: z.ZodObject<{
    licenseNumber: z.ZodOptional<z.ZodString>;
    specialty: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    licenseNumber?: string | undefined;
    specialty?: string | undefined;
    bio?: string | undefined;
    color?: string | undefined;
}, {
    licenseNumber?: string | undefined;
    specialty?: string | undefined;
    bio?: string | undefined;
    color?: string | undefined;
}>;
/**
 * GET /staff
 * Get staff for current context (organization or clinic)
 */
export declare const getStaff: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /staff/my-clinics
 * Get clinics accessible to the current user
 */
export declare const getMyClinics: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /staff/assign
 * Assign a worker to a clinic
 */
export declare const assignWorker: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /staff/assign/:userId/:clinicId
 * Remove a worker from a clinic
 */
export declare const removeWorker: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /staff/profile
 * Update current user's staff profile
 */
export declare const updateMyProfile: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /staff/profile/:userId
 * Update a staff member's profile (admin only)
 */
export declare const updateStaffProfile: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=staff.controller.d.ts.map