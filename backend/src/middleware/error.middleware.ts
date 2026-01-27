import type { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors.js';
import { error as errorResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

/**
 * Global error handling middleware
 */
export const errorHandler = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    // Log error
    if (err instanceof AppError && err.isOperational) {
        logger.warn({ err, statusCode: err.statusCode }, err.message);
    } else {
        logger.error({ err }, 'Unexpected error');
    }

    // Handle known operational errors
    if (err instanceof ValidationError) {
        res.status(err.statusCode).json(errorResponse(err.message, err.errors));
        return;
    }

    if (err instanceof AppError) {
        res.status(err.statusCode).json(errorResponse(err.message));
        return;
    }

    // Handle unknown errors
    const statusCode = 500;
    const message = config.isProduction
        ? 'Internal server error'
        : err.message || 'Internal server error';

    res.status(statusCode).json(errorResponse(message));
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (_req: Request, res: Response): void => {
    res.status(404).json(errorResponse('Resource not found'));
};

/**
 * Async handler wrapper to catch async errors
 */
export const asyncHandler = <T>(
    fn: (req: any, res: Response, next: NextFunction) => Promise<T>
) => {
    return (req: any, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
