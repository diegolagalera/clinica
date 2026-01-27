import type { Response } from 'express';
import { z } from 'zod';
import * as staffService from '../services/staff.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

// Validation schemas
export const assignWorkerSchema = z.object({
    userId: z.string().uuid(),
    clinicId: z.string().uuid(),
    role: z.string().max(50).optional(),
});

export const updateProfileSchema = z.object({
    licenseNumber: z.string().max(100).optional(),
    specialty: z.string().max(100).optional(),
    bio: z.string().optional(),
    color: z.string().max(7).optional(),
});

/**
 * GET /staff
 * Get staff for current context (organization or clinic)
 */
export const getStaff = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = req.headers['x-clinic-id'] as string | undefined;

    if (clinicId) {
        const staff = await staffService.getStaffByClinic(clinicId);
        res.json(success(staff));
    } else if (req.tenantContext?.organizationId) {
        const staff = await staffService.getStaffByOrganization(req.tenantContext.organizationId);
        res.json(success(staff));
    } else {
        res.json(success([]));
    }
});

/**
 * GET /staff/my-clinics
 * Get clinics accessible to the current user
 */
export const getMyClinics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId, role, organizationId } = req.user!;

    const clinics = await staffService.getAccessibleClinics(userId, role, organizationId);

    res.json(success(clinics));
});

/**
 * POST /staff/assign
 * Assign a worker to a clinic
 */
export const assignWorker = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId, clinicId, role } = assignWorkerSchema.parse(req.body);

    const assignment = await staffService.assignWorkerToClinic(userId, clinicId, role);

    res.status(201).json(success(assignment, 'Worker assigned successfully'));
});

/**
 * DELETE /staff/assign/:userId/:clinicId
 * Remove a worker from a clinic
 */
export const removeWorker = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId, clinicId } = req.params;

    await staffService.removeWorkerFromClinic(userId!, clinicId!);

    res.json(success(null, 'Worker removed from clinic'));
});

/**
 * PUT /staff/profile
 * Update current user's staff profile
 */
export const updateMyProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = updateProfileSchema.parse(req.body);

    const profile = await staffService.updateStaffProfile(req.user!.userId, data);

    res.json(success(profile, 'Profile updated'));
});

/**
 * PUT /staff/profile/:userId
 * Update a staff member's profile (admin only)
 */
export const updateStaffProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const data = updateProfileSchema.parse(req.body);

    const profile = await staffService.updateStaffProfile(userId!, data);

    res.json(success(profile, 'Profile updated'));
});
