import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate, requireSuperAdmin, requireAdmin } from '../middleware/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get available clinics for user assignment (Admin can see org clinics)
router.get('/clinics', requireAdmin, userController.getAvailableClinics);

// ========= Organization-scoped routes (ADMIN) =========
// These allow ADMIN to manage users within their organization

// List users in organization (for Admin panel)
router.get('/org', requireAdmin, userController.listOrgUsers);

// Get user by ID (Admin can see org users)
router.get('/org/:id', requireAdmin, userController.getOrgUser);

// Create user in organization
router.post('/org', requireAdmin, userController.createOrgUser);

// Update user in organization
router.put('/org/:id', requireAdmin, userController.updateOrgUser);

// Reset user password in organization
router.post('/org/:id/reset-password', requireAdmin, userController.resetOrgPassword);

// Toggle user active status in organization
router.post('/org/:id/toggle-status', requireAdmin, userController.toggleOrgUserStatus);

// Delete user in organization
router.delete('/org/:id', requireAdmin, userController.deleteOrgUser);

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
