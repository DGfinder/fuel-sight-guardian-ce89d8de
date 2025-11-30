-- ============================================================================
-- RECALCULATE: Calculate consumption for all AgBot assets
-- Uses level_liters for more reliable consumption calculation
-- Run this AFTER backfill_readings_level_percent.sql
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Calculate consumption from historical readings (using liters)
WITH consumption_calc AS (
  SELECT
    r.asset_id,
    r.level_liters,
    r.level_percent,
    r.reading_at,
    LAG(r.level_liters) OVER (PARTITION BY r.asset_id ORDER BY r.reading_at) as prev_liters,
    LAG(r.reading_at) OVER (PARTITION BY r.asset_id ORDER BY r.reading_at) as prev_datetime
  FROM ta_agbot_readings r
  WHERE r.reading_at > NOW() - INTERVAL '30 days'
    AND r.level_liters IS NOT NULL
    AND r.level_liters > 0
),
daily_rates AS (
  SELECT
    asset_id,
    reading_at,
    CASE
      -- Only count consumption (level decreased, not refills)
      WHEN prev_liters IS NOT NULL
        AND level_liters < prev_liters
        AND (prev_liters - level_liters) < (prev_liters * 0.20)  -- Max 20% drop per reading
        AND EXTRACT(EPOCH FROM (reading_at - prev_datetime)) > 3600  -- At least 1 hour gap
      THEN (prev_liters - level_liters) / GREATEST(EXTRACT(EPOCH FROM (reading_at - prev_datetime)) / 86400, 0.1)
      ELSE NULL
    END as daily_rate_liters
  FROM consumption_calc
  WHERE prev_liters IS NOT NULL
    AND reading_at > NOW() - INTERVAL '14 days'
),
asset_consumption AS (
  SELECT
    asset_id,
    ROUND(AVG(daily_rate_liters) FILTER (WHERE daily_rate_liters > 10 AND daily_rate_liters < 5000)::numeric, 2) as avg_daily_liters,
    COUNT(*) FILTER (WHERE daily_rate_liters > 10 AND daily_rate_liters < 5000) as data_points
  FROM daily_rates
  GROUP BY asset_id
  HAVING COUNT(*) FILTER (WHERE daily_rate_liters > 10) >= 2  -- Need at least 2 data points
)
UPDATE ta_agbot_assets a
SET
  daily_consumption_liters = ac.avg_daily_liters,
  days_remaining = CASE
    WHEN ac.avg_daily_liters > 0 AND a.current_level_liters > 0
    THEN LEAST(ROUND((a.current_level_liters / ac.avg_daily_liters)::numeric, 0), 365)
    ELSE NULL
  END,
  updated_at = NOW()
FROM asset_consumption ac
WHERE a.id = ac.asset_id;

-- Step 2: Report results
SELECT 'Consumption recalculation complete' as status;

-- Step 3: Show updated assets sorted by urgency
SELECT
  a.name,
  a.current_level_percent as "Level %",
  a.current_level_liters as "Liters",
  a.daily_consumption_liters as "Daily L",
  a.days_remaining as "Days Left",
  l.customer_name,
  CASE
    WHEN a.days_remaining IS NULL THEN 'Unknown'
    WHEN a.days_remaining <= 7 THEN 'CRITICAL'
    WHEN a.days_remaining <= 14 THEN 'WARNING'
    WHEN a.days_remaining <= 30 THEN 'Monitor'
    ELSE 'OK'
  END as urgency
FROM ta_agbot_assets a
JOIN ta_agbot_locations l ON a.location_id = l.id
WHERE a.is_disabled = false
ORDER BY a.days_remaining ASC NULLS LAST
LIMIT 30;
