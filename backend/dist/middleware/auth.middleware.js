"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.requireStaff = exports.requireAdmin = exports.requireSuperAdmin = exports.requireRoles = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const drizzle_orm_1 = require("drizzle-orm");
const env_js_1 = require("../config/env.js");
const errors_js_1 = require("../utils/errors.js");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
/**
 * Verify JWT access token and check if user is still active
 */
const authenticate = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new errors_js_1.UnauthorizedError('No token provided');
        }
        const token = authHeader.substring(7);
        const decoded = jsonwebtoken_1.default.verify(token, env_js_1.config.jwt.accessSecret);
        // Check if user is still active in database
        const user = await index_js_1.db.query.users.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_js_1.users.id, decoded.userId),
            columns: { isActive: true },
        });
        if (!user || !user.isActive) {
            throw new errors_js_1.UnauthorizedError('Account deactivated', 'ACCOUNT_DEACTIVATED');
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            next(new errors_js_1.UnauthorizedError('Token expired', 'TOKEN_EXPIRED'));
        }
        else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            next(new errors_js_1.UnauthorizedError('Invalid token', 'INVALID_TOKEN'));
        }
        else {
            next(error);
        }
    }
};
exports.authenticate = authenticate;
/**
 * Check if user has one of the required roles
 */
const requireRoles = (...roles) => {
    return (req, _res, next) => {
        const authReq = req;
        if (!authReq.user) {
            return next(new errors_js_1.UnauthorizedError('Not authenticated'));
        }
        if (!roles.includes(authReq.user.role)) {
            return next(new errors_js_1.ForbiddenError('Insufficient permissions'));
        }
        next();
    };
};
exports.requireRoles = requireRoles;
/**
 * Check if user is a SUPERADMIN
 */
exports.requireSuperAdmin = (0, exports.requireRoles)('SUPERADMIN');
/**
 * Check if user is an ADMIN or SUPERADMIN
 */
exports.requireAdmin = (0, exports.requireRoles)('SUPERADMIN', 'ADMIN');
/**
 * Check if user is a WORKER, ADMIN, or SUPERADMIN
 */
exports.requireStaff = (0, exports.requireRoles)('SUPERADMIN', 'ADMIN', 'WORKER');
/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return next();
        }
        const token = authHeader.substring(7);
        const decoded = jsonwebtoken_1.default.verify(token, env_js_1.config.jwt.accessSecret);
        req.user = decoded;
        next();
    }
    catch {
        // Token invalid but that's okay for optional auth
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.middleware.js.map