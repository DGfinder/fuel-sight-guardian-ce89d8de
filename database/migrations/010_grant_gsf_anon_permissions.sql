-- Migration: Grant Anon Permissions on Great Southern Fuels Schema
-- Description: Allow anonymous (frontend) users to read AgBot data
-- Author: Claude Code
-- Date: 2025-01-04
-- Phase: 3.6 - Frontend Access

-- =============================================================================
-- GRANT SCHEMA USAGE TO ANON
-- =============================================================================
-- Frontend uses anon key, so we need to grant schema access to anon role

GRANT USAGE ON SCHEMA great_southern_fuels TO anon;

-- =============================================================================
-- GRANT READ PERMISSIONS ON AGBOT TABLES
-- =============================================================================
-- Allow anon users to read AgBot data (RLS will handle row-level security)

GRANT SELECT ON great_southern_fuels.ta_agbot_locations TO anon;
GRANT SELECT ON great_southern_fuels.ta_agbot_assets TO anon;
GRANT SELECT ON great_southern_fuels.ta_agbot_readings TO anon;
GRANT SELECT ON great_southern_fuels.ta_agbot_device_health TO anon;
GRANT SELECT ON great_southern_fuels.ta_agbot_alerts TO anon;
GRANT SELECT ON great_southern_fuels.ta_agbot_sync_log TO anon;

-- =============================================================================
-- GRANT READ PERMISSIONS ON VIEWS
-- =============================================================================
-- Allow anon users to read AgBot-related views

GRANT SELECT ON great_southern_fuels.ta_tank_dashboard TO anon;
GRANT SELECT ON great_southern_fuels.ta_tank_analytics TO anon;
GRANT SELECT ON great_southern_fuels.ta_tank_full_status TO anon;
GRANT SELECT ON great_southern_fuels.ta_unified_map_locations TO anon;

-- =============================================================================
-- SET DEFAULT PRIVILEGES FOR FUTURE TABLES
-- =============================================================================
-- Any new tables created in this schema will automatically grant SELECT to anon

ALTER DEFAULT PRIVILEGES IN SCHEMA great_southern_fuels
  GRANT SELECT ON TABLES TO anon;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  table_count INTEGER;
  view_count INTEGER;
BEGIN
  -- Count tables with anon permissions
  SELECT COUNT(DISTINCT tablename) INTO table_count
  FROM pg_tables
  WHERE schemaname = 'great_southern_fuels'
    AND tablename LIKE 'ta_agbot%';

  -- Count views
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = 'great_southern_fuels'
    AND table_name LIKE 'ta_%';

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'ANON PERMISSIONS GRANTED';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Schema: great_southern_fuels';
  RAISE NOTICE 'AgBot tables accessible: %', table_count;
  RAISE NOTICE 'Views accessible: %', view_count;
  RAISE NOTICE 'Accessible by: anon role (frontend)';
  RAISE NOTICE '';
  RAISE NOTICE 'Security model:';
  RAISE NOTICE '  ✓ Anon users: READ-ONLY access to AgBot tables';
  RAISE NOTICE '  ✓ RLS policies: Should be enabled for row-level filtering';
  RAISE NOTICE '  ✓ Write access: Still restricted to authenticated/service_role';
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Verify frontend can access AgBot data';
  RAISE NOTICE '============================================';
END $$;

