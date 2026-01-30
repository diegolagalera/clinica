import { Router } from 'express';
import * as clinicController from '../controllers/clinic.controller.js';
import { authenticate, requireAdmin, tenantContext } from '../middleware/index.js';

const router = Router();

// All routes require authentication and tenant context
router.use(authenticate);
router.use(tenantContext);

// List clinics (filtered by role)
router.get('/', clinicController.listClinics);

// Get current clinic settings (from tenant context)
router.get('/current', clinicController.getCurrentClinic);

// Update current clinic settings
router.put('/current', clinicController.updateCurrentClinic);

// Get clinic by ID
router.get('/:id', clinicController.getClinic);

// Get clinic stats
router.get('/:id/stats', clinicController.getClinicStats);

// Create clinic (ADMIN only)
router.post('/', requireAdmin, clinicController.createClinic);

// Update clinic (ADMIN only)
router.put('/:id', requireAdmin, clinicController.updateClinic);

// Delete clinic (ADMIN only - actually requires SUPERADMIN for safety)
router.delete('/:id', requireAdmin, clinicController.deleteClinic);

export default router;
