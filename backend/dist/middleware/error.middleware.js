"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.notFoundHandler = exports.errorHandler = void 0;
const errors_js_1 = require("../utils/errors.js");
const response_js_1 = require("../utils/response.js");
const logger_js_1 = require("../utils/logger.js");
const env_js_1 = require("../config/env.js");
/**
 * Global error handling middleware
 */
const errorHandler = (err, _req, res, _next) => {
    // Log error
    if (err instanceof errors_js_1.AppError && err.isOperational) {
        logger_js_1.logger.warn({ err, statusCode: err.statusCode }, err.message);
    }
    else {
        logger_js_1.logger.error({ err }, 'Unexpected error');
    }
    // Handle known operational errors
    if (err instanceof errors_js_1.ValidationError) {
        res.status(err.statusCode).json((0, response_js_1.error)(err.message, err.errors));
        return;
    }
    if (err instanceof errors_js_1.AppError) {
        res.status(err.statusCode).json((0, response_js_1.error)(err.message));
        return;
    }
    // Handle unknown errors
    const statusCode = 500;
    const message = env_js_1.config.isProduction
        ? 'Internal server error'
        : err.message || 'Internal server error';
    res.status(statusCode).json((0, response_js_1.error)(message));
};
exports.errorHandler = errorHandler;
/**
 * 404 Not Found handler
 */
const notFoundHandler = (_req, res) => {
    res.status(404).json((0, response_js_1.error)('Resource not found'));
};
exports.notFoundHandler = notFoundHandler;
/**
 * Async handler wrapper to catch async errors
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=error.middleware.js.map