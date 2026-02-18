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
import { startSignedPdfRecoveryScheduler } from './jobs/esignature-recovery-scheduler.js';
import { initializeWebSocket } from './websocket.js';
import { tenantManager } from './db/tenant-manager.js';

const app = express();

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Helmet for security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration - allow subdomain-based multi-tenant origins
const allowedOrigins = [
    config.frontend.url,
    'http://localhost:5173',
    'http://localhost:5174',
];

/**
 * Check if the origin is a valid subdomain for multi-tenant access.
 * Matches:
 *   - http://*.localhost:5173  (dev)
 *   - http://*.localhost:5174  (dev)
 *   - https://*.cuspia.com     (prod)
 */
const isAllowedSubdomain = (origin: string): boolean => {
    try {
        const url = new URL(origin);
        const hostname = url.hostname;

        // Dev: any subdomain of localhost (e.g. mi-clinica.localhost)
        if (hostname.endsWith('.localhost')) {
            return ['5173', '5174', ''].includes(url.port);
        }

        // Prod: any subdomain of cuspia.com (e.g. mi-clinica.cuspia.com)
        if (hostname.endsWith('.cuspia.com') || hostname === 'cuspia.com') {
            return true;
        }

        return false;
    } catch {
        return false;
    }
};

// Allow webhook requests from Meta (no CORS restriction)
app.use('/api/v1/whatsapp', cors());

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // Allow any tenant subdomain (*.localhost in dev, *.cuspia.com in prod)
        if (isAllowedSubdomain(origin)) {
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Clinic-Id', 'X-Organization-Id', 'X-Tenant-Slug'],
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

        // Resolve tenant slug for per-tenant bucket lookup:
        // 1. From ?t= query param (used by img/audio/video tags that can't send headers)
        // 2. From authorization header (if available)
        let tenantSlug: string | undefined = req.query.t as string | undefined;

        if (!tenantSlug) {
            try {
                const authHeader = req.headers.authorization;
                if (authHeader?.startsWith('Bearer ')) {
                    const jwt = await import('jsonwebtoken');
                    const decoded = jwt.default.verify(
                        authHeader.substring(7),
                        config.jwt.accessSecret
                    ) as any;
                    tenantSlug = decoded.tenantSlug;
                }
            } catch {
                // Token expired/invalid — ignore, will use default bucket
            }
        }

        const { stream, contentType, contentLength } = await storage.getFileStream(key, tenantSlug);

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

            // Start signed PDF recovery scheduler (re-downloads from SignNow if MinIO upload failed)
            startSignedPdfRecoveryScheduler();
        });

        // Graceful shutdown
        const shutdown = async () => {
            logger.info('Shutting down gracefully...');
            await tenantManager.closeAll();
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
