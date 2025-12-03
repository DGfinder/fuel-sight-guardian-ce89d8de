-- Migration: Create Great Southern Fuels Schema
-- Description: Create schema and copy table structures from public
-- Author: Claude Code
-- Date: 2025-01-02
-- Phase: 3.1 - Schema Creation

-- =============================================================================
-- CREATE GREAT SOUTHERN FUELS SCHEMA
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS great_southern_fuels;

COMMENT ON SCHEMA great_southern_fuels IS
  'Tenant schema for Great Southern Fuels - complete data isolation with all ta_ tables';

-- =============================================================================
-- COPY TABLE STRUCTURES (All 28 ta_ tables)
-- =============================================================================
-- Creates table structures identical to public schema
-- INCLUDING ALL copies: constraints, indexes, defaults, comments

DO $$
BEGIN
  RAISE NOTICE 'Creating table structures in great_southern_fuels schema...';
END $$;

-- Core Business Tables
CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_businesses (
  LIKE public.ta_businesses INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_groups (
  LIKE public.ta_groups INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_subgroups (
  LIKE public.ta_subgroups INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_locations (
  LIKE public.ta_locations INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_products (
  LIKE public.ta_products INCLUDING ALL
);

-- Tank Management Tables (CRITICAL)
CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_tanks (
  LIKE public.ta_tanks INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_tank_dips (
  LIKE public.ta_tank_dips INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_tank_sources (
  LIKE public.ta_tank_sources INCLUDING ALL
);

-- Delivery & Logistics
CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_deliveries (
  LIKE public.ta_deliveries INCLUDING ALL
);

-- Alerts & Monitoring
CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_alerts (
  LIKE public.ta_alerts INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_alert_history (
  LIKE public.ta_alert_history INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_anomaly_events (
  LIKE public.ta_anomaly_events INCLUDING ALL
);

-- AgBot Integration Tables
CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_agbot_locations (
  LIKE public.ta_agbot_locations INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_agbot_assets (
  LIKE public.ta_agbot_assets INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_agbot_readings (
  LIKE public.ta_agbot_readings INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_agbot_device_health (
  LIKE public.ta_agbot_device_health INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_agbot_alerts (
  LIKE public.ta_agbot_alerts INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_agbot_sync_log (
  LIKE public.ta_agbot_sync_log INCLUDING ALL
);

-- User Management
CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_users (
  LIKE public.ta_users INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_user_business_access (
  LIKE public.ta_user_business_access INCLUDING ALL
);

-- System & Configuration
CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_subscriptions (
  LIKE public.ta_subscriptions INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_api_keys (
  LIKE public.ta_api_keys INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_audit_log (
  LIKE public.ta_audit_log INCLUDING ALL
);

-- Analytics & Predictions
CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_prediction_history (
  LIKE public.ta_prediction_history INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS great_southern_fuels.ta_fleet_snapshots (
  LIKE public.ta_fleet_snapshots INCLUDING ALL
);

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  -- Count tables created
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'great_southern_fuels'
    AND table_type = 'BASE TABLE';

  RAISE NOTICE '============================================';
  RAISE NOTICE 'SCHEMA CREATION COMPLETE';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Schema: great_southern_fuels';
  RAISE NOTICE 'Tables created: %', table_count;
  RAISE NOTICE 'Expected: 25 ta_ tables';

  IF table_count < 25 THEN
    RAISE WARNING 'Table count mismatch! Expected 25+, got %', table_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Run 005_migrate_gsf_data.sql to copy data';
  RAISE NOTICE '============================================';
END $$;
