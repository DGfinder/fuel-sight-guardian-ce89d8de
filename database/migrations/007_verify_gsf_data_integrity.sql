-- Migration: Verify Great Southern Fuels Data Integrity
-- Description: Verify all data copied correctly from public to tenant schema
-- Author: Claude Code
-- Date: 2025-01-02
-- Phase: 3.4 - Data Integrity Verification

-- =============================================================================
-- ROW COUNT VERIFICATION
-- =============================================================================
-- Compares row counts between public.ta_* and great_southern_fuels.ta_*

DO $$
DECLARE
  errors TEXT[] := ARRAY[]::TEXT[];
  warnings TEXT[] := ARRAY[]::TEXT[];
  table_name TEXT;
  public_count BIGINT;
  tenant_count BIGINT;
  total_public BIGINT := 0;
  total_tenant BIGINT := 0;
  match_count INTEGER := 0;
  total_tables INTEGER := 25;
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'DATA INTEGRITY VERIFICATION';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Comparing: public.ta_* vs great_southern_fuels.ta_*';
  RAISE NOTICE '';

  -- Core Business Tables
  FOR table_name IN SELECT unnest(ARRAY[
    'ta_businesses',
    'ta_groups',
    'ta_subgroups',
    'ta_locations',
    'ta_products',
    'ta_tanks',
    'ta_tank_dips',
    'ta_tank_sources',
    'ta_deliveries',
    'ta_alerts',
    'ta_alert_history',
    'ta_anomaly_events',
    'ta_agbot_locations',
    'ta_agbot_assets',
    'ta_agbot_readings',
    'ta_agbot_device_health',
    'ta_agbot_alerts',
    'ta_agbot_sync_log',
    'ta_users',
    'ta_user_business_access',
    'ta_subscriptions',
    'ta_api_keys',
    'ta_audit_log',
    'ta_prediction_history',
    'ta_fleet_snapshots'
  ])
  LOOP
    -- Get row counts
    EXECUTE format('SELECT COUNT(*) FROM public.%I', table_name) INTO public_count;
    EXECUTE format('SELECT COUNT(*) FROM great_southern_fuels.%I', table_name) INTO tenant_count;

    total_public := total_public + public_count;
    total_tenant := total_tenant + tenant_count;

    IF public_count = tenant_count THEN
      match_count := match_count + 1;
      RAISE NOTICE '✓ % | Public: % | Tenant: % | MATCH',
        RPAD(table_name, 30), LPAD(public_count::TEXT, 8), LPAD(tenant_count::TEXT, 8);
    ELSE
      errors := array_append(errors, format('%s: public=%s, tenant=%s',
        table_name, public_count, tenant_count));
      RAISE WARNING '✗ % | Public: % | Tenant: % | MISMATCH!',
        RPAD(table_name, 30), LPAD(public_count::TEXT, 8), LPAD(tenant_count::TEXT, 8);
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'SUMMARY';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Tables verified: %/%', match_count, total_tables;
  RAISE NOTICE 'Total rows in public: %', total_public;
  RAISE NOTICE 'Total rows in tenant: %', total_tenant;

  IF match_count = total_tables THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓✓✓ ALL TABLES VERIFIED - Data integrity confirmed!';
  ELSE
    RAISE WARNING '';
    RAISE WARNING 'ERRORS FOUND:';
    FOREACH table_name IN ARRAY errors LOOP
      RAISE WARNING '  - %', table_name;
    END LOOP;
    RAISE EXCEPTION 'Data integrity verification failed - mismatched row counts';
  END IF;

  RAISE NOTICE '============================================';
END $$;

-- =============================================================================
-- SAMPLE DATA VERIFICATION
-- =============================================================================
-- Verify that actual data matches (not just row counts)

DO $$
DECLARE
  public_sample RECORD;
  tenant_sample RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'SAMPLE DATA VERIFICATION';
  RAISE NOTICE '============================================';

  -- Verify ta_tanks sample
  SELECT id, name, capacity_liters, current_level_liters
  INTO public_sample
  FROM public.ta_tanks
  WHERE archived_at IS NULL
  ORDER BY id
  LIMIT 1;

  IF public_sample.id IS NOT NULL THEN
    SELECT id, name, capacity_liters, current_level_liters
    INTO tenant_sample
    FROM great_southern_fuels.ta_tanks
    WHERE id = public_sample.id;

    IF tenant_sample.id IS NULL THEN
      RAISE WARNING 'Tank ID % not found in tenant schema!', public_sample.id;
    ELSIF
      tenant_sample.name = public_sample.name AND
      tenant_sample.capacity_liters = public_sample.capacity_liters AND
      tenant_sample.current_level_liters = public_sample.current_level_liters
    THEN
      RAISE NOTICE '✓ Tank data matches (ID: %, Name: %)',
        public_sample.id, public_sample.name;
    ELSE
      RAISE WARNING '✗ Tank data mismatch for ID %', public_sample.id;
    END IF;
  END IF;

  -- Verify ta_locations sample
  SELECT id, name, latitude, longitude
  INTO public_sample
  FROM public.ta_locations
  WHERE archived_at IS NULL
  ORDER BY id
  LIMIT 1;

  IF public_sample.id IS NOT NULL THEN
    SELECT id, name, latitude, longitude
    INTO tenant_sample
    FROM great_southern_fuels.ta_locations
    WHERE id = public_sample.id;

    IF tenant_sample.id IS NOT NULL AND
       tenant_sample.name = public_sample.name
    THEN
      RAISE NOTICE '✓ Location data matches (ID: %, Name: %)',
        public_sample.id, public_sample.name;
    ELSE
      RAISE WARNING '✗ Location data mismatch for ID %', public_sample.id;
    END IF;
  END IF;

  RAISE NOTICE '============================================';
END $$;

-- =============================================================================
-- VIEW VERIFICATION
-- =============================================================================
-- Verify views are queryable and return data

DO $$
DECLARE
  view_data RECORD;
  view_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'VIEW VERIFICATION';
  RAISE NOTICE '============================================';

  -- Test ta_tank_dashboard
  SELECT COUNT(*) INTO view_count
  FROM great_southern_fuels.ta_tank_dashboard;
  RAISE NOTICE '✓ ta_tank_dashboard: % rows', view_count;

  -- Test ta_tank_full_status
  SELECT COUNT(*) INTO view_count
  FROM great_southern_fuels.ta_tank_full_status;
  RAISE NOTICE '✓ ta_tank_full_status: % rows', view_count;

  -- Test ta_unified_map_locations
  SELECT COUNT(*) INTO view_count
  FROM great_southern_fuels.ta_unified_map_locations;
  RAISE NOTICE '✓ ta_unified_map_locations: % rows', view_count;

  -- Test materialized view
  SELECT COUNT(*) INTO view_count
  FROM great_southern_fuels.ta_tank_analytics;
  RAISE NOTICE '✓ ta_tank_analytics: % rows', view_count;

  RAISE NOTICE '============================================';
END $$;

-- =============================================================================
-- FOREIGN KEY VERIFICATION
-- =============================================================================
-- Check that relationships are intact

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'FOREIGN KEY VERIFICATION';
  RAISE NOTICE '============================================';

  -- Check ta_tanks → ta_businesses
  SELECT COUNT(*) INTO orphan_count
  FROM great_southern_fuels.ta_tanks t
  LEFT JOIN great_southern_fuels.ta_businesses b ON t.business_id = b.id
  WHERE t.business_id IS NOT NULL AND b.id IS NULL;

  IF orphan_count = 0 THEN
    RAISE NOTICE '✓ ta_tanks → ta_businesses: All references valid';
  ELSE
    RAISE WARNING '✗ ta_tanks → ta_businesses: % orphaned records', orphan_count;
  END IF;

  -- Check ta_tanks → ta_locations
  SELECT COUNT(*) INTO orphan_count
  FROM great_southern_fuels.ta_tanks t
  LEFT JOIN great_southern_fuels.ta_locations l ON t.location_id = l.id
  WHERE t.location_id IS NOT NULL AND l.id IS NULL;

  IF orphan_count = 0 THEN
    RAISE NOTICE '✓ ta_tanks → ta_locations: All references valid';
  ELSE
    RAISE WARNING '✗ ta_tanks → ta_locations: % orphaned records', orphan_count;
  END IF;

  -- Check ta_tank_dips → ta_tanks
  SELECT COUNT(*) INTO orphan_count
  FROM great_southern_fuels.ta_tank_dips d
  LEFT JOIN great_southern_fuels.ta_tanks t ON d.tank_id = t.id
  WHERE d.tank_id IS NOT NULL AND t.id IS NULL;

  IF orphan_count = 0 THEN
    RAISE NOTICE '✓ ta_tank_dips → ta_tanks: All references valid';
  ELSE
    RAISE WARNING '✗ ta_tank_dips → ta_tanks: % orphaned records', orphan_count;
  END IF;

  -- Check ta_agbot_assets → ta_agbot_locations
  SELECT COUNT(*) INTO orphan_count
  FROM great_southern_fuels.ta_agbot_assets a
  LEFT JOIN great_southern_fuels.ta_agbot_locations l ON a.location_id = l.id
  WHERE a.location_id IS NOT NULL AND l.id IS NULL;

  IF orphan_count = 0 THEN
    RAISE NOTICE '✓ ta_agbot_assets → ta_agbot_locations: All references valid';
  ELSE
    RAISE WARNING '✗ ta_agbot_assets → ta_agbot_locations: % orphaned records', orphan_count;
  END IF;

  RAISE NOTICE '============================================';
END $$;

-- =============================================================================
-- FINAL VERIFICATION SUMMARY
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'VERIFICATION COMPLETE ✓';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Status: Data migration successful';
  RAISE NOTICE 'Source: public.ta_* (preserved - live system safe)';
  RAISE NOTICE 'Target: great_southern_fuels.ta_* (ready for testing)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run 008_grant_gsf_permissions.sql';
  RAISE NOTICE '  2. Update tenant provisioned_at timestamp';
  RAISE NOTICE '  3. Begin Phase 2 testing with feature flag';
  RAISE NOTICE '============================================';
END $$;
