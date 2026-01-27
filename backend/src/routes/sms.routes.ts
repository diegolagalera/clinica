import { Router } from 'express';
import * as smsController from '../controllers/sms.controller.js';
import { authenticate, requireAdmin, tenantContext, requireClinicContext } from '../middleware/index.js';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(tenantContext);
router.use(requireAdmin);
router.use(requireClinicContext);

// SMS Settings
router.get('/settings', smsController.getSettings);
router.put('/settings', smsController.updateSettings);
router.post('/settings/test', smsController.testConnection);
router.post('/settings/test-sms', smsController.sendTestSms);

// Templates
router.get('/templates', smsController.getTemplates);
router.get('/templates/defaults', smsController.getDefaultTemplates);
router.get('/templates/variables', smsController.getVariables);
router.post('/templates', smsController.createTemplate);
router.put('/templates/:id', smsController.updateTemplate);
router.delete('/templates/:id', smsController.deleteTemplate);

export default router;
