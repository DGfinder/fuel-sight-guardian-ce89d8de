-- Migration: Archive great_southern_fuels Schema
-- Date: 2025-12-05
-- Purpose: Make great_southern_fuels schema inactive - NOT USED by application
-- Risk Level: LOW - Only revoking permissions on unused schema

-- Background:
-- The great_southern_fuels schema contains duplicate ta_ tables that were an early
-- attempt at multi-tenancy. The application uses PUBLIC schema ta_ tables instead.
-- All tables in great_southern_fuels schema have 0 rows.
-- Supabase cannot expose this schema via PostgREST.

-- Revoke all permissions from anon and authenticated users
REVOKE ALL ON SCHEMA great_southern_fuels FROM anon;
REVOKE ALL ON SCHEMA great_southern_fuels FROM authenticated;
REVOKE ALL ON SCHEMA great_southern_fuels FROM public;

-- Revoke permissions on all tables in the schema
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'great_southern_fuels'
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE great_southern_fuels.%I FROM anon', tbl.tablename);
    EXECUTE format('REVOKE ALL ON TABLE great_southern_fuels.%I FROM authenticated', tbl.tablename);
    EXECUTE format('REVOKE ALL ON TABLE great_southern_fuels.%I FROM public', tbl.tablename);
  END LOOP;

  RAISE NOTICE 'Revoked permissions on % tables in great_southern_fuels schema', (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'great_southern_fuels');
END $$;

-- Add comment documenting the schema as archived
COMMENT ON SCHEMA great_southern_fuels IS
  'ARCHIVED 2025-12-05: This schema is NOT used by the application. All tenant-aware (ta_) tables are in the PUBLIC schema. This schema was an early attempt at multi-tenancy that was never implemented. All tables have 0 rows. Cannot be exposed via Supabase PostgREST. Kept for reference only. DO NOT USE.';

-- Summary
DO $$
DECLARE
  table_count INTEGER;
  schema_permissions TEXT;
BEGIN
  -- Count tables in schema
  SELECT COUNT(*) INTO table_count
  FROM pg_tables
  WHERE schemaname = 'great_southern_fuels';

  -- Get schema permissions
  SELECT nspacl::TEXT INTO schema_permissions
  FROM pg_namespace
  WHERE nspname = 'great_southern_fuels';

  RAISE NOTICE '================================================';
  RAISE NOTICE 'GREAT_SOUTHERN_FUELS SCHEMA ARCHIVED';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Tables in schema: %', table_count;
  RAISE NOTICE 'All tables have 0 rows';
  RAISE NOTICE 'Schema permissions: %', schema_permissions;
  RAISE NOTICE 'Status: ARCHIVED - Cannot be accessed via PostgREST';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Application uses PUBLIC schema ta_ tables';
  RAISE NOTICE '❌ great_southern_fuels schema is inactive';
  RAISE NOTICE '================================================';
END $$;
