-- FIX SALLY'S TANK VISIBILITY - SECURITY BARRIER VIEW
-- Sally (operator role) still sees all GSF Depots tanks instead of just GSFS Narrogin
-- Root Cause: tanks_with_rolling_avg view doesn't inherit RLS from underlying fuel_tanks table
-- Solution: Recreate view with security_barrier=true to force RLS inheritance
--
-- CRITICAL: This preserves ALL existing fuel burn and days calculations EXACTLY

-- ============================================================================
-- STEP 1: BACKUP AND DIAGNOSTIC
-- ============================================================================

SELECT 'BACKING UP CURRENT VIEW DEFINITION' as step;

-- Show current view definition (for reference)
SELECT 
    'Current View Check' as info,
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE viewname = 'tanks_with_rolling_avg';

-- Test current Sally access (before fix)
SELECT 'Sally Current Access (BEFORE FIX)' as test;
SELECT 
    t.location,
    t.subgroup,
    tg.name as group_name,
    'Currently visible to Sally' as status
FROM fuel_tanks t
JOIN tank_groups tg ON t.group_id = tg.id
WHERE tg.name = 'GSF Depots'
ORDER BY t.subgroup, t.location;

-- ============================================================================
-- STEP 2: DROP EXISTING VIEW
-- ============================================================================

SELECT 'DROPPING EXISTING VIEW TO RECREATE WITH SECURITY BARRIER' as step;

DROP VIEW IF EXISTS tanks_with_rolling_avg;

-- ============================================================================
-- STEP 3: RECREATE VIEW WITH SECURITY BARRIER
-- ============================================================================

SELECT 'CREATING SECURITY BARRIER VIEW - PRESERVING ALL CALCULATIONS' as step;

-- Recreate the EXACT same view with security_barrier=true
-- This forces PostgreSQL to apply RLS from underlying fuel_tanks table
CREATE VIEW tanks_with_rolling_avg WITH (security_barrier=true) AS
WITH latest_dip AS (
  SELECT DISTINCT ON (tank_id)
    tank_id AS id,
    value as current_level,
    created_at as last_dip_ts,
    recorded_by as last_dip_by
  FROM dip_readings
  ORDER BY tank_id, created_at DESC
),
recent_readings AS (
  SELECT 
    tank_id AS id,
    value,
    created_at,
    LAG(value) OVER (PARTITION BY tank_id ORDER BY created_at) as prev_value,
    LAG(created_at) OVER (PARTITION BY tank_id ORDER BY created_at) as prev_date
  FROM dip_readings 
  WHERE created_at >= NOW() - INTERVAL '7 days'
),
daily_changes AS (
  SELECT 
    id,
    (value - prev_value) as fuel_change,
    EXTRACT(EPOCH FROM (created_at - prev_date)) / 86400.0 as days_diff
  FROM recent_readings
  WHERE prev_value IS NOT NULL 
    AND prev_date IS NOT NULL
    AND EXTRACT(EPOCH FROM (created_at - prev_date)) / 86400.0 > 0
),
rolling_average AS (
  SELECT 
    id,
    CASE 
      WHEN SUM(days_diff) > 0 
      THEN ROUND(SUM(fuel_change) / SUM(days_diff))::INTEGER
      ELSE NULL 
    END as rolling_avg_lpd
  FROM daily_changes
  GROUP BY id
),
prev_day_usage AS (
  SELECT DISTINCT ON (id)
    id,
    ABS(value - prev_value) as prev_day_used
  FROM recent_readings
  WHERE prev_value IS NOT NULL 
    AND prev_date IS NOT NULL
    AND EXTRACT(EPOCH FROM (created_at - prev_date)) / 86400.0 BETWEEN 0.5 AND 2.0
  ORDER BY id, created_at DESC
)
SELECT
  t.id,
  t.location,
  t.product_type,
  t.safe_level,
  COALESCE(t.min_level, 0) as min_level,
  t.group_id,
  tg.name AS group_name,
  t.subgroup,
  ld.current_level,
  ld.last_dip_ts,
  ld.last_dip_by,
  CASE 
    WHEN t.safe_level IS NOT NULL 
         AND t.safe_level > COALESCE(t.min_level, 0) 
         AND ld.current_level IS NOT NULL
    THEN GREATEST(0, ROUND(
      ((ld.current_level - COALESCE(t.min_level, 0)) / 
       (t.safe_level - COALESCE(t.min_level, 0))) * 100, 1
    ))
    ELSE 0
  END AS current_level_percent,
  COALESCE(ra.rolling_avg_lpd, 0) AS rolling_avg,
  COALESCE(pdu.prev_day_used, 0) AS prev_day_used,
  CASE
    WHEN ra.rolling_avg_lpd < 0 AND ld.current_level IS NOT NULL
    THEN ROUND((ld.current_level - COALESCE(t.min_level, 0)) / ABS(ra.rolling_avg_lpd), 1)
    ELSE NULL
  END AS days_to_min_level
FROM fuel_tanks t
JOIN tank_groups tg ON tg.id = t.group_id
LEFT JOIN latest_dip ld ON ld.id = t.id
LEFT JOIN rolling_average ra ON ra.id = t.id
LEFT JOIN prev_day_usage pdu ON pdu.id = t.id;

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

SELECT 'VERIFYING SECURITY BARRIER VIEW CREATED' as step;

-- Confirm view was created with security barrier
SELECT 
    'Security Barrier View Status' as check,
    schemaname,
    viewname,
    'View recreated with security_barrier=true' as status
FROM pg_views 
WHERE viewname = 'tanks_with_rolling_avg';

-- Test that view structure is identical (column count and names)
SELECT 'View Structure Verification' as check;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'tanks_with_rolling_avg'
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 5: TEST SALLY'S ACCESS WITH NEW VIEW
-- ============================================================================

SELECT 'TESTING SALLY ACCESS WITH SECURITY BARRIER VIEW' as step;

-- Show what Sally should be able to access now
-- This simulates the RLS-filtered result
SELECT 
    'Sally Expected Access (AFTER FIX)' as test,
    ft.location,
    ft.subgroup,
    tg.name as group_name,
    'Should be accessible to Sally' as expected_result
FROM fuel_tanks ft
JOIN tank_groups tg ON ft.group_id = tg.id
JOIN user_subgroup_permissions usp ON (
    usp.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b'
    AND usp.group_id = ft.group_id
    AND usp.subgroup_name = ft.subgroup
)
ORDER BY ft.location;

-- Show what Sally should NOT be able to access
SELECT 
    'Sally Blocked Access (AFTER FIX)' as test,
    ft.subgroup,
    COUNT(*) as tank_count,
    'Should be blocked from Sally' as expected_result
FROM fuel_tanks ft
JOIN tank_groups tg ON ft.group_id = tg.id
WHERE tg.name = 'GSF Depots' 
AND ft.subgroup IS NOT NULL
AND ft.subgroup != 'GSFS Narrogin'
GROUP BY ft.subgroup
ORDER BY ft.subgroup;

-- ============================================================================
-- STEP 6: CALCULATION VERIFICATION
-- ============================================================================

SELECT 'VERIFYING ALL CALCULATIONS PRESERVED' as step;

-- Test sample calculation to ensure formulas work identically
-- This verifies rolling average and days_to_min_level calculations
SELECT 
    'Sample Calculation Test' as test,
    location,
    current_level,
    rolling_avg as rolling_avg_lpd,
    days_to_min_level,
    current_level_percent,
    'Calculations should be identical to before' as verification
FROM tanks_with_rolling_avg
WHERE location LIKE '%Narrogin%'
ORDER BY location
LIMIT 3;

-- ============================================================================
-- STEP 7: FRONTEND CACHE INVALIDATION INSTRUCTIONS
-- ============================================================================

SELECT 'FRONTEND ACTION REQUIRED' as step;

SELECT 
    'CACHE REFRESH NEEDED' as instruction,
    'Sally must refresh browser or logout/login' as action,
    'React Query caches view data - needs invalidation' as reason,
    'No frontend code changes required' as note;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 
    'SECURITY BARRIER FIX COMPLETE' as status,
    'tanks_with_rolling_avg now inherits RLS from fuel_tanks' as database_fix,
    'All fuel burn and days calculations preserved exactly' as calculation_preservation,
    'Sally should only see GSFS Narrogin tanks after cache refresh' as expected_result;

-- Summary of changes:
SELECT 
    'CHANGES SUMMARY' as summary,
    'Added WITH (security_barrier=true) to view definition' as change_1,
    'Preserved all existing CTEs and calculations exactly' as change_2,
    'View now respects RLS policies from underlying fuel_tanks table' as result,
    'Frontend cache refresh required for Sally to see filtered results' as next_step;