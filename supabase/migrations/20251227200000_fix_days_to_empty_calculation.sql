-- Migration: Fix estimated_days_until_empty calculation
-- Issue: Showing 0 days when tank has fuel (e.g., 200,000L / 109,720 L/day = ~2 days)
-- Fix:
--   1. Ensure minimum 1 day when tank has fuel above min_level
--   2. Use current tank level from ta_tanks directly
--   3. Refresh materialized view

-- ============================================
-- Step 1: Recreate the ta_tank_analytics materialized view
-- with improved days calculation
-- ============================================

-- First, drop dependent views
DROP VIEW IF EXISTS ta_unified_map_locations;
DROP VIEW IF EXISTS ta_tank_full_status;
DROP MATERIALIZED VIEW IF EXISTS ta_tank_analytics;

-- Create enhanced materialized view with fixed calculation
CREATE MATERIALIZED VIEW ta_tank_analytics AS
WITH
-- Get all dips in last 30 days for calculations
all_recent_dips AS (
    SELECT
        tank_id,
        level_liters,
        measured_at,
        LAG(level_liters) OVER (PARTITION BY tank_id ORDER BY measured_at) as prev_level,
        LAG(measured_at) OVER (PARTITION BY tank_id ORDER BY measured_at) as prev_measured_at
    FROM ta_tank_dips
    WHERE archived_at IS NULL
      AND measured_at >= NOW() - INTERVAL '30 days'
),

-- Calculate consumption per reading (only when level goes DOWN)
consumption_per_reading AS (
    SELECT
        tank_id,
        measured_at,
        prev_measured_at,
        CASE
            WHEN prev_level > level_liters
            THEN prev_level - level_liters
            ELSE 0
        END as consumption,
        CASE
            WHEN prev_level > level_liters AND prev_measured_at IS NOT NULL
            THEN (prev_level - level_liters) /
                 NULLIF(EXTRACT(EPOCH FROM (measured_at - prev_measured_at)) / 86400.0, 0)
            ELSE 0
        END as daily_rate,
        -- Detect refills (level went UP by >500L)
        CASE
            WHEN level_liters - prev_level > 500 THEN TRUE
            ELSE FALSE
        END as is_refill,
        CASE
            WHEN level_liters - prev_level > 500 THEN level_liters - prev_level
            ELSE 0
        END as refill_volume,
        level_liters,
        prev_level
    FROM all_recent_dips
    WHERE prev_level IS NOT NULL
),

-- Latest two dips for previous_day_use
latest_two AS (
    SELECT
        tank_id,
        level_liters,
        measured_at,
        ROW_NUMBER() OVER (PARTITION BY tank_id ORDER BY measured_at DESC) as rn
    FROM ta_tank_dips
    WHERE archived_at IS NULL
),

-- Previous day use calculation
prev_day_calc AS (
    SELECT
        l1.tank_id,
        l1.measured_at as latest_dip_at,
        CASE
            WHEN l2.level_liters > l1.level_liters THEN (l2.level_liters - l1.level_liters)::integer
            ELSE 0
        END as previous_day_use
    FROM latest_two l1
    LEFT JOIN latest_two l2 ON l1.tank_id = l2.tank_id AND l2.rn = 2
    WHERE l1.rn = 1
),

-- Last 7 days consumption stats
week1_stats AS (
    SELECT
        tank_id,
        AVG(NULLIF(daily_rate, 0)) as avg_daily_rate,
        STDDEV(NULLIF(daily_rate, 0)) as stddev_rate,
        MAX(daily_rate) as peak_rate,
        SUM(consumption) as total_consumption
    FROM consumption_per_reading
    WHERE measured_at >= NOW() - INTERVAL '7 days'
      AND daily_rate > 0
    GROUP BY tank_id
),

-- Previous 7 days (days 8-14) consumption stats for trend
week2_stats AS (
    SELECT
        tank_id,
        AVG(NULLIF(daily_rate, 0)) as avg_daily_rate
    FROM consumption_per_reading
    WHERE measured_at >= NOW() - INTERVAL '14 days'
      AND measured_at < NOW() - INTERVAL '7 days'
      AND daily_rate > 0
    GROUP BY tank_id
),

-- Last 30 days total consumption
month_stats AS (
    SELECT
        tank_id,
        SUM(consumption) as total_consumption,
        AVG(NULLIF(daily_rate, 0)) as avg_daily_rate,
        MAX(daily_rate) as peak_daily_consumption,
        COUNT(*) FILTER (WHERE daily_rate > 0) as reading_count
    FROM consumption_per_reading
    WHERE daily_rate > 0
    GROUP BY tank_id
),

-- Last refill info
last_refill AS (
    SELECT DISTINCT ON (tank_id)
        tank_id,
        measured_at as last_refill_date,
        refill_volume as last_refill_volume
    FROM consumption_per_reading
    WHERE is_refill = TRUE
    ORDER BY tank_id, measured_at DESC
),

-- Average refill interval
refill_intervals AS (
    SELECT
        tank_id,
        AVG(EXTRACT(EPOCH FROM (measured_at - prev_measured_at)) / 86400.0)::integer as avg_refill_interval_days
    FROM consumption_per_reading
    WHERE is_refill = TRUE
    GROUP BY tank_id
),

-- Group averages for comparison
group_avgs AS (
    SELECT
        t.group_id,
        AVG(m.avg_daily_rate) as group_avg_consumption
    FROM ta_tanks t
    LEFT JOIN month_stats m ON t.id = m.tank_id
    WHERE t.group_id IS NOT NULL
    GROUP BY t.group_id
)

SELECT
    t.id as tank_id,

    -- Existing metrics (14-day rolling average)
    COALESCE(
        (SELECT AVG(daily_rate)::integer FROM consumption_per_reading c
         WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0),
        0
    ) as avg_daily_consumption_liters,

    -- FIXED: Days until empty (using 14-day avg)
    -- Now ensures minimum 1 day when there's fuel above min level
    CASE
        WHEN COALESCE(
            (SELECT AVG(daily_rate) FROM consumption_per_reading c
             WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0),
            0
        ) > 0
        THEN GREATEST(1, ROUND(
            (t.current_level_liters - COALESCE(t.min_level_liters, 0))::numeric /
            (SELECT AVG(daily_rate) FROM consumption_per_reading c
             WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0)
        )::integer)
        ELSE 999
    END as estimated_days_until_empty,

    -- Estimated empty date
    CASE
        WHEN COALESCE(
            (SELECT AVG(daily_rate) FROM consumption_per_reading c
             WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0),
            0
        ) > 0
        THEN (NOW() + GREATEST(1, ROUND(
            (t.current_level_liters - COALESCE(t.min_level_liters, 0))::numeric /
            (SELECT AVG(daily_rate) FROM consumption_per_reading c
             WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0)
        )) * INTERVAL '1 day')::date
        ELSE NULL
    END as estimated_empty_date,

    -- Days until min level
    CASE
        WHEN COALESCE(
            (SELECT AVG(daily_rate) FROM consumption_per_reading c
             WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0),
            0
        ) > 0 AND t.min_level_liters > 0 AND t.current_level_liters > t.min_level_liters
        THEN GREATEST(1, ROUND((t.current_level_liters - t.min_level_liters)::numeric /
            (SELECT AVG(daily_rate) FROM consumption_per_reading c
             WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0)
        )::integer)
        ELSE 999
    END as days_until_min_level,

    -- Count of readings in period
    COALESCE((SELECT COUNT(*) FROM consumption_per_reading c
              WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days'), 0) as readings_in_period,

    -- Previous day use
    COALESCE(p.previous_day_use, 0) as previous_day_use,

    -- NEW: 7-day consumption
    COALESCE(w.total_consumption, 0)::integer as consumption_7_days,

    -- NEW: 30-day consumption
    COALESCE(m.total_consumption, 0)::integer as consumption_30_days,

    -- NEW: Peak daily consumption
    COALESCE(m.peak_daily_consumption, 0)::integer as peak_daily_consumption,

    -- NEW: Consumption trend (comparing week 1 vs week 2)
    CASE
        WHEN w.avg_daily_rate IS NOT NULL AND w2.avg_daily_rate IS NOT NULL
        THEN CASE
            WHEN w.avg_daily_rate > w2.avg_daily_rate * 1.1 THEN 'increasing'
            WHEN w.avg_daily_rate < w2.avg_daily_rate * 0.9 THEN 'decreasing'
            ELSE 'stable'
        END
        ELSE 'unknown'
    END as trend_direction,

    -- NEW: Trend percentage change
    CASE
        WHEN w.avg_daily_rate IS NOT NULL AND w2.avg_daily_rate IS NOT NULL AND w2.avg_daily_rate > 0
        THEN ROUND(((w.avg_daily_rate - w2.avg_daily_rate) / w2.avg_daily_rate * 100)::numeric, 1)
        ELSE 0
    END as trend_percent_change,

    -- NEW: Last refill date
    lr.last_refill_date,

    -- NEW: Last refill volume
    COALESCE(lr.last_refill_volume, 0)::integer as last_refill_volume,

    -- NEW: Average refill interval
    COALESCE(ri.avg_refill_interval_days, 0) as avg_refill_interval_days,

    -- NEW: Consumption standard deviation (predictability indicator)
    COALESCE(w.stddev_rate, 0)::integer as consumption_stddev,

    -- NEW: Predictability score
    CASE
        WHEN w.avg_daily_rate IS NULL OR w.avg_daily_rate = 0 THEN 'no_data'
        WHEN w.stddev_rate IS NULL OR w.stddev_rate = 0 THEN 'stable'
        WHEN w.stddev_rate / NULLIF(w.avg_daily_rate, 0) > 0.5 THEN 'unpredictable'
        WHEN w.stddev_rate / NULLIF(w.avg_daily_rate, 0) > 0.25 THEN 'variable'
        ELSE 'stable'
    END as predictability,

    -- NEW: Anomaly detection
    CASE
        WHEN w.peak_rate IS NOT NULL AND w.avg_daily_rate IS NOT NULL
             AND w.peak_rate > w.avg_daily_rate * 3
        THEN TRUE
        ELSE FALSE
    END as is_anomaly,

    CASE
        WHEN w.peak_rate IS NOT NULL AND w.avg_daily_rate IS NOT NULL
             AND w.peak_rate > w.avg_daily_rate * 3
        THEN 'spike'
        ELSE NULL
    END as anomaly_type,

    -- NEW: Optimal order date (when to order to maintain safe level)
    CASE
        WHEN w.avg_daily_rate IS NOT NULL AND w.avg_daily_rate > 0 AND t.safe_level_liters > 0
             AND t.current_level_liters > t.safe_level_liters
        THEN (NOW() + ((t.current_level_liters - t.safe_level_liters) / w.avg_daily_rate) * INTERVAL '1 day')::date
        ELSE NULL
    END as optimal_order_date,

    -- NEW: Order urgency
    CASE
        WHEN t.current_level_liters <= COALESCE(t.min_level_liters, 0) THEN 'critical'
        WHEN t.current_level_liters <= COALESCE(t.safe_level_liters, t.capacity_liters * 0.2) THEN 'urgent'
        WHEN w.avg_daily_rate IS NOT NULL AND w.avg_daily_rate > 0
             AND (t.current_level_liters - COALESCE(t.min_level_liters, 0)) / w.avg_daily_rate <= 7
        THEN 'soon'
        ELSE 'ok'
    END as order_urgency,

    -- NEW: Consumption vs group average
    CASE
        WHEN ga.group_avg_consumption IS NOT NULL AND ga.group_avg_consumption > 0
             AND w.avg_daily_rate IS NOT NULL
        THEN ROUND(((w.avg_daily_rate - ga.group_avg_consumption) / ga.group_avg_consumption * 100)::numeric, 1)
        ELSE NULL
    END as consumption_vs_group_percent,

    -- NEW: Efficiency trend
    CASE
        WHEN w.avg_daily_rate IS NOT NULL AND ga.group_avg_consumption IS NOT NULL
        THEN CASE
            WHEN w.avg_daily_rate < ga.group_avg_consumption * 0.9 THEN 'efficient'
            WHEN w.avg_daily_rate > ga.group_avg_consumption * 1.1 THEN 'high'
            ELSE 'normal'
        END
        ELSE 'unknown'
    END as efficiency_trend,

    -- Calculated timestamp
    NOW() as calculated_at

FROM ta_tanks t
LEFT JOIN prev_day_calc p ON t.id = p.tank_id
LEFT JOIN week1_stats w ON t.id = w.tank_id
LEFT JOIN week2_stats w2 ON t.id = w2.tank_id
LEFT JOIN month_stats m ON t.id = m.tank_id
LEFT JOIN last_refill lr ON t.id = lr.tank_id
LEFT JOIN refill_intervals ri ON t.id = ri.tank_id
LEFT JOIN group_avgs ga ON t.group_id = ga.group_id
WHERE t.archived_at IS NULL;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_ta_tank_analytics_pk ON ta_tank_analytics(tank_id);

-- ============================================
-- Step 2: Recreate ta_tank_full_status view
-- ============================================

CREATE VIEW ta_tank_full_status AS
SELECT
    d.*,
    p.name as product_name,
    COALESCE(a.avg_daily_consumption_liters, 0) as avg_daily_consumption_liters,
    COALESCE(a.estimated_days_until_empty, 999) as estimated_days_until_empty,
    a.estimated_empty_date,
    COALESCE(a.days_until_min_level, 999) as days_until_min_level,
    COALESCE(a.readings_in_period, 0) as readings_in_period,
    a.calculated_at as analytics_updated_at,
    COALESCE(a.previous_day_use, 0) as previous_day_use,
    -- Extended analytics
    COALESCE(a.consumption_7_days, 0) as consumption_7_days,
    COALESCE(a.consumption_30_days, 0) as consumption_30_days,
    COALESCE(a.peak_daily_consumption, 0) as peak_daily_consumption,
    COALESCE(a.trend_direction, 'unknown') as trend_direction,
    COALESCE(a.trend_percent_change, 0) as trend_percent_change,
    a.last_refill_date,
    COALESCE(a.last_refill_volume, 0) as last_refill_volume,
    COALESCE(a.avg_refill_interval_days, 0) as avg_refill_interval_days,
    COALESCE(a.consumption_stddev, 0) as consumption_stddev,
    COALESCE(a.predictability, 'unknown') as predictability,
    COALESCE(a.is_anomaly, FALSE) as is_anomaly,
    a.anomaly_type,
    a.optimal_order_date,
    COALESCE(a.order_urgency, 'ok') as order_urgency,
    a.consumption_vs_group_percent,
    COALESCE(a.efficiency_trend, 'unknown') as efficiency_trend,
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
LEFT JOIN ta_products p ON d.product_id = p.id
LEFT JOIN ta_tank_analytics a ON d.id = a.tank_id;

-- ============================================
-- Step 3: Recreate the unified map locations view
-- ============================================

CREATE VIEW ta_unified_map_locations AS
SELECT
    'tank' as source_type,
    fs.id,
    fs.name,
    fs.business_name,
    fs.group_name as region,
    fs.subgroup_name as location,
    fs.current_level_liters::float / NULLIF(fs.capacity_liters, 0) as fill_level,
    fs.current_level_datetime as latest_reading_at,
    fs.urgency_status,
    fs.avg_daily_consumption_liters as rolling_avg,
    fs.estimated_days_until_empty as days_to_min,
    fs.capacity_liters,
    fs.current_level_liters,
    NULL::boolean as device_online,
    NULL::text as alert_type,
    NULL::integer as alert_count,
    NULL::float as latitude,
    NULL::float as longitude
FROM ta_tank_full_status fs;

-- ============================================
-- Step 4: Grant permissions
-- ============================================

GRANT SELECT ON ta_tank_analytics TO authenticated;
GRANT SELECT ON ta_tank_full_status TO authenticated;
GRANT SELECT ON ta_unified_map_locations TO authenticated;

-- ============================================
-- Step 5: Refresh the materialized view
-- ============================================

REFRESH MATERIALIZED VIEW ta_tank_analytics;

-- ============================================
-- Verification query (run separately)
-- ============================================

-- Check the fix worked:
-- SELECT
--     name,
--     current_level_liters,
--     avg_daily_consumption_liters,
--     estimated_days_until_empty,
--     ROUND((current_level_liters - COALESCE(min_level_liters, 0))::numeric / NULLIF(avg_daily_consumption_liters, 0), 1) as expected_days
-- FROM ta_tank_full_status
-- WHERE avg_daily_consumption_liters > 10000
-- ORDER BY avg_daily_consumption_liters DESC
-- LIMIT 10;
