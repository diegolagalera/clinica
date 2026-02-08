import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { submitBugReport } from '../controllers/feedback.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/v1/feedback/report-bug
router.post('/report-bug', submitBugReport);

export default router;
