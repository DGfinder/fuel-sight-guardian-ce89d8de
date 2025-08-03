-- DIAGNOSE EMPTY VIEW DATA ISSUE
-- Sally sees tanks but all data is empty (0% full, no capacity, etc.)
-- This script tests each component to find what's broken

-- ============================================================================
-- STEP 1: CHECK BASE DATA AVAILABILITY
-- ============================================================================

SELECT 'BASIC DATA AVAILABILITY CHECK' as step;

-- Check if dip_readings table has data
SELECT 
    'dip_readings' as table_name,
    COUNT(*) as row_count,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM dip_readings;

-- Check if fuel_tanks has data
SELECT 
    'fuel_tanks' as table_name,
    COUNT(*) as row_count,
    COUNT(DISTINCT group_id) as unique_groups
FROM fuel_tanks;

-- Check if tank_groups has data
SELECT 
    'tank_groups' as table_name,
    COUNT(*) as row_count
FROM tank_groups;

-- ============================================================================
-- STEP 2: CHECK ID MATCHING BETWEEN TABLES
-- ============================================================================

SELECT 'ID MATCHING CHECK' as step;

-- Check data types of ID columns
SELECT 
    'fuel_tanks.id' as column_ref,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'fuel_tanks' AND column_name = 'id';

SELECT 
    'dip_readings.tank_id' as column_ref,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'dip_readings' AND column_name = 'tank_id';

-- Test if tank IDs match between tables
SELECT 
    'ID Matching Test' as test,
    ft.id as fuel_tank_id,
    dr.tank_id as dip_reading_tank_id,
    CASE 
        WHEN dr.tank_id IS NOT NULL THEN 'MATCH' 
        ELSE 'NO_MATCH' 
    END as match_status
FROM fuel_tanks ft
LEFT JOIN dip_readings dr ON ft.id = dr.tank_id
WHERE ft.subgroup = 'GSFS Narrogin'  -- Test with Sally's tanks
LIMIT 5;

-- ============================================================================
-- STEP 3: TEST EACH CTE INDIVIDUALLY
-- ============================================================================

SELECT 'CTE TESTING' as step;

-- Test latest_dip CTE
SELECT 'Testing latest_dip CTE' as cte_test;
WITH latest_dip AS (
  SELECT DISTINCT ON (tank_id)
    tank_id AS id,
    value as current_level,
    created_at as last_dip_ts,
    recorded_by as last_dip_by
  FROM dip_readings
  ORDER BY tank_id, created_at DESC
)
SELECT 
    COUNT(*) as cte_row_count,
    COUNT(current_level) as non_null_levels,
    AVG(current_level) as avg_level
FROM latest_dip;

-- Test recent_readings CTE
SELECT 'Testing recent_readings CTE' as cte_test;
WITH recent_readings AS (
  SELECT
    tank_id AS id,
    value,
    created_at,
    LAG(value) OVER (PARTITION BY tank_id ORDER BY created_at) as prev_value,
    LAG(created_at) OVER (PARTITION BY tank_id ORDER BY created_at) as prev_date
  FROM dip_readings
  WHERE created_at >= NOW() - INTERVAL '7 days'
)
SELECT 
    COUNT(*) as cte_row_count,
    COUNT(prev_value) as non_null_prev_values
FROM recent_readings;

-- ============================================================================
-- STEP 4: TEST SIMPLE VIEW WITHOUT CTES
-- ============================================================================

SELECT 'TESTING SIMPLE VIEW' as step;

-- Test basic tank data without any CTEs
SELECT 
    'Basic Tank Data Test' as test,
    t.id,
    t.location,
    t.product_type,
    t.safe_level,
    t.min_level,
    t.subgroup,
    tg.name as group_name,
    t.safe_level - COALESCE(t.min_level, 0) as calculated_capacity
FROM fuel_tanks t
JOIN tank_groups tg ON tg.id = t.group_id
WHERE t.subgroup = 'GSFS Narrogin'
LIMIT 3;

-- ============================================================================
-- STEP 5: TEST DIRECT DIP READING JOIN
-- ============================================================================

SELECT 'TESTING DIRECT DIP JOIN' as step;

-- Test if we can get latest dip reading without CTE
SELECT 
    'Direct Dip Join Test' as test,
    t.id,
    t.location,
    t.safe_level,
    dr.value as latest_dip,
    dr.created_at as dip_time
FROM fuel_tanks t
LEFT JOIN dip_readings dr ON t.id = dr.tank_id
WHERE t.subgroup = 'GSFS Narrogin'
ORDER BY t.id, dr.created_at DESC
LIMIT 10;

-- ============================================================================
-- DIAGNOSTIC SUMMARY
-- ============================================================================

SELECT 'DIAGNOSTIC COMPLETE' as status;
SELECT 'Check results above to identify:' as instruction_1;
SELECT '1. If dip_readings table has data' as instruction_2;  
SELECT '2. If tank IDs match between tables' as instruction_3;
SELECT '3. Which CTE is returning empty results' as instruction_4;
SELECT '4. If basic tank data works without CTEs' as instruction_5;