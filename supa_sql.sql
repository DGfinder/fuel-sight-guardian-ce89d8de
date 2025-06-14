-- Updated SQL view definition (using tanks_with_rolling_avg) so that the frontend query (selecting from tanks_with_rolling_avg) works.
DROP VIEW IF EXISTS public.tanks_with_rolling_avg;
CREATE OR REPLACE VIEW public.tanks_with_rolling_avg AS
WITH latest_dip AS (
  SELECT DISTINCT ON (tank_id)
    tank_id,
    value as current_level,
    created_at as last_dip_ts,
    recorded_by as last_dip_by
  FROM dip_readings
  ORDER BY tank_id, created_at DESC
),
recent_readings AS (
  SELECT 
    tank_id,
    value,
    created_at,
    LAG(value) OVER (PARTITION BY tank_id ORDER BY created_at) as prev_value,
    LAG(created_at) OVER (PARTITION BY tank_id ORDER BY created_at) as prev_date
  FROM dip_readings 
  WHERE created_at >= NOW() - INTERVAL '7 days'
),
daily_changes AS (
  SELECT 
    tank_id,
    (prev_value - value) as fuel_change, -- Positive = fuel used, Negative = fuel added
    EXTRACT(EPOCH FROM (created_at - prev_date)) / 86400.0 as days_diff
  FROM recent_readings
  WHERE prev_value IS NOT NULL 
    AND prev_date IS NOT NULL
    AND EXTRACT(EPOCH FROM (created_at - prev_date)) / 86400.0 > 0
),
rolling_average AS (
  SELECT 
    tank_id,
    CASE 
      WHEN SUM(days_diff) > 0 
      THEN ROUND(SUM(fuel_change) / SUM(days_diff))::INTEGER
      ELSE NULL 
    END as rolling_avg_lpd
  FROM daily_changes
  GROUP BY tank_id
)
SELECT
  t.id,
  t.location,
  t.product_type,
  t.safe_level,
  COALESCE(t.min_level, 0) as min_level,
  t.group_id,
  tg.name AS group_name,
  ld.current_level,
  ld.last_dip_ts,
  ld.last_dip_by,
  -- % Full: (current - min) / (safe - min) * 100, properly using min_level
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
  -- Rolling average (negative = burn rate, positive = net addition)
  COALESCE(ra.rolling_avg_lpd, 0) AS rolling_avg_lpd,
  -- Days to minimum level (only when burning fuel)
  CASE
    WHEN ra.rolling_avg_lpd > 0 AND ld.current_level IS NOT NULL
    THEN ROUND((ld.current_level - COALESCE(t.min_level, 0)) / ra.rolling_avg_lpd, 1)
    ELSE NULL
  END AS days_to_min_level
FROM fuel_tanks t
JOIN tank_groups tg ON tg.id = t.group_id
LEFT JOIN latest_dip ld ON ld.tank_id = t.id
LEFT JOIN rolling_average ra ON ra.tank_id = t.id; 