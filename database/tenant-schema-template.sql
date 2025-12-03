-- Tenant Schema Provisioning Template
-- Description: Reusable script to provision a new tenant schema with all ta_ tables
-- Usage: Replace {{SCHEMA_NAME}} with actual tenant schema name
-- Author: Claude Code
-- Date: 2025-01-02

-- =============================================================================
-- SCHEMA CREATION
-- =============================================================================
-- Create the tenant schema (e.g., great_southern_fuels, acme_corp, etc.)

CREATE SCHEMA IF NOT EXISTS {{SCHEMA_NAME}};

COMMENT ON SCHEMA {{SCHEMA_NAME}} IS
  'Tenant-specific schema with complete data isolation. Contains all ta_ tables and views.';

-- =============================================================================
-- TABLE CREATION (All 28 ta_ tables)
-- =============================================================================
-- Create table structures by copying from public schema templates
-- IMPORTANT: This assumes public.ta_* tables exist as source templates

-- Core Business Tables
CREATE TABLE {{SCHEMA_NAME}}.ta_businesses (LIKE public.ta_businesses INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_groups (LIKE public.ta_groups INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_subgroups (LIKE public.ta_subgroups INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_locations (LIKE public.ta_locations INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_products (LIKE public.ta_products INCLUDING ALL);

-- Tank Management Tables (CRITICAL)
CREATE TABLE {{SCHEMA_NAME}}.ta_tanks (LIKE public.ta_tanks INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_tank_dips (LIKE public.ta_tank_dips INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_tank_sources (LIKE public.ta_tank_sources INCLUDING ALL);

-- Delivery & Logistics
CREATE TABLE {{SCHEMA_NAME}}.ta_deliveries (LIKE public.ta_deliveries INCLUDING ALL);

-- Alerts & Monitoring
CREATE TABLE {{SCHEMA_NAME}}.ta_alerts (LIKE public.ta_alerts INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_alert_history (LIKE public.ta_alert_history INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_anomaly_events (LIKE public.ta_anomaly_events INCLUDING ALL);

-- AgBot Integration Tables
CREATE TABLE {{SCHEMA_NAME}}.ta_agbot_locations (LIKE public.ta_agbot_locations INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_agbot_assets (LIKE public.ta_agbot_assets INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_agbot_readings (LIKE public.ta_agbot_readings INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_agbot_device_health (LIKE public.ta_agbot_device_health INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_agbot_alerts (LIKE public.ta_agbot_alerts INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_agbot_sync_log (LIKE public.ta_agbot_sync_log INCLUDING ALL);

-- User Management
CREATE TABLE {{SCHEMA_NAME}}.ta_users (LIKE public.ta_users INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_user_business_access (LIKE public.ta_user_business_access INCLUDING ALL);

-- System & Configuration
CREATE TABLE {{SCHEMA_NAME}}.ta_subscriptions (LIKE public.ta_subscriptions INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_api_keys (LIKE public.ta_api_keys INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_audit_log (LIKE public.ta_audit_log INCLUDING ALL);

-- Analytics & Predictions
CREATE TABLE {{SCHEMA_NAME}}.ta_prediction_history (LIKE public.ta_prediction_history INCLUDING ALL);
CREATE TABLE {{SCHEMA_NAME}}.ta_fleet_snapshots (LIKE public.ta_fleet_snapshots INCLUDING ALL);

-- =============================================================================
-- VIEWS CREATION
-- =============================================================================
-- Recreate views in tenant schema
-- NOTE: Views must reference {{SCHEMA_NAME}} tables, not public tables

-- Tank Dashboard View (if exists in public)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'ta_tank_dashboard') THEN
    EXECUTE format('
      CREATE OR REPLACE VIEW %I.ta_tank_dashboard AS
      SELECT * FROM %I.ta_tanks  -- Simplified, replace with actual view definition
    ', '{{SCHEMA_NAME}}', '{{SCHEMA_NAME}}');
  END IF;
END $$;

-- Tank Full Status View
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'ta_tank_full_status') THEN
    EXECUTE format('
      CREATE OR REPLACE VIEW %I.ta_tank_full_status AS
      SELECT * FROM %I.ta_tanks  -- Simplified, replace with actual view definition
    ', '{{SCHEMA_NAME}}', '{{SCHEMA_NAME}}');
  END IF;
END $$;

-- Unified Map Locations View
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'ta_unified_map_locations') THEN
    EXECUTE format('
      CREATE OR REPLACE VIEW %I.ta_unified_map_locations AS
      SELECT * FROM %I.ta_locations  -- Simplified, replace with actual view definition
    ', '{{SCHEMA_NAME}}', '{{SCHEMA_NAME}}');
  END IF;
END $$;

-- Basic tank data view
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'tanks_basic_data') THEN
    EXECUTE format('
      CREATE OR REPLACE VIEW %I.tanks_basic_data AS
      SELECT * FROM %I.ta_tanks  -- Simplified, replace with actual view definition
    ', '{{SCHEMA_NAME}}', '{{SCHEMA_NAME}}');
  END IF;
END $$;

-- Tanks with latest dip
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'tanks_with_latest_dip') THEN
    EXECUTE format('
      CREATE OR REPLACE VIEW %I.tanks_with_latest_dip AS
      SELECT * FROM %I.ta_tanks  -- Simplified, replace with actual view definition
    ', '{{SCHEMA_NAME}}', '{{SCHEMA_NAME}}');
  END IF;
END $$;

-- Tanks with latest reading
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'tanks_with_latest_reading') THEN
    EXECUTE format('
      CREATE OR REPLACE VIEW %I.tanks_with_latest_reading AS
      SELECT * FROM %I.ta_tanks  -- Simplified, replace with actual view definition
    ', '{{SCHEMA_NAME}}', '{{SCHEMA_NAME}}');
  END IF;
END $$;

-- Tanks with rolling average
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'tanks_with_rolling_avg') THEN
    EXECUTE format('
      CREATE OR REPLACE VIEW %I.tanks_with_rolling_avg AS
      SELECT * FROM %I.ta_tanks  -- Simplified, replace with actual view definition
    ', '{{SCHEMA_NAME}}', '{{SCHEMA_NAME}}');
  END IF;
END $$;

-- =============================================================================
-- PERMISSIONS & SECURITY
-- =============================================================================

-- Revoke public access
REVOKE ALL ON SCHEMA {{SCHEMA_NAME}} FROM PUBLIC;
REVOKE ALL ON SCHEMA {{SCHEMA_NAME}} FROM anon;

-- Grant schema usage to authenticated users
GRANT USAGE ON SCHEMA {{SCHEMA_NAME}} TO authenticated;

-- Grant table permissions to authenticated role
-- Users will be restricted via search_path, not RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA {{SCHEMA_NAME}} TO authenticated;

-- Grant sequence permissions (for auto-increment IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA {{SCHEMA_NAME}} TO authenticated;

-- Grant view permissions
GRANT SELECT ON ALL TABLES IN SCHEMA {{SCHEMA_NAME}} TO authenticated;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA {{SCHEMA_NAME}}
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA {{SCHEMA_NAME}}
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  table_count INTEGER;
  view_count INTEGER;
BEGIN
  -- Count tables in schema
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = '{{SCHEMA_NAME}}'
    AND table_type = 'BASE TABLE';

  -- Count views in schema
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = '{{SCHEMA_NAME}}';

  RAISE NOTICE '============================================';
  RAISE NOTICE 'TENANT SCHEMA PROVISIONING COMPLETE';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Schema: {{SCHEMA_NAME}}';
  RAISE NOTICE 'Tables created: %', table_count;
  RAISE NOTICE 'Views created: %', view_count;
  RAISE NOTICE 'Permissions: Granted to authenticated role';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected tables: 25 (ta_ prefixed)';
  IF table_count < 25 THEN
    RAISE WARNING 'Table count mismatch! Expected 25+, got %. Verify migration.', table_count;
  END IF;
  RAISE NOTICE '============================================';
END $$;

-- =============================================================================
-- USAGE INSTRUCTIONS
-- =============================================================================

/*
USAGE:

1. Replace {{SCHEMA_NAME}} with actual tenant schema name:
   Example: sed 's/{{SCHEMA_NAME}}/great_southern_fuels/g' tenant-schema-template.sql > provision-gsf.sql

2. Run the generated SQL file:
   psql -U your_user -d your_database -f provision-gsf.sql

3. Verify schema creation:
   SELECT * FROM information_schema.schemata WHERE schema_name = 'great_southern_fuels';

4. Test search_path:
   SET search_path TO great_southern_fuels, public;
   SELECT * FROM ta_tanks LIMIT 1;

5. Update tenant record:
   UPDATE public.whitelabel_tenants
   SET provisioned_at = NOW()
   WHERE schema_name = 'great_southern_fuels';

AUTOMATED PROVISIONING:

Use the provision_tenant_schema() function (created in later migration):
   SELECT public.provision_tenant_schema(
     'acme-corp',                    -- tenant_key
     'Acme Corporation',             -- company_name
     'admin@acmecorp.com',           -- owner_email
     'acme.tankalert.com.au'         -- subdomain (optional)
   );
*/
