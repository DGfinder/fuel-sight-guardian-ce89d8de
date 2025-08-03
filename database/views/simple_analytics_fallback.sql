-- SIMPLE ANALYTICS FALLBACK
-- If the hybrid view still causes issues, use this ultra-simple version
-- Adds analytics one piece at a time for easier debugging

-- ============================================================================
-- STEP 1: Ultra-simple view with just rolling average
-- ============================================================================

SELECT 'CREATING SIMPLE ANALYTICS FALLBACK' as step;

DROP VIEW IF EXISTS tanks_with_rolling_avg CASCADE;

CREATE OR REPLACE VIEW tanks_with_rolling_avg AS
SELECT 
  t.id,
  t.location,
  t.product_type,
  t.safe_level,
  COALESCE(t.min_level, 0) as min_level,
  t.group_id,
  tg.name AS group_name,
  t.subgroup,
  
  -- Current level (simple)
  (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) as current_level,
  (SELECT dr.created_at FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) as last_dip_ts,
  (SELECT dr.recorded_by FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) as last_dip_by,
  
  -- Current level percentage 
  CASE
    WHEN t.safe_level IS NOT NULL AND t.safe_level > COALESCE(t.min_level, 0)
         AND (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) IS NOT NULL
    THEN GREATEST(0, ROUND(
      (((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0)) /
       (t.safe_level - COALESCE(t.min_level, 0))) * 100, 1
    ))
    ELSE 0
  END AS current_level_percent,
  
  CASE
    WHEN t.safe_level IS NOT NULL AND t.safe_level > COALESCE(t.min_level, 0)
         AND (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) IS NOT NULL
    THEN GREATEST(0, ROUND(
      (((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0)) /
       (t.safe_level - COALESCE(t.min_level, 0))) * 100, 1
    ))
    ELSE 0
  END AS current_level_percent_display,
  
  -- ULTRA-SIMPLE rolling average (just last 3 consumption readings)
  COALESCE((
    SELECT ROUND(AVG(consumption)::numeric, 0)
    FROM (
      SELECT ABS(dr1.value - dr2.value) as consumption
      FROM dip_readings dr1, dip_readings dr2
      WHERE dr1.tank_id = t.id 
        AND dr2.tank_id = t.id
        AND dr1.created_at > dr2.created_at
        AND dr1.value < dr2.value  -- Only consumption
        AND ABS(dr1.value - dr2.value) BETWEEN 100 AND 5000  -- Reasonable range
      ORDER BY dr1.created_at DESC
      LIMIT 3  -- Only last 3 to keep it simple
    ) recent_consumption
  ), 0) as rolling_avg_lpd,
  
  -- SIMPLE previous day usage (just most recent consumption)
  COALESCE((
    SELECT ABS(dr1.value - dr2.value)
    FROM dip_readings dr1, dip_readings dr2
    WHERE dr1.tank_id = t.id 
      AND dr2.tank_id = t.id
      AND dr1.created_at > dr2.created_at
      AND dr1.value < dr2.value  -- Consumption
      AND ABS(dr1.value - dr2.value) BETWEEN 50 AND 8000
    ORDER BY dr1.created_at DESC
    LIMIT 1
  ), 0) as prev_day_used,
  
  -- SIMPLE days to minimum (basic calculation)
  CASE 
    WHEN (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) > COALESCE(t.min_level, 0)
         AND COALESCE((SELECT ABS(dr1.value - dr2.value) FROM dip_readings dr1, dip_readings dr2 WHERE dr1.tank_id = t.id AND dr2.tank_id = t.id AND dr1.created_at > dr2.created_at AND dr1.value < dr2.value ORDER BY dr1.created_at DESC LIMIT 1), 0) > 0
    THEN ROUND(
      ((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0)) / 
      COALESCE((SELECT ABS(dr1.value - dr2.value) FROM dip_readings dr1, dip_readings dr2 WHERE dr1.tank_id = t.id AND dr2.tank_id = t.id AND dr1.created_at > dr2.created_at AND dr1.value < dr2.value ORDER BY dr1.created_at DESC LIMIT 1), 1)
    , 1)
    ELSE NULL
  END as days_to_min_level,
  
  -- Additional fields
  t.latitude,
  t.longitude

FROM fuel_tanks t
LEFT JOIN tank_groups tg ON tg.id = t.group_id;

GRANT SELECT ON public.tanks_with_rolling_avg TO authenticated;

-- Test the simple version
SELECT 'SIMPLE FALLBACK CREATED' as status;
SELECT 
    location,
    rolling_avg_lpd,
    prev_day_used,
    days_to_min_level,
    CASE 
        WHEN rolling_avg_lpd > 0 THEN '✅ Has Analytics'
        ELSE '⚠️ No Data'
    END as analytics_status
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin' OR location LIKE '%Narrogin%'
LIMIT 3;