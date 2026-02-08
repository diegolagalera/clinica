"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChildLogger = exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const env_js_1 = require("../config/env.js");
exports.logger = (0, pino_1.default)({
    level: env_js_1.config.logging.level,
    transport: env_js_1.config.isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
    base: {
        env: env_js_1.config.env,
    },
});
const createChildLogger = (context) => {
    return exports.logger.child(context);
};
exports.createChildLogger = createChildLogger;
//# sourceMappingURL=logger.js.map