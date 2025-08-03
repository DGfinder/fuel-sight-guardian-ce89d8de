-- FIX VIEW COLUMN POSITION - COORDINATES AT END
-- This SQL keeps exact original column order and adds coordinates at the very end
-- to avoid PostgreSQL column position conflicts

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
  t.id,                                     -- position 1
  t.location,                               -- position 2
  t.product_type,                           -- position 3 (KEEP ORIGINAL ORDER)
  t.safe_level,                             -- position 4
  COALESCE(t.min_level, 0) as min_level,    -- position 5
  t.group_id,                               -- position 6
  tg.name AS group_name,                    -- position 7
  t.subgroup,                               -- position 8
  ld.current_level,                         -- position 9
  ld.last_dip_ts,                           -- position 10
  ld.last_dip_by,                           -- position 11
  CASE                                      -- position 12
    WHEN t.safe_level IS NOT NULL
         AND t.safe_level > COALESCE(t.min_level, 0)
         AND ld.current_level IS NOT NULL
    THEN GREATEST(0, ROUND(
      ((ld.current_level - COALESCE(t.min_level, 0)) /
       (t.safe_level - COALESCE(t.min_level, 0))) * 100, 1
    ))
    ELSE 0
  END AS current_level_percent,
  COALESCE(ra.rolling_avg_lpd, 0) AS rolling_avg,  -- position 13
  COALESCE(pdu.prev_day_used, 0) AS prev_day_used,  -- position 14
  CASE                                      -- position 15
    WHEN ra.rolling_avg_lpd < 0 AND ld.current_level IS NOT NULL
    THEN ROUND((ld.current_level - COALESCE(t.min_level, 0)) / ABS(ra.rolling_avg_lpd), 1)
    ELSE NULL
  END AS days_to_min_level,
  t.latitude,                               -- position 16 (ADDED AT END)
  t.longitude                               -- position 17 (ADDED AT END)
FROM fuel_tanks t
JOIN tank_groups tg ON tg.id = t.group_id
LEFT JOIN latest_dip ld ON ld.id = t.id
LEFT JOIN rolling_average ra ON ra.id = t.id
LEFT JOIN prev_day_usage pdu ON pdu.id = t.id;

-- Verification
SELECT 'VIEW WITH COORDINATES CREATED SUCCESSFULLY' as status;

-- Test sample data with coordinates
SELECT 
    location,
    subgroup,
    current_level,
    rolling_avg,
    latitude,
    longitude
FROM tanks_with_rolling_avg
WHERE location LIKE '%Narrogin%'
LIMIT 3;