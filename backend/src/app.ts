import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/index.js';
import routes from './routes/index.js';
import { startReminderScheduler } from './jobs/reminder-scheduler.js';
import { startRatingScheduler } from './jobs/rating-scheduler.js';

const app = express();

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Helmet for security headers
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: config.frontend.url,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Clinic-Id', 'X-Organization-Id'],
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// ============================================================================
// BODY PARSING
// ============================================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============================================================================
// REQUEST LOGGING
// ============================================================================

app.use((req, _res, next) => {
    logger.debug({
        method: req.method,
        url: req.url,
        ip: req.ip,
    }, 'Incoming request');
    next();
});

// ============================================================================
// API ROUTES
// ============================================================================

app.use('/api/v1', routes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

const start = async () => {
    try {
        const server = app.listen(config.port, () => {
            logger.info(`🚀 Server running on port ${config.port}`);
            logger.info(`📊 Environment: ${config.env}`);
            logger.info(`🔗 API: http://localhost:${config.port}/api/v1`);

            // Start reminder scheduler
            startReminderScheduler();

            // Start rating scheduler
            startRatingScheduler();
        });

        // Graceful shutdown
        const shutdown = async () => {
            logger.info('Shutting down gracefully...');
            server.close(() => {
                logger.info('Server closed');
                process.exit(0);
            });
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    } catch (error) {
        logger.error({ error }, 'Failed to start server');
        process.exit(1);
    }
};

start();

export default app;
