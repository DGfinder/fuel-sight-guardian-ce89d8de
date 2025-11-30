-- ============================================================================
-- Calculate AgBot Consumption from Historical Readings
-- This calculates daily consumption and days remaining for all AgBot assets
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Calculate consumption from readings and update assets
WITH consumption_calc AS (
  SELECT
    r.asset_id,
    r.level_percent,
    r.level_liters,
    r.reading_at,
    LAG(r.level_percent) OVER (PARTITION BY r.asset_id ORDER BY r.reading_at) as prev_percent,
    LAG(r.level_liters) OVER (PARTITION BY r.asset_id ORDER BY r.reading_at) as prev_liters,
    LAG(r.reading_at) OVER (PARTITION BY r.asset_id ORDER BY r.reading_at) as prev_datetime
  FROM ta_agbot_readings r
  WHERE r.reading_at > NOW() - INTERVAL '30 days'
),
daily_rates AS (
  SELECT
    asset_id,
    CASE
      -- Only count consumption (level decreased, not refills)
      WHEN prev_percent IS NOT NULL
        AND level_percent < prev_percent
        AND (prev_percent - level_percent) < 15  -- Ignore big drops (possible sensor errors)
        AND EXTRACT(EPOCH FROM (reading_at - prev_datetime)) > 3600  -- At least 1 hour between readings
      THEN (prev_percent - level_percent) / GREATEST(EXTRACT(EPOCH FROM (reading_at - prev_datetime)) / 86400, 0.1)
      ELSE NULL
    END as daily_rate_percent,
    CASE
      WHEN prev_liters IS NOT NULL
        AND level_liters < prev_liters
        AND (prev_liters - level_liters) < (prev_liters * 0.15)  -- Ignore >15% drops
        AND EXTRACT(EPOCH FROM (reading_at - prev_datetime)) > 3600
      THEN (prev_liters - level_liters) / GREATEST(EXTRACT(EPOCH FROM (reading_at - prev_datetime)) / 86400, 0.1)
      ELSE NULL
    END as daily_rate_liters
  FROM consumption_calc
  WHERE prev_percent IS NOT NULL
    AND reading_at > NOW() - INTERVAL '14 days'  -- Use 14 days for average
),
asset_consumption AS (
  SELECT
    asset_id,
    ROUND(AVG(daily_rate_percent) FILTER (WHERE daily_rate_percent > 0.1 AND daily_rate_percent < 20)::numeric, 2) as avg_daily_percent,
    ROUND(AVG(daily_rate_liters) FILTER (WHERE daily_rate_liters > 0 AND daily_rate_liters < 5000)::numeric, 2) as avg_daily_liters,
    COUNT(*) FILTER (WHERE daily_rate_percent > 0.1 AND daily_rate_percent < 20) as data_points
  FROM daily_rates
  GROUP BY asset_id
  HAVING COUNT(*) FILTER (WHERE daily_rate_percent > 0.1) >= 2  -- Need at least 2 data points
)
UPDATE ta_agbot_assets a
SET
  daily_consumption_liters = COALESCE(
    ac.avg_daily_liters,
    -- Fallback: calculate from percentage if liters not available
    CASE
      WHEN a.capacity_liters > 0 AND ac.avg_daily_percent > 0
      THEN ROUND((ac.avg_daily_percent / 100 * a.capacity_liters)::numeric, 2)
      ELSE NULL
    END
  ),
  days_remaining = CASE
    WHEN COALESCE(ac.avg_daily_percent, 0) > 0.1 AND a.current_level_percent > 0
    THEN LEAST(ROUND((a.current_level_percent / ac.avg_daily_percent)::numeric, 0), 365)
    WHEN COALESCE(ac.avg_daily_liters, 0) > 0 AND a.current_level_liters > 0
    THEN LEAST(ROUND((a.current_level_liters / ac.avg_daily_liters)::numeric, 0), 365)
    ELSE NULL
  END,
  updated_at = NOW()
FROM asset_consumption ac
WHERE a.id = ac.asset_id;

-- Step 2: Report results
SELECT 'Consumption calculation complete' as status;

-- Step 3: Show updated assets
SELECT
  a.name,
  a.current_level_percent,
  a.current_level_liters,
  a.daily_consumption_liters,
  a.days_remaining,
  a.updated_at
FROM ta_agbot_assets a
WHERE a.is_disabled = false
  AND (a.daily_consumption_liters IS NOT NULL OR a.days_remaining IS NOT NULL)
ORDER BY a.days_remaining ASC NULLS LAST
LIMIT 20;
