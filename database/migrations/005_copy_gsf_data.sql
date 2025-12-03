-- Migration: Copy Great Southern Fuels Data
-- Description: Copy all data from public.ta_* to great_southern_fuels.ta_*
-- Author: Claude Code
-- Date: 2025-01-02
-- Phase: 3.2 - Data Copy (NOT MOVE - original data stays in public)
--
-- IMPORTANT: This COPIES data, leaving originals in public schema intact.
-- The live system continues running on public schema during this migration.

-- =============================================================================
-- DATA COPY - ORDERED BY DEPENDENCIES
-- =============================================================================
-- Tables are copied in dependency order to maintain foreign key relationships

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
  RAISE NOTICE 'STARTING DATA COPY TO TENANT SCHEMA';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Source: public.ta_*';
  RAISE NOTICE 'Target: great_southern_fuels.ta_*';
  RAISE NOTICE 'Mode: COPY (original data preserved)';
  RAISE NOTICE '';

  -- =============================================================================
  -- PRIORITY 1: Core Business Tables (Foundation)
  -- =============================================================================

  RAISE NOTICE '[1/25] Copying ta_businesses...';
  INSERT INTO great_southern_fuels.ta_businesses
  SELECT * FROM public.ta_businesses;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[2/25] Copying ta_groups...';
  INSERT INTO great_southern_fuels.ta_groups
  SELECT * FROM public.ta_groups;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[3/25] Copying ta_subgroups...';
  INSERT INTO great_southern_fuels.ta_subgroups
  SELECT * FROM public.ta_subgroups;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[4/25] Copying ta_locations...';
  INSERT INTO great_southern_fuels.ta_locations
  SELECT * FROM public.ta_locations;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[5/25] Copying ta_products...';
  INSERT INTO great_southern_fuels.ta_products
  SELECT * FROM public.ta_products;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  -- =============================================================================
  -- PRIORITY 2: Tank Tables (CRITICAL - may have large datasets)
  -- =============================================================================

  RAISE NOTICE '[6/25] Copying ta_tanks...';
  INSERT INTO great_southern_fuels.ta_tanks
  SELECT * FROM public.ta_tanks;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[7/25] Copying ta_tank_sources...';
  INSERT INTO great_southern_fuels.ta_tank_sources
  SELECT * FROM public.ta_tank_sources;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  -- ta_tank_dips can be MASSIVE (millions of rows) - copy in batches
  RAISE NOTICE '[8/25] Copying ta_tank_dips (may take several minutes for large datasets)...';
  DECLARE
    batch_size INTEGER := 50000;
    offset_val INTEGER := 0;
    batch_rows INTEGER;
    total_dips INTEGER;
  BEGIN
    SELECT COUNT(*) INTO total_dips FROM public.ta_tank_dips;
    RAISE NOTICE '  Total dips to copy: %', total_dips;

    LOOP
      INSERT INTO great_southern_fuels.ta_tank_dips
      SELECT * FROM public.ta_tank_dips
      ORDER BY id
      LIMIT batch_size OFFSET offset_val;

      GET DIAGNOSTICS batch_rows = ROW_COUNT;
      EXIT WHEN batch_rows = 0;

      offset_val := offset_val + batch_rows;
      total_rows := total_rows + batch_rows;
      RAISE NOTICE '  Progress: %/%  (%.1f%%)',
        offset_val, total_dips,
        (offset_val::FLOAT / NULLIF(total_dips, 0) * 100);

      -- Brief pause to prevent DB overload
      PERFORM pg_sleep(0.1);
    END LOOP;

    RAISE NOTICE '  ✓ Copied % rows', offset_val;
  END;

  -- =============================================================================
  -- PRIORITY 3: AgBot Integration Tables
  -- =============================================================================

  RAISE NOTICE '[9/25] Copying ta_agbot_locations...';
  INSERT INTO great_southern_fuels.ta_agbot_locations
  SELECT * FROM public.ta_agbot_locations;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[10/25] Copying ta_agbot_assets...';
  INSERT INTO great_southern_fuels.ta_agbot_assets
  SELECT * FROM public.ta_agbot_assets;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  -- ta_agbot_readings can be large - batch copy
  RAISE NOTICE '[11/25] Copying ta_agbot_readings (batched)...';
  DECLARE
    batch_size INTEGER := 50000;
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

      PERFORM pg_sleep(0.1);
    END LOOP;

    RAISE NOTICE '  ✓ Copied % rows', offset_val;
  END;

  RAISE NOTICE '[12/25] Copying ta_agbot_device_health...';
  INSERT INTO great_southern_fuels.ta_agbot_device_health
  SELECT * FROM public.ta_agbot_device_health;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[13/25] Copying ta_agbot_alerts...';
  INSERT INTO great_southern_fuels.ta_agbot_alerts
  SELECT * FROM public.ta_agbot_alerts;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[14/25] Copying ta_agbot_sync_log...';
  INSERT INTO great_southern_fuels.ta_agbot_sync_log
  SELECT * FROM public.ta_agbot_sync_log;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  -- =============================================================================
  -- PRIORITY 4: Feature Tables
  -- =============================================================================

  RAISE NOTICE '[15/25] Copying ta_deliveries...';
  INSERT INTO great_southern_fuels.ta_deliveries
  SELECT * FROM public.ta_deliveries;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[16/25] Copying ta_alerts...';
  INSERT INTO great_southern_fuels.ta_alerts
  SELECT * FROM public.ta_alerts;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[17/25] Copying ta_alert_history...';
  INSERT INTO great_southern_fuels.ta_alert_history
  SELECT * FROM public.ta_alert_history;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[18/25] Copying ta_anomaly_events...';
  INSERT INTO great_southern_fuels.ta_anomaly_events
  SELECT * FROM public.ta_anomaly_events;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[19/25] Copying ta_users...';
  INSERT INTO great_southern_fuels.ta_users
  SELECT * FROM public.ta_users;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[20/25] Copying ta_user_business_access...';
  INSERT INTO great_southern_fuels.ta_user_business_access
  SELECT * FROM public.ta_user_business_access;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[21/25] Copying ta_subscriptions...';
  INSERT INTO great_southern_fuels.ta_subscriptions
  SELECT * FROM public.ta_subscriptions;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[22/25] Copying ta_api_keys...';
  INSERT INTO great_southern_fuels.ta_api_keys
  SELECT * FROM public.ta_api_keys;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[23/25] Copying ta_audit_log...';
  INSERT INTO great_southern_fuels.ta_audit_log
  SELECT * FROM public.ta_audit_log;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  -- =============================================================================
  -- PRIORITY 5: Analytics Tables
  -- =============================================================================

  RAISE NOTICE '[24/25] Copying ta_prediction_history...';
  INSERT INTO great_southern_fuels.ta_prediction_history
  SELECT * FROM public.ta_prediction_history;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  RAISE NOTICE '[25/25] Copying ta_fleet_snapshots...';
  INSERT INTO great_southern_fuels.ta_fleet_snapshots
  SELECT * FROM public.ta_fleet_snapshots;
  GET DIAGNOSTICS rows_copied = ROW_COUNT;
  total_rows := total_rows + rows_copied;
  RAISE NOTICE '  ✓ Copied % rows', rows_copied;

  -- =============================================================================
  -- COMPLETION SUMMARY
  -- =============================================================================

  end_time := clock_timestamp();
  duration := end_time - start_time;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'DATA COPY COMPLETE';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total rows copied: %', total_rows;
  RAISE NOTICE 'Duration: %', duration;
  RAISE NOTICE 'Source data preserved: public.ta_* (still intact)';
  RAISE NOTICE 'Target data created: great_southern_fuels.ta_*';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run 006_recreate_gsf_views.sql to create views';
  RAISE NOTICE '  2. Run 007_verify_gsf_data_integrity.sql to verify';
  RAISE NOTICE '============================================';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Data copy failed: %', SQLERRM;
    RAISE NOTICE 'ERROR: Data copy incomplete - rolling back';
    RAISE NOTICE 'Original data in public schema is safe';
END $$;
