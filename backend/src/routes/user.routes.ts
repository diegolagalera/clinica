import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate, requireSuperAdmin, requireAdmin, requirePermission } from '../middleware/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get available clinics for user assignment
router.get('/clinics', requirePermission('staff'), userController.getAvailableClinics);

// ========= Organization-scoped routes (ADMIN or WORKER with 'staff' permission) =========
// These allow ADMIN (and workers with staff permission) to manage users within their organization

// List users in organization (for Staff panel)
router.get('/org', requirePermission('staff'), userController.listOrgUsers);

// Get user by ID
router.get('/org/:id', requirePermission('staff'), userController.getOrgUser);

// Create user in organization
router.post('/org', requirePermission('staff'), userController.createOrgUser);

// Update user in organization
router.put('/org/:id', requirePermission('staff'), userController.updateOrgUser);

// Reset user password in organization
router.post('/org/:id/reset-password', requirePermission('staff'), userController.resetOrgPassword);

// Toggle user active status in organization
router.post('/org/:id/toggle-status', requirePermission('staff'), userController.toggleOrgUserStatus);

// Delete user in organization
router.delete('/org/:id', requirePermission('staff'), userController.deleteOrgUser);

// ========= Global routes (SUPERADMIN only) =========
// List all users
router.get('/', requireSuperAdmin, userController.listUsers);

// Get user by ID
router.get('/:id', requireSuperAdmin, userController.getUser);

// Create user
router.post('/', requireSuperAdmin, userController.createUser);

// Update user
router.put('/:id', requireSuperAdmin, userController.updateUser);

// Reset user password
router.post('/:id/reset-password', requireSuperAdmin, userController.resetPassword);

// Deactivate user
router.post('/:id/deactivate', requireSuperAdmin, userController.deactivateUser);

// Delete user
router.delete('/:id', requireSuperAdmin, userController.deleteUser);

export default router;
