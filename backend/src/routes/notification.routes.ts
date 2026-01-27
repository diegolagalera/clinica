import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { authenticate, requireAdmin, tenantContext, requireClinicContext } from '../middleware/index.js';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(tenantContext);
router.use(requireAdmin);
router.use(requireClinicContext);

// Email Settings
router.get('/settings', notificationController.getSettings);
router.put('/settings', notificationController.updateSettings);
router.post('/settings/test', notificationController.testConnection);
router.post('/settings/test-email', notificationController.sendTestEmail);
router.post('/send-test', notificationController.sendCustomTestEmail);

// Templates
router.get('/templates', notificationController.getTemplates);
router.get('/templates/types', notificationController.getTemplateTypes);
router.get('/templates/default/:type', notificationController.getDefaultTemplate);
router.get('/templates/:id', notificationController.getTemplate);
router.post('/templates', notificationController.createTemplate);
router.put('/templates/:id', notificationController.updateTemplate);
router.delete('/templates/:id', notificationController.deleteTemplate);
router.post('/templates/:id/preview', notificationController.previewTemplate);
router.post('/templates/:id/test', notificationController.testTemplate);
router.post('/templates/generate', notificationController.generateTemplateWithAI);

// Logs
router.get('/logs', notificationController.getLogs);
router.get('/stats', notificationController.getStats);

export default router;
