-- Migration: Seed Great Southern Fuels Tenant
-- Description: Create the first tenant record for Great Southern Fuels
-- Author: Claude Code
-- Date: 2025-01-02

-- =============================================================================
-- CREATE GREAT SOUTHERN FUELS TENANT
-- =============================================================================

DO $$
DECLARE
  gsf_tenant_id UUID;
  tenant_count INTEGER;
BEGIN
  -- Check if tenant already exists
  SELECT COUNT(*) INTO tenant_count
  FROM public.whitelabel_tenants
  WHERE tenant_key = 'great-southern-fuels';

  IF tenant_count > 0 THEN
    RAISE NOTICE 'Great Southern Fuels tenant already exists, skipping...';
  ELSE
    -- Create tenant record
    INSERT INTO public.whitelabel_tenants (
      tenant_key,
      schema_name,
      company_name,
      subdomain,
      is_active,
      provisioned_at,
      settings
    ) VALUES (
      'great-southern-fuels',
      'great_southern_fuels',
      'Great Southern Fuels',
      'gsf.tankalert.com.au',
      true,
      NULL,  -- Will be set after schema provisioning
      jsonb_build_object(
        'branding', jsonb_build_object(
          'primary_color', '#1E40AF',
          'logo_url', '/assets/gsf-logo.png'
        ),
        'features', jsonb_build_object(
          'agbot_integration', true,
          'email_reports', true,
          'analytics_dashboard', true
        ),
        'limits', jsonb_build_object(
          'max_users', 100,
          'max_tanks', 1000
        )
      )
    )
    RETURNING id INTO gsf_tenant_id;

    RAISE NOTICE 'Created Great Southern Fuels tenant with ID: %', gsf_tenant_id;
    RAISE NOTICE 'Tenant key: great-southern-fuels';
    RAISE NOTICE 'Schema name: great_southern_fuels';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Run schema provisioning to create great_southern_fuels schema';
    RAISE NOTICE '  2. Migrate existing data from public.ta_* tables';
    RAISE NOTICE '  3. Assign existing users to this tenant via user_tenant_assignments';
  END IF;
END $$;

-- =============================================================================
-- ASSIGN EXISTING USERS TO GSF TENANT (Optional - Run if users exist)
-- =============================================================================
-- This section will assign all existing users to the GSF tenant
-- Uncomment and run after user accounts are confirmed

/*
DO $$
DECLARE
  gsf_tenant_id UUID;
  user_record RECORD;
  assigned_count INTEGER := 0;
BEGIN
  -- Get GSF tenant ID
  SELECT id INTO gsf_tenant_id
  FROM public.whitelabel_tenants
  WHERE tenant_key = 'great-southern-fuels';

  IF gsf_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Great Southern Fuels tenant not found. Run this migration first.';
  END IF;

  -- Assign all existing users to GSF tenant
  FOR user_record IN
    SELECT id, email, raw_user_meta_data->>'full_name' AS full_name
    FROM auth.users
    WHERE deleted_at IS NULL
  LOOP
    -- Check if assignment already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.user_tenant_assignments
      WHERE user_id = user_record.id AND tenant_id = gsf_tenant_id
    ) THEN
      INSERT INTO public.user_tenant_assignments (
        user_id,
        tenant_id,
        role,
        is_default
      ) VALUES (
        user_record.id,
        gsf_tenant_id,
        'user',  -- Default role, adjust as needed
        true     -- GSF is their default tenant
      );

      assigned_count := assigned_count + 1;
      RAISE NOTICE 'Assigned user % (%) to GSF tenant', user_record.email, user_record.full_name;
    END IF;
  END LOOP;

  RAISE NOTICE 'Assigned % users to Great Southern Fuels tenant', assigned_count;
END $$;
*/

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================
-- Run this to verify the tenant was created successfully

DO $$
DECLARE
  tenant_info RECORD;
BEGIN
  SELECT
    id,
    tenant_key,
    schema_name,
    company_name,
    subdomain,
    is_active,
    provisioned_at,
    created_at
  INTO tenant_info
  FROM public.whitelabel_tenants
  WHERE tenant_key = 'great-southern-fuels';

  IF tenant_info.id IS NOT NULL THEN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'TENANT VERIFICATION';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Tenant ID: %', tenant_info.id;
    RAISE NOTICE 'Tenant Key: %', tenant_info.tenant_key;
    RAISE NOTICE 'Schema Name: %', tenant_info.schema_name;
    RAISE NOTICE 'Company Name: %', tenant_info.company_name;
    RAISE NOTICE 'Subdomain: %', COALESCE(tenant_info.subdomain, '(none)');
    RAISE NOTICE 'Is Active: %', tenant_info.is_active;
    RAISE NOTICE 'Provisioned: %', COALESCE(tenant_info.provisioned_at::TEXT, 'Not yet provisioned');
    RAISE NOTICE 'Created At: %', tenant_info.created_at;
    RAISE NOTICE '============================================';
  ELSE
    RAISE WARNING 'Tenant verification failed - Great Southern Fuels tenant not found';
  END IF;
END $$;
