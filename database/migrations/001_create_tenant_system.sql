-- Migration: Create Multi-Tenant System Tables
-- Description: Foundation tables for schema-per-tenant architecture
-- Author: Claude Code
-- Date: 2025-01-02

-- =============================================================================
-- TENANT REGISTRY TABLE
-- =============================================================================
-- Stores metadata for each whitelabel tenant/client
-- Each tenant will have their own dedicated schema

CREATE TABLE IF NOT EXISTS public.whitelabel_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_key TEXT UNIQUE NOT NULL,
  schema_name TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  subdomain TEXT,
  is_active BOOLEAN DEFAULT true,
  provisioned_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT tenant_key_format CHECK (tenant_key ~* '^[a-z0-9-]+$'),
  CONSTRAINT schema_name_format CHECK (schema_name ~* '^[a-z0-9_]+$'),
  CONSTRAINT tenant_key_min_length CHECK (length(tenant_key) >= 3),
  CONSTRAINT schema_name_min_length CHECK (length(schema_name) >= 3)
);

-- Index for fast tenant lookups
CREATE INDEX IF NOT EXISTS idx_whitelabel_tenants_tenant_key
  ON public.whitelabel_tenants(tenant_key);

CREATE INDEX IF NOT EXISTS idx_whitelabel_tenants_schema_name
  ON public.whitelabel_tenants(schema_name);

CREATE INDEX IF NOT EXISTS idx_whitelabel_tenants_is_active
  ON public.whitelabel_tenants(is_active)
  WHERE is_active = true;

-- Comments for documentation
COMMENT ON TABLE public.whitelabel_tenants IS
  'Registry of whitelabel tenant clients. Each tenant has dedicated schema for complete data isolation.';

COMMENT ON COLUMN public.whitelabel_tenants.tenant_key IS
  'URL-safe unique identifier (e.g., "great-southern-fuels")';

COMMENT ON COLUMN public.whitelabel_tenants.schema_name IS
  'PostgreSQL schema name for this tenant (e.g., "great_southern_fuels")';

COMMENT ON COLUMN public.whitelabel_tenants.subdomain IS
  'Optional subdomain for tenant-specific URLs (e.g., "gsf.tankalert.com.au")';

COMMENT ON COLUMN public.whitelabel_tenants.settings IS
  'Tenant-specific configuration: branding, features, limits, etc.';

COMMENT ON COLUMN public.whitelabel_tenants.provisioned_at IS
  'Timestamp when tenant schema was fully provisioned and ready';

-- =============================================================================
-- USER-TENANT ASSIGNMENTS TABLE
-- =============================================================================
-- Maps Supabase auth users to their tenant(s)
-- Supports users belonging to multiple tenants with different roles

CREATE TABLE IF NOT EXISTS public.user_tenant_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'user',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT unique_user_tenant UNIQUE(user_id, tenant_id),
  CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'manager', 'user', 'readonly'))
);

-- Indexes for fast user-tenant lookups
CREATE INDEX IF NOT EXISTS idx_user_tenant_assignments_user_id
  ON public.user_tenant_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_user_tenant_assignments_tenant_id
  ON public.user_tenant_assignments(tenant_id);

CREATE INDEX IF NOT EXISTS idx_user_tenant_assignments_default
  ON public.user_tenant_assignments(user_id, is_default)
  WHERE is_default = true;

-- Comments for documentation
COMMENT ON TABLE public.user_tenant_assignments IS
  'Maps users to tenants. Users can belong to multiple tenants with different roles.';

COMMENT ON COLUMN public.user_tenant_assignments.role IS
  'User role within tenant: owner (full control), admin (manage users), manager (manage data), user (standard access), readonly (view only)';

COMMENT ON COLUMN public.user_tenant_assignments.is_default IS
  'Default tenant for this user. Used when user logs in to determine which schema to use.';

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================
-- Automatically update updated_at timestamp on row modification

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whitelabel_tenants_updated_at
  BEFORE UPDATE ON public.whitelabel_tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_tenant_assignments_updated_at
  BEFORE UPDATE ON public.user_tenant_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- AUDIT LOG
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Multi-tenant system tables created successfully';
  RAISE NOTICE '  - whitelabel_tenants table';
  RAISE NOTICE '  - user_tenant_assignments table';
  RAISE NOTICE '  - Indexes and triggers configured';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run 002_seed_gsf_tenant.sql to create Great Southern Fuels tenant';
  RAISE NOTICE '  2. Run 003_create_search_path_functions.sql for tenant routing';
END $$;
