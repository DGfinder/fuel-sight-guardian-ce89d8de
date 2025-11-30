-- TankAlert Dashboard Views
-- Run in Supabase SQL Editor AFTER add_ta_performance_indexes.sql
-- These views provide single-query access to tank data with pre-calculated analytics

-- ============================================
-- VIEW 1: ta_tank_dashboard
-- Single query for all tank data with group/subgroup names
-- ============================================

CREATE OR REPLACE VIEW ta_tank_dashboard AS
SELECT
    t.id,
    t.name,
    t.business_id,
    b.name as business_name,
    b.code as business_code,
    t.group_id,
    g.name as group_name,
    t.subgroup_id,
    s.name as subgroup_name,
    t.capacity_liters,
    t.current_level_liters,
    t.current_level_datetime,
    t.current_level_source,
    t.fill_percent,
    t.safe_level_liters,
    t.min_level_liters,
    t.critical_level_liters,
    t.rolling_avg_liters_per_day,
    t.days_to_min_level,
    t.unit,
    t.installation_type,
    t.has_sensor,
    t.status,
    t.notes,
    t.created_at,
    t.updated_at
FROM ta_tanks t
LEFT JOIN ta_businesses b ON t.business_id = b.id
LEFT JOIN ta_groups g ON t.group_id = g.id
LEFT JOIN ta_subgroups s ON t.subgroup_id = s.id
WHERE t.archived_at IS NULL;

-- ============================================
-- MATERIALIZED VIEW: ta_tank_analytics
-- Pre-calculated consumption analytics (refreshed periodically)
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS ta_tank_analytics AS
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
    COUNT(c.daily_consumption)::integer as readings_in_period,
    NOW() as calculated_at
FROM ta_tanks t
LEFT JOIN consumption_calc c ON t.id = c.tank_id
WHERE t.archived_at IS NULL
GROUP BY t.id, t.current_level_liters, t.min_level_liters;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_ta_tank_analytics_pk
    ON ta_tank_analytics(tank_id);

-- ============================================
-- VIEW 2: ta_tank_full_status
-- Combined dashboard + analytics with urgency scoring
-- This is the PRIMARY view for frontend queries
-- ============================================

CREATE OR REPLACE VIEW ta_tank_full_status AS
SELECT
    d.*,
    COALESCE(a.avg_daily_consumption_liters, 0) as avg_daily_consumption_liters,
    COALESCE(a.estimated_days_until_empty, 999) as estimated_days_until_empty,
    a.estimated_empty_date,
    COALESCE(a.days_until_min_level, 999) as days_until_min_level,
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

-- ============================================
-- FUNCTION: Refresh Analytics
-- Call this after recording dips or on schedule
-- ============================================

CREATE OR REPLACE FUNCTION refresh_ta_tank_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY ta_tank_analytics;
END;
$$;

-- ============================================
-- OPTIONAL: Schedule with pg_cron (if available)
-- Uncomment if you have pg_cron extension enabled
-- ============================================

-- SELECT cron.schedule(
--     'refresh_ta_analytics',
--     '*/5 * * * *',  -- Every 5 minutes
--     'SELECT refresh_ta_tank_analytics()'
-- );

-- ============================================
-- TRIGGER: Auto-update ta_tanks.rolling_avg_liters_per_day
-- Updates the denormalized field when analytics refresh
-- ============================================

CREATE OR REPLACE FUNCTION sync_tank_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the denormalized fields on ta_tanks
    UPDATE ta_tanks t
    SET
        rolling_avg_liters_per_day = a.avg_daily_consumption_liters,
        days_to_min_level = a.days_until_min_level,
        updated_at = NOW()
    FROM ta_tank_analytics a
    WHERE t.id = a.tank_id
      AND t.archived_at IS NULL;

    RETURN NULL;
END;
$$;

-- Note: This trigger would fire after materialized view refresh
-- Since MV refresh doesn't fire triggers, call sync_tank_analytics()
-- manually after refresh_ta_tank_analytics() if needed

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Test the dashboard view (should return all tanks with names)
-- SELECT * FROM ta_tank_dashboard LIMIT 5;

-- Test the full status view (should include analytics)
-- SELECT
--     name, fill_percent, urgency_status,
--     estimated_days_until_empty, avg_daily_consumption_liters
-- FROM ta_tank_full_status
-- ORDER BY priority_score, fill_percent
-- LIMIT 10;

-- Check materialized view data
-- SELECT COUNT(*), AVG(avg_daily_consumption_liters) FROM ta_tank_analytics;

-- Performance test
-- EXPLAIN ANALYZE
-- SELECT * FROM ta_tank_full_status
-- WHERE business_id = '1bc7929d-9a3f-4074-9031-2dc950b187a6';
