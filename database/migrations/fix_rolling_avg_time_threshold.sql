-- Migration: Fix Rolling Average Calculation Bug
-- Issue: Small time intervals between readings cause astronomical daily consumption rates
-- Example: 1,000L drop in 10 minutes = 1000/0.007 = 142,857 L/day (WRONG!)
--
-- Fixes:
-- 1. Minimum time threshold: Only consider readings at least 4 hours apart
-- 2. Dynamic rate cap: Maximum consumption = 2x tank capacity per day
--
-- Run in Supabase SQL Editor

-- ============================================================================
-- UPDATE refresh_single_tank_analytics FUNCTION
-- This is the main function that calculates consumption rates for individual tanks
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refresh_single_tank_analytics(p_tank_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Delete old analytics for this specific tank
    DELETE FROM ta_tank_analytics WHERE tank_id = p_tank_id;

    -- Insert fresh analytics for just this tank with safeguards:
    -- 1. Minimum 4 hours between readings
    -- 2. Dynamic rate cap: max 2x tank capacity per day
    INSERT INTO ta_tank_analytics (
        tank_id,
        avg_daily_consumption_liters,
        estimated_days_until_empty,
        estimated_empty_date,
        days_until_min_level,
        readings_in_period,
        calculated_at
    )
    WITH recent_dips AS (
        SELECT
            tank_id,
            level_liters,
            measured_at,
            LAG(level_liters) OVER (PARTITION BY tank_id ORDER BY measured_at) as prev_level,
            LAG(measured_at) OVER (PARTITION BY tank_id ORDER BY measured_at) as prev_measured_at
        FROM ta_tank_dips
        WHERE archived_at IS NULL
          AND measured_at >= NOW() - INTERVAL '14 days'
          AND tank_id = p_tank_id
    ),
    consumption_calc AS (
        -- Calculate daily consumption with safeguards:
        -- 1. Minimum 4 hours between readings
        -- 2. Only count when level goes DOWN (consumption)
        SELECT
            r.tank_id,
            r.measured_at,
            t.capacity_liters,
            CASE
                WHEN r.prev_level > r.level_liters
                  AND EXTRACT(EPOCH FROM (r.measured_at - r.prev_measured_at)) >= 14400  -- >= 4 hours
                THEN (r.prev_level - r.level_liters) /
                    NULLIF(EXTRACT(EPOCH FROM (r.measured_at - r.prev_measured_at)) / 86400.0, 0)
                ELSE NULL  -- Ignore readings too close together or refills
            END as daily_consumption
        FROM recent_dips r
        JOIN ta_tanks t ON r.tank_id = t.id
        WHERE r.prev_level IS NOT NULL
    ),
    -- Filter out unrealistic consumption rates
    valid_consumption AS (
        SELECT
            tank_id,
            measured_at,
            daily_consumption
        FROM consumption_calc
        WHERE daily_consumption IS NOT NULL
          AND daily_consumption > 0
          AND daily_consumption < (capacity_liters * 2)  -- Dynamic cap: 2x tank capacity/day
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
    LEFT JOIN valid_consumption c ON t.id = c.tank_id
    WHERE t.id = p_tank_id
    GROUP BY t.id, t.current_level_liters, t.min_level_liters;

    RAISE NOTICE 'Refreshed analytics for tank %', p_tank_id;
END;
$function$;

-- ============================================================================
-- CREATE refresh_all_tank_analytics FUNCTION
-- Refreshes analytics for ALL tanks (replaces the broken matview refresh)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refresh_all_tank_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Clear existing analytics
    DELETE FROM ta_tank_analytics;

    -- Insert fresh analytics for all tanks with safeguards:
    -- 1. Minimum 4 hours between readings
    -- 2. Dynamic rate cap: max 2x tank capacity per day
    INSERT INTO ta_tank_analytics (
        tank_id,
        avg_daily_consumption_liters,
        estimated_days_until_empty,
        estimated_empty_date,
        days_until_min_level,
        readings_in_period,
        calculated_at
    )
    WITH recent_dips AS (
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
        -- Calculate daily consumption with safeguards:
        -- 1. Minimum 4 hours between readings
        -- 2. Only count when level goes DOWN (consumption)
        SELECT
            r.tank_id,
            r.measured_at,
            t.capacity_liters,
            CASE
                WHEN r.prev_level > r.level_liters
                  AND EXTRACT(EPOCH FROM (r.measured_at - r.prev_measured_at)) >= 14400  -- >= 4 hours
                THEN (r.prev_level - r.level_liters) /
                    NULLIF(EXTRACT(EPOCH FROM (r.measured_at - r.prev_measured_at)) / 86400.0, 0)
                ELSE NULL  -- Ignore readings too close together or refills
            END as daily_consumption
        FROM recent_dips r
        JOIN ta_tanks t ON r.tank_id = t.id
        WHERE r.prev_level IS NOT NULL
    ),
    -- Filter out unrealistic consumption rates
    valid_consumption AS (
        SELECT
            tank_id,
            measured_at,
            daily_consumption
        FROM consumption_calc
        WHERE daily_consumption IS NOT NULL
          AND daily_consumption > 0
          AND daily_consumption < (capacity_liters * 2)  -- Dynamic cap: 2x tank capacity/day
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
    LEFT JOIN valid_consumption c ON t.id = c.tank_id
    WHERE t.archived_at IS NULL
    GROUP BY t.id, t.current_level_liters, t.min_level_liters;

    RAISE NOTICE 'Refreshed analytics for all tanks';
END;
$function$;

-- ============================================================================
-- UPDATE refresh_ta_tank_analytics TO USE THE NEW FUNCTION
-- (Fixes the broken reference to non-existent materialized view)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refresh_ta_tank_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Use the new function that properly handles the table
    PERFORM refresh_all_tank_analytics();
END;
$function$;

-- ============================================================================
-- REFRESH ALL ANALYTICS NOW TO FIX EXISTING DATA
-- ============================================================================
SELECT refresh_all_tank_analytics();

-- ============================================================================
-- VERIFICATION: Show all tank analytics to confirm fix
-- ============================================================================
SELECT 'Migration complete. Verifying rolling averages...' as status;

SELECT
    t.name as tank_name,
    t.capacity_liters,
    a.avg_daily_consumption_liters,
    a.days_until_min_level,
    a.readings_in_period,
    CASE
        WHEN a.avg_daily_consumption_liters > t.capacity_liters THEN 'STILL_TOO_HIGH'
        ELSE 'OK'
    END as validation_status
FROM ta_tanks t
LEFT JOIN ta_tank_analytics a ON t.id = a.tank_id
WHERE t.archived_at IS NULL
ORDER BY a.avg_daily_consumption_liters DESC NULLS LAST
LIMIT 20;
