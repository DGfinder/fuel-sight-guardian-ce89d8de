-- ============================================================================
-- SETUP TRIP CORRELATION SYSTEM
-- Run this script to set up the complete correlation system
-- ============================================================================

-- Step 1: Check if required tables exist
DO $$
BEGIN
  -- Check if mtdata_trip_history exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mtdata_trip_history') THEN
    RAISE EXCEPTION 'Table mtdata_trip_history does not exist. Run create_mtdata_trip_history_system.sql first.';
  END IF;
  
  -- Check if captive_payment_records exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'captive_payment_records') THEN
    RAISE EXCEPTION 'Table captive_payment_records does not exist. Run create_captive_payments_system.sql first.';
  END IF;
  
  -- Check if captive_deliveries view exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'captive_deliveries') THEN
    RAISE EXCEPTION 'Materialized view captive_deliveries does not exist. Run create_captive_payments_system.sql first.';
  END IF;
  
  RAISE NOTICE 'All required tables exist. Proceeding with correlation system setup...';
END $$;

-- Step 2: Create the correlation system
-- This will create the mtdata_captive_correlations table and related objects
\i database/migrations/create_mtdata_captive_correlations.sql

-- Step 3: Create the hybrid correlation engine functions
\i database/functions/hybrid_correlation_engine.sql

-- Step 4: Create the geospatial matching functions
\i database/functions/geospatial_trip_terminal_matching.sql

-- Step 5: Upgrade to the hybrid correlation system
\i database/migrations/upgrade_correlation_system_hybrid.sql

-- Step 6: Verify the setup
SELECT 
  'Correlation System Setup Complete' as status,
  (SELECT COUNT(*) FROM mtdata_captive_correlations) as correlations_count,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name = 'hybrid_correlate_trip_with_deliveries') as functions_created,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'correlation_analytics_summary') as views_created;

-- Step 7: Show sample data for verification
SELECT 
  'Sample Data Verification' as check_type,
  (SELECT COUNT(*) FROM mtdata_trip_history WHERE start_location IS NOT NULL) as trips_with_location,
  (SELECT COUNT(*) FROM captive_deliveries) as captive_deliveries_count,
  (SELECT COUNT(*) FROM captive_payment_records) as payment_records_count;

-- Step 8: Test correlation function availability
SELECT 
  'Function Availability Check' as check_type,
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'hybrid_correlate_trip_with_deliveries',
    'run_batch_correlation_analysis',
    'insert_hybrid_correlation'
  );

-- Step 9: Show next steps
SELECT 
  'Next Steps' as instruction,
  '1. Run a test correlation analysis' as step_1,
  '2. Verify correlation quality' as step_2,
  '3. Set up automated correlation processing' as step_3;
