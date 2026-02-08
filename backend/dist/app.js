"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_js_1 = require("./config/env.js");
const logger_js_1 = require("./utils/logger.js");
const index_js_1 = require("./middleware/index.js");
const index_js_2 = __importDefault(require("./routes/index.js"));
const reminder_scheduler_js_1 = require("./jobs/reminder-scheduler.js");
const rating_scheduler_js_1 = require("./jobs/rating-scheduler.js");
const app = (0, express_1.default)();
// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================
// Helmet for security headers
app.use((0, helmet_1.default)());
// CORS configuration
app.use((0, cors_1.default)({
    origin: env_js_1.config.frontend.url,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Clinic-Id', 'X-Organization-Id'],
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: env_js_1.config.rateLimit.windowMs,
    max: env_js_1.config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);
// ============================================================================
// BODY PARSING
// ============================================================================
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
// ============================================================================
// REQUEST LOGGING
// ============================================================================
app.use((req, _res, next) => {
    logger_js_1.logger.debug({
        method: req.method,
        url: req.url,
        ip: req.ip,
    }, 'Incoming request');
    next();
});
// ============================================================================
// API ROUTES
// ============================================================================
app.use('/api/v1', index_js_2.default);
// ============================================================================
// ERROR HANDLING
// ============================================================================
app.use(index_js_1.notFoundHandler);
app.use(index_js_1.errorHandler);
// ============================================================================
// SERVER STARTUP
// ============================================================================
const start = async () => {
    try {
        const server = app.listen(env_js_1.config.port, () => {
            logger_js_1.logger.info(`🚀 Server running on port ${env_js_1.config.port}`);
            logger_js_1.logger.info(`📊 Environment: ${env_js_1.config.env}`);
            logger_js_1.logger.info(`🔗 API: http://localhost:${env_js_1.config.port}/api/v1`);
            // Start reminder scheduler
            (0, reminder_scheduler_js_1.startReminderScheduler)();
            // Start rating scheduler
            (0, rating_scheduler_js_1.startRatingScheduler)();
        });
        // Graceful shutdown
        const shutdown = async () => {
            logger_js_1.logger.info('Shutting down gracefully...');
            server.close(() => {
                logger_js_1.logger.info('Server closed');
                process.exit(0);
            });
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }
    catch (error) {
        logger_js_1.logger.error({ error }, 'Failed to start server');
        process.exit(1);
    }
};
start();
exports.default = app;
//# sourceMappingURL=app.js.map