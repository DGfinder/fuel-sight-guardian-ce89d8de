-- Migration: Drop Dip Sync Trigger and Deprecate dip_readings Table
-- Date: 2025-12-05
-- Purpose: Remove sync from dip_readings to ta_tank_dips, deprecate legacy table
-- Risk Level: MEDIUM - Stops sync, but new code writes directly to ta_tank_dips
-- Status: NEW writes go to ta_tank_dips, OLD reads from dip_readings (5 days behind)

-- Background:
-- - ta_tank_dips is 5 days ahead with 227 MORE rows (13,225 vs 12,998)
-- - New code (useDipMutations, useBulkDipEntry) writes directly to ta_tank_dips
-- - Sync trigger is no longer needed

-- Step 1: Drop the sync trigger and function
DROP TRIGGER IF EXISTS tr_sync_dip_readings_to_ta ON dip_readings;
DROP FUNCTION IF EXISTS sync_dip_to_ta_tank_dips();

COMMENT ON TABLE dip_readings IS
  'DEPRECATED 2025-12-05: Replaced by ta_tank_dips. This table is 5 days behind (latest: 2025-11-30 vs 2025-12-05 in ta_tank_dips). New writes go to ta_tank_dips. Some legacy read queries still use this table. Migration in progress. Scheduled for removal after all queries migrated.';

-- Summary
DO $$
DECLARE
  dip_readings_count INTEGER;
  ta_tank_dips_count INTEGER;
  dip_readings_latest TIMESTAMPTZ;
  ta_tank_dips_latest TIMESTAMPTZ;
BEGIN
  -- Get counts and latest dates
  SELECT COUNT(*), MAX(created_at) INTO dip_readings_count, dip_readings_latest
  FROM dip_readings;

  SELECT COUNT(*), MAX(created_at) INTO ta_tank_dips_count, ta_tank_dips_latest
  FROM ta_tank_dips;

  RAISE NOTICE '================================================';
  RAISE NOTICE 'DIP_READINGS SYNC TRIGGER DROPPED';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'dip_readings: % rows, latest: %', dip_readings_count, dip_readings_latest;
  RAISE NOTICE 'ta_tank_dips: % rows, latest: %', ta_tank_dips_count, ta_tank_dips_latest;
  RAISE NOTICE 'Difference: % rows, % days behind',
    ta_tank_dips_count - dip_readings_count,
    EXTRACT(DAY FROM ta_tank_dips_latest - dip_readings_latest);
  RAISE NOTICE '';
  RAISE NOTICE '✅ Sync trigger dropped';
  RAISE NOTICE '✅ dip_readings table deprecated';
  RAISE NOTICE '⚠️  New writes → ta_tank_dips';
  RAISE NOTICE '⚠️  Legacy reads still from dip_readings (migration in progress)';
  RAISE NOTICE '================================================';
END $$;
