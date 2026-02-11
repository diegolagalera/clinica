import type { Response } from 'express';
import { z } from 'zod';
import * as organizationService from '../services/organization.service.js';
import { success, paginated, parsePaginationParams } from '../utils/response.js';
import { asyncHandler } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

// Validation schemas
export const createOrganizationSchema = z.object({
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
    address: z.string().optional(),
    logoUrl: z.string().url().optional(),
});

export const updateOrganizationSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
    address: z.string().optional(),
    logoUrl: z.string().url().optional(),
    isActive: z.boolean().optional(),
});

/**
 * GET /organizations
 * List all organizations (SUPERADMIN only)
 */
export const listOrganizations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const params = parsePaginationParams(req.query);
    const search = req.query['search'] as string | undefined;

    const { data, total } = await organizationService.getOrganizations(req.db!, params, search);

    res.json(success(paginated(data, total, params)));
});

/**
 * GET /organizations/:id
 * Get organization by ID
 */
export const getOrganization = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const org = await organizationService.getOrganizationById(req.db!, id!);

    res.json(success(org));
});

/**
 * GET /organizations/:id/stats
 * Get organization statistics
 */
export const getOrganizationStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const stats = await organizationService.getOrganizationStats(req.db!, id!);

    res.json(success(stats));
});

/**
 * POST /organizations
 * Create new organization
 */
export const createOrganization = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = createOrganizationSchema.parse(req.body);

    const result = await organizationService.createOrganization(req.db!, input as any);

    if (result.success) {
        res.status(201).json(success(result.data, 'Organization created successfully'));
    }
});

/**
 * PUT /organizations/:id
 * Update organization
 */
export const updateOrganization = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = updateOrganizationSchema.parse(req.body);

    const result = await organizationService.updateOrganization(req.db!, id!, input as any);

    if (result.success) {
        res.json(success(result.data, 'Organization updated successfully'));
    }
});

/**
 * DELETE /organizations/:id
 * Delete organization
 */
export const deleteOrganization = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await organizationService.deleteOrganization(req.db!, id!);

    res.json(success(null, 'Organization deleted successfully'));
});
