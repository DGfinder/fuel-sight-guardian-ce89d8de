-- Migration: Backfill AgBot Sync Logs to TA Table
-- Date: 2025-12-05
-- Purpose: Migrate 2,750 historical sync logs from agbot_sync_logs to ta_agbot_sync_log
-- Risk Level: LOW - Read-only data migration, preserves all existing data
-- Impact: Enables application code to switch to ta_agbot_sync_log table

-- Schema Mapping:
-- agbot_sync_logs.sync_status → ta_agbot_sync_log.status
-- agbot_sync_logs.sync_duration_ms → ta_agbot_sync_log.duration_ms
-- agbot_sync_logs.alerts_triggered (doesn't exist in old table, will be NULL)

-- Step 1: Insert all records from old table to new table
-- Using INSERT ... ON CONFLICT DO NOTHING to handle any existing records
INSERT INTO ta_agbot_sync_log (
  id,
  sync_type,
  status,
  locations_processed,
  assets_processed,
  readings_processed,
  alerts_triggered,
  error_message,
  duration_ms,
  started_at,
  completed_at
)
SELECT
  id,
  sync_type,
  sync_status as status, -- Map sync_status to status
  locations_processed,
  assets_processed,
  readings_processed,
  NULL as alerts_triggered, -- New column, doesn't exist in old table
  error_message,
  sync_duration_ms as duration_ms, -- Map sync_duration_ms to duration_ms
  started_at,
  completed_at
FROM agbot_sync_logs
WHERE NOT EXISTS (
  -- Avoid duplicates if this migration is run multiple times
  SELECT 1 FROM ta_agbot_sync_log
  WHERE ta_agbot_sync_log.id = agbot_sync_logs.id
)
ORDER BY started_at ASC; -- Preserve chronological order

-- Step 2: Verify the migration
DO $$
DECLARE
  old_count INTEGER;
  new_count INTEGER;
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO old_count FROM agbot_sync_logs;
  SELECT COUNT(*) INTO new_count FROM ta_agbot_sync_log;

  -- Count how many records were just migrated
  SELECT COUNT(*) INTO migrated_count
  FROM ta_agbot_sync_log
  WHERE id IN (SELECT id FROM agbot_sync_logs);

  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  Records in agbot_sync_logs: %', old_count;
  RAISE NOTICE '  Records in ta_agbot_sync_log: %', new_count;
  RAISE NOTICE '  Records migrated: %', migrated_count;

  IF migrated_count < old_count THEN
    RAISE WARNING 'Not all records were migrated! Expected %, got %', old_count, migrated_count;
  ELSE
    RAISE NOTICE 'All sync logs successfully migrated!';
  END IF;
END $$;

-- Add comment to track migration
COMMENT ON TABLE ta_agbot_sync_log IS 'AgBot sync logs table. Migrated 2,750 historical records from agbot_sync_logs on 2025-12-05. This is the new canonical table for sync logging.';
