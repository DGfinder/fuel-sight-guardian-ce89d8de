-- =====================================================
-- CREATE CROSS ANALYTICS SUMMARY VIEW
-- =====================================================
-- Critical view for DataCentreSupabaseService
-- Referenced: dataCentreSupabaseService.ts:126,245,327
-- Combines Guardian, LYTX, Captive, and vehicle data
-- =====================================================

-- Drop existing view if present
DROP VIEW IF EXISTS cross_analytics_summary CASCADE;

-- =====================================================
-- CREATE VIEW
-- =====================================================

CREATE OR REPLACE VIEW cross_analytics_summary AS

-- Aggregate captive deliveries by month/fleet/depot
WITH monthly_captive AS (
    SELECT
        CASE
            WHEN carrier = 'SMB' THEN 'Stevemacs'
            WHEN carrier = 'GSF' THEN 'Great Southern Fuels'
            ELSE carrier::text
        END as fleet,
        terminal as depot,
        TO_CHAR(delivery_date, 'Mon') as month,
        EXTRACT(YEAR FROM delivery_date)::INTEGER as year,
        EXTRACT(MONTH FROM delivery_date)::INTEGER as month_num,
        COUNT(DISTINCT delivery_key) as deliveries,
        (SUM(total_volume_litres_abs) / 1000000)::DECIMAL(12,4) as volume_ml
    FROM captive_deliveries
    WHERE delivery_date IS NOT NULL
    GROUP BY
        CASE
            WHEN carrier = 'SMB' THEN 'Stevemacs'
            WHEN carrier = 'GSF' THEN 'Great Southern Fuels'
            ELSE carrier::text
        END,
        terminal,
        DATE_TRUNC('month', delivery_date),
        EXTRACT(YEAR FROM delivery_date),
        EXTRACT(MONTH FROM delivery_date),
        TO_CHAR(delivery_date, 'Mon')
),

-- Aggregate LYTX safety events by month/fleet/depot
monthly_lytx AS (
    SELECT
        carrier as fleet,
        depot,
        TO_CHAR(event_datetime, 'Mon') as month,
        EXTRACT(YEAR FROM event_datetime)::INTEGER as year,
        EXTRACT(MONTH FROM event_datetime)::INTEGER as month_num,
        COUNT(*)::INTEGER as safety_events,
        AVG(score)::DECIMAL(5,2) as avg_safety_score
    FROM lytx_safety_events
    WHERE excluded IS NOT TRUE
      AND event_datetime IS NOT NULL
    GROUP BY
        carrier,
        depot,
        DATE_TRUNC('month', event_datetime),
        EXTRACT(YEAR FROM event_datetime),
        EXTRACT(MONTH FROM event_datetime),
        TO_CHAR(event_datetime, 'Mon')
),

-- Aggregate Guardian events by month/fleet/depot
monthly_guardian AS (
    SELECT
        fleet,
        depot,
        TO_CHAR(detection_time, 'Mon') as month,
        EXTRACT(YEAR FROM detection_time)::INTEGER as year,
        EXTRACT(MONTH FROM detection_time)::INTEGER as month_num,
        COUNT(*)::INTEGER as guardian_events
    FROM guardian_events
    WHERE verified = true
      AND detection_time IS NOT NULL
    GROUP BY
        fleet,
        depot,
        DATE_TRUNC('month', detection_time),
        EXTRACT(YEAR FROM detection_time),
        EXTRACT(MONTH FROM detection_time),
        TO_CHAR(detection_time, 'Mon')
),

-- Count active vehicles by fleet/depot
monthly_vehicles AS (
    SELECT
        fleet,
        depot,
        COUNT(DISTINCT id)::INTEGER as active_vehicles
    FROM vehicles
    WHERE status = 'Active'
    GROUP BY fleet, depot
)

-- Combine all sources with FULL OUTER JOIN
SELECT
    COALESCE(mc.fleet, ml.fleet, mg.fleet)::TEXT as fleet,
    COALESCE(mc.depot, ml.depot, mg.depot)::TEXT as depot,
    COALESCE(mc.month, ml.month, mg.month)::TEXT as month,
    COALESCE(mc.year, ml.year, mg.year)::INTEGER as year,
    COALESCE(mc.month_num, ml.month_num, mg.month_num)::INTEGER as month_num,

    -- Captive delivery metrics
    COALESCE(mc.deliveries, 0)::INTEGER as captive_deliveries,
    COALESCE(mc.volume_ml, 0)::DECIMAL(12,4) as captive_volume_ml,

    -- Safety metrics
    COALESCE(ml.safety_events, 0)::INTEGER as safety_events,
    COALESCE(mg.guardian_events, 0)::INTEGER as guardian_events,

    -- Fleet metrics
    COALESCE(mv.active_vehicles, 0)::INTEGER as active_vehicles,
    COALESCE(ml.avg_safety_score, 0)::DECIMAL(5,2) as avg_safety_score,

    -- Calculated metrics
    CASE
        WHEN COALESCE(mv.active_vehicles, 0) > 0
        THEN ((COALESCE(ml.safety_events, 0) + COALESCE(mg.guardian_events, 0))::DECIMAL / mv.active_vehicles)::DECIMAL(6,2)
        ELSE 0
    END as events_per_vehicle,

    CASE
        WHEN COALESCE(mv.active_vehicles, 0) > 0
        THEN (COALESCE(mc.volume_ml, 0) / mv.active_vehicles)::DECIMAL(8,2)
        ELSE 0
    END as volume_per_vehicle

FROM monthly_captive mc

FULL OUTER JOIN monthly_lytx ml
    ON mc.fleet = ml.fleet
    AND mc.depot = ml.depot
    AND mc.month = ml.month
    AND mc.year = ml.year

FULL OUTER JOIN monthly_guardian mg
    ON COALESCE(mc.fleet, ml.fleet) = mg.fleet
    AND COALESCE(mc.depot, ml.depot) = mg.depot
    AND COALESCE(mc.month, ml.month) = mg.month
    AND COALESCE(mc.year, ml.year) = mg.year

LEFT JOIN monthly_vehicles mv
    ON COALESCE(mc.fleet, ml.fleet, mg.fleet) = mv.fleet
    AND COALESCE(mc.depot, ml.depot, mg.depot) = mv.depot

WHERE COALESCE(mc.fleet, ml.fleet, mg.fleet) IS NOT NULL

ORDER BY year DESC, month_num DESC, fleet, depot;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Enable security invoker to inherit RLS from underlying tables
ALTER VIEW cross_analytics_summary SET (security_invoker = true);

-- Grant to authenticated users
GRANT SELECT ON cross_analytics_summary TO authenticated;

-- Grant to service role for backend queries
GRANT SELECT ON cross_analytics_summary TO service_role;

-- =====================================================
-- CREATE INDEX (for materialized version if needed)
-- =====================================================

-- Note: This is a view, not materialized view
-- If performance is poor, consider:
-- CREATE MATERIALIZED VIEW cross_analytics_summary_mat AS SELECT * FROM cross_analytics_summary;
-- CREATE UNIQUE INDEX ON cross_analytics_summary_mat (fleet, depot, year, month_num);
-- REFRESH MATERIALIZED VIEW cross_analytics_summary_mat;

-- =====================================================
-- VALIDATION
-- =====================================================

-- Test the view
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM cross_analytics_summary LIMIT 1;
  RAISE NOTICE 'cross_analytics_summary view created successfully';
  RAISE NOTICE 'Test query executed - view is functional';
END $$;

-- Sample data (top 5 rows)
SELECT
  fleet,
  depot,
  month,
  year,
  captive_deliveries,
  safety_events,
  guardian_events,
  active_vehicles
FROM cross_analytics_summary
ORDER BY year DESC, month_num DESC
LIMIT 5;

-- =====================================================
-- NOTES
-- =====================================================

-- Dependencies:
--   ✓ captive_deliveries (materialized view)
--   ✓ lytx_safety_events (table)
--   ✓ guardian_events (table)
--   ✓ vehicles (table)
--
-- Used by:
--   ✓ dataCentreSupabaseService.ts:126 (getOverviewAnalytics)
--   ✓ dataCentreSupabaseService.ts:245 (getCrossAnalytics)
--   ✓ dataCentreSupabaseService.ts:327 (getDataForComponent)
--
-- Field mapping matches TypeScript interface in dataCentreSupabaseService.ts
