export declare const env: {
    NODE_ENV: "development" | "production" | "test";
    PORT: number;
    DATABASE_URL: string;
    DATABASE_SSL: boolean;
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
    JWT_ACCESS_EXPIRY: string;
    JWT_REFRESH_EXPIRY: string;
    S3_ENDPOINT: string;
    S3_ACCESS_KEY: string;
    S3_SECRET_KEY: string;
    S3_BUCKET_RADIOGRAPHS: string;
    S3_BUCKET_DOCUMENTS: string;
    S3_REGION: string;
    FRONTEND_URL: string;
    RATE_LIMIT_WINDOW_MS: number;
    RATE_LIMIT_MAX_REQUESTS: number;
    LOG_LEVEL: "debug" | "info" | "warn" | "error";
    REDIS_URL?: string | undefined;
    SMTP_HOST?: string | undefined;
    SMTP_PORT?: number | undefined;
    SMTP_USER?: string | undefined;
    SMTP_PASS?: string | undefined;
    EMAIL_FROM?: string | undefined;
    AI_SERVICE_URL?: string | undefined;
    AI_API_KEY?: string | undefined;
    OPENAI_API_KEY?: string | undefined;
};
export declare const config: {
    readonly env: "development" | "production" | "test";
    readonly port: number;
    readonly isProduction: boolean;
    readonly isDevelopment: boolean;
    readonly isTest: boolean;
    readonly database: {
        readonly url: string;
        readonly ssl: boolean;
    };
    readonly redis: {
        readonly url: string | undefined;
    };
    readonly jwt: {
        readonly accessSecret: string;
        readonly refreshSecret: string;
        readonly accessExpiry: string;
        readonly refreshExpiry: string;
    };
    readonly s3: {
        readonly endpoint: string;
        readonly accessKey: string;
        readonly secretKey: string;
        readonly buckets: {
            readonly radiographs: string;
            readonly documents: string;
        };
        readonly region: string;
    };
    readonly email: {
        readonly host: string | undefined;
        readonly port: number | undefined;
        readonly user: string | undefined;
        readonly pass: string | undefined;
        readonly from: string | undefined;
    };
    readonly ai: {
        readonly serviceUrl: string | undefined;
        readonly apiKey: string | undefined;
    };
    readonly openai: {
        readonly apiKey: string | undefined;
    };
    readonly frontend: {
        readonly url: string;
    };
    readonly rateLimit: {
        readonly windowMs: number;
        readonly maxRequests: number;
    };
    readonly logging: {
        readonly level: "debug" | "info" | "warn" | "error";
    };
};
//# sourceMappingURL=env.d.ts.map