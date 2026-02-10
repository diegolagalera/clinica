import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantContext } from '../middleware/tenant.middleware.js';
import * as assistantController from '../controllers/assistant.controller.js';

const router = Router();

// All routes require authentication + tenant context (for AI quota)
router.use(authenticate);
router.use(tenantContext);

/**
 * @route   POST /api/v1/assistant/chat
 * @desc    Send a message to the FAQ assistant
 * @access  Private (authenticated users)
 */
router.post('/chat', assistantController.chat);

export default router;
