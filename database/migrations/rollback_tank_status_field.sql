-- Rollback migration for tank status field
-- Migration: rollback_tank_status_field.sql
-- This removes the status field and related changes

-- First, set any archived tanks back to active if needed
UPDATE fuel_tanks 
SET status = 'active'
WHERE status IN ('archived', 'decommissioned');

-- Drop the index
DROP INDEX IF EXISTS idx_fuel_tanks_status;

-- Remove the status column
ALTER TABLE fuel_tanks 
DROP COLUMN IF EXISTS status;

-- Drop the enum type
DROP TYPE IF EXISTS tank_status_enum;

-- Verification
SELECT 'Tank status field removed successfully' as result;