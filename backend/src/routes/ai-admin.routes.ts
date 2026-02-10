import { Router } from 'express';
import { authenticate, requireSuperAdmin } from '../middleware/index.js';
import * as aiAdminController from '../controllers/ai-admin.controller.js';

const router = Router();

// All routes require SUPERADMIN role
router.use(authenticate);
router.use(requireSuperAdmin);

// Get AI usage summary for a clinic
router.get('/clinics/:clinicId/ai-usage', aiAdminController.getClinicAiUsage);

// Get AI configuration for a clinic
router.get('/clinics/:clinicId/ai-config', aiAdminController.getClinicAiConfig);

// Update AI configuration for a clinic
router.put('/clinics/:clinicId/ai-config', aiAdminController.updateClinicAiConfig);

// Get AI usage overview for all clinics (dashboard)
router.get('/ai-overview', aiAdminController.getAiOverview);

export default router;
