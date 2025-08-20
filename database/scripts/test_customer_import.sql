-- ============================================================================
-- TEST CUSTOMER IMPORT - MINIMAL DIAGNOSTIC SCRIPT
-- Isolates the exact issue preventing customer imports
-- ============================================================================

-- Step 1: Check prerequisites
RAISE NOTICE '=== TESTING CUSTOMER IMPORT ===';
RAISE NOTICE 'Step 1: Checking prerequisites...';

-- Check if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_locations') THEN
    RAISE NOTICE '✓ customer_locations table exists';
  ELSE
    RAISE NOTICE '✗ customer_locations table MISSING - run create_customer_locations_system.sql first';
    RETURN;
  END IF;
END $$;

-- Check custom types
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_type_enum') THEN
    RAISE NOTICE '✓ customer_type_enum exists';
  ELSE
    RAISE NOTICE '✗ customer_type_enum MISSING';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_type_enum') THEN
    RAISE NOTICE '✓ contract_type_enum exists';
  ELSE
    RAISE NOTICE '✗ contract_type_enum MISSING';
  END IF;
END $$;

-- Step 2: Test simple insert
RAISE NOTICE 'Step 2: Testing simple insert...';

BEGIN;

DO $$
BEGIN
  -- Try inserting one customer with coordinates
  BEGIN
    INSERT INTO customer_locations (
      customer_name,
      latitude,
      longitude,
      transaction_count,
      data_source
    ) VALUES (
      'TEST CUSTOMER WITH GPS',
      -31.9505,
      115.8605,
      100,
      'Test Insert'
    );
    RAISE NOTICE '✓ Successfully inserted customer with GPS coordinates';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '✗ Error inserting customer with GPS: % - %', SQLSTATE, SQLERRM;
  END;
  
  -- Try inserting one customer without coordinates
  BEGIN
    INSERT INTO customer_locations (
      customer_name,
      latitude,
      longitude,
      transaction_count,
      data_source
    ) VALUES (
      'TEST CUSTOMER WITHOUT GPS',
      NULL,
      NULL,
      50,
      'Test Insert'
    );
    RAISE NOTICE '✓ Successfully inserted customer without GPS coordinates';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '✗ Error inserting customer without GPS: % - %', SQLSTATE, SQLERRM;
  END;
END $$;

-- Check results
RAISE NOTICE 'Step 3: Checking insert results...';
SELECT 
  'Test Results' as status,
  COUNT(*) as test_records_inserted,
  array_agg(customer_name) as customer_names
FROM customer_locations 
WHERE data_source = 'Test Insert';

ROLLBACK; -- Don't keep test data

-- Step 4: Test with actual CSV data format
RAISE NOTICE 'Step 4: Testing with actual CSV data format...';

BEGIN;

DO $$
DECLARE
  batch_id UUID := gen_random_uuid();
BEGIN
  -- Test the exact format from the CSV import
  BEGIN
    INSERT INTO customer_locations (
      customer_name,
      location_name,
      latitude,
      longitude,
      transaction_count,
      data_quality_score,
      geocoding_accuracy,
      import_batch_id,
      primary_carrier,
      avg_monthly_volume_litres,
      priority_level,
      data_source
    ) VALUES (
      'KCGM FIMISTON EX KEWDALE',
      'KCGM Fimiston Fuel Farm',
      -30.761841,
      121.503301,
      3333,
      1.0,
      'exact',
      batch_id,
      'Combined',
      8332500,
      1,
      'CSV Import Test'
    );
    RAISE NOTICE '✓ Successfully inserted CSV format customer';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '✗ Error inserting CSV format: % - %', SQLSTATE, SQLERRM;
      RAISE NOTICE 'Error detail: %', SQLERRM;
  END;
  
  -- Test customer without coordinates
  BEGIN
    INSERT INTO customer_locations (
      customer_name,
      location_name,
      latitude,
      longitude,
      transaction_count,
      data_quality_score,
      geocoding_accuracy,
      import_batch_id,
      primary_carrier,
      avg_monthly_volume_litres,
      priority_level,
      data_source
    ) VALUES (
      'QUBE LOG (WA) RS2020 KALMAR REACH',
      '',
      NULL,
      NULL,
      360,
      0.6,
      'missing',
      batch_id,
      'SMB',
      900000,
      5,
      'CSV Import Test'
    );
    RAISE NOTICE '✓ Successfully inserted CSV format customer without GPS';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '✗ Error inserting CSV format without GPS: % - %', SQLSTATE, SQLERRM;
      RAISE NOTICE 'Error detail: %', SQLERRM;
  END;
END $$;

-- Check results
SELECT 
  'CSV Test Results' as status,
  COUNT(*) as csv_test_records,
  array_agg(customer_name) as customer_names
FROM customer_locations 
WHERE data_source = 'CSV Import Test';

ROLLBACK; -- Don't keep test data

-- Step 5: Check table constraints
RAISE NOTICE 'Step 5: Checking table constraints...';
SELECT 
  constraint_name,
  constraint_type,
  is_deferrable,
  initially_deferred
FROM information_schema.table_constraints 
WHERE table_name = 'customer_locations'
  AND constraint_type IN ('CHECK', 'UNIQUE', 'FOREIGN KEY');

-- Final summary
RAISE NOTICE 'Test completed. Check the messages above for specific error details.';
RAISE NOTICE 'If all tests passed, the issue is likely in the import script logic.';
RAISE NOTICE 'If tests failed, the error messages will show the exact constraint violation.';