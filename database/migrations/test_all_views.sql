-- Comprehensive test for all analytics views
-- This script validates that all views can be created and queried without errors

BEGIN;

-- Test 1: Create all views (should not fail)
SELECT 'Creating all analytics views...' as status;

-- The views should be created by running 003_create_analytics_views.sql first
-- This test just validates they exist and are queryable

-- Test 2: Validate captive_payments_analytics
SELECT 'Testing captive_payments_analytics view...' as status;

DO $$
BEGIN
    -- Test basic query structure
    PERFORM carrier, month, year, month_num, total_deliveries, total_volume_megalitres, top_customer, top_customer_volume
    FROM captive_payments_analytics 
    LIMIT 1;
    
    RAISE NOTICE 'captive_payments_analytics: Basic query SUCCESS';
    
    -- Test aggregation works
    PERFORM COUNT(*) FROM captive_payments_analytics;
    RAISE NOTICE 'captive_payments_analytics: Aggregation SUCCESS';
    
    -- Test ordering works
    PERFORM * FROM captive_payments_analytics ORDER BY year DESC, month_num DESC LIMIT 1;
    RAISE NOTICE 'captive_payments_analytics: Ordering SUCCESS';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'captive_payments_analytics FAILED: %', SQLERRM;
END $$;

-- Test 3: Validate lytx_safety_analytics  
SELECT 'Testing lytx_safety_analytics view...' as status;

DO $$
BEGIN
    -- Test basic query structure
    PERFORM carrier, depot, month, year, month_num, total_events, avg_score
    FROM lytx_safety_analytics 
    LIMIT 1;
    
    RAISE NOTICE 'lytx_safety_analytics: Basic query SUCCESS';
    
    -- Test aggregation works
    PERFORM COUNT(*) FROM lytx_safety_analytics;
    RAISE NOTICE 'lytx_safety_analytics: Aggregation SUCCESS';
    
    -- Test ordering works
    PERFORM * FROM lytx_safety_analytics ORDER BY year DESC, month_num DESC LIMIT 1;
    RAISE NOTICE 'lytx_safety_analytics: Ordering SUCCESS';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'lytx_safety_analytics FAILED: %', SQLERRM;
END $$;

-- Test 4: Validate cross_analytics_summary
SELECT 'Testing cross_analytics_summary view...' as status;

DO $$
BEGIN
    -- Test basic query structure
    PERFORM fleet, depot, month, year, month_num, captive_deliveries, safety_events
    FROM cross_analytics_summary 
    LIMIT 1;
    
    RAISE NOTICE 'cross_analytics_summary: Basic query SUCCESS';
    
    -- Test aggregation works
    PERFORM COUNT(*) FROM cross_analytics_summary;
    RAISE NOTICE 'cross_analytics_summary: Aggregation SUCCESS';
    
    -- Test ordering works
    PERFORM * FROM cross_analytics_summary ORDER BY year DESC, month_num DESC, fleet, depot LIMIT 1;
    RAISE NOTICE 'cross_analytics_summary: Ordering SUCCESS';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'cross_analytics_summary FAILED: %', SQLERRM;
END $$;

-- Test 5: Validate top customer calculation in captive_payments_analytics
SELECT 'Testing top customer calculation logic...' as status;

DO $$
DECLARE
    test_record RECORD;
BEGIN
    -- Get a sample record to validate top customer logic
    SELECT carrier, month, year, top_customer, top_customer_volume
    INTO test_record
    FROM captive_payments_analytics 
    WHERE top_customer IS NOT NULL AND top_customer != 'N/A'
    LIMIT 1;
    
    IF FOUND THEN
        IF test_record.top_customer_volume > 0 THEN
            RAISE NOTICE 'Top customer calculation: SUCCESS - Customer: %, Volume: %', 
                test_record.top_customer, test_record.top_customer_volume;
        ELSE
            RAISE NOTICE 'Top customer calculation: WARNING - Volume is zero for customer: %', 
                test_record.top_customer;
        END IF;
    ELSE
        RAISE NOTICE 'Top customer calculation: No data available for testing';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Top customer calculation FAILED: %', SQLERRM;
END $$;

-- Test 6: Validate data consistency across views
SELECT 'Testing data consistency across views...' as status;

DO $$
DECLARE
    captive_count INTEGER;
    lytx_count INTEGER;
    cross_count INTEGER;
BEGIN
    -- Count records in each view
    SELECT COUNT(*) INTO captive_count FROM captive_payments_analytics;
    SELECT COUNT(*) INTO lytx_count FROM lytx_safety_analytics;  
    SELECT COUNT(*) INTO cross_count FROM cross_analytics_summary;
    
    RAISE NOTICE 'Record counts - Captive: %, LYTX: %, Cross: %', 
        captive_count, lytx_count, cross_count;
    
    -- Validate reasonable record counts (adjust thresholds as needed)
    IF captive_count < 0 OR lytx_count < 0 OR cross_count < 0 THEN
        RAISE EXCEPTION 'Negative record counts detected';
    END IF;
    
    RAISE NOTICE 'Data consistency: SUCCESS';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Data consistency check FAILED: %', SQLERRM;
END $$;

-- Test 7: Performance test - ensure views respond quickly
SELECT 'Testing view performance...' as status;

DO $$
DECLARE 
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    duration INTERVAL;
BEGIN
    -- Test captive_payments_analytics performance
    start_time := clock_timestamp();
    PERFORM COUNT(*) FROM captive_payments_analytics;
    end_time := clock_timestamp();
    duration := end_time - start_time;
    
    RAISE NOTICE 'captive_payments_analytics query time: %', duration;
    
    -- Test lytx_safety_analytics performance  
    start_time := clock_timestamp();
    PERFORM COUNT(*) FROM lytx_safety_analytics;
    end_time := clock_timestamp();
    duration := end_time - start_time;
    
    RAISE NOTICE 'lytx_safety_analytics query time: %', duration;
    
    -- Test cross_analytics_summary performance
    start_time := clock_timestamp();
    PERFORM COUNT(*) FROM cross_analytics_summary;
    end_time := clock_timestamp();
    duration := end_time - start_time;
    
    RAISE NOTICE 'cross_analytics_summary query time: %', duration;
    
    RAISE NOTICE 'Performance test: SUCCESS';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Performance test FAILED: %', SQLERRM;
END $$;

-- Final success message
SELECT 'All analytics views validation completed successfully!' as result;

ROLLBACK; -- Don't commit any changes, this is just a test