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
    forcePathStyle: true, // Required for MinIO
});

/** Legacy default bucket — used as fallback when no tenant slug is provided */
const DEFAULT_BUCKET = config.s3.bucket;

// ─── Bucket Naming ────────────────────────────────────────────────────────────

/**
 * Convert a tenant slug to a valid S3 bucket name.
 * S3 bucket names: lowercase, 3-63 chars, no underscores, only hyphens.
 * Example: "mi-clinica" → "cuspia-mi-clinica"
 */
export const getTenantBucket = (tenantSlug: string): string => {
    return `cuspia-${tenantSlug}`;
};

/**
 * Resolve the bucket to use. If a tenantSlug is provided, use the tenant bucket.
 * Otherwise fall back to the default bucket for backward compatibility.
 */
const resolveBucket = (tenantSlug?: string): string => {
    if (tenantSlug) return getTenantBucket(tenantSlug);
    return DEFAULT_BUCKET;
};

// ─── Key Builder ──────────────────────────────────────────────────────────────

export type StorageCategory =
    | 'radiographs'
    | 'stock-images'
    | 'whatsapp-media'
    | 'chatbot-knowledge'
    | 'esignature';

/**
 * Build a consistent S3 object key with tenant isolation.
 * Format: {clinicId}/{category}/{...rest}
 * Note: orgId prefix is no longer needed since each tenant has its own bucket.
 */
export const buildKey = (
    _orgId: string, // kept for backward compatibility but no longer used in key
    clinicId: string,
    category: StorageCategory,
    ...parts: string[]
): string => {
    return [clinicId, category, ...parts].join('/');
};

// ─── Bucket Lifecycle ─────────────────────────────────────────────────────────

/**
 * Ensure a tenant bucket exists. Creates it if it doesn't.
 * Safe to call multiple times (idempotent).
 */
export const ensureBucketExists = async (tenantSlug: string): Promise<void> => {
    const bucket = getTenantBucket(tenantSlug);

    try {
        // Check if bucket already exists
        await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
        logger.debug({ bucket }, 'Bucket already exists');
        return;
    } catch (err: any) {
        // 404 / NotFound means we need to create it
        if (err.$metadata?.httpStatusCode !== 404 && err.name !== 'NotFound') {
            logger.error({ bucket, err }, 'Unexpected error checking bucket existence');
            throw err;
        }
    }

    // Create the bucket
    try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
        logger.info({ bucket, tenantSlug }, '✅ Tenant bucket created');
    } catch (err: any) {
        // BucketAlreadyOwnedByYou = race condition, another process created it
        if (err.name === 'BucketAlreadyOwnedByYou' || err.name === 'BucketAlreadyExists') {
            logger.debug({ bucket }, 'Bucket was created by another process (race condition — safe)');
            return;
        }
        logger.error({ bucket, tenantSlug, err }, '❌ Failed to create tenant bucket');
        throw err;
    }
};

/**
 * Delete a tenant bucket and ALL its contents.
 * Used when a tenant is being fully removed.
 */
export const deleteBucketWithContents = async (tenantSlug: string): Promise<void> => {
    const bucket = getTenantBucket(tenantSlug);

    // Step 1: Check if the bucket exists
    try {
        await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (err: any) {
        if (err.$metadata?.httpStatusCode === 404 || err.name === 'NotFound') {
            logger.warn({ bucket, tenantSlug }, 'Bucket does not exist — nothing to delete');
            return;
        }
        throw err;
    }

    // Step 2: Delete all objects in the bucket (S3 requires empty bucket for deletion)
    let continuationToken: string | undefined;
    let totalDeleted = 0;

    do {
        const listResponse = await s3Client.send(
            new ListObjectsV2Command({
                Bucket: bucket,
                ContinuationToken: continuationToken,
                MaxKeys: 1000,
            })
        );

        const objects = listResponse.Contents;
        if (objects && objects.length > 0) {
            await s3Client.send(
                new DeleteObjectsCommand({
                    Bucket: bucket,
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

    logger.info({ bucket, totalDeleted }, 'All objects deleted from bucket');

    // Step 3: Delete the empty bucket
    try {
        await s3Client.send(
            new DeleteObjectsCommand({
                Bucket: bucket,
                Delete: { Objects: [], Quiet: true },
            })
        );
    } catch {
        // Ignore — just ensuring no stragglers
    }

    // Actually delete the bucket itself
    const { DeleteBucketCommand } = await import('@aws-sdk/client-s3');
    await s3Client.send(new DeleteBucketCommand({ Bucket: bucket }));
    logger.info({ bucket, tenantSlug }, '✅ Tenant bucket deleted');
};

// ─── Core Operations ──────────────────────────────────────────────────────────

/**
 * Upload a file to MinIO/S3.
 */
export const uploadFile = async (
    key: string,
    buffer: Buffer,
    mimeType: string,
    tenantSlug?: string
): Promise<void> => {
    const bucket = resolveBucket(tenantSlug);
    await s3Client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
        })
    );
    logger.debug({ key, bucket, size: buffer.length }, 'File uploaded to S3');
};

/**
 * Get a file as a readable stream (for piping to HTTP response).
 */
export const getFileStream = async (
    key: string,
    tenantSlug?: string
): Promise<{ stream: Readable; contentType: string; contentLength: number }> => {
    const bucket = resolveBucket(tenantSlug);
    const response = await s3Client.send(
        new GetObjectCommand({
            Bucket: bucket,
            Key: key,
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
    const bucket = resolveBucket(tenantSlug);
    const response = await s3Client.send(
        new GetObjectCommand({
            Bucket: bucket,
            Key: key,
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
 * Delete a file from MinIO/S3.
 */
export const deleteFile = async (key: string, tenantSlug?: string): Promise<void> => {
    const bucket = resolveBucket(tenantSlug);
    try {
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: bucket,
                Key: key,
            })
        );
        logger.debug({ key, bucket }, 'File deleted from S3');
    } catch (err) {
        logger.warn({ key, err }, 'Failed to delete file from S3');
    }
};

/**
 * Check if a file exists in MinIO/S3.
 */
export const fileExists = async (key: string, tenantSlug?: string): Promise<boolean> => {
    const bucket = resolveBucket(tenantSlug);
    try {
        await s3Client.send(
            new HeadObjectCommand({
                Bucket: bucket,
                Key: key,
            })
        );
        return true;
    } catch {
        return false;
    }
};
