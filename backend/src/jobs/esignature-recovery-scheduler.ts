import cron from 'node-cron';
import type { Database } from '../db/index.js';
import { signingDocuments } from '../db/schema.js';
import { and, eq, isNull, isNotNull, lt, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import * as storage from '../services/storage.service.js';
import * as signnowService from '../services/signnow.service.js';
import { centralDb } from '../db/central-db.js';
import { tenants } from '../db/central-schema.js';
import { tenantManager } from '../db/tenant-manager.js';

/**
 * Maximum number of documents to recover in a single scheduler run per tenant.
 * Prevents overloading SignNow API or S3 if many documents are orphaned.
 */
const MAX_RECOVERY_PER_RUN = 20;

/**
 * Delay between individual document recoveries (ms).
 * Avoids hitting SignNow API rate limits.
 */
const RECOVERY_DELAY_MS = 3000;

/**
 * Simple sleep utility
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Recover orphaned signed PDFs for a single tenant.
 * Finds documents that are marked SIGNED but have no PDF stored in S3,
 * re-downloads them from SignNow, and uploads to S3.
 */
const recoverOrphanedPdfsForTenant = async (db: Database, tenantSlug: string): Promise<void> => {
    try {
        // Find signed documents missing their PDF in storage
        const orphanedDocs = await db
            .select({
                id: signingDocuments.id,
                signnowDocumentId: signingDocuments.signnowDocumentId,
                clinicId: signingDocuments.clinicId,
            })
            .from(signingDocuments)
            .where(
                and(
                    eq(signingDocuments.status, 'SIGNED'),
                    isNull(signingDocuments.signedPdfStorageKey)
                )
            )
            .limit(MAX_RECOVERY_PER_RUN);

        if (orphanedDocs.length === 0) return;

        logger.info(
            { tenantSlug, count: orphanedDocs.length },
            `📄 Found ${orphanedDocs.length} signed documents missing PDF — starting recovery`
        );

        let recovered = 0;
        let failed = 0;

        for (let i = 0; i < orphanedDocs.length; i++) {
            const doc = orphanedDocs[i]!;
            if (!doc.signnowDocumentId) {
                // No SignNow document ID — can't recover
                failed++;
                continue;
            }

            try {
                // Download signed PDF from SignNow
                const pdfBuffer = await signnowService.downloadSignedDocument(doc.signnowDocumentId);

                // Upload to S3
                const key = storage.buildKey(
                    '',
                    doc.clinicId,
                    'esignature',
                    'signed',
                    `${doc.id}_signed.pdf`
                );
                await storage.uploadFile(key, pdfBuffer, 'application/pdf', tenantSlug);

                // Update DB with the storage key
                await db
                    .update(signingDocuments)
                    .set({
                        signedPdfStorageKey: key,
                        updatedAt: new Date(),
                    })
                    .where(eq(signingDocuments.id, doc.id));

                recovered++;
                logger.info(
                    { tenantSlug, documentId: doc.id },
                    `📄 Recovered signed PDF for document ${doc.id}`
                );
            } catch (err: any) {
                failed++;
                logger.warn(
                    { tenantSlug, documentId: doc.id, error: err.message },
                    `📄 Failed to recover PDF for document ${doc.id}`
                );
            }

            // Rate limit: wait between downloads to avoid hitting SignNow limits
            if (i < orphanedDocs.length - 1) {
                await sleep(RECOVERY_DELAY_MS);
            }
        }

        logger.info(
            { tenantSlug, recovered, failed, total: orphanedDocs.length },
            `📄 PDF recovery complete for tenant ${tenantSlug}`
        );
    } catch (err: any) {
        logger.error({ err, tenantSlug }, 'Fatal error during PDF recovery for tenant');
    }
};

/**
 * Expire documents that have passed their expiresAt date for a single tenant.
 * Finds DRAFT/PENDING documents past their expiresAt, cancels invites in SignNow,
 * deletes the SignNow document, and marks them as EXPIRED in the DB.
 */
const expireDocumentsForTenant = async (db: Database, tenantSlug: string): Promise<void> => {
    try {
        const now = new Date();

        // Find documents that are DRAFT or PENDING and past their expiration
        const expiredDocs = await db
            .select({
                id: signingDocuments.id,
                signnowDocumentId: signingDocuments.signnowDocumentId,
                status: signingDocuments.status,
            })
            .from(signingDocuments)
            .where(
                and(
                    inArray(signingDocuments.status, ['DRAFT', 'PENDING']),
                    isNotNull(signingDocuments.expiresAt),
                    lt(signingDocuments.expiresAt, now)
                )
            )
            .limit(50);

        if (expiredDocs.length === 0) return;

        logger.info(
            { tenantSlug, count: expiredDocs.length },
            `⏰ Found ${expiredDocs.length} expired signing documents — marking as EXPIRED`
        );

        let expired = 0;

        for (const doc of expiredDocs) {
            // Clean up in SignNow (best-effort)
            if (doc.signnowDocumentId) {
                try {
                    if (doc.status === 'PENDING') {
                        await signnowService.cancelInvites(doc.signnowDocumentId);
                    }
                    await signnowService.deleteDocument(doc.signnowDocumentId);
                } catch (err: any) {
                    // Non-critical — document might already be gone
                    logger.debug(
                        { tenantSlug, documentId: doc.id, error: err.message },
                        'SignNow cleanup warning during expiration'
                    );
                }
            }

            // Mark as EXPIRED in DB
            await db
                .update(signingDocuments)
                .set({
                    status: 'EXPIRED',
                    updatedAt: new Date(),
                })
                .where(eq(signingDocuments.id, doc.id));

            expired++;
        }

        logger.info(
            { tenantSlug, expired, total: expiredDocs.length },
            `⏰ Document expiration complete for tenant ${tenantSlug}`
        );
    } catch (err: any) {
        logger.error({ err, tenantSlug }, 'Fatal error during document expiration for tenant');
    }
};

/**
 * Run PDF recovery across all active tenants.
 */
export const processSignedPdfRecovery = async (): Promise<void> => {
    // Skip if SignNow is not configured
    if (!signnowService.checkConfiguration()) {
        return;
    }

    logger.info('📄 Starting e-signature maintenance across all tenants...');

    try {
        const activeTenants = await centralDb.query.tenants.findMany({
            where: eq(tenants.isActive, true),
        });

        for (const tenant of activeTenants) {
            try {
                const db = await tenantManager.getConnection(tenant.slug);
                // 1. Recover orphaned signed PDFs
                await recoverOrphanedPdfsForTenant(db, tenant.slug);
                // 2. Expire documents past their expiresAt date
                await expireDocumentsForTenant(db, tenant.slug);
            } catch (error: any) {
                logger.error(
                    { tenantSlug: tenant.slug, error: error.message },
                    'Failed to process e-signature maintenance for tenant'
                );
            }
        }

        logger.info('📄 E-signature maintenance complete');
    } catch (err: any) {
        logger.error({ err }, 'Fatal error during e-signature maintenance');
    }
};

/**
 * Start the signed PDF recovery scheduler.
 * Runs every 30 minutes to recover orphaned signed PDFs.
 */
export const startSignedPdfRecoveryScheduler = (): void => {
    logger.info('Starting signed PDF recovery scheduler...');

    // Run every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        try {
            await processSignedPdfRecovery();
        } catch (err: any) {
            logger.error(`Signed PDF recovery scheduler error: ${err.message}`);
        }
    });

    logger.info('📄 Signed PDF recovery scheduler started (runs every 30 minutes)');
};
