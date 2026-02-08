import type { RequestHandler } from 'express';
import type { Role } from '../types/index.js';
/**
 * Verify JWT access token and check if user is still active
 */
export declare const authenticate: RequestHandler;
/**
 * Check if user has one of the required roles
 */
export declare const requireRoles: (...roles: Role[]) => RequestHandler;
/**
 * Check if user is a SUPERADMIN
 */
export declare const requireSuperAdmin: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * Check if user is an ADMIN or SUPERADMIN
 */
export declare const requireAdmin: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * Check if user is a WORKER, ADMIN, or SUPERADMIN
 */
export declare const requireStaff: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * Optional authentication - doesn't fail if no token
 */
export declare const optionalAuth: RequestHandler;
//# sourceMappingURL=auth.middleware.d.ts.map