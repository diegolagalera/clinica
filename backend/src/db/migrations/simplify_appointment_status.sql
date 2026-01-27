-- Migration: Simplify appointment_status enum
-- This migration removes CONFIRMED and IN_PROGRESS statuses

-- Step 1: Update existing appointments with old statuses to SCHEDULED
UPDATE appointments 
SET status = 'SCHEDULED' 
WHERE status IN ('CONFIRMED', 'IN_PROGRESS');

-- Step 2: Create new enum type without the removed values
CREATE TYPE appointment_status_new AS ENUM (
    'SCHEDULED',
    'COMPLETED', 
    'CANCELLED',
    'NO_SHOW'
);

-- Step 3: Alter the column to use the new enum
ALTER TABLE appointments 
    ALTER COLUMN status TYPE appointment_status_new 
    USING status::text::appointment_status_new;

-- Step 4: Drop the old enum and rename new one
DROP TYPE appointment_status;
ALTER TYPE appointment_status_new RENAME TO appointment_status;

-- Verify the migration
SELECT column_name, udt_name 
FROM information_schema.columns 
WHERE table_name = 'appointments' AND column_name = 'status';
