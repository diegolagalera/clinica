import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
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

const BUCKET = config.s3.bucket;

// ─── Key Builder ──────────────────────────────────────────────────────────────

export type StorageCategory =
    | 'radiographs'
    | 'stock-images'
    | 'whatsapp-media'
    | 'chatbot-knowledge';

/**
 * Build a consistent S3 object key with tenant isolation.
 * Format: {orgId}/{clinicId}/{category}/{...rest}
 */
export const buildKey = (
    orgId: string,
    clinicId: string,
    category: StorageCategory,
    ...parts: string[]
): string => {
    return [orgId, clinicId, category, ...parts].join('/');
};

// ─── Core Operations ──────────────────────────────────────────────────────────

/**
 * Upload a file to MinIO/S3.
 */
export const uploadFile = async (
    key: string,
    buffer: Buffer,
    mimeType: string
): Promise<void> => {
    await s3Client.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
        })
    );
    logger.debug({ key, bucket: BUCKET, size: buffer.length }, 'File uploaded to S3');
};

/**
 * Get a file as a readable stream (for piping to HTTP response).
 */
export const getFileStream = async (
    key: string
): Promise<{ stream: Readable; contentType: string; contentLength: number }> => {
    const response = await s3Client.send(
        new GetObjectCommand({
            Bucket: BUCKET,
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
export const getFileBuffer = async (key: string): Promise<Buffer> => {
    const response = await s3Client.send(
        new GetObjectCommand({
            Bucket: BUCKET,
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
export const deleteFile = async (key: string): Promise<void> => {
    try {
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: BUCKET,
                Key: key,
            })
        );
        logger.debug({ key, bucket: BUCKET }, 'File deleted from S3');
    } catch (err) {
        logger.warn({ key, err }, 'Failed to delete file from S3');
    }
};

/**
 * Check if a file exists in MinIO/S3.
 */
export const fileExists = async (key: string): Promise<boolean> => {
    try {
        await s3Client.send(
            new HeadObjectCommand({
                Bucket: BUCKET,
                Key: key,
            })
        );
        return true;
    } catch {
        return false;
    }
};
