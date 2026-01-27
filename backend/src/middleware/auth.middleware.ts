import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { config } from '../config/env.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import type { AuthenticatedRequest, AccessTokenPayload, Role } from '../types/index.js';

/**
 * Verify JWT access token and check if user is still active
 */
export const authenticate: RequestHandler = async (
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedError('No token provided');
        }

        const token = authHeader.substring(7);

        const decoded = jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;

        // Check if user is still active in database
        const user = await db.query.users.findFirst({
            where: eq(users.id, decoded.userId),
            columns: { isActive: true },
        });

        if (!user || !user.isActive) {
            throw new UnauthorizedError('Account deactivated', 'ACCOUNT_DEACTIVATED');
        }

        (req as AuthenticatedRequest).user = decoded;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            next(new UnauthorizedError('Token expired', 'TOKEN_EXPIRED'));
        } else if (error instanceof jwt.JsonWebTokenError) {
            next(new UnauthorizedError('Invalid token', 'INVALID_TOKEN'));
        } else {
            next(error);
        }
    }
};

/**
 * Check if user has one of the required roles
 */
export const requireRoles = (...roles: Role[]): RequestHandler => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const authReq = req as AuthenticatedRequest;
        if (!authReq.user) {
            return next(new UnauthorizedError('Not authenticated'));
        }

        if (!roles.includes(authReq.user.role)) {
            return next(new ForbiddenError('Insufficient permissions'));
        }

        next();
    };
};

/**
 * Check if user is a SUPERADMIN
 */
export const requireSuperAdmin = requireRoles('SUPERADMIN' as Role);

/**
 * Check if user is an ADMIN or SUPERADMIN
 */
export const requireAdmin = requireRoles('SUPERADMIN' as Role, 'ADMIN' as Role);

/**
 * Check if user is a WORKER, ADMIN, or SUPERADMIN
 */
export const requireStaff = requireRoles('SUPERADMIN' as Role, 'ADMIN' as Role, 'WORKER' as Role);

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth: RequestHandler = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
        (req as AuthenticatedRequest).user = decoded;
        next();
    } catch {
        // Token invalid but that's okay for optional auth
        next();
    }
};
