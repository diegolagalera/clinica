import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { config } from '../config/env.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { users, workerClinics } from '../db/schema.js';
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

/**
 * Check if user has the required module permission.
 * - SUPERADMIN and ADMIN always pass (full access).
 * - WORKER must have the permission in their worker_clinics record for the current clinic.
 * Must be used AFTER authenticate middleware. Uses X-Clinic-Id header or tenantContext.
 */
export const requirePermission = (...permissions: string[]): RequestHandler => {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        try {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user) {
                return next(new UnauthorizedError('Not authenticated'));
            }

            const { role, userId } = authReq.user;

            // SUPERADMIN and ADMIN always have full access
            if (role === ('SUPERADMIN' as Role) || role === ('ADMIN' as Role)) {
                return next();
            }

            // For WORKER, check permissions in worker_clinics
            if (role === ('WORKER' as Role)) {
                // Determine clinic ID from tenant context or header
                const clinicId = authReq.tenantContext?.clinicId
                    || req.headers['x-clinic-id'] as string | undefined;

                if (!clinicId) {
                    return next(new ForbiddenError('No clinic context for permission check'));
                }

                const assignment = await db.query.workerClinics.findFirst({
                    where: and(
                        eq(workerClinics.userId, userId),
                        eq(workerClinics.clinicId, clinicId),
                        eq(workerClinics.isActive, true)
                    ),
                    columns: { permissions: true },
                });

                if (!assignment) {
                    return next(new ForbiddenError('Not assigned to this clinic'));
                }

                const userPermissions = assignment.permissions || [];
                const hasRequired = permissions.some(p => userPermissions.includes(p));

                if (!hasRequired) {
                    return next(new ForbiddenError(`Requires permission: ${permissions.join(' or ')}`));
                }

                return next();
            }

            // Any other role — deny
            return next(new ForbiddenError('Insufficient permissions'));
        } catch (error) {
            next(error);
        }
    };
};
