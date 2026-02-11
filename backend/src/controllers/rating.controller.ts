import type { Request, Response } from 'express';
import { z } from 'zod';
import * as ratingService from '../services/rating.service.js';
import { asyncHandler } from '../middleware/index.js';
import { success, error } from '../utils/response.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { logger } from '../utils/logger.js';
import type { Database } from '../db/index.js';

// Validation schemas
const submitRatingSchema = z.object({
    rating: z.number().min(1).max(5),
    comment: z.string().max(1000).optional(),
});

/**
 * GET /api/public/rating/:token
 * Validate a rating token and return basic info (public endpoint)
 */
export const validateRatingToken = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    if (!token || token.length < 20) {
        throw new BadRequestError('Token inválido');
    }

    const validation = await ratingService.validateToken((req as any).db as Database, token);

    if (!validation.valid) {
        // Return appropriate message based on status
        switch (validation.status) {
            case 'completed':
                return res.json(success({
                    valid: false,
                    status: 'completed',
                    message: 'Ya has valorado esta visita. ¡Gracias por tu opinión!',
                }));
            case 'expired':
                return res.json(success({
                    valid: false,
                    status: 'expired',
                    message: 'Este enlace ha expirado. Los enlaces de valoración son válidos durante 7 días.',
                }));
            case 'pending':
                return res.json(success({
                    valid: false,
                    status: 'pending',
                    message: 'Este enlace aún no está activo.',
                }));
            default:
                return res.json(success({
                    valid: false,
                    status: 'not_found',
                    message: 'Enlace de valoración no encontrado.',
                }));
        }
    }

    // Return only necessary info (no patient data for privacy)
    return res.json(success({
        valid: true,
        status: 'valid',
        clinicName: validation.clinicName,
    }));
});

/**
 * POST /api/public/rating/:token
 * Submit a rating (public endpoint)
 */
export const submitRating = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    if (!token || token.length < 20) {
        throw new BadRequestError('Token inválido');
    }

    const input = submitRatingSchema.parse(req.body);

    const result = await ratingService.submitRating((req as any).db as Database, token, input.rating, input.comment);

    if (!result.success) {
        // Map error status to user-friendly message
        const errorMessages: Record<string, string> = {
            'completed': 'Ya has valorado esta visita.',
            'expired': 'Este enlace ha expirado.',
            'not_found': 'Enlace de valoración no encontrado.',
            'pending': 'Este enlace aún no está activo.',
        };
        throw new BadRequestError(errorMessages[result.error || ''] || result.error || 'Error al enviar la valoración');
    }

    res.json(success(null, '¡Gracias por tu valoración!'));
});

/**
 * GET /api/ratings/stats
 * Get rating statistics for the current clinic (authenticated)
 */
export const getClinicStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const stats = await ratingService.getClinicRatingStats(req.db!, req.tenantContext.clinicId);
    res.json(success(stats));
});

/**
 * GET /api/ratings/worker/:workerId
 * Get rating statistics for a specific worker (authenticated)
 */
export const getWorkerStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { workerId } = req.params;

    if (!workerId) {
        throw new BadRequestError('Worker ID required');
    }

    const stats = await ratingService.getWorkerRatingStats(req.db!,
        workerId,
        req.tenantContext.clinicId || undefined
    );

    res.json(success(stats));
});

/**
 * GET /api/ratings/recent
 * Get recent ratings with comments for the current clinic (authenticated)
 */
export const getRecentRatings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const ratings = await ratingService.getRecentRatings(req.db!, req.tenantContext.clinicId, limit);

    res.json(success(ratings));
});

/**
 * GET /api/ratings/requests
 * Get all rating requests for the current clinic (authenticated)
 */
export const getAllRatingRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const requests = await ratingService.getClinicRatingRequests(req.db!, req.tenantContext.clinicId);
    res.json(success(requests));
});

/**
 * POST /api/ratings/test/:appointmentId
 * Send a rating request email immediately for testing (skips 24h delay)
 */
export const sendTestRatingEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { appointmentId } = req.params;

    if (!appointmentId) {
        throw new BadRequestError('Appointment ID required');
    }

    if (!req.tenantContext.clinicId) {
        throw new BadRequestError('Clinic context required');
    }

    const result = await ratingService.sendRatingEmailNow(req.db!, appointmentId, req.tenantContext.clinicId);

    if (!result.success) {
        throw new BadRequestError(result.error || 'Error al enviar email de valoración');
    }

    res.json(success({
        ratingUrl: result.ratingUrl,
        token: result.token,
    }, 'Email de valoración enviado correctamente'));
});
