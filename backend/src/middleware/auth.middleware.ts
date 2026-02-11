import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { config } from '../config/env.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { tenantManager } from '../db/tenant-manager.js';
import { centralDb } from '../db/central-db.js';
import { superadmins } from '../db/central-schema.js';
import { users, workerClinics } from '../db/schema.js';
import type { AuthenticatedRequest, AccessTokenPayload, Role } from '../types/index.js';
import type { Database } from '../db/index.js';
import { logger } from '../utils/logger.js';

/**
 * Verify JWT access token, resolve tenant DB, and check if user is still active.
 *
 * After this middleware:
 * - req.user is populated with JWT payload (including tenantSlug)
 * - req.db is the tenant-specific database connection
 *
 * For SUPERADMIN users:
 * - req.db is set via X-Tenant-Slug header (when viewing a specific tenant)
 * - If no X-Tenant-Slug, req.db is undefined (central-only operations)
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

        // ── SUPERADMIN: verify against central DB ──────────────
        if (decoded.role === ('SUPERADMIN' as Role)) {
            const sa = await centralDb.query.superadmins.findFirst({
                where: and(
                    eq(superadmins.id, decoded.userId),
                    eq(superadmins.isActive, true),
                ),
                columns: { isActive: true },
            });

            if (!sa) {
                throw new UnauthorizedError('Account deactivated', 'ACCOUNT_DEACTIVATED');
            }

            (req as AuthenticatedRequest).user = decoded;

            // If SUPERADMIN sends X-Tenant-Slug, resolve that tenant's DB
            const tenantSlugHeader = req.headers['x-tenant-slug'] as string | undefined;
            if (tenantSlugHeader) {
                try {
                    const tenantDb = await tenantManager.getConnection(tenantSlugHeader);
                    (req as AuthenticatedRequest).db = tenantDb;
                } catch (err) {
                    logger.warn({ tenantSlug: tenantSlugHeader, err }, 'SUPERADMIN: Failed to resolve tenant');
                    throw new UnauthorizedError('Invalid tenant');
                }
            }

            return next();
        }

        // ── Regular user: resolve tenant DB from JWT ───────────
        const tenantSlug = decoded.tenantSlug;
        if (!tenantSlug) {
            throw new UnauthorizedError('Missing tenant context');
        }

        const tenantDb = await tenantManager.getConnection(tenantSlug);

        // Check if user is still active in tenant database
        const user = await tenantDb.query.users.findFirst({
            where: eq(users.id, decoded.userId),
            columns: { isActive: true },
        });

        if (!user || !user.isActive) {
            throw new UnauthorizedError('Account deactivated', 'ACCOUNT_DEACTIVATED');
        }

        (req as AuthenticatedRequest).user = decoded;
        (req as AuthenticatedRequest).db = tenantDb;
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
export const optionalAuth: RequestHandler = async (
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
        (req as AuthenticatedRequest).user = decoded;

        // Resolve tenant DB if available
        if (decoded.tenantSlug) {
            try {
                const tenantDb = await tenantManager.getConnection(decoded.tenantSlug);
                (req as AuthenticatedRequest).db = tenantDb;
            } catch {
                // Optional auth — don't fail if tenant can't be resolved
            }
        }

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
 * Uses req.db (tenant-specific) instead of global db import.
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
                const clinicId = authReq.tenantContext?.clinicId
                    || req.headers['x-clinic-id'] as string | undefined;

                if (!clinicId) {
                    return next(new ForbiddenError('No clinic context for permission check'));
                }

                if (!authReq.db) {
                    return next(new UnauthorizedError('No database context'));
                }

                const assignment = await authReq.db.query.workerClinics.findFirst({
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
