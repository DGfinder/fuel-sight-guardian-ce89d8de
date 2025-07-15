-- DEBUG EMPTY TANK DATA
-- This script helps identify why tanks show 0% capacity and no data

-- ============================================================================
-- STEP 1: Check what tanks Sally can see
-- ============================================================================

SELECT 'CHECKING GSFS NARROGIN TANKS' as step;

-- Get all GSFS Narrogin tanks
SELECT 
    id,
    location,
    product_type,
    safe_level,
    min_level,
    subgroup,
    'Basic tank data' as data_type
FROM fuel_tanks
WHERE subgroup = 'GSFS Narrogin'
ORDER BY location;

-- ============================================================================
-- STEP 2: Check what the view returns for these tanks
-- ============================================================================

SELECT 'CHECKING VIEW DATA FOR GSFS NARROGIN' as step;

-- Get view data for Sally's tanks
SELECT 
    id,
    location,
    product,  -- Note: view uses 'product' not 'product_type'
    safe_fill,  -- Note: view uses 'safe_fill' not 'safe_level'
    min_level,
    current_level,
    current_level_percent_display,
    rolling_avg_lpd,
    days_to_min_level,
    last_dip_ts,
    usable_capacity,
    subgroup
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin'
ORDER BY location;

-- ============================================================================
-- STEP 3: Check if dip_readings exist for these tanks
-- ============================================================================

SELECT 'CHECKING DIP READINGS FOR GSFS NARROGIN TANKS' as step;

-- Count dip readings per tank
SELECT 
    ft.id as tank_id,
    ft.location,
    COUNT(dr.id) as dip_count,
    MAX(dr.created_at) as latest_dip,
    MAX(dr.value) as latest_value
FROM fuel_tanks ft
LEFT JOIN dip_readings dr ON ft.id = dr.tank_id
WHERE ft.subgroup = 'GSFS Narrogin'
GROUP BY ft.id, ft.location
ORDER BY ft.location;

-- ============================================================================
-- STEP 4: Check data types match between tables
-- ============================================================================

SELECT 'CHECKING DATA TYPE COMPATIBILITY' as step;

-- Check fuel_tanks ID type
SELECT 
    'fuel_tanks.id' as column_ref,
    data_type,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'fuel_tanks' AND column_name = 'id';

-- Check dip_readings tank_id type
SELECT 
    'dip_readings.tank_id' as column_ref,
    data_type,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'dip_readings' AND column_name = 'tank_id';

-- ============================================================================
-- STEP 5: Test a simple join directly
-- ============================================================================

SELECT 'TESTING DIRECT JOIN' as step;

-- Direct join test
SELECT 
    ft.id,
    ft.location,
    ft.safe_level,
    dr.value as dip_value,
    dr.created_at as dip_date,
    CASE 
        WHEN dr.tank_id IS NULL THEN 'NO MATCH - Check ID types'
        ELSE 'MATCH FOUND'
    END as join_status
FROM fuel_tanks ft
LEFT JOIN dip_readings dr ON ft.id = dr.tank_id
WHERE ft.subgroup = 'GSFS Narrogin'
ORDER BY ft.location, dr.created_at DESC
LIMIT 10;

-- ============================================================================
-- STEP 6: Check view definition
-- ============================================================================

SELECT 'CHECKING VIEW DEFINITION' as step;

-- Get the view definition
SELECT 
    viewname,
    definition
FROM pg_views
WHERE viewname = 'tanks_with_rolling_avg';

-- ============================================================================
-- STEP 7: Test what frontend expects vs what view provides
-- ============================================================================

SELECT 'FRONTEND EXPECTATION CHECK' as step;

-- List all columns from the view
SELECT 
    column_name,
    data_type,
    ordinal_position
FROM information_schema.columns
WHERE table_name = 'tanks_with_rolling_avg'
ORDER BY ordinal_position;

-- ============================================================================
-- DIAGNOSIS SUMMARY
-- ============================================================================

SELECT 'DIAGNOSIS COMPLETE' as status;
SELECT 'Check results above to identify:' as instruction_1;
SELECT '1. If GSFS Narrogin tanks exist in fuel_tanks table' as instruction_2;
SELECT '2. If view returns data for these tanks' as instruction_3;
SELECT '3. If dip_readings exist for these tank IDs' as instruction_4;
SELECT '4. If JOIN is failing due to data type mismatch' as instruction_5;
SELECT '5. If view columns match frontend expectations' as instruction_6;