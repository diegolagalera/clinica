import type { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors.js';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Middleware factory to validate request data with Zod schemas
 */
export const validate = (schema: ZodSchema, target: ValidationTarget = 'body') => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            const data = req[target];
            const validated = schema.parse(data);
            req[target] = validated;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errors: Record<string, string[]> = {};

                for (const issue of error.issues) {
                    const path = issue.path.join('.') || '_root';
                    if (!errors[path]) {
                        errors[path] = [];
                    }
                    errors[path]!.push(issue.message);
                }

                next(new ValidationError(errors));
            } else {
                next(error);
            }
        }
    };
};

/**
 * Validate request body
 */
export const validateBody = (schema: ZodSchema) => validate(schema, 'body');

/**
 * Validate query parameters
 */
export const validateQuery = (schema: ZodSchema) => validate(schema, 'query');

/**
 * Validate URL parameters
 */
export const validateParams = (schema: ZodSchema) => validate(schema, 'params');
