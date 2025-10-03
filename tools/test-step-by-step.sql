-- =====================================================
-- Step-by-Step Test to Find Composite Type Error Source  
-- =====================================================
-- Run each test individually to isolate where the error occurs
--
-- Author: Claude Code
-- Created: 2025-08-25

-- Test 1: Ultra-simple function (should work)
SELECT 'TEST 1: Ultra-simple function' as test_name;
SELECT get_driver_summary_simple(
    '202f3cb3-adc6-4af9-bfbb-069b87505287'::UUID,
    '1IDB419'
) as result;

-- Step 4: Unified driver profile (replace with a real driver UUID)
SELECT get_unified_driver_profile(
  '202f3cb3-adc6-4af9-bfbb-069b87505287'::UUID,
  180
) as unified_result;

-- Test 2: With basic counts (should work)
SELECT 'TEST 2: With basic counts' as test_name;
SELECT get_driver_summary_with_counts(
    '202f3cb3-adc6-4af9-bfbb-069b87505287'::UUID,
    '1IDB419'
) as result;

-- Test 3: With FILTER clause alternative (should work)
SELECT 'TEST 3: With CASE WHEN instead of FILTER' as test_name;
SELECT get_driver_summary_with_filter(
    '202f3cb3-adc6-4af9-bfbb-069b87505287'::UUID,
    '1IDB419'
) as result;

-- Test 4: Fixed main function (should now work)
SELECT 'TEST 4: Fixed main function' as test_name;
SELECT get_vehicle_driver_associations_summary(
    '202f3cb3-adc6-4af9-bfbb-069b87505287'::UUID,
    '1IDB419',
    180
) as result;