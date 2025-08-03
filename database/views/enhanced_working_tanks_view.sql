-- ENHANCED WORKING TANKS VIEW
-- Based on the user's working old SQL structure that "sort of works"
-- Adds missing frontend compatibility fields while keeping the proven CTE structure

-- ============================================================================
-- STEP 1: Create enhanced view using working CTE pattern
-- ============================================================================

SELECT 'CREATING ENHANCED WORKING VIEW' as step;

DROP VIEW IF EXISTS public.tanks_with_rolling_avg CASCADE;

CREATE VIEW public.tanks_with_rolling_avg AS
WITH recent_dips AS (
  SELECT
    tank_id,
    value,
    created_at,
    recorded_by,
    ROW_NUMBER() OVER (PARTITION BY tank_id ORDER BY created_at DESC) as rn
  FROM dip_readings
  WHERE created_at >= NOW() - INTERVAL '7 days'
),
latest_dips AS (
  SELECT
    tank_id,
    value as current_level,
    created_at as last_dip_ts,
    recorded_by as last_dip_by
  FROM recent_dips
  WHERE rn = 1
),
deltas AS (
  SELECT
    tank_id,
    value,
    created_at,
    LAG(value) OVER (PARTITION BY tank_id ORDER BY created_at) AS prev_value,
    LAG(created_at) OVER (PARTITION BY tank_id ORDER BY created_at) AS prev_date
  FROM dip_readings
  WHERE created_at >= NOW() - INTERVAL '7 days'
),
usage_deltas AS (
  SELECT
    tank_id,
    (prev_value - value) AS usage, -- Negative means burn, positive means refill
    EXTRACT(EPOCH FROM (created_at - prev_date)) / 86400 AS days
  FROM deltas
  WHERE prev_value IS NOT NULL AND prev_date IS NOT NULL
),
rolling_avg_calc AS (
  SELECT
    tank_id,
    CASE WHEN SUM(days) > 0 THEN ROUND(SUM(usage) / SUM(days)) ELSE NULL END AS rolling_avg_lpd
  FROM usage_deltas
  GROUP BY tank_id
),
prev_day_dips AS (
  SELECT
    t.id AS tank_id,
    (
      SELECT value
      FROM dip_readings d
      WHERE d.tank_id = t.id AND d.created_at <= (CURRENT_DATE - INTERVAL '1 day')
      ORDER BY d.created_at DESC
      LIMIT 1
    ) AS start_value,
    (
      SELECT value
      FROM dip_readings d
      WHERE d.tank_id = t.id AND d.created_at <= CURRENT_DATE
      ORDER BY d.created_at DESC
      LIMIT 1
    ) AS end_value
  FROM fuel_tanks t
)
SELECT
  -- ============================================================================
  -- CORE TANK IDENTIFICATION (Original working fields)
  -- ============================================================================
  t.id,
  t.location,
  t.product_type,
  t.safe_level,
  COALESCE(t.min_level, 0) as min_level,
  t.group_id,
  tg.name AS group_name,
  t.subgroup,
  
  -- ============================================================================
  -- CURRENT LEVEL DATA (Original working fields)
  -- ============================================================================
  ld.current_level,
  ld.last_dip_ts,
  ld.last_dip_by,
  
  -- ============================================================================
  -- PERCENTAGE CALCULATION (Original working logic)
  -- ============================================================================
  GREATEST(
    CASE
      WHEN t.safe_level > COALESCE(t.min_level, 0) AND ld.current_level IS NOT NULL
      THEN ROUND(((ld.current_level - COALESCE(t.min_level, 0)) / NULLIF(t.safe_level - COALESCE(t.min_level, 0),0)) * 100, 1)
      ELSE 0
    END,
    0
  ) AS current_level_percent,
  
  -- ============================================================================
  -- FRONTEND COMPATIBILITY - Add display version
  -- ============================================================================
  GREATEST(
    CASE
      WHEN t.safe_level > COALESCE(t.min_level, 0) AND ld.current_level IS NOT NULL
      THEN ROUND(((ld.current_level - COALESCE(t.min_level, 0)) / NULLIF(t.safe_level - COALESCE(t.min_level, 0),0)) * 100, 1)
      ELSE 0
    END,
    0
  ) AS current_level_percent_display,
  
  -- ============================================================================
  -- ANALYTICS (Original working calculations)
  -- ============================================================================
  -- Rolling average (L/day), negative means burn, positive means refill
  rac.rolling_avg_lpd AS rolling_avg_lpd,
  
  -- Days to minimum level
  CASE
    WHEN rac.rolling_avg_lpd IS NULL OR rac.rolling_avg_lpd >= 0 THEN NULL  -- Refilling or no data, no days to min
    WHEN ld.current_level IS NOT NULL
    THEN ROUND((ld.current_level - COALESCE(t.min_level, 0)) / ABS(rac.rolling_avg_lpd), 1)
    ELSE NULL
  END AS days_to_min_level,
  
  -- Previous day's fuel used (negative means burn, positive means refill)
  COALESCE(prev_day_dips.start_value - prev_day_dips.end_value, NULL) AS prev_day_used,
  
  -- ============================================================================
  -- MAP AND LOCATION DATA (Frontend needs these)
  -- ============================================================================
  t.latitude,
  t.longitude,
  
  -- ============================================================================
  -- ADDITIONAL TANK DETAILS (Frontend compatibility)
  -- ============================================================================
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
  
  -- ============================================================================
  -- CALCULATED FIELDS (Frontend might expect these)
  -- ============================================================================
  -- Usable capacity calculation
  CASE 
    WHEN t.safe_level > COALESCE(t.min_level, 0) 
    THEN t.safe_level - COALESCE(t.min_level, 0)
    ELSE NULL
  END as usable_capacity,
  
  -- Latest dip aliases (for frontend compatibility)
  ld.current_level as latest_dip_value,
  ld.last_dip_ts as latest_dip_date,
  ld.last_dip_by as latest_dip_by

FROM fuel_tanks t
JOIN tank_groups tg ON tg.id = t.group_id
LEFT JOIN latest_dips ld ON ld.tank_id = t.id
LEFT JOIN rolling_avg_calc rac ON rac.tank_id = t.id
LEFT JOIN prev_day_dips ON prev_day_dips.tank_id = t.id;

-- ============================================================================
-- STEP 2: Grant permissions
-- ============================================================================

GRANT SELECT ON public.tanks_with_rolling_avg TO authenticated;

-- ============================================================================
-- STEP 3: Test the enhanced working view
-- ============================================================================

SELECT 'TESTING ENHANCED WORKING VIEW' as step;

-- Test that analytics are working
SELECT 
    'Analytics Test' as test,
    COUNT(*) as total_tanks,
    COUNT(current_level) as tanks_with_readings,
    COUNT(CASE WHEN rolling_avg_lpd IS NOT NULL THEN 1 END) as tanks_with_rolling_avg,
    COUNT(CASE WHEN prev_day_used IS NOT NULL THEN 1 END) as tanks_with_prev_day,
    COUNT(CASE WHEN days_to_min_level IS NOT NULL THEN 1 END) as tanks_with_days_to_min
FROM tanks_with_rolling_avg;

-- Test specific analytics values
SELECT 
    'Specific Analytics Test' as test,
    location,
    current_level,
    current_level_percent,
    current_level_percent_display,
    rolling_avg_lpd,
    prev_day_used,
    days_to_min_level,
    usable_capacity,
    CASE 
        WHEN rolling_avg_lpd IS NOT NULL AND rolling_avg_lpd < 0 THEN '✅ Consumption Data'
        WHEN rolling_avg_lpd IS NOT NULL AND rolling_avg_lpd > 0 THEN '🔄 Refill Data'  
        WHEN rolling_avg_lpd IS NOT NULL AND rolling_avg_lpd = 0 THEN '⏸️ No Change'
        ELSE '❓ No Analytics'
    END as status
FROM tanks_with_rolling_avg
WHERE subgroup LIKE '%Narrogin%' OR location LIKE '%Narrogin%'
ORDER BY location
LIMIT 5;

-- Test frontend field compatibility
SELECT 
    'Frontend Fields Test' as test,
    id,
    location,
    group_name,
    current_level_percent_display,
    latitude,
    longitude,
    latest_dip_value,
    latest_dip_date,
    CASE 
        WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN '✅ Map Ready'
        ELSE '⚠️ No Coordinates'
    END as map_status
FROM tanks_with_rolling_avg
WHERE subgroup LIKE '%Narrogin%' OR location LIKE '%Narrogin%'
LIMIT 3;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'ENHANCED WORKING VIEW CREATED' as status;
SELECT 'Uses proven CTE structure from working old SQL' as base;
SELECT 'Added frontend compatibility fields' as enhancement;
SELECT 'Rolling averages, prev day usage, and days to min should work' as analytics;
SELECT 'Negative values indicate consumption, positive indicate refills' as note;