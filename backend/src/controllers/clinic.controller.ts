import type { Response } from 'express';
import { z } from 'zod';
import * as clinicService from '../services/clinic.service.js';
import { success, paginated, parsePaginationParams } from '../utils/response.js';
import { asyncHandler } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

// Validation schemas
export const createClinicSchema = z.object({
    organizationId: z.string().uuid(),
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
    address: z.string().optional(),
    city: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
    country: z.string().length(2).optional(),
    timezone: z.string().max(50).optional(),
});

export const updateClinicSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
    address: z.string().optional(),
    city: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
    country: z.string().length(2).optional(),
    timezone: z.string().max(50).optional(),
    isActive: z.boolean().optional(),
});

/**
 * GET /clinics
 * List clinics (filtered by tenant context)
 */
export const listClinics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const params = parsePaginationParams(req.query);
    const search = req.query['search'] as string | undefined;

    let data, total;

    // Super Admin sees all clinics
    if (req.user.role === 'SUPERADMIN') {
        const result = await clinicService.getAllClinics(params, search);
        data = result.data;
        total = result.total;
    } else if (req.tenantContext.organizationId) {
        // Admin/Worker see their organization's clinics
        const result = await clinicService.getClinicsByOrganization(
            req.tenantContext.organizationId,
            params,
            search
        );
        data = result.data;
        total = result.total;
    } else {
        data = [];
        total = 0;
    }

    res.json(success(paginated(data, total, params)));
});

/**
 * GET /clinics/:id
 * Get clinic by ID
 */
export const getClinic = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const clinic = await clinicService.getClinicById(id!);

    res.json(success(clinic));
});

/**
 * GET /clinics/:id/stats
 * Get clinic statistics
 */
export const getClinicStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const stats = await clinicService.getClinicStats(id!);

    res.json(success(stats));
});

/**
 * POST /clinics
 * Create new clinic
 */
export const createClinic = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = createClinicSchema.parse(req.body);

    const result = await clinicService.createClinic(input);

    if (result.success) {
        res.status(201).json(success(result.data, 'Clinic created successfully'));
    }
});

/**
 * PUT /clinics/:id
 * Update clinic
 */
export const updateClinic = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = updateClinicSchema.parse(req.body);

    const result = await clinicService.updateClinic(id!, input);

    if (result.success) {
        res.json(success(result.data, 'Clinic updated successfully'));
    }
});

/**
 * DELETE /clinics/:id
 * Delete clinic
 */
export const deleteClinic = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await clinicService.deleteClinic(id!);

    res.json(success(null, 'Clinic deleted successfully'));
});
