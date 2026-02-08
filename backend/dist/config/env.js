"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    // Environment
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.coerce.number().default(3000),
    // Database
    DATABASE_URL: zod_1.z.string().url(),
    DATABASE_SSL: zod_1.z.coerce.boolean().default(false),
    // Redis
    REDIS_URL: zod_1.z.string().url().optional(),
    // JWT
    JWT_ACCESS_SECRET: zod_1.z.string().min(32),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32),
    JWT_ACCESS_EXPIRY: zod_1.z.string().default('15m'),
    JWT_REFRESH_EXPIRY: zod_1.z.string().default('7d'),
    // S3
    S3_ENDPOINT: zod_1.z.string().url(),
    S3_ACCESS_KEY: zod_1.z.string(),
    S3_SECRET_KEY: zod_1.z.string(),
    S3_BUCKET_RADIOGRAPHS: zod_1.z.string().default('radiographs'),
    S3_BUCKET_DOCUMENTS: zod_1.z.string().default('documents'),
    S3_REGION: zod_1.z.string().default('us-east-1'),
    // Email
    SMTP_HOST: zod_1.z.string().optional(),
    SMTP_PORT: zod_1.z.coerce.number().optional(),
    SMTP_USER: zod_1.z.string().optional(),
    SMTP_PASS: zod_1.z.string().optional(),
    EMAIL_FROM: zod_1.z.string().email().optional(),
    // AI Service
    AI_SERVICE_URL: zod_1.z.string().url().optional(),
    AI_API_KEY: zod_1.z.string().optional(),
    OPENAI_API_KEY: zod_1.z.string().optional(),
    // Frontend
    FRONTEND_URL: zod_1.z.string().url(),
    // Rate Limiting (higher defaults for development)
    RATE_LIMIT_WINDOW_MS: zod_1.z.coerce.number().default(60000), // 1 minute
    RATE_LIMIT_MAX_REQUESTS: zod_1.z.coerce.number().default(1000), // 1000 requests per minute
    // Logging
    LOG_LEVEL: zod_1.z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}
exports.env = parsed.data;
exports.config = {
    env: exports.env.NODE_ENV,
    port: exports.env.PORT,
    isProduction: exports.env.NODE_ENV === 'production',
    isDevelopment: exports.env.NODE_ENV === 'development',
    isTest: exports.env.NODE_ENV === 'test',
    database: {
        url: exports.env.DATABASE_URL,
        ssl: exports.env.DATABASE_SSL,
    },
    redis: {
        url: exports.env.REDIS_URL,
    },
    jwt: {
        accessSecret: exports.env.JWT_ACCESS_SECRET,
        refreshSecret: exports.env.JWT_REFRESH_SECRET,
        accessExpiry: exports.env.JWT_ACCESS_EXPIRY,
        refreshExpiry: exports.env.JWT_REFRESH_EXPIRY,
    },
    s3: {
        endpoint: exports.env.S3_ENDPOINT,
        accessKey: exports.env.S3_ACCESS_KEY,
        secretKey: exports.env.S3_SECRET_KEY,
        buckets: {
            radiographs: exports.env.S3_BUCKET_RADIOGRAPHS,
            documents: exports.env.S3_BUCKET_DOCUMENTS,
        },
        region: exports.env.S3_REGION,
    },
    email: {
        host: exports.env.SMTP_HOST,
        port: exports.env.SMTP_PORT,
        user: exports.env.SMTP_USER,
        pass: exports.env.SMTP_PASS,
        from: exports.env.EMAIL_FROM,
    },
    ai: {
        serviceUrl: exports.env.AI_SERVICE_URL,
        apiKey: exports.env.AI_API_KEY,
    },
    openai: {
        apiKey: exports.env.OPENAI_API_KEY,
    },
    frontend: {
        url: exports.env.FRONTEND_URL,
    },
    rateLimit: {
        windowMs: exports.env.RATE_LIMIT_WINDOW_MS,
        maxRequests: exports.env.RATE_LIMIT_MAX_REQUESTS,
    },
    logging: {
        level: exports.env.LOG_LEVEL,
    },
};
//# sourceMappingURL=env.js.map