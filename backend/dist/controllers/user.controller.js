"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleOrgUserStatus = exports.deleteOrgUser = exports.resetOrgPassword = exports.updateOrgUser = exports.createOrgUser = exports.createOrgUserSchema = exports.getOrgUser = exports.listOrgUsers = exports.getAvailableClinics = exports.deactivateUser = exports.deleteUser = exports.resetPassword = exports.updateUser = exports.createUser = exports.getUser = exports.listUsers = exports.resetPasswordSchema = exports.updateUserSchema = exports.createUserSchema = void 0;
const zod_1 = require("zod");
const userService = __importStar(require("../services/user.service.js"));
const response_js_1 = require("../utils/response.js");
const index_js_1 = require("../middleware/index.js");
// Validation schemas
exports.createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    firstName: zod_1.z.string().min(1).max(100),
    lastName: zod_1.z.string().min(1).max(100),
    phone: zod_1.z.string().max(50).optional(),
    role: zod_1.z.enum(['SUPERADMIN', 'ADMIN', 'WORKER', 'USER']),
    organizationId: zod_1.z.string().uuid().optional(),
    clinicId: zod_1.z.string().uuid().optional(),
    clinicIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    licenseNumber: zod_1.z.string().max(50).optional(),
    specialty: zod_1.z.string().max(100).optional(),
});
exports.updateUserSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).max(100).optional(),
    lastName: zod_1.z.string().min(1).max(100).optional(),
    phone: zod_1.z.string().max(50).optional(),
    role: zod_1.z.enum(['SUPERADMIN', 'ADMIN', 'WORKER', 'USER']).optional(),
    organizationId: zod_1.z.string().uuid().nullable().optional(),
    clinicId: zod_1.z.string().uuid().nullable().optional(),
    clinicIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    isActive: zod_1.z.boolean().optional(),
    licenseNumber: zod_1.z.string().max(50).optional(),
    specialty: zod_1.z.string().max(100).optional(),
    bio: zod_1.z.string().optional(),
});
exports.resetPasswordSchema = zod_1.z.object({
    newPassword: zod_1.z.string().min(8),
});
/**
 * GET /users
 * List all users (SUPERADMIN only)
 */
exports.listUsers = (0, index_js_1.asyncHandler)(async (req, res) => {
    const params = (0, response_js_1.parsePaginationParams)(req.query);
    const role = req.query['role'];
    const organizationId = req.query['organizationId'];
    const search = req.query['search'];
    const { data, total } = await userService.getAllUsers(params, {
        role,
        organizationId,
        search,
    });
    res.json((0, response_js_1.success)((0, response_js_1.paginated)(data, total, params)));
});
/**
 * GET /users/:id
 * Get user by ID
 */
exports.getUser = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    res.json((0, response_js_1.success)(user));
});
/**
 * POST /users
 * Create new user
 */
exports.createUser = (0, index_js_1.asyncHandler)(async (req, res) => {
    const input = exports.createUserSchema.parse(req.body);
    const result = await userService.createUser(input);
    if (result.success) {
        res.status(201).json((0, response_js_1.success)(result.data, 'User created successfully'));
    }
});
/**
 * PUT /users/:id
 * Update user
 */
exports.updateUser = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const input = exports.updateUserSchema.parse(req.body);
    const result = await userService.updateUser(id, input);
    if (result.success) {
        res.json((0, response_js_1.success)(result.data, 'User updated successfully'));
    }
});
/**
 * POST /users/:id/reset-password
 * Reset user password
 */
exports.resetPassword = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { newPassword } = exports.resetPasswordSchema.parse(req.body);
    await userService.resetUserPassword(id, newPassword);
    res.json((0, response_js_1.success)(null, 'Password reset successfully'));
});
/**
 * DELETE /users/:id
 * Delete user
 */
exports.deleteUser = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await userService.deleteUser(id);
    res.json((0, response_js_1.success)(null, 'User deleted successfully'));
});
/**
 * POST /users/:id/deactivate
 * Deactivate user
 */
exports.deactivateUser = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await userService.deactivateUser(id);
    res.json((0, response_js_1.success)(null, 'User deactivated successfully'));
});
/**
 * GET /users/clinics
 * Get available clinics for user assignment
 */
exports.getAvailableClinics = (0, index_js_1.asyncHandler)(async (req, res) => {
    // Admin gets their org clinics, SuperAdmin can specify any org
    const organizationId = req.user?.role === 'SUPERADMIN'
        ? req.query['organizationId']
        : req.user?.organizationId;
    const clinics = await userService.getAvailableClinics(organizationId);
    res.json((0, response_js_1.success)(clinics));
});
// ============================================================================
// Organization-scoped handlers (for ADMIN managing their organization)
// ============================================================================
/**
 * GET /users/org
 * List users in organization (ADMIN only)
 * Only returns ADMIN and WORKER roles (staff), not patients (USER)
 */
exports.listOrgUsers = (0, index_js_1.asyncHandler)(async (req, res) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
        return res.status(403).json({ success: false, message: 'No organization context' });
    }
    const params = (0, response_js_1.parsePaginationParams)(req.query);
    const role = req.query['role'];
    const search = req.query['search'];
    const { data, total } = await userService.getUsersByOrganization(organizationId, params, {
        role,
        search,
        staffOnly: true, // Only show ADMIN and WORKER, not patients
    });
    res.json((0, response_js_1.success)((0, response_js_1.paginated)(data, total, params)));
});
/**
 * GET /users/org/:id
 * Get user by ID in organization
 */
exports.getOrgUser = (0, index_js_1.asyncHandler)(async (req, res) => {
    const organizationId = req.user?.organizationId;
    const { id } = req.params;
    const user = await userService.getUserById(id);
    // Verify user belongs to same organization
    if (!user || user.organizationId !== organizationId) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json((0, response_js_1.success)(user));
});
// Schema for org user creation (no SUPERADMIN role, org is fixed)
exports.createOrgUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    firstName: zod_1.z.string().min(1).max(100),
    lastName: zod_1.z.string().min(1).max(100),
    phone: zod_1.z.string().max(50).optional(),
    role: zod_1.z.enum(['ADMIN', 'WORKER', 'USER']), // Cannot create SUPERADMIN
    clinicId: zod_1.z.string().uuid().optional(),
    clinicIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    licenseNumber: zod_1.z.string().max(50).optional(),
    specialty: zod_1.z.string().max(100).optional(),
});
/**
 * POST /users/org
 * Create user in organization (ADMIN only)
 */
exports.createOrgUser = (0, index_js_1.asyncHandler)(async (req, res) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
        return res.status(403).json({ success: false, message: 'No organization context' });
    }
    const input = exports.createOrgUserSchema.parse(req.body);
    const result = await userService.createUser({
        ...input,
        organizationId, // Force to current org
    });
    if (result.success) {
        res.status(201).json((0, response_js_1.success)(result.data, 'User created successfully'));
    }
});
/**
 * PUT /users/org/:id
 * Update user in organization
 */
exports.updateOrgUser = (0, index_js_1.asyncHandler)(async (req, res) => {
    const organizationId = req.user?.organizationId;
    const { id } = req.params;
    // Verify user belongs to same organization
    const existing = await userService.getUserById(id);
    if (!existing || existing.organizationId !== organizationId) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    const input = exports.updateUserSchema.parse(req.body);
    // Prevent changing to SUPERADMIN
    if (input.role === 'SUPERADMIN') {
        return res.status(403).json({ success: false, message: 'Cannot assign SUPERADMIN role' });
    }
    const result = await userService.updateUser(id, {
        ...input,
        organizationId, // Keep in same org
    });
    if (result.success) {
        res.json((0, response_js_1.success)(result.data, 'User updated successfully'));
    }
});
/**
 * POST /users/org/:id/reset-password
 * Reset password for user in organization
 */
exports.resetOrgPassword = (0, index_js_1.asyncHandler)(async (req, res) => {
    const organizationId = req.user?.organizationId;
    const { id } = req.params;
    // Verify user belongs to same organization
    const existing = await userService.getUserById(id);
    if (!existing || existing.organizationId !== organizationId) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    const { newPassword } = exports.resetPasswordSchema.parse(req.body);
    await userService.resetUserPassword(id, newPassword);
    res.json((0, response_js_1.success)(null, 'Password reset successfully'));
});
/**
 * DELETE /users/org/:id
 * Delete user in organization
 */
exports.deleteOrgUser = (0, index_js_1.asyncHandler)(async (req, res) => {
    const organizationId = req.user?.organizationId;
    const { id } = req.params;
    // Verify user belongs to same organization
    const existing = await userService.getUserById(id);
    if (!existing || existing.organizationId !== organizationId) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    // Prevent deleting yourself
    if (id === req.user?.userId) {
        return res.status(403).json({ success: false, message: 'Cannot delete yourself' });
    }
    await userService.deleteUser(id);
    res.json((0, response_js_1.success)(null, 'User deleted successfully'));
});
/**
 * POST /users/org/:id/toggle-status
 * Toggle user active status in organization
 */
exports.toggleOrgUserStatus = (0, index_js_1.asyncHandler)(async (req, res) => {
    const organizationId = req.user?.organizationId;
    const { id } = req.params;
    // Verify user belongs to same organization
    const existing = await userService.getUserById(id);
    if (!existing || existing.organizationId !== organizationId) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    // Prevent toggling yourself
    if (id === req.user?.userId) {
        return res.status(403).json({ success: false, message: 'Cannot change your own status' });
    }
    // Toggle the isActive status
    const newStatus = !existing.isActive;
    const result = await userService.updateUser(id, { isActive: newStatus });
    if (result.success) {
        res.json((0, response_js_1.success)(result.data, newStatus ? 'User activated' : 'User deactivated'));
    }
});
//# sourceMappingURL=user.controller.js.map