-- Migration: Permanently Drop All Deprecated Tables
-- Date: 2025-12-05
-- Purpose: Permanently remove all deprecated data centre and legacy tables
-- Risk Level: MEDIUM - Dropping large amounts of data (~260,000 rows, ~300 MB)
-- Impact: Frees up ~300 MB database space, removes ~260,000 rows

-- Business Context:
-- User confirmed to permanently delete mtdata, lytx, and guardian tables immediately
-- No monitoring period needed - these features have been removed from the application

-- WARNING: This migration is IRREVERSIBLE. Data will be permanently deleted.
-- Ensure backups exist if data recovery might be needed.

-- Drop data centre / fleet management tables (12 tables)
-- These tables were deprecated in migration 20251205000005

DROP TABLE IF EXISTS asset_compliance_deprecated CASCADE;
COMMENT ON SCHEMA public IS 'Dropped asset_compliance_deprecated (6 rows) on 2025-12-05';

DROP TABLE IF EXISTS driver_assignments_deprecated CASCADE;
COMMENT ON SCHEMA public IS 'Dropped driver_assignments_deprecated (3 rows) on 2025-12-05';

DROP TABLE IF EXISTS driver_name_mappings_deprecated CASCADE;
COMMENT ON SCHEMA public IS 'Dropped driver_name_mappings_deprecated (713 rows) on 2025-12-05';

DROP TABLE IF EXISTS route_patterns_deprecated CASCADE;
COMMENT ON SCHEMA public IS 'Dropped route_patterns_deprecated (315 rows, 568 kB) on 2025-12-05';

DROP TABLE IF EXISTS guardian_events_deprecated CASCADE;
COMMENT ON SCHEMA public IS 'Dropped guardian_events_deprecated (131,143 rows, 165 MB) on 2025-12-05';

DROP TABLE IF EXISTS lytx_safety_events_deprecated CASCADE;
COMMENT ON SCHEMA public IS 'Dropped lytx_safety_events_deprecated (39,379 rows, 103 MB) on 2025-12-05';

DROP TABLE IF EXISTS captive_payment_records_deprecated CASCADE;
COMMENT ON SCHEMA public IS 'Dropped captive_payment_records_deprecated (81,973 rows, 26 MB) on 2025-12-05';

DROP TABLE IF EXISTS mtdata_trip_history_deprecated CASCADE;
COMMENT ON SCHEMA public IS 'Dropped mtdata_trip_history_deprecated (6,355 rows, 7.8 MB) on 2025-12-05';

DROP TABLE IF EXISTS discovered_poi_deprecated CASCADE;
COMMENT ON SCHEMA public IS 'Dropped discovered_poi_deprecated (8 rows, 184 kB) on 2025-12-05';

DROP TABLE IF EXISTS terminal_locations_deprecated CASCADE;
COMMENT ON SCHEMA public IS 'Dropped terminal_locations_deprecated (10 rows, 144 kB) on 2025-12-05';

DROP TABLE IF EXISTS drivers_deprecated CASCADE;
COMMENT ON SCHEMA public IS 'Dropped drivers_deprecated (136 rows, 264 kB) on 2025-12-05';

DROP TABLE IF EXISTS vehicles_deprecated CASCADE;
COMMENT ON SCHEMA public IS 'Dropped vehicles_deprecated (139 rows, 264 kB) on 2025-12-05';

-- Drop legacy AgBot tables (2 tables)
-- These tables were deprecated in migrations 20251205000002 and 20251205000004

DROP TABLE IF EXISTS location_mapping_deprecated CASCADE;
COMMENT ON SCHEMA public IS 'Dropped location_mapping_deprecated (0 rows) on 2025-12-05';

DROP TABLE IF EXISTS agbot_sync_logs_deprecated CASCADE;
COMMENT ON SCHEMA public IS 'Dropped agbot_sync_logs_deprecated (2,750 rows, 1.4 MB) on 2025-12-05';

-- Summary and verification
DO $$
DECLARE
  remaining_deprecated INTEGER;
  total_tables INTEGER;
BEGIN
  -- Count any remaining deprecated tables
  SELECT COUNT(*) INTO remaining_deprecated
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name LIKE '%_deprecated';

  -- Count total tables in public schema
  SELECT COUNT(*) INTO total_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

  RAISE NOTICE '================================================';
  RAISE NOTICE 'PERMANENT TABLE DELETION SUMMARY';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Tables dropped: 14';
  RAISE NOTICE 'Rows deleted: ~260,000';
  RAISE NOTICE 'Space reclaimed: ~300 MB';
  RAISE NOTICE '';
  RAISE NOTICE 'Deleted Tables:';
  RAISE NOTICE '  ✓ guardian_events_deprecated (131,143 rows, 165 MB)';
  RAISE NOTICE '  ✓ captive_payment_records_deprecated (81,973 rows, 26 MB)';
  RAISE NOTICE '  ✓ lytx_safety_events_deprecated (39,379 rows, 103 MB)';
  RAISE NOTICE '  ✓ mtdata_trip_history_deprecated (6,355 rows, 7.8 MB)';
  RAISE NOTICE '  ✓ agbot_sync_logs_deprecated (2,750 rows, 1.4 MB)';
  RAISE NOTICE '  ✓ driver_name_mappings_deprecated (713 rows)';
  RAISE NOTICE '  ✓ route_patterns_deprecated (315 rows)';
  RAISE NOTICE '  ✓ vehicles_deprecated (139 rows)';
  RAISE NOTICE '  ✓ drivers_deprecated (136 rows)';
  RAISE NOTICE '  ✓ terminal_locations_deprecated (10 rows)';
  RAISE NOTICE '  ✓ discovered_poi_deprecated (8 rows)';
  RAISE NOTICE '  ✓ asset_compliance_deprecated (6 rows)';
  RAISE NOTICE '  ✓ driver_assignments_deprecated (3 rows)';
  RAISE NOTICE '  ✓ location_mapping_deprecated (0 rows)';
  RAISE NOTICE '';
  RAISE NOTICE 'Remaining deprecated tables: %', remaining_deprecated;
  RAISE NOTICE 'Total tables in public schema: %', total_tables;

  IF remaining_deprecated > 0 THEN
    RAISE WARNING 'WARNING: % deprecated tables still exist!', remaining_deprecated;
  ELSE
    RAISE NOTICE '✅ All deprecated tables successfully removed!';
  END IF;

  RAISE NOTICE '================================================';
END $$;
