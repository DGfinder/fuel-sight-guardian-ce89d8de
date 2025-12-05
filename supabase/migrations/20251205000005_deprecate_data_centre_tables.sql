-- Migration: Deprecate Data Centre / Fleet Management Tables
-- Date: 2025-12-05
-- Purpose: Rename unused data centre tables to _deprecated
-- Risk Level: LOW - No pages in active routes, 93 unused TS files
-- Impact: None - Fleet dashboard pages removed from routes
-- Total Data: ~260,000 rows, ~300 MB

-- Business Context:
-- These tables were for fleet management/data centre features (Stevemacs, GSF Fleet)
-- that have been removed from the application. The focus is now on AgBot tank monitoring.
-- Pages removed: VehicleDatabase, StevemacsFleetDashboard, GSFFleetDashboard,
-- StevemacsSafetyDashboard, GSFSafetyDashboard, DriverManagement, etc.

-- Tables to deprecate (in dependency order):

-- 1. Tables with no incoming FKs (safe to rename first)
ALTER TABLE IF EXISTS asset_compliance RENAME TO asset_compliance_deprecated;
ALTER TABLE IF EXISTS driver_assignments RENAME TO driver_assignments_deprecated;
ALTER TABLE IF EXISTS driver_name_mappings RENAME TO driver_name_mappings_deprecated;
ALTER TABLE IF EXISTS route_patterns RENAME TO route_patterns_deprecated;
ALTER TABLE IF EXISTS guardian_events RENAME TO guardian_events_deprecated;
ALTER TABLE IF EXISTS lytx_safety_events RENAME TO lytx_safety_events_deprecated;
ALTER TABLE IF EXISTS captive_payment_records RENAME TO captive_payment_records_deprecated;
ALTER TABLE IF EXISTS mtdata_trip_history RENAME TO mtdata_trip_history_deprecated;

-- 2. Tables referenced by others (rename after dependents)
ALTER TABLE IF EXISTS discovered_poi RENAME TO discovered_poi_deprecated;
ALTER TABLE IF EXISTS terminal_locations RENAME TO terminal_locations_deprecated;
ALTER TABLE IF EXISTS drivers RENAME TO drivers_deprecated;
ALTER TABLE IF EXISTS vehicles RENAME TO vehicles_deprecated;

-- Add deprecation comments
COMMENT ON TABLE asset_compliance_deprecated IS 'DEPRECATED 2025-12-05: Fleet compliance tracking removed. Part of data centre/fleet management feature removal. Contains 6 rows. Scheduled for permanent removal on 2025-12-19.';

COMMENT ON TABLE driver_assignments_deprecated IS 'DEPRECATED 2025-12-05: Driver-vehicle assignments removed. Part of data centre/fleet management feature removal. Contains 3 rows. Scheduled for permanent removal on 2025-12-19.';

COMMENT ON TABLE driver_name_mappings_deprecated IS 'DEPRECATED 2025-12-05: Cross-system driver name mapping removed. Part of data centre/fleet management feature removal. Contains 713 rows. Scheduled for permanent removal on 2025-12-19.';

COMMENT ON TABLE route_patterns_deprecated IS 'DEPRECATED 2025-12-05: Route analytics removed. Part of data centre/fleet management feature removal. Contains 315 rows (568 kB). Scheduled for permanent removal on 2025-12-19.';

COMMENT ON TABLE guardian_events_deprecated IS 'DEPRECATED 2025-12-05: Guardian fatigue monitoring removed. Part of data centre/fleet management feature removal. Contains 131,143 rows (165 MB). Scheduled for permanent removal on 2025-12-19.';

COMMENT ON TABLE lytx_safety_events_deprecated IS 'DEPRECATED 2025-12-05: Lytx safety camera events removed. Part of data centre/fleet management feature removal. Contains 39,379 rows (103 MB). Scheduled for permanent removal on 2025-12-19.';

COMMENT ON TABLE captive_payment_records_deprecated IS 'DEPRECATED 2025-12-05: Captive payment delivery records removed. Part of data centre/fleet management feature removal. Contains 81,973 rows (26 MB). Scheduled for permanent removal on 2025-12-19.';

COMMENT ON TABLE mtdata_trip_history_deprecated IS 'DEPRECATED 2025-12-05: MTData trip history removed. Part of data centre/fleet management feature removal. Contains 6,355 rows (7.8 MB). Scheduled for permanent removal on 2025-12-19.';

COMMENT ON TABLE discovered_poi_deprecated IS 'DEPRECATED 2025-12-05: Auto-discovered points of interest removed. Part of data centre/fleet management feature removal. Contains 8 rows (184 kB). Scheduled for permanent removal on 2025-12-19.';

COMMENT ON TABLE terminal_locations_deprecated IS 'DEPRECATED 2025-12-05: Fuel terminal locations removed. Part of data centre/fleet management feature removal. Contains 10 rows (144 kB). Scheduled for permanent removal on 2025-12-19.';

COMMENT ON TABLE drivers_deprecated IS 'DEPRECATED 2025-12-05: Driver database removed. Part of data centre/fleet management feature removal. Contains 136 rows (264 kB). Scheduled for permanent removal on 2025-12-19.';

COMMENT ON TABLE vehicles_deprecated IS 'DEPRECATED 2025-12-05: Vehicle database removed. Part of data centre/fleet management feature removal. Contains 139 rows (264 kB). Scheduled for permanent removal on 2025-12-19.';

-- Summary
DO $$
DECLARE
  deprecated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO deprecated_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name LIKE '%_deprecated';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Data Centre Tables Deprecation Summary';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total deprecated tables: %', deprecated_count;
  RAISE NOTICE 'Data preserved for 2-week monitoring period';
  RAISE NOTICE 'Permanent removal scheduled: 2025-12-19';
  RAISE NOTICE '';
  RAISE NOTICE 'Deprecated tables:';
  RAISE NOTICE '  - asset_compliance_deprecated (6 rows)';
  RAISE NOTICE '  - driver_assignments_deprecated (3 rows)';
  RAISE NOTICE '  - driver_name_mappings_deprecated (713 rows)';
  RAISE NOTICE '  - route_patterns_deprecated (315 rows)';
  RAISE NOTICE '  - guardian_events_deprecated (131,143 rows, 165 MB)';
  RAISE NOTICE '  - lytx_safety_events_deprecated (39,379 rows, 103 MB)';
  RAISE NOTICE '  - captive_payment_records_deprecated (81,973 rows, 26 MB)';
  RAISE NOTICE '  - mtdata_trip_history_deprecated (6,355 rows, 7.8 MB)';
  RAISE NOTICE '  - discovered_poi_deprecated (8 rows)';
  RAISE NOTICE '  - terminal_locations_deprecated (10 rows)';
  RAISE NOTICE '  - drivers_deprecated (136 rows)';
  RAISE NOTICE '  - vehicles_deprecated (139 rows)';
  RAISE NOTICE '';
  RAISE NOTICE 'TOTAL: ~260,000 rows, ~300 MB';
  RAISE NOTICE '========================================';
END $$;
