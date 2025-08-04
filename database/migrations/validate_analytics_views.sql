-- Validation script for analytics views
-- This script tests that all views can be created without column reference errors

-- Test 1: Validate captive_payments_analytics view structure
SELECT 'Testing captive_payments_analytics view' as test_name;

-- Check if view exists and has expected columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'captive_payments_analytics' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test query on view (will fail if columns don't exist or have grouping errors)
SELECT carrier, month, year, month_num, total_deliveries, total_volume_megalitres, top_customer, top_customer_volume
FROM captive_payments_analytics 
LIMIT 1;

-- Test 2: Validate lytx_safety_analytics view structure
SELECT 'Testing lytx_safety_analytics view' as test_name;

-- Check if view exists and has expected columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'lytx_safety_analytics' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test query on view (will fail if columns don't exist)
SELECT carrier, depot, month, year, month_num, total_events, avg_score
FROM lytx_safety_analytics 
LIMIT 1;

-- Test 3: Validate cross_analytics_summary view structure
SELECT 'Testing cross_analytics_summary view' as test_name;

-- Check if view exists and has expected columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cross_analytics_summary' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test query on view (will fail if columns don't exist)
SELECT fleet, depot, month, year, month_num, captive_deliveries, safety_events
FROM cross_analytics_summary 
LIMIT 1;

-- Test 4: Validate ORDER BY functionality
SELECT 'Testing ORDER BY functionality' as test_name;

-- Test ordering works without column reference errors
SELECT carrier, month, year 
FROM captive_payments_analytics 
ORDER BY year DESC, month_num DESC 
LIMIT 5;

SELECT carrier, depot, month, year 
FROM lytx_safety_analytics 
ORDER BY year DESC, month_num DESC 
LIMIT 5;

SELECT fleet, depot, month, year 
FROM cross_analytics_summary 
ORDER BY year DESC, month_num DESC, fleet, depot 
LIMIT 5;

-- Test 5: Validate all expected columns are present
SELECT 'Validating all expected columns' as test_name;

-- Expected columns for captive_payments_analytics
DO $$
DECLARE
    expected_columns TEXT[] := ARRAY['carrier', 'month', 'year', 'month_num', 'total_deliveries', 'total_volume_litres', 'total_volume_megalitres', 'unique_customers', 'top_customer', 'top_customer_volume', 'avg_delivery_size'];
    col TEXT;
    col_count INTEGER;
BEGIN
    FOREACH col IN ARRAY expected_columns
    LOOP
        SELECT COUNT(*) INTO col_count 
        FROM information_schema.columns 
        WHERE table_name = 'captive_payments_analytics' 
        AND column_name = col;
        
        IF col_count = 0 THEN
            RAISE NOTICE 'Missing column in captive_payments_analytics: %', col;
        END IF;
    END LOOP;
END $$;

-- Test 6: Validate top customer calculation logic
SELECT 'Testing top customer calculation logic' as test_name;

-- Test that top_customer and top_customer_volume are properly calculated
WITH test_data AS (
    SELECT 
        carrier,
        month,
        year,
        top_customer,
        top_customer_volume,
        CASE 
            WHEN top_customer IS NULL OR top_customer = 'N/A' THEN 'No data available'
            WHEN top_customer_volume > 0 THEN 'Valid calculation'
            ELSE 'Potential issue'
        END as validation_status
    FROM captive_payments_analytics 
    LIMIT 5
)
SELECT * FROM test_data;

-- Test 7: Verify CTE structure doesn't cause grouping errors
SELECT 'Testing CTE structure integrity' as test_name;

-- This should not fail with grouping errors
SELECT COUNT(*) as total_monthly_records
FROM captive_payments_analytics;

-- Success message
SELECT 'All analytics views validation completed successfully!' as result;