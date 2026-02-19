import { lt, and, isNotNull, or, eq } from 'drizzle-orm';
import { centralDb } from '../db/central-db.js';
import { superadminRefreshTokens, tenants } from '../db/central-schema.js';
import { tenantManager } from '../db/tenant-manager.js';
import { refreshTokens } from '../db/schema.js';
import { users } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import type { Database } from '../db/index.js';

/**
 * Purge expired or revoked refresh tokens older than the retention period.
 * Also clean up expired password reset tokens.
 */
const RETENTION_DAYS = 7; // Keep revoked/expired tokens for 7 days for debugging

/**
 * Clean up old tokens for a single tenant database.
 */
const cleanupTenantTokens = async (db: Database, tenantSlug: string): Promise<{ deletedTokens: number; clearedResetTokens: number }> => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    // Delete refresh tokens that are revoked OR expired, and older than retention period
    const deletedTokens = await db.delete(refreshTokens)
        .where(
            or(
                // Revoked tokens older than retention
                and(
                    isNotNull(refreshTokens.revokedAt),
                    lt(refreshTokens.revokedAt, cutoff),
                ),
                // Expired tokens older than retention
                lt(refreshTokens.expiresAt, cutoff),
            )
        )
        .returning({ id: refreshTokens.id });

    // Clear expired password reset tokens
    const now = new Date();
    const clearedResetTokens = await db.update(users)
        .set({
            passwordResetToken: null,
            passwordResetExpires: null,
        })
        .where(
            and(
                isNotNull(users.passwordResetToken),
                lt(users.passwordResetExpires!, now),
            )
        )
        .returning({ id: users.id });

    return {
        deletedTokens: deletedTokens.length,
        clearedResetTokens: clearedResetTokens.length,
    };
};

/**
 * Clean up SuperAdmin refresh tokens in central DB.
 */
const cleanupSuperadminTokens = async (): Promise<number> => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const deleted = await centralDb.delete(superadminRefreshTokens)
        .where(
            or(
                and(
                    isNotNull(superadminRefreshTokens.revokedAt),
                    lt(superadminRefreshTokens.revokedAt, cutoff),
                ),
                lt(superadminRefreshTokens.expiresAt, cutoff),
            )
        )
        .returning({ id: superadminRefreshTokens.id });

    return deleted.length;
};

/**
 * Run the full token cleanup across all tenants + central DB.
 */
export const processTokenCleanup = async (): Promise<void> => {
    logger.info('🔐 Starting auth token cleanup...');

    try {
        // 1. Clean up SuperAdmin tokens
        const saDeleted = await cleanupSuperadminTokens();
        if (saDeleted > 0) {
            logger.info({ deleted: saDeleted }, '🔐 Cleaned up SuperAdmin refresh tokens');
        }

        // 2. Clean up tenant tokens
        const allTenants = await centralDb.query.tenants.findMany({
            where: eq(tenants.isActive, true),
        });

        let totalDeleted = saDeleted;
        let totalResetCleared = 0;

        for (const tenant of allTenants) {
            try {
                const db = await tenantManager.getConnection(tenant.slug);
                const result = await cleanupTenantTokens(db, tenant.slug);
                totalDeleted += result.deletedTokens;
                totalResetCleared += result.clearedResetTokens;

                if (result.deletedTokens > 0 || result.clearedResetTokens > 0) {
                    logger.info(
                        { tenantSlug: tenant.slug, ...result },
                        '🔐 Cleaned up tenant tokens'
                    );
                }
            } catch (err) {
                logger.error({ tenantSlug: tenant.slug, err }, 'Failed to clean up tokens for tenant');
            }
        }

        logger.info(
            { totalDeletedTokens: totalDeleted, totalResetCleared },
            '🔐 Auth token cleanup complete'
        );
    } catch (err) {
        logger.error({ err }, 'Fatal error during auth token cleanup');
    }
};

/**
 * Start the auth token cleanup scheduler (runs daily at 4:00 AM, after the message cleanup at 3:00 AM)
 */
export const startTokenCleanupScheduler = (): void => {
    logger.info('Starting auth token cleanup scheduler...');

    const runDaily = () => {
        const now = new Date();
        const next4AM = new Date(now);
        next4AM.setHours(4, 0, 0, 0);

        // If 4 AM has already passed today, schedule for tomorrow
        if (now >= next4AM) {
            next4AM.setDate(next4AM.getDate() + 1);
        }

        const msUntilNext = next4AM.getTime() - now.getTime();

        setTimeout(async () => {
            try {
                await processTokenCleanup();
            } catch (err) {
                logger.error(`Token cleanup scheduler error: ${(err as Error).message}`);
            }
            // Schedule next run
            runDaily();
        }, msUntilNext);
    };

    runDaily();
    logger.info('Auth token cleanup scheduler started (runs daily at 4:00 AM)');
};
