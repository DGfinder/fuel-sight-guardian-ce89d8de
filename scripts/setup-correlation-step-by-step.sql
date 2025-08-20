-- ============================================================================
-- SETUP TRIP CORRELATION SYSTEM - STEP BY STEP
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
-- Note: You'll need to copy the content from create_mtdata_captive_correlations.sql here
-- For now, let's just check what exists and what needs to be created

-- Check current status
SELECT 
  'Current System Status' as check_type,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'mtdata_captive_correlations') as correlation_table_exists,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name = 'hybrid_correlate_trip_with_deliveries') as correlation_function_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'correlation_analytics_summary') as analytics_view_exists;

-- Show what tables we have
SELECT 
  'Available Tables' as table_info,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%correlation%'
ORDER BY table_name;

-- Show what functions we have
SELECT 
  'Available Functions' as function_info,
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%correlation%'
ORDER BY routine_name;

-- Show sample data for verification
SELECT 
  'Sample Data Verification' as check_type,
  (SELECT COUNT(*) FROM mtdata_trip_history WHERE start_location IS NOT NULL) as trips_with_location,
  (SELECT COUNT(*) FROM captive_deliveries) as captive_deliveries_count,
  (SELECT COUNT(*) FROM captive_payment_records) as payment_records_count;

-- Show next steps based on what exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mtdata_captive_correlations') THEN
    RAISE NOTICE 'Next step: Run the create_mtdata_captive_correlations.sql migration';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'hybrid_correlate_trip_with_deliveries') THEN
    RAISE NOTICE 'Next step: Run the hybrid_correlation_engine.sql function creation';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'correlation_analytics_summary') THEN
    RAISE NOTICE 'Next step: Run the upgrade_correlation_system_hybrid.sql migration';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mtdata_captive_correlations') THEN
    RAISE NOTICE 'Correlation table exists! You can now run correlation analysis.';
  END IF;
END $$;
