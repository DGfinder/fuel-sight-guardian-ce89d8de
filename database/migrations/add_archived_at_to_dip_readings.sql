-- Migration: Add archived_at column to dip_readings table
-- Purpose: Support archiving of superseded same-day dip readings instead of deletion
-- This allows maintaining audit trail while ensuring only one active reading per tank per day

-- Add the archived_at column
ALTER TABLE dip_readings 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for performance when filtering active readings
CREATE INDEX IF NOT EXISTS idx_dip_readings_active 
ON dip_readings (tank_id, created_at) 
WHERE archived_at IS NULL;

-- Create index for archived readings queries
CREATE INDEX IF NOT EXISTS idx_dip_readings_archived 
ON dip_readings (archived_at) 
WHERE archived_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN dip_readings.archived_at IS 'Timestamp when reading was archived (superseded by newer same-day reading). NULL means active reading.';

SELECT 'Successfully added archived_at column to dip_readings table' as result;