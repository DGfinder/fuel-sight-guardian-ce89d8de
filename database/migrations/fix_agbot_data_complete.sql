-- ============================================================================
-- COMPLETE FIX: AgBot Data Issues
-- Fixes: 1) 0% percentage display  2) Days remaining calculation
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- FIX 1: Calculate current_level_percent from liters/capacity
-- ============================================================================

UPDATE ta_agbot_assets
SET current_level_percent = ROUND((current_level_liters / NULLIF(capacity_liters, 0) * 100)::numeric, 1)
WHERE current_level_liters IS NOT NULL
  AND capacity_liters IS NOT NULL
  AND capacity_liters > 0
  AND (current_level_percent IS NULL OR current_level_percent = 0);

SELECT 'Fixed percentage display' as step1, COUNT(*) as rows_updated
FROM ta_agbot_assets
WHERE current_level_percent > 0;

-- ============================================================================
-- FIX 2: Calculate consumption from historical readings
-- ============================================================================

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
    reading_at,
    CASE
      -- Only count consumption (level decreased, not refills)
      WHEN prev_percent IS NOT NULL
        AND level_percent < prev_percent
        AND (prev_percent - level_percent) < 15  -- Ignore big drops (sensor errors)
        AND EXTRACT(EPOCH FROM (reading_at - prev_datetime)) > 3600  -- Min 1 hour gap
      THEN (prev_percent - level_percent) / GREATEST(EXTRACT(EPOCH FROM (reading_at - prev_datetime)) / 86400, 0.1)
      ELSE NULL
    END as daily_rate_percent,
    CASE
      WHEN prev_liters IS NOT NULL
        AND level_liters < prev_liters
        AND (prev_liters - level_liters) < (prev_liters * 0.15)
        AND EXTRACT(EPOCH FROM (reading_at - prev_datetime)) > 3600
      THEN (prev_liters - level_liters) / GREATEST(EXTRACT(EPOCH FROM (reading_at - prev_datetime)) / 86400, 0.1)
      ELSE NULL
    END as daily_rate_liters
  FROM consumption_calc
  WHERE prev_percent IS NOT NULL
    AND reading_at > NOW() - INTERVAL '14 days'
),
asset_consumption AS (
  SELECT
    asset_id,
    ROUND(AVG(daily_rate_percent) FILTER (WHERE daily_rate_percent > 0.1 AND daily_rate_percent < 20)::numeric, 2) as avg_daily_percent,
    ROUND(AVG(daily_rate_liters) FILTER (WHERE daily_rate_liters > 0 AND daily_rate_liters < 5000)::numeric, 2) as avg_daily_liters,
    COUNT(*) FILTER (WHERE daily_rate_percent > 0.1 AND daily_rate_percent < 20) as data_points
  FROM daily_rates
  GROUP BY asset_id
  HAVING COUNT(*) FILTER (WHERE daily_rate_percent > 0.1) >= 2
)
UPDATE ta_agbot_assets a
SET
  daily_consumption_liters = COALESCE(
    ac.avg_daily_liters,
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

SELECT 'Fixed consumption/days remaining' as step2;

-- ============================================================================
-- VERIFICATION: Show results
-- ============================================================================

SELECT
  a.name,
  a.current_level_percent as "Level %",
  a.current_level_liters as "Liters",
  a.daily_consumption_liters as "Daily L",
  a.days_remaining as "Days Left",
  l.customer_name
FROM ta_agbot_assets a
JOIN ta_agbot_locations l ON a.location_id = l.id
WHERE a.is_disabled = false
ORDER BY a.days_remaining ASC NULLS LAST
LIMIT 25;
