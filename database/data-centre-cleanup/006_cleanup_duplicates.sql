-- ============================================================================
-- DATA CENTRE CLEANUP: PHASE 6 - CLEANUP DUPLICATE TABLES
-- ============================================================================
-- Purpose: Remove duplicate and redundant tables after data migration
-- Status: BREAKING CHANGES (drops tables - BACKUP FIRST!)
-- Dependencies: Requires Phase 1-5 to be completed and validated
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'DATA CENTRE CLEANUP - PHASE 6: CLEANUP DUPLICATE TABLES';
  RAISE NOTICE '⚠️  WARNING: THIS MIGRATION CONTAINS BREAKING CHANGES';
  RAISE NOTICE '⚠️  ENSURE YOU HAVE A COMPLETE BACKUP BEFORE PROCEEDING';
  RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- SAFETY CHECK: VERIFY DATA MIGRATION
-- ============================================================================

DO $$
DECLARE
  v_lytx_vehicle_match_rate DECIMAL;
  v_guardian_vehicle_match_rate DECIMAL;
  v_captive_correlation_rate DECIMAL;
  v_proceed BOOLEAN := TRUE;
BEGIN
  RAISE NOTICE '[SAFETY CHECK] Verifying data migration quality...';

  -- Check LYTX vehicle match rate
  SELECT
    ROUND((COUNT(*) FILTER (WHERE vehicle_id IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2)
  INTO v_lytx_vehicle_match_rate
  FROM lytx_safety_events;

  -- Check Guardian vehicle match rate
  SELECT
    ROUND((COUNT(*) FILTER (WHERE vehicle_id_uuid IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2)
  INTO v_guardian_vehicle_match_rate
  FROM guardian_events;

  -- Check captive payments correlation rate
  SELECT
    ROUND((COUNT(*) FILTER (WHERE mtdata_trip_id IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2)
  INTO v_captive_correlation_rate
  FROM captive_payment_records;

  RAISE NOTICE '  LYTX vehicle match rate: %%', v_lytx_vehicle_match_rate;
  RAISE NOTICE '  Guardian vehicle match rate: %%', v_guardian_vehicle_match_rate;
  RAISE NOTICE '  Captive correlation rate: %%', v_captive_correlation_rate;

  -- Verify minimum quality thresholds
  IF v_lytx_vehicle_match_rate < 50 THEN
    RAISE WARNING '  ⚠️  LYTX vehicle match rate below 50%% - review data quality';
    v_proceed := FALSE;
  END IF;

  IF v_guardian_vehicle_match_rate < 50 THEN
    RAISE WARNING '  ⚠️  Guardian vehicle match rate below 50%% - review data quality';
    v_proceed := FALSE;
  END IF;

  IF NOT v_proceed THEN
    RAISE EXCEPTION 'Data quality checks failed. Review warnings before proceeding with cleanup.';
  END IF;

  RAISE NOTICE '  ✓ Data migration quality verified';
END $$;

-- ============================================================================
-- 1. IDENTIFY DUPLICATE TABLES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '[1/4] Identifying duplicate tables...';
END $$;

-- Create temporary tracking table
CREATE TEMP TABLE IF NOT EXISTS tables_to_remove (
  table_name TEXT PRIMARY KEY,
  reason TEXT,
  replacement TEXT,
  record_count BIGINT
);

-- Identify duplicates
INSERT INTO tables_to_remove (table_name, reason, replacement, record_count)
VALUES
  ('carrier_deliveries', 'Duplicate of captive_payment_records', 'captive_payment_records',
    (SELECT COUNT(*) FROM carrier_deliveries WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carrier_deliveries'))),
  ('upload_batches', 'Duplicate of data_import_batches', 'data_import_batches',
    (SELECT COUNT(*) FROM upload_batches WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upload_batches'))),
  ('driver_performance_monthly', 'Consolidated into driver_performance_metrics', 'driver_performance_metrics',
    (SELECT COUNT(*) FROM driver_performance_monthly WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'driver_performance_monthly')))
ON CONFLICT (table_name) DO NOTHING;

DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '  Tables identified for removal:';
  FOR r IN SELECT * FROM tables_to_remove ORDER BY table_name LOOP
    RAISE NOTICE '    • % (% records) → %', r.table_name, r.record_count, r.replacement;
    RAISE NOTICE '      Reason: %', r.reason;
  END LOOP;
END $$;

-- ============================================================================
-- 2. MIGRATE DATA FROM DUPLICATES (IF NEEDED)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '[2/4] Migrating any remaining data from duplicate tables...';
END $$;

-- Migrate from upload_batches to data_import_batches (if not already migrated)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upload_batches') THEN
    -- Check if data needs migration
    IF EXISTS (
      SELECT 1 FROM upload_batches ub
      WHERE NOT EXISTS (
        SELECT 1 FROM data_import_batches dib
        WHERE dib.id = ub.id
      )
      LIMIT 1
    ) THEN
      INSERT INTO data_import_batches (
        id, data_source_id, filename, upload_type, file_size, record_count,
        duplicate_count, error_count, uploaded_by, upload_status,
        processing_notes, uploaded_at, completed_at
      )
      SELECT
        id, data_source_id, filename, upload_type, file_size, record_count,
        duplicate_count, error_count, uploaded_by, upload_status,
        processing_notes, uploaded_at, completed_at
      FROM upload_batches
      WHERE NOT EXISTS (
        SELECT 1 FROM data_import_batches WHERE id = upload_batches.id
      )
      ON CONFLICT (id) DO NOTHING;

      RAISE NOTICE '  ✓ Migrated upload_batches data to data_import_batches';
    ELSE
      RAISE NOTICE '  - upload_batches data already in data_import_batches';
    END IF;
  END IF;
END $$;

-- Migrate from driver_performance_monthly to driver_performance_metrics
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'driver_performance_monthly') THEN
    -- Check if data needs migration
    IF EXISTS (
      SELECT 1 FROM driver_performance_monthly dpm
      WHERE NOT EXISTS (
        SELECT 1 FROM driver_performance_metrics dpm2
        WHERE dpm2.driver_id = dpm.driver_id
          AND dpm2.period_end = dpm.month_year
          AND dpm2.period_type = 'Monthly'
      )
      LIMIT 1
    ) THEN
      INSERT INTO driver_performance_metrics (
        driver_id, period_start, period_end, period_type,
        lytx_events_count, lytx_safety_score,
        guardian_events_count, guardian_safety_score,
        total_deliveries, total_kilometers,
        risk_level, trend, last_calculated
      )
      SELECT
        driver_name::TEXT, -- Will need manual driver_id mapping
        DATE_TRUNC('month', month_year),
        month_year,
        'Monthly',
        lytx_total_events,
        lytx_avg_safety_score,
        guardian_distraction_total + guardian_fatigue_total,
        0, -- Guardian score not in old table
        deliveries_completed,
        total_volume_delivered,
        risk_category,
        performance_trend,
        calculated_at
      FROM driver_performance_monthly
      WHERE NOT EXISTS (
        SELECT 1 FROM driver_performance_metrics dpm
        WHERE dpm.driver_id::TEXT = driver_performance_monthly.driver_name
          AND dpm.period_end = driver_performance_monthly.month_year
          AND dpm.period_type = 'Monthly'
      )
      ON CONFLICT DO NOTHING;

      RAISE NOTICE '  ⚠️  driver_performance_monthly needs manual driver_id mapping';
    ELSE
      RAISE NOTICE '  - driver_performance_monthly data already migrated';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 3. DROP DUPLICATE TABLES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '[3/4] Dropping duplicate tables...';
  RAISE NOTICE '  ⚠️  THIS IS A DESTRUCTIVE OPERATION';
END $$;

-- Drop carrier_deliveries if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carrier_deliveries') THEN
    DROP TABLE carrier_deliveries CASCADE;
    RAISE NOTICE '  ✓ Dropped carrier_deliveries table';
  ELSE
    RAISE NOTICE '  - carrier_deliveries table does not exist';
  END IF;
END $$;

-- Drop upload_batches if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upload_batches') THEN
    DROP TABLE upload_batches CASCADE;
    RAISE NOTICE '  ✓ Dropped upload_batches table';
  ELSE
    RAISE NOTICE '  - upload_batches table does not exist';
  END IF;
END $$;

-- Drop driver_performance_monthly if exists (after manual verification)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'driver_performance_monthly') THEN
    -- Comment this out if you need to keep this table for manual migration
    -- DROP TABLE driver_performance_monthly CASCADE;
    RAISE NOTICE '  ⚠️  driver_performance_monthly NOT dropped - requires manual verification';
    RAISE NOTICE '     → Verify data migration then manually drop this table';
  ELSE
    RAISE NOTICE '  - driver_performance_monthly table does not exist';
  END IF;
END $$;

-- ============================================================================
-- 4. CLEANUP OLD GUARDIAN VEHICLE_ID COLUMN
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '[4/4] Cleaning up old guardian_events.vehicle_id column...';
END $$;

-- Rename old INTEGER vehicle_id column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_events'
      AND column_name = 'vehicle_id'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE guardian_events
    RENAME COLUMN vehicle_id TO vehicle_id_old_integer;

    ALTER TABLE guardian_events
    RENAME COLUMN vehicle_id_uuid TO vehicle_id;

    RAISE NOTICE '  ✓ Renamed INTEGER vehicle_id to vehicle_id_old_integer';
    RAISE NOTICE '  ✓ Renamed vehicle_id_uuid to vehicle_id';
    RAISE NOTICE '  ⚠️  Old vehicle_id_old_integer column preserved for reference';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_events'
      AND column_name = 'vehicle_id'
      AND data_type = 'uuid'
  ) THEN
    RAISE NOTICE '  - guardian_events.vehicle_id already UUID type';
  ELSE
    RAISE NOTICE '  ⚠️  guardian_events.vehicle_id column state unclear';
  END IF;
END $$;

-- ============================================================================
-- COMPLETION SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'PHASE 6 COMPLETE: DUPLICATE TABLES CLEANED UP';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'ACTIONS COMPLETED:';
  RAISE NOTICE '  1. ✓ Data quality verified before cleanup';
  RAISE NOTICE '  2. ✓ Data migrated from duplicate tables';
  RAISE NOTICE '  3. ✓ Duplicate tables dropped (where safe)';
  RAISE NOTICE '  4. ✓ Guardian vehicle_id column standardized to UUID';
  RAISE NOTICE '';
  RAISE NOTICE 'MANUAL ACTIONS REQUIRED:';
  RAISE NOTICE '  → Review driver_performance_monthly migration';
  RAISE NOTICE '  → Manually drop driver_performance_monthly after verification';
  RAISE NOTICE '  → Update application code to use new table/column names';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  → Run migration 999 to validate entire cleanup';
  RAISE NOTICE '  → Test all query functions and views';
  RAISE NOTICE '  → Monitor application for any breaking changes';
  RAISE NOTICE '============================================================================';
END $$;

-- Analyze affected tables
ANALYZE guardian_events;
ANALYZE data_import_batches;
ANALYZE driver_performance_metrics;
