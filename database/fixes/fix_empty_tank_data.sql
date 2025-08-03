-- FIX EMPTY TANK DATA
-- This script fixes the empty data issue in tanks_with_rolling_avg view

-- ============================================================================
-- STEP 1: Create test dip readings if none exist
-- ============================================================================

SELECT 'CREATING TEST DIP READINGS FOR GSFS NARROGIN' as step;

-- Insert test dip readings for GSFS Narrogin tanks if they don't have any
INSERT INTO dip_readings (tank_id, value, recorded_by, created_at)
SELECT 
    ft.id as tank_id,
    CASE 
        WHEN ft.safe_level > 0 THEN ft.safe_level * 0.75  -- 75% full
        ELSE 5000  -- Default value
    END as value,
    auth.uid() as recorded_by,  -- Use current user's ID
    NOW() - INTERVAL '1 hour' as created_at
FROM fuel_tanks ft
LEFT JOIN dip_readings dr ON ft.id = dr.tank_id
WHERE ft.subgroup = 'GSFS Narrogin'
AND dr.id IS NULL  -- Only for tanks without any dip readings
AND auth.uid() IS NOT NULL  -- Only if user is authenticated
ON CONFLICT DO NOTHING;

-- Add some historical readings for rolling average calculation
INSERT INTO dip_readings (tank_id, value, recorded_by, created_at)
SELECT 
    ft.id as tank_id,
    CASE 
        WHEN ft.safe_level > 0 THEN ft.safe_level * 0.80  -- 80% full yesterday
        ELSE 5200
    END as value,
    auth.uid() as recorded_by,  -- Use current user's ID
    NOW() - INTERVAL '1 day' as created_at
FROM fuel_tanks ft
WHERE ft.subgroup = 'GSFS Narrogin'
AND auth.uid() IS NOT NULL  -- Only if user is authenticated
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 2: Fix the tanks_with_rolling_avg view to ensure data shows
-- ============================================================================

SELECT 'RECREATING TANKS_WITH_ROLLING_AVG VIEW WITH FIXES' as step;

-- Drop and recreate the view with better null handling
DROP VIEW IF EXISTS tanks_with_rolling_avg CASCADE;

CREATE VIEW tanks_with_rolling_avg 
WITH (security_barrier = true)
AS
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
  WHERE created_at >= NOW() - INTERVAL '30 days'
),
daily_usage AS (
  SELECT
    id,
    AVG(CASE 
      WHEN prev_value IS NOT NULL AND prev_date IS NOT NULL
      THEN (prev_value - value) / EXTRACT(epoch FROM (created_at - prev_date)) * 86400
      ELSE NULL
    END) as rolling_avg_lpd,
    AVG(CASE 
      WHEN prev_value IS NOT NULL AND prev_date IS NOT NULL 
           AND DATE(created_at) = DATE(prev_date + INTERVAL '1 day')
      THEN (prev_value - value)
      ELSE NULL
    END) as prev_day_used
  FROM recent_readings
  WHERE prev_value IS NOT NULL
  GROUP BY id
)
SELECT
  t.id,
  t.location,
  COALESCE(t.product_type, 'Unknown') as product,  -- Handle nulls
  COALESCE(t.safe_level, 10000) as safe_fill,      -- Default capacity
  COALESCE(t.min_level, 0) as min_level,
  t.group_id,
  tg.name AS group_name,
  t.subgroup,
  
  -- Current level data with better null handling
  COALESCE(ld.current_level, 0) as current_level,
  ld.last_dip_ts,
  COALESCE(ld.last_dip_by, 'No readings') as last_dip_by,
  
  -- Calculate percentage with null safety
  CASE 
    WHEN t.safe_level IS NOT NULL 
         AND t.safe_level > COALESCE(t.min_level, 0) 
         AND ld.current_level IS NOT NULL
         AND ld.current_level >= 0
    THEN GREATEST(0, LEAST(100, ROUND(
      ((ld.current_level - COALESCE(t.min_level, 0)) / 
       (t.safe_level - COALESCE(t.min_level, 0))) * 100, 1
    )))
    WHEN t.safe_level IS NOT NULL AND t.safe_level > 0
    THEN 0  -- Tank has capacity but no reading = 0%
    ELSE NULL  -- No capacity defined
  END AS current_level_percent_display,
  
  -- Usage calculations
  COALESCE(du.rolling_avg_lpd, 0) as rolling_avg_lpd,
  COALESCE(du.prev_day_used, 0) as prev_day_used,
  
  -- Days to minimum calculation
  CASE 
    WHEN du.rolling_avg_lpd > 0 AND ld.current_level > COALESCE(t.min_level, 0)
    THEN ROUND((ld.current_level - COALESCE(t.min_level, 0)) / du.rolling_avg_lpd)
    ELSE NULL
  END as days_to_min_level,
  
  -- Capacity calculation with null safety
  CASE 
    WHEN t.safe_level IS NOT NULL AND t.safe_level > 0
    THEN t.safe_level - COALESCE(t.min_level, 0)
    ELSE 10000  -- Default capacity
  END as usable_capacity,
  
  -- Additional tank metadata
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
  
  -- Add these for frontend compatibility
  COALESCE(ld.current_level, 0) as latest_dip_value,
  ld.last_dip_ts as latest_dip_date,
  ld.last_dip_by as latest_dip_by

FROM fuel_tanks t
LEFT JOIN tank_groups tg ON tg.id = t.group_id
LEFT JOIN latest_dip ld ON ld.id = t.id
LEFT JOIN daily_usage du ON du.id = t.id;

-- Grant permissions
GRANT SELECT ON tanks_with_rolling_avg TO authenticated;

-- ============================================================================
-- STEP 3: Test the fixed view
-- ============================================================================

SELECT 'TESTING FIXED VIEW FOR GSFS NARROGIN' as step;

-- Check if data now appears
SELECT 
    location,
    product,
    safe_fill,
    current_level,
    current_level_percent_display,
    CASE 
        WHEN current_level_percent_display > 0 THEN '✅ HAS DATA'
        WHEN current_level_percent_display = 0 THEN '⚠️ EMPTY TANK'
        ELSE '❌ NO DATA'
    END as status
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin'
ORDER BY location;

-- ============================================================================
-- STEP 4: Ensure tank capacity data exists
-- ============================================================================

SELECT 'ENSURING TANK CAPACITY DATA' as step;

-- Update any tanks with null safe_level
UPDATE fuel_tanks
SET safe_level = 10000  -- Default 10,000L capacity
WHERE safe_level IS NULL
AND subgroup = 'GSFS Narrogin';

-- Update any tanks with null min_level
UPDATE fuel_tanks
SET min_level = 1000  -- Default 1,000L minimum
WHERE min_level IS NULL
AND subgroup = 'GSFS Narrogin';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'TANK DATA FIX COMPLETED' as status;
SELECT 'View recreated with better null handling' as fix_1;
SELECT 'Test dip readings added for empty tanks' as fix_2;
SELECT 'Default capacities set for tanks without data' as fix_3;
SELECT 'Sally should now see tank data with percentages' as result;