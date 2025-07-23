-- FIX FRONTEND DATA COMPATIBILITY
-- This script ensures the tanks_with_rolling_avg view provides all fields expected by the frontend

-- Drop existing view
DROP VIEW IF EXISTS tanks_with_rolling_avg CASCADE;

-- Create view with all expected fields
CREATE VIEW tanks_with_rolling_avg AS
WITH latest_dip AS (
  SELECT DISTINCT ON (tank_id)
    tank_id,
    value,
    created_at,
    recorded_by,
    created_by_name
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
    (prev_value - value) as fuel_consumed,  -- Positive when fuel is consumed
    EXTRACT(EPOCH FROM (created_at - prev_date)) / 86400.0 as days_diff
  FROM recent_readings
  WHERE prev_value IS NOT NULL
    AND prev_date IS NOT NULL
    AND EXTRACT(EPOCH FROM (created_at - prev_date)) / 86400.0 > 0
    AND prev_value >= value  -- Only count consumption, not refills
),
rolling_stats AS (
  SELECT
    tank_id,
    CASE
      WHEN SUM(days_diff) > 0
      THEN ROUND(SUM(fuel_consumed) / SUM(days_diff))::INTEGER
      ELSE 0
    END as rolling_avg,
    -- Get the most recent consumption for prev_day_used
    MAX(CASE 
      WHEN days_diff BETWEEN 0.5 AND 2.0 
      THEN ROUND(fuel_consumed / days_diff)::INTEGER
      ELSE NULL 
    END) as prev_day_used
  FROM daily_changes
  WHERE fuel_consumed > 0  -- Only positive consumption
  GROUP BY tank_id
)
SELECT
  -- Core tank fields
  t.id,
  t.location,
  t.product_type,  -- Keep original name, not 'product'
  t.safe_level,
  COALESCE(t.min_level, 0) as min_level,
  t.group_id,
  tg.name AS group_name,
  t.subgroup,
  
  -- Current level data
  COALESCE(ld.value, 0) as current_level,
  ld.created_at as last_dip_ts,
  COALESCE(ld.recorded_by, '') as last_dip_by,
  
  -- Calculated percentage (matching SQL calculation from other views)
  CASE
    WHEN t.safe_level IS NOT NULL 
         AND t.safe_level > COALESCE(t.min_level, 0) 
         AND ld.value IS NOT NULL
    THEN GREATEST(0, LEAST(100, ROUND(
      ((ld.value - COALESCE(t.min_level, 0)) / 
       (t.safe_level - COALESCE(t.min_level, 0))) * 100, 1
    )))
    ELSE 0
  END AS current_level_percent,
  
  -- Analytics fields with correct names
  COALESCE(rs.rolling_avg, 0) as rolling_avg,  -- Frontend expects 'rolling_avg', not 'rolling_avg_lpd'
  COALESCE(rs.prev_day_used, 0) as prev_day_used,
  
  -- Days to minimum calculation
  CASE
    WHEN rs.rolling_avg > 0 AND ld.value > COALESCE(t.min_level, 0)
    THEN ROUND((ld.value - COALESCE(t.min_level, 0))::NUMERIC / rs.rolling_avg, 1)
    ELSE NULL
  END AS days_to_min_level,
  
  -- Capacity calculations
  CASE 
    WHEN t.safe_level IS NOT NULL AND t.min_level IS NOT NULL
    THEN t.safe_level - t.min_level
    ELSE COALESCE(t.safe_level, 0)
  END as usable_capacity,
  
  CASE 
    WHEN t.safe_level IS NOT NULL AND ld.value IS NOT NULL
    THEN t.safe_level - ld.value
    ELSE 0
  END as ullage,
  
  -- Additional metadata fields
  t.address,
  t.vehicle,
  t.discharge,
  t.bp_portal,
  t.delivery_window,
  t.afterhours_contact,
  t.notes,
  t.serviced_on,
  t.serviced_by,
  t.latitude,
  t.longitude,
  t.created_at,
  t.updated_at,
  
  -- Last dip as object (for frontend compatibility)
  CASE 
    WHEN ld.value IS NOT NULL 
    THEN jsonb_build_object(
      'value', ld.value,
      'created_at', ld.created_at,
      'recorded_by', COALESCE(ld.created_by_name, 'Unknown')
    )
    ELSE NULL
  END as last_dip

FROM fuel_tanks t
LEFT JOIN tank_groups tg ON tg.id = t.group_id
LEFT JOIN latest_dip ld ON ld.tank_id = t.id
LEFT JOIN rolling_stats rs ON rs.tank_id = t.id
WHERE t.deleted_at IS NULL;  -- Don't show deleted tanks

-- Grant permissions
GRANT SELECT ON tanks_with_rolling_avg TO authenticated;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_dip_readings_tank_created 
  ON dip_readings(tank_id, created_at DESC);

-- Test the view
SELECT 
  location,
  product_type,
  current_level,
  current_level_percent,
  rolling_avg,
  prev_day_used,
  days_to_min_level,
  last_dip
FROM tanks_with_rolling_avg
LIMIT 5;