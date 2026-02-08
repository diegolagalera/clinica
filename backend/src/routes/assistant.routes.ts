import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as assistantController from '../controllers/assistant.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/assistant/chat
 * @desc    Send a message to the FAQ assistant
 * @access  Private (authenticated users)
 */
router.post('/chat', assistantController.chat);

export default router;
