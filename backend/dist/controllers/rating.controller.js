"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTestRatingEmail = exports.getAllRatingRequests = exports.getRecentRatings = exports.getWorkerStats = exports.getClinicStats = exports.submitRating = exports.validateRatingToken = void 0;
const zod_1 = require("zod");
const ratingService = __importStar(require("../services/rating.service.js"));
const index_js_1 = require("../middleware/index.js");
const response_js_1 = require("../utils/response.js");
const errors_js_1 = require("../utils/errors.js");
// Validation schemas
const submitRatingSchema = zod_1.z.object({
    rating: zod_1.z.number().min(1).max(5),
    comment: zod_1.z.string().max(1000).optional(),
});
/**
 * GET /api/public/rating/:token
 * Validate a rating token and return basic info (public endpoint)
 */
exports.validateRatingToken = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { token } = req.params;
    if (!token || token.length < 20) {
        throw new errors_js_1.BadRequestError('Token inválido');
    }
    const validation = await ratingService.validateToken(token);
    if (!validation.valid) {
        // Return appropriate message based on status
        switch (validation.status) {
            case 'completed':
                return res.json((0, response_js_1.success)({
                    valid: false,
                    status: 'completed',
                    message: 'Ya has valorado esta visita. ¡Gracias por tu opinión!',
                }));
            case 'expired':
                return res.json((0, response_js_1.success)({
                    valid: false,
                    status: 'expired',
                    message: 'Este enlace ha expirado. Los enlaces de valoración son válidos durante 7 días.',
                }));
            case 'pending':
                return res.json((0, response_js_1.success)({
                    valid: false,
                    status: 'pending',
                    message: 'Este enlace aún no está activo.',
                }));
            default:
                return res.json((0, response_js_1.success)({
                    valid: false,
                    status: 'not_found',
                    message: 'Enlace de valoración no encontrado.',
                }));
        }
    }
    // Return only necessary info (no patient data for privacy)
    return res.json((0, response_js_1.success)({
        valid: true,
        status: 'valid',
        clinicName: validation.clinicName,
    }));
});
/**
 * POST /api/public/rating/:token
 * Submit a rating (public endpoint)
 */
exports.submitRating = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { token } = req.params;
    if (!token || token.length < 20) {
        throw new errors_js_1.BadRequestError('Token inválido');
    }
    const input = submitRatingSchema.parse(req.body);
    const result = await ratingService.submitRating(token, input.rating, input.comment);
    if (!result.success) {
        // Map error status to user-friendly message
        const errorMessages = {
            'completed': 'Ya has valorado esta visita.',
            'expired': 'Este enlace ha expirado.',
            'not_found': 'Enlace de valoración no encontrado.',
            'pending': 'Este enlace aún no está activo.',
        };
        throw new errors_js_1.BadRequestError(errorMessages[result.error || ''] || result.error || 'Error al enviar la valoración');
    }
    res.json((0, response_js_1.success)(null, '¡Gracias por tu valoración!'));
});
/**
 * GET /api/ratings/stats
 * Get rating statistics for the current clinic (authenticated)
 */
exports.getClinicStats = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const stats = await ratingService.getClinicRatingStats(req.tenantContext.clinicId);
    res.json((0, response_js_1.success)(stats));
});
/**
 * GET /api/ratings/worker/:workerId
 * Get rating statistics for a specific worker (authenticated)
 */
exports.getWorkerStats = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { workerId } = req.params;
    if (!workerId) {
        throw new errors_js_1.BadRequestError('Worker ID required');
    }
    const stats = await ratingService.getWorkerRatingStats(workerId, req.tenantContext.clinicId || undefined);
    res.json((0, response_js_1.success)(stats));
});
/**
 * GET /api/ratings/recent
 * Get recent ratings with comments for the current clinic (authenticated)
 */
exports.getRecentRatings = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const limit = parseInt(req.query.limit) || 10;
    const ratings = await ratingService.getRecentRatings(req.tenantContext.clinicId, limit);
    res.json((0, response_js_1.success)(ratings));
});
/**
 * GET /api/ratings/requests
 * Get all rating requests for the current clinic (authenticated)
 */
exports.getAllRatingRequests = (0, index_js_1.asyncHandler)(async (req, res) => {
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const requests = await ratingService.getClinicRatingRequests(req.tenantContext.clinicId);
    res.json((0, response_js_1.success)(requests));
});
/**
 * POST /api/ratings/test/:appointmentId
 * Send a rating request email immediately for testing (skips 24h delay)
 */
exports.sendTestRatingEmail = (0, index_js_1.asyncHandler)(async (req, res) => {
    const { appointmentId } = req.params;
    if (!appointmentId) {
        throw new errors_js_1.BadRequestError('Appointment ID required');
    }
    if (!req.tenantContext.clinicId) {
        throw new errors_js_1.BadRequestError('Clinic context required');
    }
    const result = await ratingService.sendRatingEmailNow(appointmentId, req.tenantContext.clinicId);
    if (!result.success) {
        throw new errors_js_1.BadRequestError(result.error || 'Error al enviar email de valoración');
    }
    res.json((0, response_js_1.success)({
        ratingUrl: result.ratingUrl,
        token: result.token,
    }, 'Email de valoración enviado correctamente'));
});
//# sourceMappingURL=rating.controller.js.map