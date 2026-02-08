"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rating_controller_js_1 = require("../controllers/rating.controller.js");
const index_js_1 = require("../middleware/index.js");
const router = (0, express_1.Router)();
// ============================================================================
// PUBLIC ROUTES (no authentication required)
// These are mounted at /api/public/rating in app.ts
// ============================================================================
// Validate rating token and get basic info
router.get('/public/:token', rating_controller_js_1.validateRatingToken);
// Submit a rating
router.post('/public/:token', rating_controller_js_1.submitRating);
// ============================================================================
// PROTECTED ROUTES (authentication required)
// These are mounted at /api/ratings in app.ts
// ============================================================================
// Get clinic rating statistics (ADMIN only)
router.get('/stats', index_js_1.authenticate, index_js_1.tenantContext, index_js_1.requireAdmin, rating_controller_js_1.getClinicStats);
// Get worker rating statistics (ADMIN only)
router.get('/worker/:workerId', index_js_1.authenticate, index_js_1.tenantContext, index_js_1.requireAdmin, rating_controller_js_1.getWorkerStats);
// Get recent ratings with comments (ADMIN only)
router.get('/recent', index_js_1.authenticate, index_js_1.tenantContext, index_js_1.requireAdmin, rating_controller_js_1.getRecentRatings);
// Get all rating requests for the clinic (ADMIN only)
router.get('/requests', index_js_1.authenticate, index_js_1.tenantContext, index_js_1.requireAdmin, rating_controller_js_1.getAllRatingRequests);
// Send a rating email immediately for testing (ADMIN only)
router.post('/test/:appointmentId', index_js_1.authenticate, index_js_1.tenantContext, index_js_1.requireAdmin, rating_controller_js_1.sendTestRatingEmail);
exports.default = router;
//# sourceMappingURL=rating.routes.js.map