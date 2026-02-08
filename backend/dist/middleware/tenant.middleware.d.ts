import type { RequestHandler } from 'express';
import type { TenantContext } from '../types/index.js';
/**
 * Multi-tenant middleware that sets up tenant context based on user role
 *
 * - SUPERADMIN: Can access all organizations and clinics
 * - ADMIN: Can access their organization's clinics
 * - WORKER: Can access only their assigned clinic
 * - USER: Can access only their linked clinic
 */
export declare const tenantContext: RequestHandler;
/**
 * Require a specific clinic to be selected
 */
export declare const requireClinicContext: RequestHandler;
/**
 * Require organization context
 */
export declare const requireOrganizationContext: RequestHandler;
/**
 * Validate that the requested entity belongs to the tenant
 */
export declare const validateTenantAccess: (clinicId: string, tenantContext: TenantContext) => Promise<boolean>;
//# sourceMappingURL=tenant.middleware.d.ts.map