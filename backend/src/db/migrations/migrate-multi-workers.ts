/**
 * Migration script for multi-worker appointments
 * Creates appointment_workers table and migrates existing workerId data
 * 
 * Run with: npx tsx src/db/migrations/migrate-multi-workers.ts
 */

import { db } from '../index.js';
import { sql } from 'drizzle-orm';

async function runMigration() {
    console.log('Starting migration: Multi-worker appointments\n');

    try {
        // Step 1: Create the appointment_workers table
        console.log('Step 1: Creating appointment_workers table...');
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS appointment_workers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                is_primary BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW() NOT NULL,
                UNIQUE(appointment_id, user_id)
            )
        `);
        console.log('✓ Created appointment_workers table\n');

        // Step 2: Create indexes
        console.log('Step 2: Creating indexes...');
        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS appointment_workers_appointment_id_idx 
            ON appointment_workers(appointment_id)
        `);
        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS appointment_workers_user_id_idx 
            ON appointment_workers(user_id)
        `);
        console.log('✓ Created indexes\n');

        // Step 3: Migrate existing workerId data to the junction table
        console.log('Step 3: Migrating existing worker assignments...');
        const result = await db.execute(sql`
            INSERT INTO appointment_workers (appointment_id, user_id, is_primary)
            SELECT id, worker_id, true
            FROM appointments
            WHERE worker_id IS NOT NULL
            ON CONFLICT (appointment_id, user_id) DO NOTHING
        `);
        console.log('✓ Migrated existing worker assignments\n');

        // Step 4: Make workerId nullable (for backwards compatibility)
        console.log('Step 4: Making workerId nullable...');
        await db.execute(sql`
            ALTER TABLE appointments 
            ALTER COLUMN worker_id DROP NOT NULL
        `);
        console.log('✓ Made workerId nullable\n');

        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
