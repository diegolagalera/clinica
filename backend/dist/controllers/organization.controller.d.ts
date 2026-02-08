import type { Response } from 'express';
import { z } from 'zod';
export declare const createOrganizationSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    logoUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    slug: string;
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    logoUrl?: string | undefined;
}, {
    name: string;
    slug: string;
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    logoUrl?: string | undefined;
}>;
export declare const updateOrganizationSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    logoUrl: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    slug?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    logoUrl?: string | undefined;
    isActive?: boolean | undefined;
}, {
    name?: string | undefined;
    slug?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    logoUrl?: string | undefined;
    isActive?: boolean | undefined;
}>;
/**
 * GET /organizations
 * List all organizations (SUPERADMIN only)
 */
export declare const listOrganizations: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /organizations/:id
 * Get organization by ID
 */
export declare const getOrganization: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /organizations/:id/stats
 * Get organization statistics
 */
export declare const getOrganizationStats: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /organizations
 * Create new organization
 */
export declare const createOrganization: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * PUT /organizations/:id
 * Update organization
 */
export declare const updateOrganization: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * DELETE /organizations/:id
 * Delete organization
 */
export declare const deleteOrganization: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=organization.controller.d.ts.map