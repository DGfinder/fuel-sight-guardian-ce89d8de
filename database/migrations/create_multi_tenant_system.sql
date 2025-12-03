-- Multi-Tenant System Implementation
-- Enables white-label SaaS with isolated data per organization
-- Created: 2025-12-03
-- Part of: Phase 3 - Multi-Tenancy

-- ============================================================================
-- TENANTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  tenant_name TEXT NOT NULL,
  subdomain TEXT UNIQUE, -- e.g., 'gsf' for gsf.tankalert.app
  domain TEXT UNIQUE,    -- e.g., 'tankalert.greatsouthernfuels.com.au' (custom domain)

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  provisioned_at TIMESTAMPTZ DEFAULT NOW(),

  -- Branding
  branding JSONB DEFAULT '{}'::jsonb,
  /* Example branding structure:
  {
    "logo_url": "https://...",
    "logo_dark_url": "https://...",
    "primary_color": "#059669",
    "secondary_color": "#10b981",
    "favicon_url": "https://...",
    "company_name": "Great Southern Fuel Supplies",
    "company_website": "https://greatsouthernfuels.com.au"
  }
  */

  -- Email Configuration
  email_config JSONB DEFAULT '{}'::jsonb,
  /* Example email_config structure:
  {
    "from_email": "alert@tankalert.greatsouthernfuels.com.au",
    "from_name": "Tank Alert",
    "reply_to": "support@greatsouthernfuels.com.au",
    "support_email": "support@greatsouthernfuels.com.au",
    "use_enhanced_template": true,
    "batch_size": 50,
    "batch_delay_ms": 2000
  }
  */

  -- Alert Settings (per-tenant thresholds)
  alert_settings JSONB DEFAULT '{}'::jsonb,
  /* Example alert_settings structure:
  {
    "low_fuel_pct": 30,
    "critical_pct": 15,
    "days_remaining_critical": 3,
    "enable_sms_alerts": false,
    "enable_slack_alerts": false
  }
  */

  -- Feature Flags (per-tenant features)
  features JSONB DEFAULT '{}'::jsonb,
  /* Example features structure:
  {
    "enable_analytics": true,
    "enable_charts": true,
    "enable_weekly_reports": true,
    "enable_monthly_reports": true,
    "enable_api_access": false,
    "max_locations": 1000,
    "max_users": 50
  }
  */

  -- Timezone
  timezone TEXT DEFAULT 'Australia/Perth',

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE tenants IS 'Multi-tenant organizations with isolated data and configuration';
COMMENT ON COLUMN tenants.subdomain IS 'Subdomain for tenant-specific URL (e.g., gsf.tankalert.app)';
COMMENT ON COLUMN tenants.domain IS 'Custom domain for white-label hosting';
COMMENT ON COLUMN tenants.branding IS 'JSON object containing logo, colors, and brand assets';
COMMENT ON COLUMN tenants.email_config IS 'JSON object for tenant-specific email settings';
COMMENT ON COLUMN tenants.alert_settings IS 'JSON object for tenant-specific alert thresholds';
COMMENT ON COLUMN tenants.features IS 'JSON object for tenant-specific feature flags and limits';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain) WHERE subdomain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain) WHERE domain IS NOT NULL;

-- ============================================================================
-- USER-TENANT ASSOCIATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Role within this tenant (can be different per tenant)
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'viewer')),

  -- Permissions
  permissions JSONB DEFAULT '[]'::jsonb,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,

  -- Unique constraint: user can only be in a tenant once
  UNIQUE(user_id, tenant_id)
);

COMMENT ON TABLE user_tenants IS 'Maps users to tenants with role-based access';
COMMENT ON COLUMN user_tenants.role IS 'User role within this specific tenant';
COMMENT ON COLUMN user_tenants.permissions IS 'Additional fine-grained permissions array';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_tenants_user ON user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON user_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_active ON user_tenants(is_active);

-- ============================================================================
-- ADD TENANT_ID TO EXISTING TABLES
-- ============================================================================

-- Add tenant_id to customer_contacts
ALTER TABLE customer_contacts
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Add tenant_id to customer_email_logs
ALTER TABLE customer_email_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Add tenant_id to ta_agbot_locations (if multi-tenant tanks needed)
ALTER TABLE ta_agbot_locations
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Add tenant_id to system_config (allow per-tenant overrides)
ALTER TABLE system_config
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Create indexes for tenant_id
CREATE INDEX IF NOT EXISTS idx_customer_contacts_tenant ON customer_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_email_logs_tenant ON customer_email_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ta_agbot_locations_tenant ON ta_agbot_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_config_tenant ON system_config(tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================================================
-- SEED DEFAULT TENANT (Great Southern Fuel Supplies)
-- ============================================================================

INSERT INTO tenants (
  id,
  tenant_name,
  subdomain,
  status,
  branding,
  email_config,
  alert_settings,
  features,
  timezone
) VALUES (
  gen_random_uuid(),
  'Great Southern Fuel Supplies',
  'gsf',
  'active',
  '{
    "logo_url": "https://www.greatsouthernfuels.com.au/wp-content/uploads/2024/08/9d8131_1317ed20e5274adc9fd15fe2196d2cb8mv2.webp",
    "primary_color": "#059669",
    "secondary_color": "#10b981",
    "company_name": "Great Southern Fuel Supplies",
    "company_website": "https://greatsouthernfuels.com.au"
  }'::jsonb,
  '{
    "from_email": "alert@tankalert.greatsouthernfuels.com.au",
    "from_name": "Tank Alert",
    "reply_to": "hayden@stevemacs.com.au",
    "support_email": "support@greatsouthernfuel.com.au",
    "use_enhanced_template": true,
    "batch_size": 50,
    "batch_delay_ms": 2000
  }'::jsonb,
  '{
    "low_fuel_pct": 30,
    "critical_pct": 15,
    "days_remaining_critical": 3,
    "enable_sms_alerts": false,
    "enable_slack_alerts": false
  }'::jsonb,
  '{
    "enable_analytics": true,
    "enable_charts": true,
    "enable_weekly_reports": true,
    "enable_monthly_reports": true,
    "enable_api_access": true,
    "max_locations": 1000,
    "max_users": 50
  }'::jsonb,
  'Australia/Perth'
) ON CONFLICT (subdomain) DO NOTHING;

-- ============================================================================
-- UPDATE EXISTING DATA TO DEFAULT TENANT
-- ============================================================================

-- Get the default tenant ID
DO $$
DECLARE
  v_default_tenant_id UUID;
BEGIN
  -- Get GSF tenant ID
  SELECT id INTO v_default_tenant_id
  FROM tenants
  WHERE subdomain = 'gsf'
  LIMIT 1;

  IF v_default_tenant_id IS NOT NULL THEN
    -- Update customer_contacts
    UPDATE customer_contacts
    SET tenant_id = v_default_tenant_id
    WHERE tenant_id IS NULL;

    -- Update customer_email_logs
    UPDATE customer_email_logs
    SET tenant_id = v_default_tenant_id
    WHERE tenant_id IS NULL;

    -- Update ta_agbot_locations
    UPDATE ta_agbot_locations
    SET tenant_id = v_default_tenant_id
    WHERE tenant_id IS NULL;

    RAISE NOTICE 'Migrated existing data to default tenant: %', v_default_tenant_id;
  ELSE
    RAISE WARNING 'Default tenant (GSF) not found - data migration skipped';
  END IF;
END $$;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get tenant by subdomain
CREATE OR REPLACE FUNCTION get_tenant_by_subdomain(p_subdomain TEXT)
RETURNS tenants AS $$
DECLARE
  v_tenant tenants;
BEGIN
  SELECT * INTO v_tenant
  FROM tenants
  WHERE subdomain = p_subdomain
    AND status = 'active';

  RETURN v_tenant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get tenant by domain
CREATE OR REPLACE FUNCTION get_tenant_by_domain(p_domain TEXT)
RETURNS tenants AS $$
DECLARE
  v_tenant tenants;
BEGIN
  SELECT * INTO v_tenant
  FROM tenants
  WHERE domain = p_domain
    AND status = 'active';

  RETURN v_tenant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's tenants
CREATE OR REPLACE FUNCTION get_user_tenants(p_user_id UUID)
RETURNS TABLE(
  tenant_id UUID,
  tenant_name TEXT,
  subdomain TEXT,
  role TEXT,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.tenant_name,
    t.subdomain,
    ut.role,
    ut.is_active
  FROM user_tenants ut
  JOIN tenants t ON t.id = ut.tenant_id
  WHERE ut.user_id = p_user_id
    AND ut.is_active = true
    AND t.status = 'active'
  ORDER BY ut.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has access to tenant
CREATE OR REPLACE FUNCTION user_has_tenant_access(
  p_user_id UUID,
  p_tenant_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_tenants
    WHERE user_id = p_user_id
      AND tenant_id = p_tenant_id
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES - TENANT ISOLATION
-- ============================================================================

-- Enable RLS on tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;

-- Users can view tenants they belong to
CREATE POLICY "Users can view their tenants"
  ON tenants FOR SELECT
  USING (
    id IN (
      SELECT tenant_id
      FROM user_tenants
      WHERE user_id = auth.uid()
        AND is_active = true
    )
  );

-- Tenant owners and admins can update their tenant
CREATE POLICY "Tenant owners and admins can update tenant"
  ON tenants FOR UPDATE
  USING (
    id IN (
      SELECT tenant_id
      FROM user_tenants
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Users can view their tenant associations
CREATE POLICY "Users can view their tenant associations"
  ON user_tenants FOR SELECT
  USING (user_id = auth.uid());

-- Update existing RLS policies to include tenant isolation
-- customer_contacts: Users can only see contacts from their tenant(s)
DROP POLICY IF EXISTS "Admins can view customer contacts" ON customer_contacts;
CREATE POLICY "Users can view contacts from their tenants"
  ON customer_contacts FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM user_tenants
      WHERE user_id = auth.uid()
        AND is_active = true
    )
    AND auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager')
    )
  );

-- customer_email_logs: Users can only see logs from their tenant(s)
CREATE POLICY "Users can view email logs from their tenants"
  ON customer_email_logs FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM user_tenants
      WHERE user_id = auth.uid()
        AND is_active = true
    )
  );

-- ta_agbot_locations: Users can only see tanks from their tenant(s)
CREATE POLICY "Users can view tanks from their tenants"
  ON ta_agbot_locations FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM user_tenants
      WHERE user_id = auth.uid()
        AND is_active = true
    )
  );

-- Grant permissions
GRANT SELECT ON tenants TO authenticated;
GRANT SELECT, UPDATE ON tenants TO service_role;
GRANT SELECT ON user_tenants TO authenticated;
GRANT ALL ON user_tenants TO service_role;

GRANT EXECUTE ON FUNCTION get_tenant_by_subdomain(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_tenant_by_domain(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_tenants(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION user_has_tenant_access(UUID, UUID) TO authenticated, service_role;

-- Success message
DO $$
DECLARE
  v_tenant_count INT;
BEGIN
  SELECT COUNT(*) INTO v_tenant_count FROM tenants;
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Multi-tenant system created successfully';
  RAISE NOTICE 'Tenants created: %', v_tenant_count;
  RAISE NOTICE 'Default tenant: Great Southern Fuel Supplies';
  RAISE NOTICE '============================================';
END $$;
