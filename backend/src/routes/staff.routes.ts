import { Router } from 'express';
import * as staffController from '../controllers/staff.controller.js';
import { authenticate, requireAdmin, requireStaff, tenantContext } from '../middleware/index.js';
import { requireTenantDb } from '../middleware/tenant.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get clinics accessible to current user (requires tenant DB)
router.get('/my-clinics', requireTenantDb, staffController.getMyClinics);

// Get current user's staff profile
router.get('/me', requireTenantDb, requireStaff, staffController.getMyProfile);

// Update own profile
router.put('/profile', requireTenantDb, requireStaff, staffController.updateMyProfile);

// Routes requiring tenant context
router.use(tenantContext);

// Get staff (by clinic or organization) - any staff member can view
router.get('/', requireStaff, staffController.getStaff);

// Assign/remove workers (Admin only)
router.post('/assign', requireAdmin, staffController.assignWorker);
router.delete('/assign/:userId/:clinicId', requireAdmin, staffController.removeWorker);

// Update staff profile (Admin only)
router.put('/profile/:userId', requireAdmin, staffController.updateStaffProfile);

export default router;
