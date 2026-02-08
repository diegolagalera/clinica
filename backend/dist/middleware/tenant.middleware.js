"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTenantAccess = exports.requireOrganizationContext = exports.requireClinicContext = exports.tenantContext = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
const errors_js_1 = require("../utils/errors.js");
/**
 * Multi-tenant middleware that sets up tenant context based on user role
 *
 * - SUPERADMIN: Can access all organizations and clinics
 * - ADMIN: Can access their organization's clinics
 * - WORKER: Can access only their assigned clinic
 * - USER: Can access only their linked clinic
 */
const tenantContext = async (req, _res, next) => {
    try {
        const authReq = req;
        if (!authReq.user) {
            return next(new errors_js_1.ForbiddenError('User context required'));
        }
        const { role, organizationId, clinicId, userId } = authReq.user;
        // Initialize tenant context
        const context = {
            organizationId: null,
            clinicId: null,
            clinicIds: [],
        };
        // SUPERADMIN can access everything - check for clinic filter in request
        if (role === 'SUPERADMIN') {
            const requestedClinicId = req.headers['x-clinic-id'];
            const requestedOrgId = req.headers['x-organization-id'];
            if (requestedClinicId) {
                context.clinicId = requestedClinicId;
                context.clinicIds = [requestedClinicId];
                // Get organization from clinic
                const clinic = await index_js_1.db.query.clinics.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema_js_1.clinics.id, requestedClinicId),
                });
                if (clinic) {
                    context.organizationId = clinic.organizationId;
                }
            }
            else if (requestedOrgId) {
                context.organizationId = requestedOrgId;
                // Get all clinics in organization
                const orgClinics = await index_js_1.db.query.clinics.findMany({
                    where: (0, drizzle_orm_1.eq)(schema_js_1.clinics.organizationId, requestedOrgId),
                });
                context.clinicIds = orgClinics.map(c => c.id);
            }
            authReq.tenantContext = context;
            return next();
        }
        // For ADMIN, WORKER, USER - must have organization context
        if (!organizationId) {
            return next(new errors_js_1.ForbiddenError('No organization context'));
        }
        context.organizationId = organizationId;
        // ADMIN can access all clinics in their organization
        if (role === 'ADMIN') {
            const orgClinics = await index_js_1.db.query.clinics.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.clinics.organizationId, organizationId), (0, drizzle_orm_1.eq)(schema_js_1.clinics.isActive, true)),
            });
            context.clinicIds = orgClinics.map(c => c.id);
            // Check if request specifies a clinic
            const requestedClinicId = req.headers['x-clinic-id'];
            if (requestedClinicId) {
                if (!context.clinicIds.includes(requestedClinicId)) {
                    return next(new errors_js_1.ForbiddenError('Access to clinic denied'));
                }
                context.clinicId = requestedClinicId;
            }
            authReq.tenantContext = context;
            return next();
        }
        // WORKER can access their assigned clinics via workerClinics or direct clinicId
        if (role === 'WORKER') {
            // Get all clinics the worker has access to
            const workerAssignments = await index_js_1.db.query.workerClinics.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.workerClinics.userId, userId), (0, drizzle_orm_1.eq)(schema_js_1.workerClinics.isActive, true)),
            });
            // Accessible clinic IDs: from workerClinics + direct clinicId (if exists)
            const accessibleClinicIds = workerAssignments.map(a => a.clinicId);
            if (clinicId && !accessibleClinicIds.includes(clinicId)) {
                accessibleClinicIds.push(clinicId);
            }
            if (accessibleClinicIds.length === 0) {
                return next(new errors_js_1.ForbiddenError('No clinic assigned'));
            }
            context.clinicIds = accessibleClinicIds;
            // Check if request specifies a clinic via header
            const requestedClinicId = req.headers['x-clinic-id'];
            if (requestedClinicId) {
                if (!accessibleClinicIds.includes(requestedClinicId)) {
                    return next(new errors_js_1.ForbiddenError('Access to clinic denied'));
                }
                context.clinicId = requestedClinicId;
            }
            else {
                // Default to first accessible clinic or the direct clinicId
                context.clinicId = clinicId || accessibleClinicIds[0] || null;
            }
            authReq.tenantContext = context;
            return next();
        }
        // USER (patient) - check clinic linkage
        if (role === 'USER') {
            const user = await index_js_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_js_1.users.id, userId),
            });
            if (!user?.clinicId) {
                // User not linked to any clinic yet
                context.clinicId = null;
                context.clinicIds = [];
            }
            else {
                context.clinicId = user.clinicId;
                context.clinicIds = [user.clinicId];
            }
            authReq.tenantContext = context;
            return next();
        }
        // Fallback - deny access
        return next(new errors_js_1.ForbiddenError('Unable to determine tenant context'));
    }
    catch (error) {
        next(error);
    }
};
exports.tenantContext = tenantContext;
/**
 * Require a specific clinic to be selected
 */
const requireClinicContext = (req, _res, next) => {
    const authReq = req;
    if (!authReq.tenantContext?.clinicId) {
        return next(new errors_js_1.BadRequestError('Clinic context required. Set X-Clinic-Id header.'));
    }
    next();
};
exports.requireClinicContext = requireClinicContext;
/**
 * Require organization context
 */
const requireOrganizationContext = (req, _res, next) => {
    const authReq = req;
    if (!authReq.tenantContext?.organizationId) {
        return next(new errors_js_1.BadRequestError('Organization context required. Set X-Organization-Id header.'));
    }
    next();
};
exports.requireOrganizationContext = requireOrganizationContext;
/**
 * Validate that the requested entity belongs to the tenant
 */
const validateTenantAccess = async (clinicId, tenantContext) => {
    if (!tenantContext.clinicIds.length) {
        // SUPERADMIN without filter can access everything
        return tenantContext.organizationId === null && tenantContext.clinicId === null;
    }
    return tenantContext.clinicIds.includes(clinicId);
};
exports.validateTenantAccess = validateTenantAccess;
//# sourceMappingURL=tenant.middleware.js.map