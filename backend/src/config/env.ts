import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    // Environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),

    // Database
    DATABASE_URL: z.string().url(),
    DATABASE_SSL: z.coerce.boolean().default(false),

    // Redis
    REDIS_URL: z.string().url().optional(),

    // JWT
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRY: z.string().default('15m'),
    JWT_REFRESH_EXPIRY: z.string().default('7d'),

    // S3
    S3_ENDPOINT: z.string().url(),
    S3_ACCESS_KEY: z.string(),
    S3_SECRET_KEY: z.string(),
    S3_BUCKET_RADIOGRAPHS: z.string().default('radiographs'),
    S3_BUCKET_DOCUMENTS: z.string().default('documents'),
    S3_REGION: z.string().default('us-east-1'),

    // Email
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().email().optional(),

    // AI Service
    AI_SERVICE_URL: z.string().url().optional(),
    AI_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),

    // Frontend
    FRONTEND_URL: z.string().url(),

    // Rate Limiting (higher defaults for development)
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000), // 1 minute
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(1000), // 1000 requests per minute

    // Logging
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // Support
    SUPPORT_EMAIL: z.string().email().default('soporte@cuspia.com'),

    // WhatsApp Chatbot
    WHATSAPP_VERIFY_TOKEN: z.string().optional(),
    ENCRYPTION_KEY: z.string().min(32).optional(),
    NGROK_AUTHTOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;

export const config = {
    env: env.NODE_ENV,
    port: env.PORT,
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',

    database: {
        url: env.DATABASE_URL,
        ssl: env.DATABASE_SSL,
    },

    redis: {
        url: env.REDIS_URL,
    },

    jwt: {
        accessSecret: env.JWT_ACCESS_SECRET,
        refreshSecret: env.JWT_REFRESH_SECRET,
        accessExpiry: env.JWT_ACCESS_EXPIRY,
        refreshExpiry: env.JWT_REFRESH_EXPIRY,
    },

    s3: {
        endpoint: env.S3_ENDPOINT,
        accessKey: env.S3_ACCESS_KEY,
        secretKey: env.S3_SECRET_KEY,
        buckets: {
            radiographs: env.S3_BUCKET_RADIOGRAPHS,
            documents: env.S3_BUCKET_DOCUMENTS,
        },
        region: env.S3_REGION,
    },

    email: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        from: env.EMAIL_FROM,
    },

    ai: {
        serviceUrl: env.AI_SERVICE_URL,
        apiKey: env.AI_API_KEY,
    },

    openai: {
        apiKey: env.OPENAI_API_KEY,
    },

    frontend: {
        url: env.FRONTEND_URL,
    },

    rateLimit: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    },

    logging: {
        level: env.LOG_LEVEL,
    },

    support: {
        email: env.SUPPORT_EMAIL,
    },

    whatsapp: {
        verifyToken: env.WHATSAPP_VERIFY_TOKEN,
    },

    encryption: {
        key: env.ENCRYPTION_KEY,
    },

    ngrok: {
        authtoken: env.NGROK_AUTHTOKEN,
    },
} as const;
