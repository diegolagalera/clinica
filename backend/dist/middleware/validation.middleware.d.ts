import type { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
type ValidationTarget = 'body' | 'query' | 'params';
/**
 * Middleware factory to validate request data with Zod schemas
 */
export declare const validate: (schema: ZodSchema, target?: ValidationTarget) => (req: Request, _res: Response, next: NextFunction) => void;
/**
 * Validate request body
 */
export declare const validateBody: (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => void;
/**
 * Validate query parameters
 */
export declare const validateQuery: (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => void;
/**
 * Validate URL parameters
 */
export declare const validateParams: (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=validation.middleware.d.ts.map