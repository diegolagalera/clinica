import express from 'express';
import { createServer } from 'http';
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
import { startCleanupScheduler } from './jobs/cleanup-scheduler.js';
import { initializeWebSocket } from './websocket.js';

const app = express();

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Helmet for security headers
app.use(helmet());

// CORS configuration - allow multiple dev ports
const allowedOrigins = [
    config.frontend.url,
    'http://localhost:5173',
    'http://localhost:5174',
];

// Allow webhook requests from Meta (no CORS restriction)
app.use('/api/v1/whatsapp', cors());

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // Allow ngrok tunnel domains for demo/testing
        if (origin.endsWith('.ngrok-free.app')) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
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
// MEDIA SERVING (from MinIO/S3)
// ============================================================================
// NOTE: No auth middleware here — <img>, <audio>, <video> tags cannot send
// Authorization headers. This matches the stock image pattern (see stock.routes.ts).
// Security: MinIO bucket is private + S3 keys contain non-guessable UUIDs.

import * as storage from './services/storage.service.js';

// Generic media endpoint: streams any file from MinIO by its storage key
app.get('/api/v1/media/*', async (req, res): Promise<void> => {
    try {
        // Extract the full key from the URL path after /api/v1/media/
        const key = (req.params as Record<string, string>)[0];
        if (!key) {
            res.status(400).json({ error: 'Missing media key' });
            return;
        }

        const { stream, contentType, contentLength } = await storage.getFileStream(key);

        res.setHeader('Content-Type', contentType);
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h cache
        stream.pipe(res);
    } catch (err: any) {
        if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
            res.status(404).json({ error: 'File not found' });
            return;
        }
        logger.error({ err, url: req.url }, 'Error serving media from MinIO');
        res.status(500).json({ error: 'Error serving file' });
    }
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
        // Create HTTP server wrapping Express
        const httpServer = createServer(app);

        // Initialize WebSocket server
        initializeWebSocket(httpServer);

        httpServer.listen(config.port, () => {
            logger.info(`🚀 Server running on port ${config.port}`);
            logger.info(`📊 Environment: ${config.env}`);
            logger.info(`🔗 API: http://localhost:${config.port}/api/v1`);
            logger.info(`🔌 WebSocket: ws://localhost:${config.port}`);

            // Start reminder scheduler
            startReminderScheduler();

            // Start rating scheduler
            startRatingScheduler();

            // Start message & media cleanup scheduler
            startCleanupScheduler();
        });

        // Graceful shutdown
        const shutdown = async () => {
            logger.info('Shutting down gracefully...');
            httpServer.close(() => {
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
