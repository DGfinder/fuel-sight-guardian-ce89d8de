-- FIX TANKS_WITH_ROLLING_AVG VIEW - CORRECT COLUMN ORDER AND NAMES
-- This SQL matches the exact original structure and adds coordinates for map
-- Based on refactor_tank_id.sql with proper column order

CREATE OR REPLACE VIEW public.tanks_with_rolling_avg AS
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
  t.product_type,                           -- CORRECT: product_type (not product)
  t.safe_level,                            -- CORRECT: safe_level (not safe_fill)
  COALESCE(t.min_level, 0) as min_level,
  t.group_id,
  tg.name AS group_name,
  t.subgroup,                              -- CORRECT: position 8 (not position 3)
  ld.current_level,
  ld.last_dip_ts,
  ld.last_dip_by,                          -- ADDED: missing from new SQL
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
  COALESCE(ra.rolling_avg_lpd, 0) AS rolling_avg,  -- CORRECT: rolling_avg (not rolling_avg_lpd)
  COALESCE(pdu.prev_day_used, 0) AS prev_day_used,
  CASE
    WHEN ra.rolling_avg_lpd < 0 AND ld.current_level IS NOT NULL
    THEN ROUND((ld.current_level - COALESCE(t.min_level, 0)) / ABS(ra.rolling_avg_lpd), 1)
    ELSE NULL
  END AS days_to_min_level,
  t.latitude,                              -- ADDED: for map functionality
  t.longitude                              -- ADDED: for map functionality
FROM fuel_tanks t
JOIN tank_groups tg ON tg.id = t.group_id
LEFT JOIN latest_dip ld ON ld.id = t.id
LEFT JOIN rolling_average ra ON ra.id = t.id
LEFT JOIN prev_day_usage pdu ON pdu.id = t.id;

-- Verification queries
SELECT 'VIEW STRUCTURE VERIFICATION' as check;

SELECT 
    column_name,
    ordinal_position,
    data_type
FROM information_schema.columns 
WHERE table_name = 'tanks_with_rolling_avg'
ORDER BY ordinal_position;

-- Test sample data
SELECT 'SAMPLE DATA VERIFICATION' as check;
SELECT 
    id,
    location,
    product_type,
    subgroup,
    current_level,
    rolling_avg,
    days_to_min_level,
    latitude,
    longitude
FROM tanks_with_rolling_avg
WHERE location LIKE '%Narrogin%'
LIMIT 3;

SELECT 
    'VIEW RESTORATION COMPLETE' as status,
    'Tank data should display normally again' as result,
    'Map coordinates added for location display' as map_fix,
    'Sally subgroup filtering preserved in frontend' as permissions;