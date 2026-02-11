/**
 * Migration: Add permissions column to worker_clinics table
 * Run: npx tsx src/db/migrate-permissions.ts
 */
import { db } from './index.js';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

async function migrate() {
    logger.info('Starting permissions migration...');

    try {
        // Add permissions column if it doesn't exist
        await db.execute(sql`
            ALTER TABLE worker_clinics 
            ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]'::jsonb NOT NULL
        `);
        logger.info('✅ Added permissions column to worker_clinics');

        logger.info('✅ Permissions migration completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error({ error }, '❌ Permissions migration failed');
        process.exit(1);
    }
}

migrate();
