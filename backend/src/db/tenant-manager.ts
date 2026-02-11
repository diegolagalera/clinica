import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema.js';
import { centralDb } from './central-db.js';
import { tenants } from './central-schema.js';
import { logger } from '../utils/logger.js';
import type { Database } from './index.js';

// ============================================================================
// Tenant Connection Manager
// Maintains a pool of database connections, one per active tenant.
// Connections are cached and automatically cleaned up after idle timeout.
// ============================================================================

interface TenantConnection {
    db: Database;
    sql: Sql;
    lastAccessedAt: number;
    slug: string;
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
const POOL_SIZE_PER_TENANT = 10;

class TenantManager {
    private connections = new Map<string, TenantConnection>();
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        this.startCleanupJob();
    }

    /**
     * Get or create a database connection for a tenant by slug.
     * Connections are cached and reused.
     */
    async getConnection(tenantSlug: string): Promise<Database> {
        const existing = this.connections.get(tenantSlug);
        if (existing) {
            existing.lastAccessedAt = Date.now();
            return existing.db;
        }

        // Look up tenant in central DB
        const tenant = await centralDb.query.tenants.findFirst({
            where: eq(tenants.slug, tenantSlug),
        });

        if (!tenant || !tenant.isActive) {
            throw new Error(`Tenant "${tenantSlug}" not found or inactive`);
        }

        return this.createConnection(tenant.slug, tenant.databaseUrl);
    }

    /**
     * Get a connection using a known database URL (for provisioning).
     */
    async getConnectionByUrl(slug: string, databaseUrl: string): Promise<Database> {
        const existing = this.connections.get(slug);
        if (existing) {
            existing.lastAccessedAt = Date.now();
            return existing.db;
        }

        return this.createConnection(slug, databaseUrl);
    }

    /**
     * Create a new database connection for a tenant.
     */
    private createConnection(slug: string, databaseUrl: string): Database {
        logger.info({ slug }, 'Creating new tenant database connection');

        const sqlClient = postgres(databaseUrl, {
            max: POOL_SIZE_PER_TENANT,
            idle_timeout: 20,
            connect_timeout: 10,
        });

        const db = drizzle(sqlClient, { schema }) as Database;

        this.connections.set(slug, {
            db,
            sql: sqlClient,
            lastAccessedAt: Date.now(),
            slug,
        });

        return db;
    }

    /**
     * Close a specific tenant's connection.
     */
    async closeConnection(slug: string): Promise<void> {
        const conn = this.connections.get(slug);
        if (conn) {
            logger.info({ slug }, 'Closing tenant database connection');
            await conn.sql.end();
            this.connections.delete(slug);
        }
    }

    /**
     * Close all tenant connections (for graceful shutdown).
     */
    async closeAll(): Promise<void> {
        logger.info(`Closing all tenant connections (${this.connections.size} active)`);
        const promises: Promise<void>[] = [];
        for (const [slug, conn] of this.connections) {
            promises.push(
                conn.sql.end().then(() => {
                    logger.debug({ slug }, 'Tenant connection closed');
                }),
            );
        }
        await Promise.all(promises);
        this.connections.clear();

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Remove idle connections that haven't been used recently.
     */
    private async cleanupIdleConnections(): Promise<void> {
        const now = Date.now();
        const toRemove: string[] = [];

        for (const [slug, conn] of this.connections) {
            if (now - conn.lastAccessedAt > IDLE_TIMEOUT_MS) {
                toRemove.push(slug);
            }
        }

        if (toRemove.length > 0) {
            logger.info(`Cleaning up ${toRemove.length} idle tenant connections`);
            for (const slug of toRemove) {
                await this.closeConnection(slug);
            }
        }
    }

    /**
     * Start the periodic cleanup job.
     */
    private startCleanupJob(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupIdleConnections().catch((err) => {
                logger.error({ err }, 'Error cleaning up idle tenant connections');
            });
        }, CLEANUP_INTERVAL_MS);

        // Don't let the cleanup interval prevent Node.js from exiting
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    /**
     * Get the number of active connections (for monitoring).
     */
    getActiveConnectionCount(): number {
        return this.connections.size;
    }

    /**
     * Get info about all active connections (for monitoring/admin).
     */
    getConnectionStats(): Array<{ slug: string; lastAccessedAt: number; idleMs: number }> {
        const now = Date.now();
        return Array.from(this.connections.entries()).map(([slug, conn]) => ({
            slug,
            lastAccessedAt: conn.lastAccessedAt,
            idleMs: now - conn.lastAccessedAt,
        }));
    }
}

// Singleton instance
export const tenantManager = new TenantManager();
