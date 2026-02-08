import type { Request, Response, NextFunction } from 'express';
/**
 * Global error handling middleware
 */
export declare const errorHandler: (err: Error, _req: Request, res: Response, _next: NextFunction) => void;
/**
 * 404 Not Found handler
 */
export declare const notFoundHandler: (_req: Request, res: Response) => void;
/**
 * Async handler wrapper to catch async errors
 */
export declare const asyncHandler: <T>(fn: (req: any, res: Response, next: NextFunction) => Promise<T>) => (req: any, res: Response, next: NextFunction) => void;
//# sourceMappingURL=error.middleware.d.ts.map