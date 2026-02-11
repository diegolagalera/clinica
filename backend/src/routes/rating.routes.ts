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
import { authenticate, tenantContext, requirePermission } from '../middleware/index.js';

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

// Get clinic rating statistics (ADMIN or workers with 'ratings' permission)
router.get(
    '/stats',
    authenticate,
    tenantContext,
    requirePermission('ratings'),
    getClinicStats
);

// Get worker rating statistics (ADMIN or workers with 'ratings' permission)
router.get(
    '/worker/:workerId',
    authenticate,
    tenantContext,
    requirePermission('ratings'),
    getWorkerStats
);

// Get recent ratings with comments (ADMIN or workers with 'ratings' permission)
router.get(
    '/recent',
    authenticate,
    tenantContext,
    requirePermission('ratings'),
    getRecentRatings
);

// Get all rating requests for the clinic (ADMIN or workers with 'ratings' permission)
router.get(
    '/requests',
    authenticate,
    tenantContext,
    requirePermission('ratings'),
    getAllRatingRequests
);

// Send a rating email immediately for testing (ADMIN or workers with 'ratings' permission)
router.post(
    '/test/:appointmentId',
    authenticate,
    tenantContext,
    requirePermission('ratings'),
    sendTestRatingEmail
);

export default router;
