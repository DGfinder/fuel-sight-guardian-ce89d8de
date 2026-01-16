-- Migration: Fix Rolling Average Calculation - One Reading Per Day Approach
--
-- Problem: The previous 4-hour threshold fix caused Corrigin ULP98 to show 0 L/day
-- because both readings on Jan 12 were filtered out (they were 1 minute apart - a correction).
--
-- Solution: Deduplicate to one reading per day (keep latest), then calculate
-- consumption between consecutive days.
--
-- Why This Works Better:
-- 1. Handles corrections gracefully - If someone enters 16,000L then corrects to 9,000L, we keep 9,000L
-- 2. Natural daily intervals - Comparing day-to-day avoids small time divisors
-- 3. Uses all available data - Doesn't filter out valid readings
-- 4. Still catches anomalies - Keep the dynamic rate cap (2x capacity) as safety net
--
-- Example: Corrigin ULP98
-- Current readings (one per day, latest):
-- - Jan 12: 9,000L
-- - Jan 1: 14,300L
-- - Dec 30: 14,400L
-- Consumption: 14,300 -> 9,000 = 5,300L over 11 days = ~482 L/day
--
-- Run in Supabase SQL Editor

-- ============================================================================
-- UPDATE refresh_single_tank_analytics FUNCTION
-- Now uses one-reading-per-day deduplication instead of 4-hour threshold
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refresh_single_tank_analytics(p_tank_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Delete old analytics for this specific tank
    DELETE FROM ta_tank_analytics WHERE tank_id = p_tank_id;

    -- Insert fresh analytics using one-reading-per-day approach
    INSERT INTO ta_tank_analytics (
        tank_id,
        avg_daily_consumption_liters,
        estimated_days_until_empty,
        estimated_empty_date,
        days_until_min_level,
        readings_in_period,
        calculated_at
    )
    WITH daily_readings AS (
        -- Deduplicate to ONE reading per day (latest reading wins)
        -- This handles corrections gracefully - if someone enters 16,000L then
        -- corrects to 9,000L on the same day, we keep 9,000L
        SELECT DISTINCT ON (tank_id, measured_at::date)
            tank_id,
            level_liters,
            measured_at,
            measured_at::date as reading_date
        FROM ta_tank_dips
        WHERE archived_at IS NULL
          AND measured_at >= NOW() - INTERVAL '30 days'
          AND tank_id = p_tank_id
        ORDER BY tank_id, measured_at::date, measured_at DESC
    ),
    consumption_calc AS (
        -- Calculate consumption between consecutive days
        SELECT
            r.tank_id,
            r.reading_date,
            t.capacity_liters,
            r.level_liters,
            LAG(r.level_liters) OVER (PARTITION BY r.tank_id ORDER BY r.reading_date) as prev_level,
            LAG(r.reading_date) OVER (PARTITION BY r.tank_id ORDER BY r.reading_date) as prev_date,
            CASE
                -- Only count consumption (level going down), skip refills
                WHEN LAG(r.level_liters) OVER (PARTITION BY r.tank_id ORDER BY r.reading_date) > r.level_liters
                THEN (LAG(r.level_liters) OVER (PARTITION BY r.tank_id ORDER BY r.reading_date) - r.level_liters) /
                     NULLIF((r.reading_date - LAG(r.reading_date) OVER (PARTITION BY r.tank_id ORDER BY r.reading_date))::numeric, 0)
                ELSE NULL  -- Refill detected, skip this interval
            END as daily_consumption
        FROM daily_readings r
        JOIN ta_tanks t ON r.tank_id = t.id
    ),
    valid_consumption AS (
        -- Filter unrealistic rates (sensor glitches) using dynamic cap
        SELECT
            tank_id,
            reading_date,
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

    RAISE NOTICE 'Refreshed analytics for tank % using one-reading-per-day approach', p_tank_id;
END;
$function$;

-- ============================================================================
-- UPDATE refresh_all_tank_analytics FUNCTION
-- Now uses one-reading-per-day deduplication instead of 4-hour threshold
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refresh_all_tank_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Clear existing analytics
    DELETE FROM ta_tank_analytics;

    -- Insert fresh analytics for all tanks using one-reading-per-day approach
    INSERT INTO ta_tank_analytics (
        tank_id,
        avg_daily_consumption_liters,
        estimated_days_until_empty,
        estimated_empty_date,
        days_until_min_level,
        readings_in_period,
        calculated_at
    )
    WITH daily_readings AS (
        -- Deduplicate to ONE reading per day (latest reading wins)
        -- This handles corrections gracefully - if someone enters 16,000L then
        -- corrects to 9,000L on the same day, we keep 9,000L
        SELECT DISTINCT ON (tank_id, measured_at::date)
            tank_id,
            level_liters,
            measured_at,
            measured_at::date as reading_date
        FROM ta_tank_dips
        WHERE archived_at IS NULL
          AND measured_at >= NOW() - INTERVAL '30 days'
        ORDER BY tank_id, measured_at::date, measured_at DESC
    ),
    consumption_calc AS (
        -- Calculate consumption between consecutive days
        SELECT
            r.tank_id,
            r.reading_date,
            t.capacity_liters,
            r.level_liters,
            LAG(r.level_liters) OVER (PARTITION BY r.tank_id ORDER BY r.reading_date) as prev_level,
            LAG(r.reading_date) OVER (PARTITION BY r.tank_id ORDER BY r.reading_date) as prev_date,
            CASE
                -- Only count consumption (level going down), skip refills
                WHEN LAG(r.level_liters) OVER (PARTITION BY r.tank_id ORDER BY r.reading_date) > r.level_liters
                THEN (LAG(r.level_liters) OVER (PARTITION BY r.tank_id ORDER BY r.reading_date) - r.level_liters) /
                     NULLIF((r.reading_date - LAG(r.reading_date) OVER (PARTITION BY r.tank_id ORDER BY r.reading_date))::numeric, 0)
                ELSE NULL  -- Refill detected, skip this interval
            END as daily_consumption
        FROM daily_readings r
        JOIN ta_tanks t ON r.tank_id = t.id
    ),
    valid_consumption AS (
        -- Filter unrealistic rates (sensor glitches) using dynamic cap
        SELECT
            tank_id,
            reading_date,
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

    RAISE NOTICE 'Refreshed analytics for all tanks using one-reading-per-day approach';
END;
$function$;

-- ============================================================================
-- REFRESH ALL ANALYTICS NOW TO FIX EXISTING DATA
-- ============================================================================
SELECT refresh_all_tank_analytics();

-- ============================================================================
-- VERIFICATION: Check Corrigin ULP98 specifically
-- Expected: ~400-600 L/day based on the data pattern
-- ============================================================================
SELECT 'Migration complete. Verifying Corrigin ULP98...' as status;

SELECT
    t.name as tank_name,
    t.capacity_liters,
    t.current_level_liters,
    a.avg_daily_consumption_liters,
    a.days_until_min_level,
    a.estimated_days_until_empty,
    a.readings_in_period
FROM ta_tanks t
JOIN ta_tank_analytics a ON t.id = a.tank_id
WHERE t.name LIKE '%Corrigin%ULP98%'
   OR t.name LIKE '%Corrigin%' AND t.name LIKE '%ULP%98%';

-- ============================================================================
-- VERIFICATION: Show all tank analytics to confirm fix
-- ============================================================================
SELECT 'Full analytics verification...' as status;

SELECT
    t.name as tank_name,
    t.capacity_liters,
    a.avg_daily_consumption_liters,
    a.days_until_min_level,
    a.readings_in_period,
    CASE
        WHEN a.avg_daily_consumption_liters > t.capacity_liters THEN 'STILL_TOO_HIGH'
        WHEN a.avg_daily_consumption_liters = 0 AND a.readings_in_period > 0 THEN 'CHECK_DATA'
        ELSE 'OK'
    END as validation_status
FROM ta_tanks t
LEFT JOIN ta_tank_analytics a ON t.id = a.tank_id
WHERE t.archived_at IS NULL
ORDER BY a.avg_daily_consumption_liters DESC NULLS LAST
LIMIT 30;

-- ============================================================================
-- DEBUG: Show daily readings for Corrigin ULP98 to verify deduplication
-- ============================================================================
SELECT 'Daily readings debug for Corrigin ULP98...' as status;

WITH daily_readings AS (
    SELECT DISTINCT ON (d.tank_id, d.measured_at::date)
        t.name as tank_name,
        d.level_liters,
        d.measured_at,
        d.measured_at::date as reading_date
    FROM ta_tank_dips d
    JOIN ta_tanks t ON d.tank_id = t.id
    WHERE d.archived_at IS NULL
      AND d.measured_at >= NOW() - INTERVAL '14 days'
      AND (t.name LIKE '%Corrigin%ULP98%' OR (t.name LIKE '%Corrigin%' AND t.name LIKE '%ULP%98%'))
    ORDER BY d.tank_id, d.measured_at::date, d.measured_at DESC
)
SELECT * FROM daily_readings ORDER BY reading_date DESC;
