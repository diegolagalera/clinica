"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateParams = exports.validateQuery = exports.validateBody = exports.validate = void 0;
const zod_1 = require("zod");
const errors_js_1 = require("../utils/errors.js");
/**
 * Middleware factory to validate request data with Zod schemas
 */
const validate = (schema, target = 'body') => {
    return (req, _res, next) => {
        try {
            const data = req[target];
            const validated = schema.parse(data);
            req[target] = validated;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const errors = {};
                for (const issue of error.issues) {
                    const path = issue.path.join('.') || '_root';
                    if (!errors[path]) {
                        errors[path] = [];
                    }
                    errors[path].push(issue.message);
                }
                next(new errors_js_1.ValidationError(errors));
            }
            else {
                next(error);
            }
        }
    };
};
exports.validate = validate;
/**
 * Validate request body
 */
const validateBody = (schema) => (0, exports.validate)(schema, 'body');
exports.validateBody = validateBody;
/**
 * Validate query parameters
 */
const validateQuery = (schema) => (0, exports.validate)(schema, 'query');
exports.validateQuery = validateQuery;
/**
 * Validate URL parameters
 */
const validateParams = (schema) => (0, exports.validate)(schema, 'params');
exports.validateParams = validateParams;
//# sourceMappingURL=validation.middleware.js.map