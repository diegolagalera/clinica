"use strict";
/**
 * Migration script to simplify appointment_status enum
 * Removes CONFIRMED and IN_PROGRESS, updates existing records to SCHEDULED
 *
 * Run with: npx tsx src/db/migrations/run-simplify-status.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../index.js");
const drizzle_orm_1 = require("drizzle-orm");
async function runMigration() {
    console.log('Starting migration: Simplify appointment_status enum\n');
    try {
        // Step 1: Update existing appointments with old statuses to SCHEDULED
        console.log('Step 1: Updating CONFIRMED/IN_PROGRESS appointments to SCHEDULED...');
        await index_js_1.db.execute((0, drizzle_orm_1.sql) `
            UPDATE appointments 
            SET status = 'SCHEDULED' 
            WHERE status IN ('CONFIRMED', 'IN_PROGRESS')
        `);
        console.log('✓ Updated existing appointments\n');
        // Step 2: Drop the default value temporarily  
        console.log('Step 2: Dropping default value from status column...');
        await index_js_1.db.execute((0, drizzle_orm_1.sql) `ALTER TABLE appointments ALTER COLUMN status DROP DEFAULT`);
        console.log('✓ Dropped default value\n');
        // Step 3: Clean up any leftover temp enum and create new one
        console.log('Step 3: Creating new appointment_status enum...');
        await index_js_1.db.execute((0, drizzle_orm_1.sql) `DROP TYPE IF EXISTS appointment_status_new`);
        await index_js_1.db.execute((0, drizzle_orm_1.sql) `
            CREATE TYPE appointment_status_new AS ENUM (
                'SCHEDULED',
                'COMPLETED', 
                'CANCELLED',
                'NO_SHOW'
            )
        `);
        console.log('✓ Created new enum type\n');
        // Step 4: Alter the column to use the new enum
        console.log('Step 4: Altering appointments table to use new enum...');
        await index_js_1.db.execute((0, drizzle_orm_1.sql) `
            ALTER TABLE appointments 
            ALTER COLUMN status TYPE appointment_status_new 
            USING status::text::appointment_status_new
        `);
        console.log('✓ Updated appointments table\n');
        // Step 5: Drop the old enum and rename new one
        console.log('Step 5: Dropping old enum and renaming...');
        await index_js_1.db.execute((0, drizzle_orm_1.sql) `DROP TYPE appointment_status`);
        await index_js_1.db.execute((0, drizzle_orm_1.sql) `ALTER TYPE appointment_status_new RENAME TO appointment_status`);
        console.log('✓ Finalized enum renaming\n');
        // Step 6: Restore the default value
        console.log('Step 6: Restoring default value...');
        await index_js_1.db.execute((0, drizzle_orm_1.sql) `ALTER TABLE appointments ALTER COLUMN status SET DEFAULT 'SCHEDULED'`);
        console.log('✓ Restored default value\n');
        console.log('✅ Migration completed successfully!');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}
runMigration();
//# sourceMappingURL=run-simplify-status.js.map