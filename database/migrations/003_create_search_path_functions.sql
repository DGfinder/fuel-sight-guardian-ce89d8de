-- Migration: Create Search Path Helper Functions
-- Description: Functions to enable automatic tenant schema routing via PostgreSQL search_path
-- Author: Claude Code
-- Date: 2025-01-02

-- =============================================================================
-- CORE SEARCH PATH FUNCTION
-- =============================================================================
-- Sets the PostgreSQL search_path to route queries to the correct tenant schema
-- This is the KEY function that enables schema-per-tenant without code changes

CREATE OR REPLACE FUNCTION public.set_tenant_search_path(tenant_schema TEXT)
RETURNS void AS $$
BEGIN
  -- Validate schema name to prevent SQL injection
  IF tenant_schema !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid schema name: %', tenant_schema;
  END IF;

  -- Verify schema exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = tenant_schema
  ) THEN
    RAISE EXCEPTION 'Schema does not exist: %', tenant_schema;
  END IF;

  -- Set search_path to tenant schema, fallback to public
  -- Format: search_path = 'tenant_schema, public'
  -- This means unqualified table names resolve to tenant_schema first, then public
  EXECUTE format('SET search_path TO %I, public', tenant_schema);

  RAISE NOTICE 'Search path set to: %, public', tenant_schema;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.set_tenant_search_path(TEXT) IS
  'Sets PostgreSQL search_path to route queries to tenant schema. Called after user authentication to establish tenant context.';

-- =============================================================================
-- GET USER TENANT SCHEMA
-- =============================================================================
-- Returns the schema_name for the authenticated user's default tenant
-- Used during login to determine which tenant schema to use

CREATE OR REPLACE FUNCTION public.get_user_tenant_schema()
RETURNS TEXT AS $$
  SELECT t.schema_name
  FROM public.whitelabel_tenants t
  JOIN public.user_tenant_assignments uta ON uta.tenant_id = t.id
  WHERE uta.user_id = auth.uid()
    AND uta.is_default = true
    AND t.is_active = true
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_tenant_schema() IS
  'Returns schema_name for current authenticated user. Returns NULL if user has no default tenant.';

-- =============================================================================
-- GET USER TENANT INFO (Extended)
-- =============================================================================
-- Returns full tenant context for authenticated user
-- Includes tenant_id, schema_name, company_name, role

CREATE OR REPLACE FUNCTION public.get_user_tenant_context()
RETURNS TABLE (
  tenant_id UUID,
  schema_name TEXT,
  company_name TEXT,
  tenant_key TEXT,
  user_role TEXT,
  is_active BOOLEAN
) AS $$
  SELECT
    t.id AS tenant_id,
    t.schema_name,
    t.company_name,
    t.tenant_key,
    uta.role AS user_role,
    t.is_active
  FROM public.whitelabel_tenants t
  JOIN public.user_tenant_assignments uta ON uta.tenant_id = t.id
  WHERE uta.user_id = auth.uid()
    AND uta.is_default = true
    AND t.is_active = true
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_tenant_context() IS
  'Returns full tenant context for authenticated user including role and company info.';

-- =============================================================================
-- LIST USER TENANTS
-- =============================================================================
-- Returns all tenants the authenticated user has access to
-- Used for tenant switching UI

CREATE OR REPLACE FUNCTION public.list_user_tenants()
RETURNS TABLE (
  tenant_id UUID,
  tenant_key TEXT,
  company_name TEXT,
  schema_name TEXT,
  user_role TEXT,
  is_default BOOLEAN,
  is_active BOOLEAN
) AS $$
  SELECT
    t.id AS tenant_id,
    t.tenant_key,
    t.company_name,
    t.schema_name,
    uta.role AS user_role,
    uta.is_default,
    t.is_active
  FROM public.whitelabel_tenants t
  JOIN public.user_tenant_assignments uta ON uta.tenant_id = t.id
  WHERE uta.user_id = auth.uid()
    AND t.is_active = true
  ORDER BY uta.is_default DESC, t.company_name;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.list_user_tenants() IS
  'Lists all active tenants user has access to, ordered by default tenant first.';

-- =============================================================================
-- SWITCH DEFAULT TENANT
-- =============================================================================
-- Allows user to switch their default tenant
-- Updates is_default flag and returns new tenant context

CREATE OR REPLACE FUNCTION public.switch_default_tenant(new_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();

  -- Verify user has access to this tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.user_tenant_assignments
    WHERE user_id = current_user_id AND tenant_id = new_tenant_id
  ) THEN
    RAISE EXCEPTION 'User does not have access to tenant: %', new_tenant_id;
  END IF;

  -- Clear all is_default flags for this user
  UPDATE public.user_tenant_assignments
  SET is_default = false
  WHERE user_id = current_user_id;

  -- Set new default
  UPDATE public.user_tenant_assignments
  SET is_default = true
  WHERE user_id = current_user_id AND tenant_id = new_tenant_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.switch_default_tenant(UUID) IS
  'Switches user default tenant. Requires user to have existing access to target tenant.';

-- =============================================================================
-- VALIDATION & SECURITY
-- =============================================================================

-- Grant EXECUTE permission to authenticated users
GRANT EXECUTE ON FUNCTION public.set_tenant_search_path(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_schema() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_user_tenants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.switch_default_tenant(UUID) TO authenticated;

-- Revoke from anonymous users (security)
REVOKE ALL ON FUNCTION public.set_tenant_search_path(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.get_user_tenant_schema() FROM anon;
REVOKE ALL ON FUNCTION public.get_user_tenant_context() FROM anon;
REVOKE ALL ON FUNCTION public.list_user_tenants() FROM anon;
REVOKE ALL ON FUNCTION public.switch_default_tenant(UUID) FROM anon;

-- =============================================================================
-- AUDIT LOG
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Tenant search path functions created successfully';
  RAISE NOTICE 'Functions available:';
  RAISE NOTICE '  - set_tenant_search_path(schema_name) -> Sets session search_path';
  RAISE NOTICE '  - get_user_tenant_schema() -> Returns user default schema';
  RAISE NOTICE '  - get_user_tenant_context() -> Returns full tenant info';
  RAISE NOTICE '  - list_user_tenants() -> Lists all user tenants';
  RAISE NOTICE '  - switch_default_tenant(tenant_id) -> Changes default tenant';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage example:';
  RAISE NOTICE '  SELECT set_tenant_search_path(get_user_tenant_schema());';
  RAISE NOTICE '  -- Now all queries use tenant schema automatically!';
END $$;
