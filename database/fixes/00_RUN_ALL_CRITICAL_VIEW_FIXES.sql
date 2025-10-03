-- =====================================================
-- RUN ALL CRITICAL ANALYTICS VIEW FIXES
-- =====================================================
-- This script creates all missing critical analytics views
-- Run this to fix DataCentreSupabaseService query failures
-- =====================================================
-- IMPORTANT: Does NOT touch fuel tank monitoring system
-- =====================================================

\echo '========================================='
\echo 'ANALYTICS PLATFORM VIEW CREATION'
\echo 'Creating critical missing views...'
\echo '========================================='
\echo ''

-- Set error handling
\set ON_ERROR_STOP on

-- =====================================================
-- STEP 1: cross_analytics_summary
-- =====================================================

\echo 'STEP 1/4: Creating cross_analytics_summary view...'
\i database/fixes/01_create_cross_analytics_summary.sql
\echo '✓ cross_analytics_summary created'
\echo ''

-- =====================================================
-- STEP 2: captive_payments_analytics
-- =====================================================

\echo 'STEP 2/4: Creating captive_payments_analytics view...'
\i database/fixes/02_create_captive_payments_analytics.sql
\echo '✓ captive_payments_analytics created'
\echo ''

-- =====================================================
-- STEP 3: lytx_safety_analytics
-- =====================================================

\echo 'STEP 3/4: Creating lytx_safety_analytics view...'
\i database/fixes/03_create_lytx_safety_analytics.sql
\echo '✓ lytx_safety_analytics created'
\echo ''

-- =====================================================
-- STEP 4: lytx_events_enriched
-- =====================================================

\echo 'STEP 4/4: Creating lytx_events_enriched view...'
\i database/fixes/04_create_lytx_events_enriched.sql
\echo '✓ lytx_events_enriched created'
\echo ''

-- =====================================================
-- VALIDATION
-- =====================================================

\echo '========================================='
\echo 'VALIDATION: Testing all created views...'
\echo '========================================='
\echo ''

-- Test each view
\echo 'Testing cross_analytics_summary...'
SELECT COUNT(*) as row_count FROM cross_analytics_summary;

\echo 'Testing captive_payments_analytics...'
SELECT COUNT(*) as row_count FROM captive_payments_analytics;

\echo 'Testing lytx_safety_analytics...'
SELECT COUNT(*) as row_count FROM lytx_safety_analytics;

\echo 'Testing lytx_events_enriched...'
SELECT COUNT(*) as row_count FROM lytx_events_enriched;

-- =====================================================
-- SUMMARY
-- =====================================================

\echo ''
\echo '========================================='
\echo 'SUCCESS: All critical views created!'
\echo '========================================='
\echo ''
\echo 'Created views:'
\echo '  ✓ cross_analytics_summary'
\echo '  ✓ captive_payments_analytics'
\echo '  ✓ lytx_safety_analytics'
\echo '  ✓ lytx_events_enriched'
\echo ''
\echo 'These views are now available for:'
\echo '  - DataCentreSupabaseService queries'
\echo '  - Analytics dashboards'
\echo '  - Vehicle-event mapping'
\echo ''
\echo 'Next steps:'
\echo '  1. Re-run diagnostics to verify (02_test_analytics_queries.sql)'
\echo '  2. Test DataCentre page in application'
\echo '  3. Verify data displays correctly'
\echo ''
\echo 'If errors occurred, check:'
\echo '  - Dependencies: captive_deliveries, lytx_safety_events, guardian_events, vehicles tables exist'
\echo '  - Permissions: User has SELECT/CREATE VIEW privileges'
\echo '  - Data: Tables have data to aggregate'
\echo ''
