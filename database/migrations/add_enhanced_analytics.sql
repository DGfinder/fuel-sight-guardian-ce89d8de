-- Enhanced Tank Analytics Migration
-- Adds 10 new analytics metrics to ta_tank_analytics
-- Run in Supabase SQL Editor

-- Step 1: Drop dependent views
DROP VIEW IF EXISTS ta_unified_map_locations;
DROP VIEW IF EXISTS ta_tank_full_status;
DROP MATERIALIZED VIEW IF EXISTS ta_tank_analytics;

-- Step 2: Create enhanced materialized view
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

    -- Days until empty (using 14-day avg)
    CASE
        WHEN COALESCE(
            (SELECT AVG(daily_rate) FROM consumption_per_reading c
             WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0),
            0
        ) > 0
        THEN ROUND(t.current_level_liters /
            (SELECT AVG(daily_rate) FROM consumption_per_reading c
             WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0)
        )::integer
        ELSE 999
    END as estimated_days_until_empty,

    -- Estimated empty date
    CASE
        WHEN COALESCE(
            (SELECT AVG(daily_rate) FROM consumption_per_reading c
             WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0),
            0
        ) > 0
        THEN (NOW() + (t.current_level_liters /
            (SELECT AVG(daily_rate) FROM consumption_per_reading c
             WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0)
        ) * INTERVAL '1 day')::date
        ELSE NULL
    END as estimated_empty_date,

    -- Days until min level
    CASE
        WHEN COALESCE(
            (SELECT AVG(daily_rate) FROM consumption_per_reading c
             WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0),
            0
        ) > 0 AND t.min_level_liters > 0
        THEN ROUND((t.current_level_liters - t.min_level_liters) /
            (SELECT AVG(daily_rate) FROM consumption_per_reading c
             WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0)
        )::integer
        ELSE 999
    END as days_until_min_level,

    -- Previous day use
    COALESCE(p.previous_day_use, 0) as previous_day_use,

    -- ===== NEW ANALYTICS =====

    -- 1. Consumption Trend (comparing last 7 days to previous 7 days)
    CASE
        WHEN w1.avg_daily_rate IS NOT NULL AND w2.avg_daily_rate IS NOT NULL AND w2.avg_daily_rate > 0 THEN
            CASE
                WHEN (w1.avg_daily_rate - w2.avg_daily_rate) / w2.avg_daily_rate > 0.1 THEN 'increasing'
                WHEN (w1.avg_daily_rate - w2.avg_daily_rate) / w2.avg_daily_rate < -0.1 THEN 'decreasing'
                ELSE 'stable'
            END
        ELSE 'stable'
    END as trend_direction,

    CASE
        WHEN w1.avg_daily_rate IS NOT NULL AND w2.avg_daily_rate IS NOT NULL AND w2.avg_daily_rate > 0 THEN
            ROUND(((w1.avg_daily_rate - w2.avg_daily_rate) / w2.avg_daily_rate) * 100)::integer
        ELSE 0
    END as trend_percent_change,

    -- 2. Refill Detection
    lr.last_refill_date,
    lr.last_refill_volume::integer,
    ri.avg_refill_interval_days,

    -- 3. Consumption Variability
    COALESCE(w1.stddev_rate::integer, 0) as consumption_stddev,
    CASE
        WHEN w1.avg_daily_rate IS NOT NULL AND w1.stddev_rate IS NOT NULL THEN
            CASE
                WHEN w1.stddev_rate / NULLIF(w1.avg_daily_rate, 0) < 0.2 THEN 'high'
                WHEN w1.stddev_rate / NULLIF(w1.avg_daily_rate, 0) < 0.5 THEN 'medium'
                ELSE 'low'
            END
        ELSE 'unknown'
    END as predictability,

    -- 4. Data Freshness
    COALESCE(
        EXTRACT(DAY FROM (NOW() - p.latest_dip_at))::integer,
        999
    ) as days_since_last_dip,
    CASE
        WHEN p.latest_dip_at IS NULL THEN 'no_data'
        WHEN p.latest_dip_at >= NOW() - INTERVAL '3 days' THEN 'fresh'
        WHEN p.latest_dip_at >= NOW() - INTERVAL '7 days' THEN 'stale'
        ELSE 'outdated'
    END as data_quality,

    -- 5. Peak Consumption
    COALESCE(m.peak_daily_consumption::integer, 0) as peak_daily_consumption,

    -- 6. Weekly/Monthly Totals
    COALESCE(w1.total_consumption::integer, 0) as consumption_7_days,
    COALESCE(m.total_consumption::integer, 0) as consumption_30_days,

    -- 7. Anomaly Detection
    CASE
        WHEN w1.avg_daily_rate IS NOT NULL AND m.avg_daily_rate IS NOT NULL AND m.avg_daily_rate > 0 THEN
            CASE
                WHEN w1.avg_daily_rate > m.avg_daily_rate * 1.5 THEN TRUE
                WHEN w1.avg_daily_rate < m.avg_daily_rate * 0.5 THEN TRUE
                ELSE FALSE
            END
        ELSE FALSE
    END as is_anomaly,
    CASE
        WHEN w1.avg_daily_rate IS NOT NULL AND m.avg_daily_rate IS NOT NULL AND m.avg_daily_rate > 0 THEN
            CASE
                WHEN w1.avg_daily_rate > m.avg_daily_rate * 1.5 THEN 'high_usage'
                WHEN w1.avg_daily_rate < m.avg_daily_rate * 0.5 THEN 'low_usage'
                ELSE NULL
            END
        ELSE NULL
    END as anomaly_type,

    -- 8. Optimal Order Date (3-day lead time)
    CASE
        WHEN COALESCE(
            (SELECT AVG(daily_rate) FROM consumption_per_reading c
             WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0),
            0
        ) > 0 AND t.min_level_liters > 0
        THEN (NOW() + (
            (t.current_level_liters - t.min_level_liters) /
            (SELECT AVG(daily_rate) FROM consumption_per_reading c
             WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0)
            - 3  -- 3 day lead time
        ) * INTERVAL '1 day')::date
        ELSE NULL
    END as optimal_order_date,
    CASE
        WHEN COALESCE(
            (SELECT AVG(daily_rate) FROM consumption_per_reading c
             WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0),
            0
        ) > 0 AND t.min_level_liters > 0 THEN
            CASE
                WHEN (t.current_level_liters - t.min_level_liters) /
                     (SELECT AVG(daily_rate) FROM consumption_per_reading c
                      WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0)
                     <= 3 THEN 'order_now'
                WHEN (t.current_level_liters - t.min_level_liters) /
                     (SELECT AVG(daily_rate) FROM consumption_per_reading c
                      WHERE c.tank_id = t.id AND c.measured_at >= NOW() - INTERVAL '14 days' AND c.daily_rate > 0)
                     <= 7 THEN 'order_soon'
                ELSE 'ok'
            END
        ELSE 'ok'
    END as order_urgency,

    -- 9. Group Comparison
    CASE
        WHEN ga.group_avg_consumption IS NOT NULL AND ga.group_avg_consumption > 0 AND m.avg_daily_rate IS NOT NULL THEN
            ROUND(((m.avg_daily_rate - ga.group_avg_consumption) / ga.group_avg_consumption) * 100)::integer
        ELSE NULL
    END as consumption_vs_group_percent,

    -- 10. Efficiency Trend (comparing first half to second half of 30 days)
    CASE
        WHEN w1.avg_daily_rate IS NOT NULL AND w2.avg_daily_rate IS NOT NULL AND w2.avg_daily_rate > 0 THEN
            CASE
                WHEN w1.avg_daily_rate > w2.avg_daily_rate * 1.1 THEN 'degrading'
                WHEN w1.avg_daily_rate < w2.avg_daily_rate * 0.9 THEN 'improving'
                ELSE 'stable'
            END
        ELSE 'stable'
    END as efficiency_trend,

    -- Metadata
    COALESCE(m.reading_count::integer, 0) as readings_in_period,
    NOW() as calculated_at

FROM ta_tanks t
LEFT JOIN prev_day_calc p ON t.id = p.tank_id
LEFT JOIN week1_stats w1 ON t.id = w1.tank_id
LEFT JOIN week2_stats w2 ON t.id = w2.tank_id
LEFT JOIN month_stats m ON t.id = m.tank_id
LEFT JOIN last_refill lr ON t.id = lr.tank_id
LEFT JOIN refill_intervals ri ON t.id = ri.tank_id
LEFT JOIN group_avgs ga ON t.group_id = ga.group_id
WHERE t.archived_at IS NULL;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_ta_tank_analytics_pk ON ta_tank_analytics(tank_id);

-- Step 3: Recreate ta_tank_full_status view
CREATE OR REPLACE VIEW ta_tank_full_status AS
SELECT
    d.*,
    COALESCE(a.avg_daily_consumption_liters, 0) as avg_daily_consumption_liters,
    COALESCE(a.estimated_days_until_empty, 999) as estimated_days_until_empty,
    a.estimated_empty_date,
    COALESCE(a.days_until_min_level, 999) as days_until_min_level,
    COALESCE(a.previous_day_use, 0) as previous_day_use,
    -- New analytics columns
    COALESCE(a.trend_direction, 'stable') as trend_direction,
    COALESCE(a.trend_percent_change, 0) as trend_percent_change,
    a.last_refill_date,
    a.last_refill_volume,
    a.avg_refill_interval_days,
    COALESCE(a.consumption_stddev, 0) as consumption_stddev,
    COALESCE(a.predictability, 'unknown') as predictability,
    COALESCE(a.days_since_last_dip, 999) as days_since_last_dip,
    COALESCE(a.data_quality, 'no_data') as data_quality,
    COALESCE(a.peak_daily_consumption, 0) as peak_daily_consumption,
    COALESCE(a.consumption_7_days, 0) as consumption_7_days,
    COALESCE(a.consumption_30_days, 0) as consumption_30_days,
    COALESCE(a.is_anomaly, FALSE) as is_anomaly,
    a.anomaly_type,
    a.optimal_order_date,
    COALESCE(a.order_urgency, 'ok') as order_urgency,
    a.consumption_vs_group_percent,
    COALESCE(a.efficiency_trend, 'stable') as efficiency_trend,
    COALESCE(a.readings_in_period, 0) as readings_in_period,
    a.calculated_at as analytics_updated_at,
    -- Urgency scoring
    CASE
        WHEN d.fill_percent <= 10 THEN 'critical'
        WHEN d.fill_percent <= 20 THEN 'urgent'
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 3 THEN 'urgent'
        WHEN d.fill_percent <= 30 THEN 'warning'
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 7 THEN 'warning'
        WHEN d.current_level_liters <= d.min_level_liters THEN 'warning'
        ELSE 'ok'
    END as urgency_status,
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

-- Step 4: Recreate ta_unified_map_locations view
CREATE OR REPLACE VIEW ta_unified_map_locations AS
SELECT
    'manual'::text as source,
    fs.id::text,
    fs.name as location,
    loc.latitude,
    loc.longitude,
    fs.fill_percent as current_level_percent,
    fs.group_name,
    fs.subgroup_name,
    COALESCE(p.name, 'Unknown') as product_type,
    fs.current_level_datetime as latest_reading_at,
    fs.urgency_status,
    fs.avg_daily_consumption_liters as rolling_avg,
    fs.estimated_days_until_empty as days_to_min,
    fs.capacity_liters,
    fs.current_level_liters,
    NULL::boolean as device_online,
    NULL::text as customer_name,
    NULL::integer as total_assets,
    NULL::integer as assets_online
FROM ta_tank_full_status fs
JOIN ta_tanks t ON fs.id = t.id
LEFT JOIN ta_locations loc ON t.location_id = loc.id
LEFT JOIN ta_products p ON t.product_id = p.id
WHERE loc.latitude IS NOT NULL
  AND loc.longitude IS NOT NULL

UNION ALL

SELECT
    'agbot'::text as source,
    a.id::text,
    COALESCE(a.name, l.name, 'Unknown Asset') as location,
    l.latitude,
    l.longitude,
    a.current_level_percent as current_level_percent,
    l.customer_name as group_name,
    NULL::text as subgroup_name,
    a.commodity as product_type,
    a.last_telemetry_at as latest_reading_at,
    CASE
        WHEN a.current_level_percent <= 10 THEN 'critical'
        WHEN a.current_level_percent <= 20 THEN 'urgent'
        WHEN a.days_remaining <= 3 THEN 'urgent'
        WHEN a.current_level_percent <= 30 THEN 'warning'
        WHEN a.days_remaining <= 7 THEN 'warning'
        ELSE 'ok'
    END as urgency_status,
    a.daily_consumption_liters as rolling_avg,
    a.days_remaining as days_to_min,
    a.capacity_liters,
    a.current_level_liters,
    a.is_online as device_online,
    l.customer_name,
    l.total_assets,
    l.assets_online
FROM ta_agbot_assets a
JOIN ta_agbot_locations l ON a.location_id = l.id
WHERE l.latitude IS NOT NULL
  AND l.longitude IS NOT NULL
  AND a.is_disabled = false
  AND l.is_disabled = false;

-- Grant permissions
GRANT SELECT ON ta_unified_map_locations TO authenticated;
GRANT SELECT ON ta_unified_map_locations TO anon;

-- Verify
SELECT 'Migration complete!' as status;
SELECT
    tank_id,
    trend_direction,
    predictability,
    data_quality,
    order_urgency,
    consumption_7_days,
    consumption_30_days
FROM ta_tank_analytics
LIMIT 5;
