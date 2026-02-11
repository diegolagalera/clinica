import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { eq, and } from 'drizzle-orm';
import { clinics, users, workerClinics } from '../db/schema.js';
import { ForbiddenError, BadRequestError } from '../utils/errors.js';
import type { AuthenticatedRequest, TenantContext, Role } from '../types/index.js';

/**
 * Multi-tenant middleware that sets up tenant context based on user role.
 * Uses req.db (set by auth middleware) instead of global db import.
 * 
 * - SUPERADMIN: Can access all organizations and clinics (via X-Tenant-Slug)
 * - ADMIN: Can access their organization's clinics
 * - WORKER: Can access only their assigned clinic
 * - USER: Can access only their linked clinic
 */
export const tenantContext: RequestHandler = async (
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest;
        if (!authReq.user) {
            return next(new ForbiddenError('User context required'));
        }

        const { role, organizationId, clinicId, userId } = authReq.user;
        const db = authReq.db;

        // Initialize tenant context
        const context: TenantContext = {
            organizationId: null,
            clinicId: null,
            clinicIds: [],
        };

        // SUPERADMIN can access everything - check for clinic filter in request
        if (role === ('SUPERADMIN' as Role)) {
            const requestedClinicId = req.headers['x-clinic-id'] as string | undefined;
            const requestedOrgId = req.headers['x-organization-id'] as string | undefined;

            if (db && requestedClinicId) {
                context.clinicId = requestedClinicId;
                context.clinicIds = [requestedClinicId];

                // Get organization from clinic
                const clinic = await db.query.clinics.findFirst({
                    where: eq(clinics.id, requestedClinicId),
                });
                if (clinic) {
                    context.organizationId = clinic.organizationId;
                }
            } else if (db && requestedOrgId) {
                context.organizationId = requestedOrgId;
                // Get all clinics in organization
                const orgClinics = await db.query.clinics.findMany({
                    where: eq(clinics.organizationId, requestedOrgId),
                });
                context.clinicIds = orgClinics.map(c => c.id);
            }

            authReq.tenantContext = context;
            return next();
        }

        // All non-SUPERADMIN users require a tenant DB
        if (!db) {
            return next(new ForbiddenError('No tenant database context'));
        }

        // For ADMIN, WORKER, USER - must have organization context
        if (!organizationId) {
            return next(new ForbiddenError('No organization context'));
        }

        context.organizationId = organizationId;

        // ADMIN can access all clinics in their organization
        if (role === ('ADMIN' as Role)) {
            const orgClinics = await db.query.clinics.findMany({
                where: and(
                    eq(clinics.organizationId, organizationId),
                    eq(clinics.isActive, true)
                ),
            });
            context.clinicIds = orgClinics.map(c => c.id);

            // Check if request specifies a clinic
            const requestedClinicId = req.headers['x-clinic-id'] as string | undefined;
            if (requestedClinicId) {
                if (!context.clinicIds.includes(requestedClinicId)) {
                    return next(new ForbiddenError('Access to clinic denied'));
                }
                context.clinicId = requestedClinicId;
            }

            authReq.tenantContext = context;
            return next();
        }

        // WORKER can access their assigned clinics via workerClinics or direct clinicId
        if (role === ('WORKER' as Role)) {
            const workerAssignments = await db.query.workerClinics.findMany({
                where: and(
                    eq(workerClinics.userId, userId),
                    eq(workerClinics.isActive, true)
                ),
            });

            const accessibleClinicIds = workerAssignments.map(a => a.clinicId);
            if (clinicId && !accessibleClinicIds.includes(clinicId)) {
                accessibleClinicIds.push(clinicId);
            }

            if (accessibleClinicIds.length === 0) {
                return next(new ForbiddenError('No clinic assigned'));
            }

            context.clinicIds = accessibleClinicIds;

            const requestedClinicId = req.headers['x-clinic-id'] as string | undefined;
            if (requestedClinicId) {
                if (!accessibleClinicIds.includes(requestedClinicId)) {
                    return next(new ForbiddenError('Access to clinic denied'));
                }
                context.clinicId = requestedClinicId;
            } else {
                context.clinicId = clinicId || accessibleClinicIds[0] || null;
            }

            authReq.tenantContext = context;
            return next();
        }

        // USER (patient) - check clinic linkage
        if (role === ('USER' as Role)) {
            const user = await db.query.users.findFirst({
                where: eq(users.id, userId),
            });

            if (!user?.clinicId) {
                context.clinicId = null;
                context.clinicIds = [];
            } else {
                context.clinicId = user.clinicId;
                context.clinicIds = [user.clinicId];
            }

            authReq.tenantContext = context;
            return next();
        }

        // Fallback - deny access
        return next(new ForbiddenError('Unable to determine tenant context'));
    } catch (error) {
        next(error);
    }
};

/**
 * Require a specific clinic to be selected
 */
export const requireClinicContext: RequestHandler = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.tenantContext?.clinicId) {
        return next(new BadRequestError('Clinic context required. Set X-Clinic-Id header.'));
    }
    next();
};

/**
 * Require organization context
 */
export const requireOrganizationContext: RequestHandler = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.tenantContext?.organizationId) {
        return next(new BadRequestError('Organization context required. Set X-Organization-Id header.'));
    }
    next();
};

/**
 * Validate that the requested entity belongs to the tenant
 */
export const validateTenantAccess = async (
    clinicId: string,
    tenantContext: TenantContext
): Promise<boolean> => {
    if (!tenantContext.clinicIds.length) {
        // SUPERADMIN without filter can access everything
        return tenantContext.organizationId === null && tenantContext.clinicId === null;
    }

    return tenantContext.clinicIds.includes(clinicId);
};

/**
 * Guard: require req.db to be set (i.e., a tenant database must be resolved).
 * Place this on any route that MUST have a tenant DB.
 * Returns 403 with a clear message instead of crashing with 500.
 */
export const requireTenantDb: RequestHandler = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.db) {
        return next(
            new ForbiddenError(
                'This endpoint requires a tenant context. SUPERADMIN must provide X-Tenant-Slug header.'
            )
        );
    }
    next();
};
