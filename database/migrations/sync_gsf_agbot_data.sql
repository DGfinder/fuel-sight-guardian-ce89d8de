-- Migration: Sync AgBot Data to great_southern_fuels Schema
-- Description: Update gsf agbot tables with latest data from public schema
-- Author: Claude Code
-- Date: 2025-12-04
-- Purpose: Bring gsf agbot data up-to-date before application cutover
--
-- IMPORTANT: This TRUNCATES and re-copies agbot data to ensure freshness

DO $$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  duration INTERVAL;
  total_rows INTEGER := 0;
  rows_copied INTEGER;
BEGIN
  start_time := clock_timestamp();

  RAISE NOTICE '============================================';
  RAISE NOTICE 'SYNCING AGBOT DATA TO GSF SCHEMA';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Target: great_southern_fuels.ta_agbot_*';
  RAISE NOTICE 'Mode: TRUNCATE & COPY (fresh sync)';
  RAISE NOTICE '';

  -- =============================================================================
  -- STEP 1: Truncate existing data (CASCADE to handle FKs)
  -- =============================================================================

  RAISE NOTICE '[1/7] Truncating ta_agbot_readings (cascade)...';
  TRUNCATE TABLE great_southern_fuels.ta_agbot_readings CASCADE;
  RAISE NOTICE '  ✓ Truncated';

  RAISE NOTICE '[2/7] Truncating ta_agbot_device_health...';
  TRUNCATE TABLE great_southern_fuels.ta_agbot_device_health CASCADE;
  RAISE NOTICE '  ✓ Truncated';

  RAISE NOTICE '[3/7] Truncating ta_agbot_alerts...';
  TRUNCATE TABLE great_southern_fuels.ta_agbot_alerts CASCADE;
  RAISE NOTICE '  ✓ Truncated';

  RAISE NOTICE '[4/7] Truncating ta_agbot_assets (cascade)...';
  TRUNCATE TABLE great_southern_fuels.ta_agbot_assets CASCADE;
  RAISE NOTICE '  ✓ Truncated';

  RAISE NOTICE '[5/7] Truncating ta_agbot_locations (cascade)...';
  TRUNCATE TABLE great_southern_fuels.ta_agbot_locations CASCADE;
  RAISE NOTICE '  ✓ Truncated';

  RAISE NOTICE '[6/7] Truncating ta_agbot_sync_log...';
  TRUNCATE TABLE great_southern_fuels.ta_agbot_sync_log;
  RAISE NOTICE '  ✓ Truncated';

  RAISE NOTICE '';

  -- =============================================================================
  -- STEP 2: Copy fresh data from public schema
  -- =============================================================================

  RAISE NOTICE 'Copying fresh data...';
  RAISE NOTICE '';

  RAISE NOTICE '[1/6] Copying ta_agbot_locations...';
  INSERT INTO great_southern_fuels.ta_agbot_locations
  SELECT * FROM public.ta_agbot_locations;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[2/6] Copying ta_agbot_assets...';
  INSERT INTO great_southern_fuels.ta_agbot_assets
  SELECT * FROM public.ta_agbot_assets;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  -- ta_agbot_readings may be large - batch copy
  RAISE NOTICE '[3/6] Copying ta_agbot_readings (batched)...';
  DECLARE
    batch_size INTEGER := 10000;
    offset_val INTEGER := 0;
    batch_rows INTEGER;
    total_readings INTEGER;
  BEGIN
    SELECT COUNT(*) INTO total_readings FROM public.ta_agbot_readings;
    RAISE NOTICE '  Total readings to copy: %', total_readings;

    LOOP
      INSERT INTO great_southern_fuels.ta_agbot_readings
      SELECT * FROM public.ta_agbot_readings
      ORDER BY id
      LIMIT batch_size OFFSET offset_val;

      GET DIAGNOSTICS batch_rows = ROW_COUNT;
      EXIT WHEN batch_rows = 0;

      offset_val := offset_val + batch_rows;
      total_rows := total_rows + batch_rows;
      RAISE NOTICE '  Progress: %/%  (%.1f%%)',
        offset_val, total_readings,
        (offset_val::FLOAT / NULLIF(total_readings, 0) * 100);

      PERFORM pg_sleep(0.05);
    END LOOP;

    RAISE NOTICE '  ✓ Copied % rows', offset_val;
  END;

  RAISE NOTICE '[4/6] Copying ta_agbot_device_health...';
  INSERT INTO great_southern_fuels.ta_agbot_device_health
  SELECT * FROM public.ta_agbot_device_health;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[5/6] Copying ta_agbot_alerts...';
  INSERT INTO great_southern_fuels.ta_agbot_alerts
  SELECT * FROM public.ta_agbot_alerts;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[6/6] Copying ta_agbot_sync_log...';
  INSERT INTO great_southern_fuels.ta_agbot_sync_log
  SELECT * FROM public.ta_agbot_sync_log;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  -- =============================================================================
  -- STEP 3: Verification
  -- =============================================================================

  RAISE NOTICE '';
  RAISE NOTICE 'Verifying data integrity...';

  -- Check row counts match
  DECLARE
    public_loc_count INTEGER;
    gsf_loc_count INTEGER;
    public_asset_count INTEGER;
    gsf_asset_count INTEGER;
    public_reading_count INTEGER;
    gsf_reading_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO public_loc_count FROM public.ta_agbot_locations;
    SELECT COUNT(*) INTO gsf_loc_count FROM great_southern_fuels.ta_agbot_locations;

    SELECT COUNT(*) INTO public_asset_count FROM public.ta_agbot_assets;
    SELECT COUNT(*) INTO gsf_asset_count FROM great_southern_fuels.ta_agbot_assets;

    SELECT COUNT(*) INTO public_reading_count FROM public.ta_agbot_readings;
    SELECT COUNT(*) INTO gsf_reading_count FROM great_southern_fuels.ta_agbot_readings;

    RAISE NOTICE '  Locations: public=%, gsf=%', public_loc_count, gsf_loc_count;
    RAISE NOTICE '  Assets: public=%, gsf=%', public_asset_count, gsf_asset_count;
    RAISE NOTICE '  Readings: public=%, gsf=%', public_reading_count, gsf_reading_count;

    IF public_loc_count != gsf_loc_count THEN
      RAISE EXCEPTION 'Location count mismatch!';
    END IF;
    IF public_asset_count != gsf_asset_count THEN
      RAISE EXCEPTION 'Asset count mismatch!';
    END IF;
    IF public_reading_count != gsf_reading_count THEN
      RAISE EXCEPTION 'Reading count mismatch!';
    END IF;

    RAISE NOTICE '  ✓ All counts match!';
  END;

  -- =============================================================================
  -- COMPLETION SUMMARY
  -- =============================================================================

  end_time := clock_timestamp();
  duration := end_time - start_time;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'AGBOT DATA SYNC COMPLETE';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total rows copied: %', total_rows;
  RAISE NOTICE 'Duration: %', duration;
  RAISE NOTICE 'GSF schema is now up-to-date with public';
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Update application to use gsf schema';
  RAISE NOTICE '============================================';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'AgBot data sync failed: %', SQLERRM;
    RAISE NOTICE 'ERROR: Sync incomplete';
    RAISE NOTICE 'GSF schema may have partial data - re-run migration';
END $$;
