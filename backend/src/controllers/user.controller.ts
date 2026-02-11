import type { Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { workerClinics } from '../db/schema.js';
import * as userService from '../services/user.service.js';
import { success, paginated, parsePaginationParams } from '../utils/response.js';
import { asyncHandler } from '../middleware/index.js';
import type { AuthenticatedRequest, Role } from '../types/index.js';

// Validation schemas
export const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().max(50).optional(),
    role: z.enum(['SUPERADMIN', 'ADMIN', 'WORKER', 'USER']),
    organizationId: z.string().uuid().optional(),
    clinicId: z.string().uuid().optional(),
    clinicIds: z.array(z.string().uuid()).optional(),
    licenseNumber: z.string().max(50).optional(),
    specialty: z.string().max(100).optional(),
});

export const updateUserSchema = z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z.string().max(50).optional(),
    role: z.enum(['SUPERADMIN', 'ADMIN', 'WORKER', 'USER']).optional(),
    organizationId: z.string().uuid().nullable().optional(),
    clinicId: z.string().uuid().nullable().optional(),
    clinicIds: z.array(z.string().uuid()).optional(),
    isActive: z.boolean().optional(),
    licenseNumber: z.string().max(50).optional(),
    specialty: z.string().max(100).optional(),
    bio: z.string().optional(),
    clinicPermissions: z.record(z.string(), z.array(z.string())).optional(),
});

export const resetPasswordSchema = z.object({
    newPassword: z.string().min(8),
});

/**
 * GET /users
 * List all users (SUPERADMIN only)
 */
export const listUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const params = parsePaginationParams(req.query);
    const role = req.query['role'] as Role | undefined;
    const organizationId = req.query['organizationId'] as string | undefined;
    const search = req.query['search'] as string | undefined;

    const { data, total } = await userService.getAllUsers(req.db!, params, {
        ...(role !== undefined && { role }),
        ...(organizationId !== undefined && { organizationId }),
        ...(search !== undefined && { search }),
    });

    res.json(success(paginated(data, total, params)));
});

/**
 * GET /users/:id
 * Get user by ID
 */
export const getUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const user = await userService.getUserById(req.db!, id!);

    res.json(success(user));
});

/**
 * POST /users
 * Create new user
 */
export const createUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = createUserSchema.parse(req.body);

    const result = await userService.createUser(req.db!, input as any);

    if (result.success) {
        res.status(201).json(success(result.data, 'User created successfully'));
    }
});

/**
 * PUT /users/:id
 * Update user
 */
export const updateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = updateUserSchema.parse(req.body);

    const result = await userService.updateUser(req.db!, id!, input as any);

    if (result.success) {
        res.json(success(result.data, 'User updated successfully'));
    }
});

/**
 * POST /users/:id/reset-password
 * Reset user password
 */
export const resetPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { newPassword } = resetPasswordSchema.parse(req.body);

    await userService.resetUserPassword(req.db!, id!, newPassword);

    res.json(success(null, 'Password reset successfully'));
});

/**
 * DELETE /users/:id
 * Delete user
 */
export const deleteUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await userService.deleteUser(req.db!, id!);

    res.json(success(null, 'User deleted successfully'));
});

/**
 * POST /users/:id/deactivate
 * Deactivate user
 */
export const deactivateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await userService.deactivateUser(req.db!, id!);

    res.json(success(null, 'User deactivated successfully'));
});

/**
 * GET /users/clinics
 * Get available clinics for user assignment
 */
export const getAvailableClinics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Admin gets their org clinics, SuperAdmin can specify any org
    const organizationId = req.user?.role === 'SUPERADMIN'
        ? req.query['organizationId'] as string | undefined
        : req.user?.organizationId;

    const clinics = await userService.getAvailableClinics(req.db!, organizationId!);

    res.json(success(clinics));
});

// ============================================================================
// Organization-scoped handlers (for ADMIN managing their organization)
// ============================================================================

/**
 * GET /users/org
 * List users in organization (ADMIN only)
 * Only returns ADMIN and WORKER roles (staff), not patients (USER)
 */
export const listOrgUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
        res.status(403).json({ success: false, message: 'No organization context' });
        return;
    }

    const params = parsePaginationParams(req.query);
    const role = req.query['role'] as Role | undefined;
    const search = req.query['search'] as string | undefined;

    const { data, total } = await userService.getUsersByOrganization(req.db!, organizationId, params, {
        ...(role !== undefined && { role }),
        ...(search !== undefined && { search }),
        staffOnly: true, // Only show ADMIN and WORKER, not patients
    });

    res.json(success(paginated(data, total, params)));
});

/**
 * GET /users/org/:id
 * Get user by ID in organization
 */
export const getOrgUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const organizationId = req.user?.organizationId;
    const { id } = req.params;

    const user = await userService.getUserById(req.db!, id!);

    // Verify user belongs to same organization
    if (!user || user.organizationId !== organizationId) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }

    res.json(success(user));
});

// Schema for org user creation (no SUPERADMIN role, org is fixed)
export const createOrgUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().max(50).optional(),
    role: z.enum(['ADMIN', 'WORKER', 'USER']), // Cannot create SUPERADMIN
    clinicId: z.string().uuid().optional(),
    clinicIds: z.array(z.string().uuid()).optional(),
    licenseNumber: z.string().max(50).optional(),
    specialty: z.string().max(100).optional(),
});

/**
 * POST /users/org
 * Create user in organization (ADMIN only)
 */
export const createOrgUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
        res.status(403).json({ success: false, message: 'No organization context' });
        return;
    }

    const input = createOrgUserSchema.parse(req.body);

    const result = await userService.createUser(req.db!, {
        ...input as any,
        organizationId, // Force to current org
    });

    if (result.success) {
        res.status(201).json(success(result.data, 'User created successfully'));
    }
});

/**
 * PUT /users/org/:id
 * Update user in organization
 */
export const updateOrgUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const organizationId = req.user?.organizationId;
    const { id } = req.params;

    // Verify user belongs to same organization
    const existing = await userService.getUserById(req.db!, id!);
    if (!existing || existing.organizationId !== organizationId) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }

    const input = updateUserSchema.parse(req.body);

    // Extract clinicPermissions before passing to user service
    const { clinicPermissions, ...userInput } = input;

    // Prevent changing to SUPERADMIN
    if (userInput.role === 'SUPERADMIN') {
        res.status(403).json({ success: false, message: 'Cannot assign SUPERADMIN role' });
        return;
    }

    const result = await userService.updateUser(req.db!, id!, {
        ...userInput as any,
        organizationId, // Keep in same org
    });

    // Save per-clinic permissions to worker_clinics if provided
    if (clinicPermissions !== undefined && result.success) {
        for (const [clinicId, perms] of Object.entries(clinicPermissions)) {
            await req.db!.update(workerClinics)
                .set({ permissions: perms, updatedAt: new Date() })
                .where(
                    and(
                        eq(workerClinics.userId, id!),
                        eq(workerClinics.clinicId, clinicId)
                    )
                );
        }
    }

    if (result.success) {
        res.json(success(result.data, 'User updated successfully'));
    }
});

/**
 * POST /users/org/:id/reset-password
 * Reset password for user in organization
 */
export const resetOrgPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const organizationId = req.user?.organizationId;
    const { id } = req.params;

    // Verify user belongs to same organization
    const existing = await userService.getUserById(req.db!, id!);
    if (!existing || existing.organizationId !== organizationId) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }

    const { newPassword } = resetPasswordSchema.parse(req.body);

    await userService.resetUserPassword(req.db!, id!, newPassword);

    res.json(success(null, 'Password reset successfully'));
});

/**
 * DELETE /users/org/:id
 * Delete user in organization
 */
export const deleteOrgUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const organizationId = req.user?.organizationId;
    const { id } = req.params;

    // Verify user belongs to same organization
    const existing = await userService.getUserById(req.db!, id!);
    if (!existing || existing.organizationId !== organizationId) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }

    // Prevent deleting yourself
    if (id === req.user?.userId) {
        res.status(403).json({ success: false, message: 'Cannot delete yourself' });
        return;
    }

    await userService.deleteUser(req.db!, id!);

    res.json(success(null, 'User deleted successfully'));
});

/**
 * POST /users/org/:id/toggle-status
 * Toggle user active status in organization
 */
export const toggleOrgUserStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const organizationId = req.user?.organizationId;
    const { id } = req.params;

    // Verify user belongs to same organization
    const existing = await userService.getUserById(req.db!, id!);
    if (!existing || existing.organizationId !== organizationId) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }

    // Prevent toggling yourself
    if (id === req.user?.userId) {
        res.status(403).json({ success: false, message: 'Cannot change your own status' });
        return;
    }

    // Toggle the isActive status
    const newStatus = !existing.isActive;
    const result = await userService.updateUser(req.db!, id!, { isActive: newStatus });

    if (result.success) {
        res.json(success(result.data, newStatus ? 'User activated' : 'User deactivated'));
    }
});
