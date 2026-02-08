import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../utils/errors.js';
import { error as errorResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

// Field name translations for Spanish
const fieldTranslations: Record<string, string> = {
    email: 'Email',
    firstName: 'Nombre',
    lastName: 'Apellido',
    phone: 'Teléfono',
    dateOfBirth: 'Fecha de nacimiento',
    idNumber: 'DNI/NIE',
    address: 'Dirección',
    city: 'Ciudad',
    postalCode: 'Código postal',
    password: 'Contraseña',
    title: 'Título',
    description: 'Descripción',
    name: 'Nombre',
    date: 'Fecha',
    time: 'Hora',
    category: 'Categoría',
    notes: 'Notas',
    gender: 'Género',
};

// Translate common Zod error messages to Spanish
const translateZodMessage = (message: string): string => {
    if (message === 'Invalid email') return 'no es válido';
    if (message === 'Required') return 'es obligatorio';
    if (message.startsWith('String must contain at least')) {
        const match = message.match(/(\d+)/);
        return `debe tener al menos ${match?.[0] || ''} caracteres`;
    }
    if (message.includes('too long') || message.includes('at most')) {
        const match = message.match(/(\d+)/);
        return `máximo ${match?.[0] || ''} caracteres`;
    }
    if (message === 'Invalid') return 'no es válido';
    if (message === 'Expected string, received null') return 'es obligatorio';
    return message;
};

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
    } else if (!(err instanceof ZodError)) {
        logger.error({ err }, 'Unexpected error');
    }

    // Handle Zod validation errors - format them nicely
    if (err instanceof ZodError) {
        const formattedErrors: Record<string, string[]> = {};

        for (const issue of err.issues) {
            const path = issue.path.join('.') || '_root';
            if (!formattedErrors[path]) {
                formattedErrors[path] = [];
            }
            formattedErrors[path]!.push(translateZodMessage(issue.message));
        }

        // Create user-friendly message
        const errorMessages = Object.entries(formattedErrors)
            .map(([field, messages]) => {
                const fieldName = fieldTranslations[field] || field;
                return `${fieldName}: ${messages.join(', ')}`;
            })
            .join(' | ');

        res.status(422).json(errorResponse(errorMessages, formattedErrors));
        return;
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
