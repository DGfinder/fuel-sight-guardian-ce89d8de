-- =====================================================
-- CREATE LYTX SAFETY ANALYTICS VIEW
-- =====================================================
-- Critical view for DataCentreSupabaseService
-- Referenced: dataCentreSupabaseService.ts:185
-- Provides monthly safety event analytics
-- =====================================================

-- Drop existing view if present
DROP VIEW IF EXISTS lytx_safety_analytics CASCADE;

-- =====================================================
-- CREATE VIEW
-- =====================================================

CREATE OR REPLACE VIEW lytx_safety_analytics AS

SELECT
    carrier::TEXT,
    depot::TEXT,
    TO_CHAR(event_datetime, 'Mon') as month,
    EXTRACT(YEAR FROM event_datetime)::INTEGER as year,
    EXTRACT(MONTH FROM event_datetime)::INTEGER as month_num,

    -- Event counts
    COUNT(*)::INTEGER as total_events,
    COUNT(CASE WHEN event_type = 'Coachable' THEN 1 END)::INTEGER as coachable_events,
    COUNT(CASE WHEN event_type = 'Driver Tagged' THEN 1 END)::INTEGER as driver_tagged_events,
    COUNT(CASE WHEN status = 'New' THEN 1 END)::INTEGER as new_events,
    COUNT(CASE WHEN status = 'Resolved' THEN 1 END)::INTEGER as resolved_events,

    -- Safety metrics
    COALESCE(AVG(score), 0)::DECIMAL(5,2) as avg_score,

    -- Driver metrics
    COUNT(DISTINCT driver_name)::INTEGER as unique_drivers,
    COUNT(DISTINCT CASE WHEN score >= 80 THEN driver_name END)::INTEGER as high_risk_drivers

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

ORDER BY year DESC, month_num DESC, carrier, depot;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Enable security invoker to inherit RLS from underlying tables
ALTER VIEW lytx_safety_analytics SET (security_invoker = true);

-- Grant to authenticated users
GRANT SELECT ON lytx_safety_analytics TO authenticated;

-- Grant to service role for backend queries
GRANT SELECT ON lytx_safety_analytics TO service_role;

-- =====================================================
-- VALIDATION
-- =====================================================

-- Test the view
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM lytx_safety_analytics LIMIT 1;
  RAISE NOTICE 'lytx_safety_analytics view created successfully';
  RAISE NOTICE 'Test query executed - view is functional';
END $$;

-- Sample data (top 5 rows)
SELECT
  carrier,
  depot,
  month,
  year,
  total_events,
  coachable_events,
  avg_score,
  unique_drivers,
  high_risk_drivers
FROM lytx_safety_analytics
ORDER BY year DESC, month_num DESC
LIMIT 5;

-- Show latest month summary by depot
SELECT
  depot,
  total_events,
  coachable_events,
  ROUND((coachable_events::DECIMAL / NULLIF(total_events, 0) * 100), 1) as coachable_percentage,
  avg_score,
  unique_drivers
FROM lytx_safety_analytics
WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND month_num = EXTRACT(MONTH FROM CURRENT_DATE)
ORDER BY total_events DESC;

-- =====================================================
-- NOTES
-- =====================================================

-- Dependencies:
--   ✓ lytx_safety_events (table from 001_create_analytics_tables.sql)
--
-- Used by:
--   ✓ dataCentreSupabaseService.ts:185 (getSafetyEventsAnalytics)
--   ✓ LYTXSafetyDashboard.tsx (monthly trends)
--   ✓ GSFSafetyDashboard.tsx / StevemacsSafetyDashboard.tsx
--
-- Field mapping matches TypeScript interface:
--   carrier: 'Stevemacs' | 'Great Southern Fuels'
--   depot: string
--   month: string  // 'Jan', 'Feb', etc.
--   year: number
--   total_events: number
--   coachable_events: number
--   avg_score: number
--   unique_drivers: number
--   high_risk_drivers: number
--
-- Notes:
--   - Excludes events where excluded = true
--   - High risk defined as score >= 80
--   - Handles NULL scores with COALESCE
