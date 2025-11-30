-- Migration: Add previous_day_use to ta_tank_analytics
-- This calculates the consumption between the two most recent dips (recent - previous)
-- Run in Supabase SQL Editor

-- Step 1: Drop dependent view first
DROP VIEW IF EXISTS ta_tank_full_status;

-- Step 2: Drop and recreate materialized view with previous_day_use
DROP MATERIALIZED VIEW IF EXISTS ta_tank_analytics;

CREATE MATERIALIZED VIEW ta_tank_analytics AS
WITH recent_dips AS (
    -- Get last 14 days of readings per tank
    SELECT
        tank_id,
        level_liters,
        measured_at,
        LAG(level_liters) OVER (PARTITION BY tank_id ORDER BY measured_at) as prev_level,
        LAG(measured_at) OVER (PARTITION BY tank_id ORDER BY measured_at) as prev_measured_at
    FROM ta_tank_dips
    WHERE archived_at IS NULL
      AND measured_at >= NOW() - INTERVAL '14 days'
),
consumption_calc AS (
    -- Calculate daily consumption between readings
    -- Only count when level goes DOWN (consumption, not deliveries)
    SELECT
        tank_id,
        measured_at,
        CASE
            WHEN prev_level > level_liters THEN
                (prev_level - level_liters) /
                NULLIF(EXTRACT(EPOCH FROM (measured_at - prev_measured_at)) / 86400.0, 0)
            ELSE 0
        END as daily_consumption
    FROM recent_dips
    WHERE prev_level IS NOT NULL
      AND prev_level > level_liters
),
latest_two_dips AS (
    -- Get the two most recent dips per tank for previous_day_use calculation
    SELECT
        tank_id,
        level_liters,
        ROW_NUMBER() OVER (PARTITION BY tank_id ORDER BY measured_at DESC) as rn
    FROM ta_tank_dips
    WHERE archived_at IS NULL
),
prev_day_calc AS (
    -- Calculate previous day use (previous dip level - current dip level)
    -- Only positive values (consumption), 0 for deliveries/increases
    SELECT
        l1.tank_id,
        CASE
            WHEN l2.level_liters IS NOT NULL AND l2.level_liters > l1.level_liters
            THEN (l2.level_liters - l1.level_liters)::integer
            ELSE 0
        END as previous_day_use
    FROM latest_two_dips l1
    LEFT JOIN latest_two_dips l2 ON l1.tank_id = l2.tank_id AND l2.rn = 2
    WHERE l1.rn = 1
)
SELECT
    t.id as tank_id,
    COALESCE(AVG(c.daily_consumption), 0)::integer as avg_daily_consumption_liters,
    CASE
        WHEN COALESCE(AVG(c.daily_consumption), 0) > 0
        THEN ROUND(t.current_level_liters / AVG(c.daily_consumption))::integer
        ELSE 999
    END as estimated_days_until_empty,
    CASE
        WHEN COALESCE(AVG(c.daily_consumption), 0) > 0
        THEN (NOW() + (t.current_level_liters / AVG(c.daily_consumption)) * INTERVAL '1 day')::date
        ELSE NULL
    END as estimated_empty_date,
    CASE
        WHEN COALESCE(AVG(c.daily_consumption), 0) > 0 AND t.min_level_liters > 0
        THEN ROUND((t.current_level_liters - t.min_level_liters) / AVG(c.daily_consumption))::integer
        ELSE 999
    END as days_until_min_level,
    COALESCE(p.previous_day_use, 0) as previous_day_use,
    COUNT(c.daily_consumption)::integer as readings_in_period,
    NOW() as calculated_at
FROM ta_tanks t
LEFT JOIN consumption_calc c ON t.id = c.tank_id
LEFT JOIN prev_day_calc p ON t.id = p.tank_id
WHERE t.archived_at IS NULL
GROUP BY t.id, t.current_level_liters, t.min_level_liters, p.previous_day_use;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_ta_tank_analytics_pk ON ta_tank_analytics(tank_id);

-- Step 3: Recreate ta_tank_full_status view with previous_day_use
CREATE OR REPLACE VIEW ta_tank_full_status AS
SELECT
    d.*,
    COALESCE(a.avg_daily_consumption_liters, 0) as avg_daily_consumption_liters,
    COALESCE(a.estimated_days_until_empty, 999) as estimated_days_until_empty,
    a.estimated_empty_date,
    COALESCE(a.days_until_min_level, 999) as days_until_min_level,
    COALESCE(a.previous_day_use, 0) as previous_day_use,
    COALESCE(a.readings_in_period, 0) as readings_in_period,
    a.calculated_at as analytics_updated_at,
    -- Urgency scoring based on fill level AND days until empty
    CASE
        WHEN d.fill_percent <= 10 THEN 'critical'
        WHEN d.fill_percent <= 20 THEN 'urgent'
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 3 THEN 'urgent'
        WHEN d.fill_percent <= 30 THEN 'warning'
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 7 THEN 'warning'
        WHEN d.current_level_liters <= d.min_level_liters THEN 'warning'
        ELSE 'ok'
    END as urgency_status,
    -- Priority score for sorting (lower = more urgent)
    CASE
        WHEN d.fill_percent <= 10 THEN 1
        WHEN d.fill_percent <= 20 THEN 2
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 3 THEN 2
        WHEN d.fill_percent <= 30 THEN 3
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 7 THEN 3
        ELSE 4
    END as priority_score
FROM ta_tank_dashboard d
LEFT JOIN ta_tank_analytics a ON d.id = a.tank_id;

-- Verify the changes
SELECT 'Migration complete. Testing previous_day_use...' as status;
SELECT tank_id, avg_daily_consumption_liters, previous_day_use, readings_in_period
FROM ta_tank_analytics
WHERE previous_day_use > 0
LIMIT 5;
