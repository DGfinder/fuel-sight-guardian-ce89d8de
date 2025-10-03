-- =====================================================
-- TEST ANALYTICS QUERIES - VALIDATION SCRIPT
-- =====================================================
-- Tests all queries used by the analytics platform code
-- Identifies which queries will fail in production
-- =====================================================

\timing on
\set ON_ERROR_STOP off

-- =====================================================
-- TEST 1: DataCentreSupabaseService Queries
-- =====================================================

\echo '========================================'
\echo 'TEST 1: cross_analytics_summary (dataCentreSupabaseService.ts:126)'
\echo '========================================'

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'cross_analytics_summary'
    ) THEN 'VIEW EXISTS - Testing query...'
    ELSE 'VIEW MISSING ✗'
  END as status;

-- Actual query from dataCentreSupabaseService.ts:126
SELECT * FROM cross_analytics_summary
WHERE year >= EXTRACT(YEAR FROM CURRENT_DATE) - 1
LIMIT 5;

\echo '========================================'
\echo 'TEST 2: captive_payments_analytics (dataCentreSupabaseService.ts:147)'
\echo '========================================'

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'captive_payments_analytics'
    ) THEN 'VIEW EXISTS - Testing query...'
    ELSE 'VIEW MISSING ✗'
  END as status;

-- Actual query from dataCentreSupabaseService.ts:147
SELECT * FROM captive_payments_analytics
ORDER BY year DESC, month
LIMIT 5;

\echo '========================================'
\echo 'TEST 3: lytx_safety_analytics (dataCentreSupabaseService.ts:185)'
\echo '========================================'

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'lytx_safety_analytics'
    ) THEN 'VIEW EXISTS - Testing query...'
    ELSE 'VIEW MISSING ✗'
  END as status;

-- Actual query from dataCentreSupabaseService.ts:185
SELECT * FROM lytx_safety_analytics
ORDER BY year DESC, month
LIMIT 5;

\echo '========================================'
\echo 'TEST 4: lytx_safety_events (dataCentreSupabaseService.ts:194)'
\echo '========================================'

-- Query for event types
SELECT event_type, COUNT(*) as count
FROM lytx_safety_events
WHERE excluded IS NOT TRUE
GROUP BY event_type
LIMIT 5;

\echo '========================================'
\echo 'TEST 5: data_import_batches (dataCentreSupabaseService.ts:269)'
\echo '========================================'

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'data_import_batches'
    ) THEN 'TABLE EXISTS - Testing query...'
    ELSE 'TABLE MISSING ✗'
  END as status;

-- Actual query from dataCentreSupabaseService.ts:269
SELECT source_type, source_subtype, status, records_processed, completed_at
FROM data_import_batches
ORDER BY started_at DESC
LIMIT 10;

-- =====================================================
-- TEST 6: Captive Payments API Queries
-- =====================================================

\echo '========================================'
\echo 'TEST 6: captive_deliveries materialized view'
\echo '========================================'

SELECT * FROM captive_deliveries
ORDER BY delivery_date DESC
LIMIT 5;

\echo '========================================'
\echo 'TEST 7: captive_monthly_analytics view'
\echo '========================================'

SELECT * FROM captive_monthly_analytics
ORDER BY month_start DESC
LIMIT 5;

\echo '========================================'
\echo 'TEST 8: captive_customer_analytics view'
\echo '========================================'

SELECT * FROM captive_customer_analytics
ORDER BY total_volume_litres DESC
LIMIT 5;

\echo '========================================'
\echo 'TEST 9: captive_terminal_analytics view'
\echo '========================================'

SELECT * FROM captive_terminal_analytics
ORDER BY percentage_of_carrier_volume DESC
LIMIT 5;

-- =====================================================
-- TEST 10: LYTX Events Enriched View
-- =====================================================

\echo '========================================'
\echo 'TEST 10: lytx_events_enriched view (vehicle mapping)'
\echo '========================================'

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'lytx_events_enriched'
    ) THEN 'VIEW EXISTS - Testing query...'
    ELSE 'VIEW MISSING ✗'
  END as status;

SELECT
  event_id,
  driver_name,
  vehicle_registration,
  resolved_registration,
  resolved_fleet,
  resolved_depot,
  vehicle_id
FROM lytx_events_enriched
LIMIT 5;

-- =====================================================
-- TEST 11: Data Freshness System
-- =====================================================

\echo '========================================'
\echo 'TEST 11: data_source_registry table'
\echo '========================================'

SELECT
  source_key,
  display_name,
  table_name,
  is_active
FROM data_source_registry
WHERE is_active = TRUE
LIMIT 10;

\echo '========================================'
\echo 'TEST 12: data_freshness_tracking table'
\echo '========================================'

SELECT
  source_key,
  last_updated_at,
  record_count,
  freshness_status,
  hours_since_update
FROM data_freshness_tracking
ORDER BY checked_at DESC
LIMIT 10;

-- =====================================================
-- TEST 13: Driver Profile System
-- =====================================================

\echo '========================================'
\echo 'TEST 13: unified_driver_profile view'
\echo '========================================'

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'unified_driver_profile'
    ) THEN 'VIEW EXISTS - Testing query...'
    ELSE 'VIEW MISSING ✗'
  END as status;

SELECT *
FROM unified_driver_profile
LIMIT 5;

\echo '========================================'
\echo 'TEST 14: driver_lytx_associations table'
\echo '========================================'

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'driver_lytx_associations'
    ) THEN 'TABLE EXISTS'
    ELSE 'TABLE MISSING ✗'
  END as status;

\echo '========================================'
\echo 'TEST 15: driver_guardian_associations table'
\echo '========================================'

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'driver_guardian_associations'
    ) THEN 'TABLE EXISTS'
    ELSE 'TABLE MISSING ✗'
  END as status;

-- =====================================================
-- TEST 16: Field Name Validation
-- =====================================================

\echo '========================================'
\echo 'TEST 16: Validate field names in analytics views'
\echo '========================================'

-- Check if cross_analytics_summary has expected fields
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cross_analytics_summary'
  AND column_name IN (
    'fleet', 'depot', 'month', 'year', 'captive_deliveries',
    'captive_volume_ml', 'safety_events', 'guardian_events',
    'active_vehicles', 'avg_safety_score', 'events_per_vehicle'
  )
ORDER BY column_name;

-- Check if lytx_safety_analytics has expected fields
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'lytx_safety_analytics'
  AND column_name IN (
    'carrier', 'depot', 'month', 'year', 'total_events',
    'coachable_events', 'avg_score', 'unique_drivers'
  )
ORDER BY column_name;

-- =====================================================
-- TEST 17: Data Integrity Checks
-- =====================================================

\echo '========================================'
\echo 'TEST 17: Check for NULL critical fields'
\echo '========================================'

-- Check captive_payment_records for NULL critical fields
SELECT
  'captive_payment_records' as table_name,
  COUNT(*) FILTER (WHERE bill_of_lading IS NULL) as null_bol,
  COUNT(*) FILTER (WHERE delivery_date IS NULL) as null_date,
  COUNT(*) FILTER (WHERE customer IS NULL) as null_customer,
  COUNT(*) FILTER (WHERE volume_litres IS NULL) as null_volume
FROM captive_payment_records;

-- Check lytx_safety_events for NULL critical fields
SELECT
  'lytx_safety_events' as table_name,
  COUNT(*) FILTER (WHERE event_id IS NULL) as null_event_id,
  COUNT(*) FILTER (WHERE driver_name IS NULL) as null_driver,
  COUNT(*) FILTER (WHERE vehicle_registration IS NULL) as null_vehicle,
  COUNT(*) FILTER (WHERE event_datetime IS NULL) as null_datetime
FROM lytx_safety_events;

-- =====================================================
-- SUMMARY REPORT
-- =====================================================

\echo '========================================'
\echo 'QUERY VALIDATION SUMMARY'
\echo '========================================'

SELECT
  'Total views tested' as metric,
  10 as value
UNION ALL
SELECT
  'Critical views for DataCentre',
  5
UNION ALL
SELECT
  'Captive payment views',
  4
UNION ALL
SELECT
  'Driver profile components',
  3;

\echo ''
\echo 'Review output above for:'
\echo '  1. VIEW MISSING errors - need to create missing views'
\echo '  2. TABLE MISSING errors - need to run migrations'
\echo '  3. Query errors - field name mismatches'
\echo '  4. NULL values - data integrity issues'
\echo ''
\echo 'Next steps: Fix identified issues before proceeding'
