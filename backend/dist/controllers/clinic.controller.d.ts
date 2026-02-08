import type { Response } from 'express';
import { z } from 'zod';
export declare const createClinicSchema: z.ZodObject<{
    organizationId: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
    timezone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    slug: string;
    organizationId: string;
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    postalCode?: string | undefined;
    country?: string | undefined;
    timezone?: string | undefined;
}, {
    name: string;
    slug: string;
    organizationId: string;
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    postalCode?: string | undefined;
    country?: string | undefined;
    timezone?: string | undefined;
}>;
export declare const updateClinicSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
    timezone: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    slug?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    isActive?: boolean | undefined;
    city?: string | undefined;
    postalCode?: string | undefined;
    country?: string | undefined;
    timezone?: string | undefined;
}, {
    name?: string | undefined;
    slug?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    isActive?: boolean | undefined;
    city?: string | undefined;
    postalCode?: string | undefined;
    country?: string | undefined;
    timezone?: string | undefined;
}>;
/**
 * GET /clinics
 * List clinics (filtered by tenant context)
 */
export declare const listClinics: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /clinics/:id
 * Get clinic by ID
 */
export declare const getClinic: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /clinics/current
 * Get current clinic from tenant context
 */
export declare const getCurrentClinic: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /clinics/current
 * Update current clinic settings
 */
export declare const updateCurrentClinic: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /clinics/:id/stats
 * Get clinic statistics
 */
export declare const getClinicStats: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /clinics
 * Create new clinic
 */
export declare const createClinic: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /clinics/:id
 * Update clinic
 */
export declare const updateClinic: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /clinics/:id
 * Delete clinic
 */
export declare const deleteClinic: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=clinic.controller.d.ts.map