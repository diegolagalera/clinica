import { Router } from 'express';
import {
    validateRatingToken,
    submitRating,
    getClinicStats,
    getWorkerStats,
    getRecentRatings,
    getAllRatingRequests,
    sendTestRatingEmail,
} from '../controllers/rating.controller.js';
import { authenticate, tenantContext, requireAdmin } from '../middleware/index.js';

const router = Router();

// ============================================================================
// PUBLIC ROUTES (no authentication required)
// These are mounted at /api/public/rating in app.ts
// ============================================================================

// Validate rating token and get basic info
router.get('/public/:token', validateRatingToken);

// Submit a rating
router.post('/public/:token', submitRating);

// ============================================================================
// PROTECTED ROUTES (authentication required)
// These are mounted at /api/ratings in app.ts
// ============================================================================

// Get clinic rating statistics (ADMIN only)
router.get(
    '/stats',
    authenticate,
    tenantContext,
    requireAdmin,
    getClinicStats
);

// Get worker rating statistics (ADMIN only)
router.get(
    '/worker/:workerId',
    authenticate,
    tenantContext,
    requireAdmin,
    getWorkerStats
);

// Get recent ratings with comments (ADMIN only)
router.get(
    '/recent',
    authenticate,
    tenantContext,
    requireAdmin,
    getRecentRatings
);

// Get all rating requests for the clinic (ADMIN only)
router.get(
    '/requests',
    authenticate,
    tenantContext,
    requireAdmin,
    getAllRatingRequests
);

// Send a rating email immediately for testing (ADMIN only)
router.post(
    '/test/:appointmentId',
    authenticate,
    tenantContext,
    requireAdmin,
    sendTestRatingEmail
);

export default router;
