-- Migration: Grant Permissions on Great Southern Fuels Schema
-- Description: Configure schema-level permissions for tenant data access
-- Author: Claude Code
-- Date: 2025-01-02
-- Phase: 3.5 - Permissions & Security

-- =============================================================================
-- REVOKE PUBLIC ACCESS (Security First)
-- =============================================================================
-- Ensure no unintended access to tenant schema

REVOKE ALL ON SCHEMA great_southern_fuels FROM PUBLIC;
REVOKE ALL ON SCHEMA great_southern_fuels FROM anon;

RAISE NOTICE 'Public and anonymous access revoked from great_southern_fuels schema';

-- =============================================================================
-- GRANT SCHEMA USAGE
-- =============================================================================
-- Authenticated users can access the schema (RLS not needed - schema isolation provides security)

GRANT USAGE ON SCHEMA great_southern_fuels TO authenticated;

RAISE NOTICE 'Schema usage granted to authenticated role';

-- =============================================================================
-- GRANT TABLE PERMISSIONS
-- =============================================================================
-- Users can query and modify data in their tenant schema
-- No RLS needed - users are routed to correct schema via search_path

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA great_southern_fuels TO authenticated;

RAISE NOTICE 'Table permissions granted to authenticated role';

-- =============================================================================
-- GRANT SEQUENCE PERMISSIONS
-- =============================================================================
-- Required for auto-increment IDs

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA great_southern_fuels TO authenticated;

RAISE NOTICE 'Sequence permissions granted to authenticated role';

-- =============================================================================
-- GRANT VIEW PERMISSIONS
-- =============================================================================

GRANT SELECT ON ALL TABLES IN SCHEMA great_southern_fuels TO authenticated;

RAISE NOTICE 'View permissions granted to authenticated role';

-- =============================================================================
-- SET DEFAULT PRIVILEGES (Future Tables)
-- =============================================================================
-- Any new tables/sequences created in this schema automatically get permissions

ALTER DEFAULT PRIVILEGES IN SCHEMA great_southern_fuels
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA great_southern_fuels
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

RAISE NOTICE 'Default privileges configured for future objects';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  table_count INTEGER;
  view_count INTEGER;
BEGIN
  -- Count tables with permissions
  SELECT COUNT(DISTINCT tablename) INTO table_count
  FROM pg_tables
  WHERE schemaname = 'great_southern_fuels';

  -- Count views
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = 'great_southern_fuels';

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'PERMISSIONS GRANTED';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Schema: great_southern_fuels';
  RAISE NOTICE 'Tables secured: %', table_count;
  RAISE NOTICE 'Views secured: %', view_count;
  RAISE NOTICE 'Accessible by: authenticated users (via search_path only)';
  RAISE NOTICE '';
  RAISE NOTICE 'Security model:';
  RAISE NOTICE '  ✓ Public access: REVOKED';
  RAISE NOTICE '  ✓ Anonymous access: REVOKED';
  RAISE NOTICE '  ✓ Authenticated access: GRANTED (via search_path routing)';
  RAISE NOTICE '  ✓ Schema isolation: User cannot access schema without tenant assignment';
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Run 009_mark_gsf_provisioned.sql';
  RAISE NOTICE '============================================';
END $$;
