-- =====================================================
-- DATABASE SCHEMA AUDIT - ANALYTICS TABLES ONLY
-- =====================================================
-- This script audits the analytics platform schema
-- EXCLUDES: fuel_tanks, dip_readings, tank_groups (no changes to fuel monitoring)
-- =====================================================

-- =====================================================
-- SECTION 1: CHECK WHICH ANALYTICS TABLES EXIST
-- =====================================================

SELECT 'ANALYTICS TABLES AUDIT' as audit_section;

SELECT
  table_name,
  table_type,
  CASE
    WHEN table_name IN (
      'captive_payment_records',
      'lytx_safety_events',
      'guardian_events',
      'mtdata_trip_history',
      'drivers',
      'vehicles',
      'data_source_registry',
      'data_freshness_tracking',
      'data_availability_calendar',
      'data_import_batches',
      'driver_lytx_associations',
      'driver_guardian_associations',
      'driver_mtdata_associations'
    ) THEN 'EXPECTED'
    ELSE 'UNKNOWN'
  END as table_status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type IN ('BASE TABLE', 'VIEW', 'MATERIALIZED VIEW')
  AND table_name NOT IN ('dip_readings', 'fuel_tanks', 'tank_groups') -- EXCLUDE FUEL MONITORING
  AND table_name NOT LIKE '%tank%' -- EXCLUDE all tank-related tables
  AND table_name NOT LIKE '%dip%'  -- EXCLUDE all dip-related tables
ORDER BY table_type, table_name;

-- =====================================================
-- SECTION 2: CHECK WHICH ANALYTICS VIEWS EXIST
-- =====================================================

SELECT 'ANALYTICS VIEWS AUDIT' as audit_section;

SELECT
  table_name,
  table_type,
  CASE
    WHEN table_name IN (
      'cross_analytics_summary',
      'captive_payments_analytics',
      'lytx_safety_analytics',
      'lytx_events_enriched',
      'captive_deliveries',
      'captive_monthly_analytics',
      'captive_customer_analytics',
      'captive_terminal_analytics',
      'unified_driver_profile',
      'data_freshness_dashboard'
    ) THEN 'EXPECTED BY CODE'
    ELSE 'EXTRA/LEGACY'
  END as view_status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type IN ('VIEW', 'MATERIALIZED VIEW')
  AND table_name NOT LIKE '%tank%' -- EXCLUDE tank views
  AND table_name NOT LIKE '%dip%'  -- EXCLUDE dip views
ORDER BY view_status, table_name;

-- =====================================================
-- SECTION 3: CHECK CRITICAL VIEWS REFERENCED BY CODE
-- =====================================================

SELECT 'CRITICAL VIEW VALIDATION' as audit_section;

SELECT
  view_name,
  CASE
    WHEN view_name IN (
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type IN ('VIEW', 'MATERIALIZED VIEW')
    ) THEN 'EXISTS ✓'
    ELSE 'MISSING ✗'
  END as status,
  referenced_by
FROM (
  VALUES
    ('cross_analytics_summary', 'dataCentreSupabaseService.ts:126,245,327'),
    ('captive_payments_analytics', 'dataCentreSupabaseService.ts:147'),
    ('lytx_safety_analytics', 'dataCentreSupabaseService.ts:185'),
    ('lytx_events_enriched', '003_create_analytics_views.sql:78'),
    ('captive_deliveries', 'create_captive_payments_system.sql:81'),
    ('captive_monthly_analytics', 'create_captive_payments_system.sql:117'),
    ('captive_customer_analytics', 'create_captive_payments_system.sql:148'),
    ('captive_terminal_analytics', 'create_captive_payments_system.sql:176')
) AS critical_views(view_name, referenced_by);

-- =====================================================
-- SECTION 4: CHECK DATA FRESHNESS SYSTEM
-- =====================================================

SELECT 'DATA FRESHNESS SYSTEM AUDIT' as audit_section;

SELECT
  component,
  CASE
    WHEN component IN (
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    ) THEN 'EXISTS ✓'
    ELSE 'MISSING ✗'
  END as status,
  component_type
FROM (
  VALUES
    ('data_source_registry', 'TABLE'),
    ('data_freshness_tracking', 'TABLE'),
    ('data_availability_calendar', 'TABLE'),
    ('data_freshness_dashboard', 'VIEW'),
    ('freshness_status', 'TYPE'),
    ('data_source_type', 'TYPE')
) AS freshness_components(component, component_type);

-- =====================================================
-- SECTION 5: CHECK DRIVER ASSOCIATION TABLES
-- =====================================================

SELECT 'DRIVER ASSOCIATION SYSTEM AUDIT' as audit_section;

SELECT
  table_name,
  CASE
    WHEN table_name IN (
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    ) THEN 'EXISTS ✓'
    ELSE 'MISSING ✗'
  END as status,
  purpose
FROM (
  VALUES
    ('drivers', 'Core driver registry'),
    ('driver_lytx_associations', 'Links drivers to LYTX events'),
    ('driver_guardian_associations', 'Links drivers to Guardian events'),
    ('driver_mtdata_associations', 'Links drivers to MTData trips'),
    ('unified_driver_profile', 'Unified view across all systems')
) AS driver_tables(table_name, purpose);

-- =====================================================
-- SECTION 6: CHECK FOREIGN KEY CONSTRAINTS
-- =====================================================

SELECT 'FOREIGN KEY CONSTRAINTS AUDIT' as audit_section;

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'captive_payment_records',
    'lytx_safety_events',
    'guardian_events',
    'mtdata_trip_history',
    'driver_lytx_associations',
    'driver_guardian_associations',
    'driver_mtdata_associations'
  )
ORDER BY tc.table_name, kcu.column_name;

-- =====================================================
-- SECTION 7: CHECK INDEXES ON ANALYTICS TABLES
-- =====================================================

SELECT 'ANALYTICS TABLE INDEXES AUDIT' as audit_section;

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'captive_payment_records',
    'lytx_safety_events',
    'guardian_events',
    'mtdata_trip_history',
    'vehicles',
    'drivers'
  )
ORDER BY tablename, indexname;

-- =====================================================
-- SECTION 8: CHECK ROW COUNTS (DATA VALIDATION)
-- =====================================================

SELECT 'DATA VOLUME AUDIT' as audit_section;

DO $$
DECLARE
  table_record RECORD;
  row_count BIGINT;
BEGIN
  FOR table_record IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name IN (
        'captive_payment_records',
        'lytx_safety_events',
        'guardian_events',
        'mtdata_trip_history',
        'vehicles',
        'drivers',
        'data_source_registry',
        'data_freshness_tracking'
      )
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I', table_record.table_name) INTO row_count;
    RAISE NOTICE 'Table: % - Row Count: %', table_record.table_name, row_count;
  END LOOP;
END $$;

-- =====================================================
-- SECTION 9: CHECK CUSTOM TYPES
-- =====================================================

SELECT 'CUSTOM TYPES AUDIT' as audit_section;

SELECT
  t.typname as type_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN (
  'carrier_type',
  'freshness_status',
  'data_source_type'
)
GROUP BY t.typname
ORDER BY t.typname;

-- =====================================================
-- SECTION 10: SUMMARY REPORT
-- =====================================================

SELECT 'AUDIT SUMMARY' as audit_section;

SELECT
  'Expected Analytics Tables' as category,
  COUNT(*) as total
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'captive_payment_records',
    'lytx_safety_events',
    'guardian_events',
    'mtdata_trip_history',
    'drivers',
    'vehicles',
    'data_source_registry',
    'data_freshness_tracking'
  )

UNION ALL

SELECT
  'Expected Analytics Views',
  COUNT(*)
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type IN ('VIEW', 'MATERIALIZED VIEW')
  AND table_name IN (
    'cross_analytics_summary',
    'captive_payments_analytics',
    'lytx_safety_analytics',
    'lytx_events_enriched',
    'captive_deliveries'
  )

UNION ALL

SELECT
  'Foreign Key Constraints',
  COUNT(DISTINCT tc.constraint_name)
FROM information_schema.table_constraints AS tc
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name LIKE '%captive%' OR tc.table_name LIKE '%lytx%' OR tc.table_name LIKE '%guardian%';

SELECT '========================================' as divider;
SELECT 'SCHEMA AUDIT COMPLETE' as status;
SELECT 'Review output above to identify missing components' as next_steps;
