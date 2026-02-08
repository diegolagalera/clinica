import type { Response } from 'express';
/**
 * GET /api/public/rating/:token
 * Validate a rating token and return basic info (public endpoint)
 */
export declare const validateRatingToken: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /api/public/rating/:token
 * Submit a rating (public endpoint)
 */
export declare const submitRating: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /api/ratings/stats
 * Get rating statistics for the current clinic (authenticated)
 */
export declare const getClinicStats: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /api/ratings/worker/:workerId
 * Get rating statistics for a specific worker (authenticated)
 */
export declare const getWorkerStats: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /api/ratings/recent
 * Get recent ratings with comments for the current clinic (authenticated)
 */
export declare const getRecentRatings: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /api/ratings/requests
 * Get all rating requests for the current clinic (authenticated)
 */
export declare const getAllRatingRequests: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /api/ratings/test/:appointmentId
 * Send a rating request email immediately for testing (skips 24h delay)
 */
export declare const sendTestRatingEmail: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=rating.controller.d.ts.map