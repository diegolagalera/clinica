import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    CreateBucketCommand,
    HeadBucketCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    DeleteBucketCommand,
} from '@aws-sdk/client-s3';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { Readable } from 'stream';

// ─── S3 Client Setup ──────────────────────────────────────────────────────────

const s3Client = new S3Client({
    endpoint: config.s3.endpoint,
    region: config.s3.region,
    credentials: {
        accessKeyId: config.s3.accessKey,
        secretAccessKey: config.s3.secretKey,
    },
    forcePathStyle: true, // Required for S3-compatible providers (MinIO, Hetzner Object Storage)
});

/**
 * Single shared bucket for all tenants.
 * Tenant isolation is achieved via key prefixes: {tenantSlug}/{clinicId}/{category}/...
 */
const BUCKET = config.s3.bucket;

// ─── Key Helpers ──────────────────────────────────────────────────────────────

export type StorageCategory =
    | 'radiographs'
    | 'stock-images'
    | 'whatsapp-media'
    | 'chatbot-knowledge'
    | 'esignature';

/**
 * Build a consistent S3 object key with tenant isolation.
 * Format: {clinicId}/{category}/{...rest}
 * Note: The tenant slug prefix is added automatically by the core storage functions.
 */
export const buildKey = (
    _orgId: string, // kept for backward compatibility but no longer used in key
    clinicId: string,
    category: StorageCategory,
    ...parts: string[]
): string => {
    return [clinicId, category, ...parts].join('/');
};

/**
 * Resolve the full S3 key by prepending the tenant slug prefix.
 * This ensures tenant isolation within the single shared bucket.
 * If no tenantSlug is provided, the key is used as-is (backward compatibility).
 */
const resolveKey = (key: string, tenantSlug?: string): string => {
    if (tenantSlug) return `${tenantSlug}/${key}`;
    return key;
};

// ─── Bucket Lifecycle ─────────────────────────────────────────────────────────

/**
 * Ensure the shared bucket exists. Creates it if it doesn't.
 * Safe to call multiple times (idempotent).
 * With Hetzner Object Storage, the bucket can also be created via the web console.
 */
export const ensureBucketExists = async (_tenantSlug: string): Promise<void> => {
    try {
        await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
        logger.debug({ bucket: BUCKET }, 'Shared bucket already exists');
        return;
    } catch (err: any) {
        if (err.$metadata?.httpStatusCode !== 404 && err.name !== 'NotFound') {
            logger.error({ bucket: BUCKET, err }, 'Unexpected error checking bucket existence');
            throw err;
        }
    }

    try {
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
        logger.info({ bucket: BUCKET }, '✅ Shared bucket created');
    } catch (err: any) {
        if (err.name === 'BucketAlreadyOwnedByYou' || err.name === 'BucketAlreadyExists') {
            logger.debug({ bucket: BUCKET }, 'Bucket was created by another process (race condition — safe)');
            return;
        }
        logger.error({ bucket: BUCKET, err }, '❌ Failed to create shared bucket');
        throw err;
    }
};

/**
 * Delete ALL data for a tenant within the shared bucket.
 * Removes all objects with the tenant slug prefix.
 * Used when a tenant is being fully removed.
 */
export const deleteBucketWithContents = async (tenantSlug: string): Promise<void> => {
    const prefix = `${tenantSlug}/`;
    let continuationToken: string | undefined;
    let totalDeleted = 0;

    do {
        const listResponse = await s3Client.send(
            new ListObjectsV2Command({
                Bucket: BUCKET,
                Prefix: prefix,
                ContinuationToken: continuationToken,
                MaxKeys: 1000,
            })
        );

        const objects = listResponse.Contents;
        if (objects && objects.length > 0) {
            await s3Client.send(
                new DeleteObjectsCommand({
                    Bucket: BUCKET,
                    Delete: {
                        Objects: objects.map((obj) => ({ Key: obj.Key! })),
                        Quiet: true,
                    },
                })
            );
            totalDeleted += objects.length;
        }

        continuationToken = listResponse.IsTruncated
            ? listResponse.NextContinuationToken
            : undefined;
    } while (continuationToken);

    logger.info({ tenantSlug, totalDeleted }, '✅ Tenant data deleted from shared bucket');
};

// ─── Legacy Export (backward compatibility) ───────────────────────────────────

/** @deprecated Use the shared BUCKET constant. Kept for any external consumers. */
export const getTenantBucket = (_tenantSlug: string): string => BUCKET;

// ─── Core Operations ──────────────────────────────────────────────────────────

/**
 * Upload a file to S3.
 */
export const uploadFile = async (
    key: string,
    buffer: Buffer,
    mimeType: string,
    tenantSlug?: string
): Promise<void> => {
    const fullKey = resolveKey(key, tenantSlug);
    await s3Client.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: fullKey,
            Body: buffer,
            ContentType: mimeType,
        })
    );
    logger.debug({ key: fullKey, bucket: BUCKET, size: buffer.length }, 'File uploaded to S3');
};

/**
 * Get a file as a readable stream (for piping to HTTP response).
 */
export const getFileStream = async (
    key: string,
    tenantSlug?: string
): Promise<{ stream: Readable; contentType: string; contentLength: number }> => {
    const fullKey = resolveKey(key, tenantSlug);
    const response = await s3Client.send(
        new GetObjectCommand({
            Bucket: BUCKET,
            Key: fullKey,
        })
    );

    return {
        stream: response.Body as Readable,
        contentType: response.ContentType || 'application/octet-stream',
        contentLength: response.ContentLength || 0,
    };
};

/**
 * Get a file as a Buffer (for in-memory processing, e.g. AI analysis).
 */
export const getFileBuffer = async (key: string, tenantSlug?: string): Promise<Buffer> => {
    const fullKey = resolveKey(key, tenantSlug);
    const response = await s3Client.send(
        new GetObjectCommand({
            Bucket: BUCKET,
            Key: fullKey,
        })
    );

    const chunks: Uint8Array[] = [];
    const stream = response.Body as Readable;
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};

/**
 * Delete a file from S3.
 */
export const deleteFile = async (key: string, tenantSlug?: string): Promise<void> => {
    const fullKey = resolveKey(key, tenantSlug);
    try {
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: BUCKET,
                Key: fullKey,
            })
        );
        logger.debug({ key: fullKey, bucket: BUCKET }, 'File deleted from S3');
    } catch (err) {
        logger.warn({ key: fullKey, err }, 'Failed to delete file from S3');
    }
};

/**
 * Check if a file exists in S3.
 */
export const fileExists = async (key: string, tenantSlug?: string): Promise<boolean> => {
    const fullKey = resolveKey(key, tenantSlug);
    try {
        await s3Client.send(
            new HeadObjectCommand({
                Bucket: BUCKET,
                Key: fullKey,
            })
        );
        return true;
    } catch {
        return false;
    }
};
