-- HYBRID TANKS VIEW WITH SIMPLE ANALYTICS
-- This creates a working view that adds back rolling averages, prev day usage, and days to min
-- Uses simple subqueries instead of complex CTEs to prevent 500 errors/timeouts
-- Built to work with the existing working basic structure

-- ============================================================================
-- STEP 1: Drop existing view and create base structure 
-- ============================================================================

SELECT 'CREATING HYBRID VIEW WITH ANALYTICS' as step;

DROP VIEW IF EXISTS tanks_with_rolling_avg CASCADE;

-- ============================================================================
-- STEP 2: Create hybrid view with simple analytics
-- ============================================================================

CREATE OR REPLACE VIEW tanks_with_rolling_avg AS
SELECT 
  -- ============================================================================
  -- CORE TANK IDENTIFICATION (Keep working structure)
  -- ============================================================================
  t.id,
  COALESCE(t.location, 'Unknown Location') as location,
  COALESCE(t.product_type, 'Diesel') as product_type,
  
  -- ============================================================================
  -- TANK CAPACITY FIELDS (Keep working structure)
  -- ============================================================================
  COALESCE(t.safe_level, 10000) as safe_level,
  COALESCE(t.min_level, 0) as min_level,
  
  -- ============================================================================
  -- GROUP AND ORGANIZATION (Keep working structure)
  -- ============================================================================
  t.group_id,
  COALESCE(tg.name, 'Unknown Group') as group_name,
  COALESCE(t.subgroup, 'No Subgroup') as subgroup,
  
  -- ============================================================================
  -- CURRENT FUEL LEVEL (Simple subqueries - working structure)
  -- ============================================================================
  COALESCE((
    SELECT dr.value 
    FROM dip_readings dr 
    WHERE dr.tank_id = t.id 
    ORDER BY dr.created_at DESC 
    LIMIT 1
  ), 0) as current_level,
  
  (SELECT dr.created_at 
   FROM dip_readings dr 
   WHERE dr.tank_id = t.id 
   ORDER BY dr.created_at DESC 
   LIMIT 1) as last_dip_ts,
   
  (SELECT dr.recorded_by 
   FROM dip_readings dr 
   WHERE dr.tank_id = t.id 
   ORDER BY dr.created_at DESC 
   LIMIT 1) as last_dip_by,
  
  -- ============================================================================
  -- CURRENT LEVEL PERCENTAGE (Keep working calculation)
  -- ============================================================================
  CASE
    WHEN COALESCE(t.safe_level, 10000) > COALESCE(t.min_level, 0)
         AND (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) IS NOT NULL
    THEN GREATEST(0, ROUND(
      (((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0)) /
       (COALESCE(t.safe_level, 10000) - COALESCE(t.min_level, 0))) * 100, 1
    ))
    ELSE 0
  END AS current_level_percent,
  
  -- Also provide display version for frontend compatibility
  CASE
    WHEN COALESCE(t.safe_level, 10000) > COALESCE(t.min_level, 0)
         AND (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) IS NOT NULL
    THEN GREATEST(0, ROUND(
      (((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0)) /
       (COALESCE(t.safe_level, 10000) - COALESCE(t.min_level, 0))) * 100, 1
    ))
    ELSE 0
  END AS current_level_percent_display,
  
  -- ============================================================================
  -- SIMPLE ROLLING AVERAGE (7-day consumption average) - Fixed: No window functions
  -- ============================================================================
  COALESCE((
    SELECT ROUND(AVG(daily_consumption)::numeric, 0)
    FROM (
      SELECT ABS(dr2.value - dr1.value) as daily_consumption
      FROM dip_readings dr1
      JOIN dip_readings dr2 ON dr2.tank_id = dr1.tank_id 
        AND dr2.created_at < dr1.created_at
        AND dr2.created_at >= dr1.created_at - INTERVAL '2 days'  -- Within reasonable time window
      WHERE dr1.tank_id = t.id
        AND dr1.created_at >= NOW() - INTERVAL '7 days'
        AND dr1.value < dr2.value  -- Only consumption (decreasing values)
        AND ABS(dr2.value - dr1.value) BETWEEN 50 AND 8000  -- Reasonable consumption range
      ORDER BY dr1.created_at DESC
      LIMIT 7  -- Limit to prevent timeouts
    ) consumption_data
  ), 0) as rolling_avg_lpd,
  
  -- ============================================================================
  -- SIMPLE PREVIOUS DAY USAGE 
  -- ============================================================================
  COALESCE((
    SELECT ABS(newer.value - older.value)
    FROM dip_readings newer
    JOIN dip_readings older ON older.tank_id = newer.tank_id
    WHERE newer.tank_id = t.id
      AND newer.created_at >= NOW() - INTERVAL '2 days'
      AND older.created_at < newer.created_at
      AND older.created_at >= NOW() - INTERVAL '3 days'
      AND newer.value < older.value  -- Consumption only (decreasing)
      AND ABS(newer.value - older.value) BETWEEN 10 AND 8000  -- Reasonable daily usage
    ORDER BY newer.created_at DESC, ABS(EXTRACT(EPOCH FROM (newer.created_at - older.created_at))) ASC
    LIMIT 1
  ), 0) as prev_day_used,
  
  -- ============================================================================
  -- SIMPLE DAYS TO MINIMUM LEVEL - Fixed: No window functions
  -- ============================================================================
  CASE 
    WHEN (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) > COALESCE(t.min_level, 0)
    THEN 
      CASE 
        WHEN COALESCE((
          SELECT ROUND(AVG(daily_consumption)::numeric, 0)
          FROM (
            SELECT ABS(dr2.value - dr1.value) as daily_consumption
            FROM dip_readings dr1
            JOIN dip_readings dr2 ON dr2.tank_id = dr1.tank_id 
              AND dr2.created_at < dr1.created_at
              AND dr2.created_at >= dr1.created_at - INTERVAL '2 days'
            WHERE dr1.tank_id = t.id
              AND dr1.created_at >= NOW() - INTERVAL '7 days'
              AND dr1.value < dr2.value  -- Only consumption
              AND ABS(dr2.value - dr1.value) BETWEEN 50 AND 8000
            ORDER BY dr1.created_at DESC
            LIMIT 5
          ) consumption_data
        ), 0) > 0
        THEN ROUND(
          ((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0)) / 
          COALESCE((
            SELECT ROUND(AVG(daily_consumption)::numeric, 0)
            FROM (
              SELECT ABS(dr2.value - dr1.value) as daily_consumption
              FROM dip_readings dr1
              JOIN dip_readings dr2 ON dr2.tank_id = dr1.tank_id 
                AND dr2.created_at < dr1.created_at
                AND dr2.created_at >= dr1.created_at - INTERVAL '2 days'
              WHERE dr1.tank_id = t.id
                AND dr1.created_at >= NOW() - INTERVAL '7 days'
                AND dr1.value < dr2.value
                AND ABS(dr2.value - dr1.value) BETWEEN 50 AND 8000
              ORDER BY dr1.created_at DESC
              LIMIT 5
            ) consumption_data
          ), 1)
        , 1)
        ELSE NULL
      END
    ELSE NULL
  END as days_to_min_level,
  
  -- ============================================================================
  -- ADDITIONAL FIELDS (For frontend compatibility)
  -- ============================================================================
  t.latitude,
  t.longitude,
  t.address,
  t.vehicle,
  t.discharge,
  t.bp_portal,
  t.delivery_window,
  t.afterhours_contact,
  t.notes,
  t.serviced_on,
  t.serviced_by,
  t.created_at,
  t.updated_at,
  
  -- Usable capacity calculation
  COALESCE(t.safe_level, 10000) - COALESCE(t.min_level, 0) as usable_capacity

FROM fuel_tanks t
LEFT JOIN tank_groups tg ON tg.id = t.group_id;

-- ============================================================================
-- STEP 3: Grant permissions
-- ============================================================================

GRANT SELECT ON public.tanks_with_rolling_avg TO authenticated;

-- ============================================================================
-- STEP 4: Test the hybrid view
-- ============================================================================

SELECT 'TESTING HYBRID VIEW WITH ANALYTICS' as step;

-- Test basic functionality
SELECT 
    'Basic Data Test' as test,
    COUNT(*) as total_tanks,
    COUNT(current_level) as tanks_with_readings,
    COUNT(CASE WHEN rolling_avg_lpd > 0 THEN 1 END) as tanks_with_rolling_avg,
    COUNT(CASE WHEN prev_day_used > 0 THEN 1 END) as tanks_with_prev_day_usage,
    COUNT(CASE WHEN days_to_min_level IS NOT NULL THEN 1 END) as tanks_with_days_to_min
FROM tanks_with_rolling_avg;

-- Test analytics are working
SELECT 
    'Analytics Test' as test,
    location,
    current_level,
    current_level_percent,
    rolling_avg_lpd,
    prev_day_used,
    days_to_min_level,
    CASE 
        WHEN rolling_avg_lpd > 0 AND prev_day_used > 0 THEN '✅ Analytics Working'
        WHEN rolling_avg_lpd = 0 AND prev_day_used = 0 THEN '⚠️ No Recent Usage Data'
        ELSE '❓ Partial Data'
    END as status
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin' OR subgroup IS NULL
ORDER BY location
LIMIT 5;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'HYBRID VIEW WITH ANALYTICS CREATED' as status;
SELECT 'Rolling averages, prev day usage, and days to min restored' as analytics_restored;
SELECT 'Simple subqueries used to prevent 500 errors' as performance_note;
SELECT 'View should now show detailed fuel management data' as result;