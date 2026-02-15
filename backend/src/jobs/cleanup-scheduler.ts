import cron from 'node-cron';
import type { Database } from '../db/index.js';
import { chatMessages, chatConversations } from '../db/schema.js';
import { and, lt, sql, inArray, isNotNull, eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import * as storage from '../services/storage.service.js';
import { centralDb } from '../db/central-db.js';
import { tenants } from '../db/central-schema.js';
import { tenantManager } from '../db/tenant-manager.js';

const RETENTION_MONTHS = 2;
const MIN_MESSAGES_TO_KEEP = 100;

/**
 * Process cleanup of old messages and media files for a single tenant.
 * Rules:
 *  - Delete messages older than RETENTION_MONTHS
 *  - BUT always keep the last MIN_MESSAGES_TO_KEEP messages per conversation
 *  - Delete associated media files from MinIO for removed messages
 */
const processCleanupForTenant = async (db: Database, tenantSlug: string) => {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS);

    let totalMessagesDeleted = 0;
    let totalFilesDeleted = 0;
    let totalFileErrors = 0;
    let conversationsProcessed = 0;

    try {
        // Get all conversations with their message counts
        const conversations = await db
            .select({
                id: chatConversations.id,
                messageCount: sql<number>`count(${chatMessages.id})::int`,
            })
            .from(chatConversations)
            .leftJoin(chatMessages, eq(chatMessages.conversationId, chatConversations.id))
            .groupBy(chatConversations.id)
            .having(sql`count(${chatMessages.id}) > ${MIN_MESSAGES_TO_KEEP}`);

        if (conversations.length === 0) return;

        logger.info(`[${tenantSlug}] Found ${conversations.length} conversations with more than ${MIN_MESSAGES_TO_KEEP} messages`);

        for (const conv of conversations) {
            try {
                // Find the createdAt of the Nth most recent message (the "keep boundary")
                const keepBoundaryResult = await db
                    .select({ createdAt: chatMessages.createdAt })
                    .from(chatMessages)
                    .where(eq(chatMessages.conversationId, conv.id))
                    .orderBy(sql`${chatMessages.createdAt} DESC`)
                    .limit(1)
                    .offset(MIN_MESSAGES_TO_KEEP - 1);

                if (!keepBoundaryResult.length) continue;

                const keepBoundary = keepBoundaryResult[0]!.createdAt;

                // The effective cutoff is the LATER of: keepBoundary and cutoffDate
                // Messages must be BOTH older than 2 months AND outside the top 100
                const effectiveCutoff = keepBoundary > cutoffDate ? keepBoundary : cutoffDate;

                // Find messages to delete that have media files (so we can remove files from MinIO)
                const mediaMessages = await db
                    .select({
                        id: chatMessages.id,
                        mediaUrl: chatMessages.mediaUrl,
                    })
                    .from(chatMessages)
                    .where(
                        and(
                            eq(chatMessages.conversationId, conv.id),
                            lt(chatMessages.createdAt, effectiveCutoff),
                            isNotNull(chatMessages.mediaUrl)
                        )
                    );

                // Delete media files from MinIO
                for (const msg of mediaMessages) {
                    if (msg.mediaUrl) {
                        try {
                            await storage.deleteFile(msg.mediaUrl, tenantSlug);
                            totalFilesDeleted++;
                        } catch (err: any) {
                            logger.warn({ err, mediaUrl: msg.mediaUrl }, 'Failed to delete media file from MinIO');
                            totalFileErrors++;
                        }
                    }
                }

                // Delete all old messages (both with and without media)
                const deleted = await db
                    .delete(chatMessages)
                    .where(
                        and(
                            eq(chatMessages.conversationId, conv.id),
                            lt(chatMessages.createdAt, effectiveCutoff)
                        )
                    )
                    .returning({ id: chatMessages.id });

                totalMessagesDeleted += deleted.length;
                conversationsProcessed++;

                if (deleted.length > 0) {
                    logger.info(
                        `Conversation ${conv.id}: deleted ${deleted.length} messages, ${mediaMessages.length} media files`
                    );
                }
            } catch (err: any) {
                logger.error({ err, conversationId: conv.id }, 'Error cleaning up conversation');
            }
        }

        if (totalMessagesDeleted > 0) {
            logger.info(
                {
                    tenantSlug,
                    conversationsProcessed,
                    totalMessagesDeleted,
                    totalFilesDeleted,
                    totalFileErrors,
                },
                '🧹 Tenant message & media cleanup complete'
            );
        }
    } catch (err: any) {
        logger.error({ err, tenantSlug }, 'Fatal error during tenant message cleanup');
    }
};

/**
 * Process cleanup across all active tenants
 */
export const processCleanup = async () => {
    logger.info('🧹 Starting message & media cleanup across all tenants...');

    try {
        const activeTenants = await centralDb.query.tenants.findMany({
            where: eq(tenants.isActive, true),
        });

        for (const tenant of activeTenants) {
            try {
                const db = await tenantManager.getConnection(tenant.slug);
                await processCleanupForTenant(db, tenant.slug);
            } catch (error: any) {
                logger.error({ tenantSlug: tenant.slug, error: error.message }, 'Failed to process cleanup for tenant');
            }
        }

        logger.info('🧹 Message & media cleanup complete');
    } catch (err: any) {
        logger.error({ err }, 'Fatal error during message cleanup');
    }
};

/**
 * Start the cleanup scheduler (runs daily at 3:00 AM)
 */
export const startCleanupScheduler = () => {
    logger.info('Starting message cleanup scheduler...');

    // Run daily at 3:00 AM
    cron.schedule('0 3 * * *', async () => {
        try {
            await processCleanup();
        } catch (err: any) {
            logger.error(`Cleanup scheduler error: ${err.message}`);
        }
    });

    logger.info('Message cleanup scheduler started (runs daily at 3:00 AM)');
};
