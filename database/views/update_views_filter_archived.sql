-- Update database views to filter out archived dip readings
-- This ensures that only active (non-archived) dip readings are used in calculations

-- ============================================================================
-- Update enhanced bulletproof tanks view to filter archived readings
-- ============================================================================

DROP VIEW IF EXISTS tanks_with_rolling_avg CASCADE;

CREATE OR REPLACE VIEW tanks_with_rolling_avg AS
WITH tank_with_latest_dip AS (
  -- Get latest ACTIVE dip reading for each tank (exclude archived)
  SELECT 
    t.id,
    t.location,
    t.product_type,
    t.safe_level,
    t.min_level,
    t.group_id,
    t.subgroup,
    t.address, t.vehicle, t.discharge, t.bp_portal, t.delivery_window,
    t.afterhours_contact, t.notes, t.serviced_on, t.serviced_by,
    t.latitude, t.longitude, t.created_at, t.updated_at,
    
    -- Latest ACTIVE dip data (archived_at IS NULL)
    (SELECT dr.value 
     FROM dip_readings dr 
     WHERE dr.tank_id = t.id 
       AND dr.archived_at IS NULL
     ORDER BY dr.created_at DESC 
     LIMIT 1) as current_level,
     
    (SELECT dr.created_at 
     FROM dip_readings dr 
     WHERE dr.tank_id = t.id 
       AND dr.archived_at IS NULL
     ORDER BY dr.created_at DESC 
     LIMIT 1) as last_dip_ts,
     
    (SELECT dr.recorded_by::text 
     FROM dip_readings dr 
     WHERE dr.tank_id = t.id 
       AND dr.archived_at IS NULL
     ORDER BY dr.created_at DESC 
     LIMIT 1) as last_dip_by
  FROM fuel_tanks t
),
tank_with_prev_day AS (
  -- Add previous day usage calculation using ACTIVE readings only
  SELECT 
    tld.*,
    -- Previous day used (negative for consumption, positive for refills)
    COALESCE(
      (SELECT (dr1.value - dr2.value)  -- Actual change: negative = consumption, positive = refill
       FROM dip_readings dr1
       JOIN dip_readings dr2 ON dr1.tank_id = dr2.tank_id
       WHERE dr1.tank_id = tld.id
         AND dr1.archived_at IS NULL  -- Only active readings
         AND dr2.archived_at IS NULL  -- Only active readings
         AND dr1.created_at > dr2.created_at
         AND EXTRACT(epoch FROM (dr1.created_at - dr2.created_at)) / 86400 BETWEEN 0.3 AND 3.0
       ORDER BY dr1.created_at DESC, dr2.created_at DESC
       LIMIT 1),
      0
    ) as prev_day_used
  FROM tank_with_latest_dip tld
),
tank_with_rolling_avg AS (
  -- Add 7-day rolling average calculation using ACTIVE readings only
  SELECT 
    tpd.*,
    COALESCE(
      (SELECT AVG(consumption_estimate)
       FROM (
         SELECT 
           CASE 
             WHEN LAG(value) OVER (PARTITION BY tank_id ORDER BY created_at) > value
             THEN (LAG(value) OVER (PARTITION BY tank_id ORDER BY created_at) - value)
             ELSE NULL  -- Skip refills for consumption calculation
           END as consumption_estimate
         FROM dip_readings dr
         WHERE dr.tank_id = tpd.id
           AND dr.archived_at IS NULL  -- Only active readings
           AND dr.created_at >= CURRENT_DATE - INTERVAL '7 days'
       ) consumption_data
       WHERE consumption_estimate IS NOT NULL
      ), 0) as rolling_7d_avg_consumption
  FROM tank_with_prev_day tpd
)
SELECT 
  id,
  location,
  product_type,
  safe_level,
  min_level,
  group_id,
  subgroup,
  address, vehicle, discharge, bp_portal, delivery_window,
  afterhours_contact, notes, serviced_on, serviced_by,
  latitude, longitude, created_at, updated_at,
  current_level,
  last_dip_ts,
  last_dip_by,
  prev_day_used,
  rolling_7d_avg_consumption,
  -- Calculate percentage above minimum
  CASE 
    WHEN current_level IS NOT NULL AND min_level IS NOT NULL AND min_level > 0
    THEN ROUND(((current_level - min_level) / min_level * 100.0)::numeric, 1)
    ELSE NULL
  END as percent_above_min,
  -- Calculate days to minimum based on rolling average
  CASE 
    WHEN current_level IS NOT NULL AND min_level IS NOT NULL 
         AND rolling_7d_avg_consumption > 0 AND current_level > min_level
    THEN ROUND((current_level - min_level) / rolling_7d_avg_consumption)
    ELSE NULL
  END as days_to_min,
  -- Tank status based on current level
  CASE 
    WHEN current_level IS NULL THEN 'No Data'
    WHEN min_level IS NULL THEN 'Unknown'
    WHEN current_level <= min_level THEN 'Critical'
    WHEN current_level <= (min_level * 1.2) THEN 'Low'
    WHEN current_level >= (safe_level * 0.9) THEN 'Full'
    ELSE 'Normal'
  END as status
FROM tank_with_rolling_avg;

-- ============================================================================
-- Create indexes for performance with archived_at filtering
-- ============================================================================

-- Index for filtering active readings
CREATE INDEX IF NOT EXISTS idx_dip_readings_active_tank_created 
ON dip_readings (tank_id, created_at DESC) 
WHERE archived_at IS NULL;

-- Index for date-based queries on active readings
CREATE INDEX IF NOT EXISTS idx_dip_readings_active_created_at 
ON dip_readings (created_at) 
WHERE archived_at IS NULL;

SELECT 'Successfully updated views to filter archived dip readings' as result;