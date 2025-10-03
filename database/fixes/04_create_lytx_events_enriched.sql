-- =====================================================
-- CREATE LYTX EVENTS ENRICHED VIEW
-- =====================================================
-- Enriches LYTX events with vehicle information
-- Maps events to vehicles by registration or device serial
-- Referenced: 003_create_analytics_views.sql:78
-- =====================================================

-- Drop existing view if present
DROP VIEW IF EXISTS lytx_events_enriched CASCADE;

-- =====================================================
-- CREATE VIEW
-- =====================================================

CREATE OR REPLACE VIEW lytx_events_enriched AS

SELECT
    -- All original LYTX event fields
    e.*,

    -- Vehicle mapping fields
    v.id AS vehicle_id,
    COALESCE(NULLIF(e.vehicle_registration, ''), v.registration) AS resolved_registration,
    v.fleet AS resolved_fleet,
    v.depot AS resolved_depot,
    v.make AS vehicle_make,
    v.model AS vehicle_model,
    v.vin AS vehicle_vin,
    v.guardian_unit AS vehicle_guardian_unit,
    v.lytx_device AS vehicle_lytx_device,

    -- Match quality indicator
    CASE
        WHEN UPPER(TRIM(e.vehicle_registration)) = UPPER(TRIM(v.registration)) THEN 'EXACT_REGISTRATION'
        WHEN e.device_serial IS NOT NULL AND e.device_serial = v.lytx_device THEN 'EXACT_DEVICE'
        WHEN v.id IS NOT NULL THEN 'PARTIAL_MATCH'
        ELSE 'NO_MATCH'
    END AS match_type

FROM lytx_safety_events e

LEFT JOIN vehicles v
    ON (
        -- Match by registration (case-insensitive, trimmed)
        UPPER(TRIM(e.vehicle_registration)) = UPPER(TRIM(v.registration))
        OR
        -- Match by LYTX device serial
        (e.device_serial IS NOT NULL AND e.device_serial = v.lytx_device)
    );

-- =====================================================
-- CREATE MATERIALIZED VERSION (OPTIONAL - FOR PERFORMANCE)
-- =====================================================

-- If the view is slow, create a materialized version:
-- DROP MATERIALIZED VIEW IF EXISTS lytx_events_enriched_mat CASCADE;
--
-- CREATE MATERIALIZED VIEW lytx_events_enriched_mat AS
-- SELECT * FROM lytx_events_enriched;
--
-- CREATE UNIQUE INDEX ON lytx_events_enriched_mat (id);
-- CREATE INDEX ON lytx_events_enriched_mat (vehicle_id) WHERE vehicle_id IS NOT NULL;
-- CREATE INDEX ON lytx_events_enriched_mat (event_datetime DESC);
-- CREATE INDEX ON lytx_events_enriched_mat (match_type);
--
-- -- Refresh function
-- CREATE OR REPLACE FUNCTION refresh_lytx_events_enriched()
-- RETURNS void AS $$
-- BEGIN
--   REFRESH MATERIALIZED VIEW CONCURRENTLY lytx_events_enriched_mat;
-- END;
-- $$ LANGUAGE plpgsql;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Enable security invoker to inherit RLS from underlying tables
ALTER VIEW lytx_events_enriched SET (security_invoker = true);

-- Grant to authenticated users
GRANT SELECT ON lytx_events_enriched TO authenticated;

-- Grant to service role for backend queries
GRANT SELECT ON lytx_events_enriched TO service_role;

-- =====================================================
-- VALIDATION
-- =====================================================

-- Test the view
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM lytx_events_enriched LIMIT 1;
  RAISE NOTICE 'lytx_events_enriched view created successfully';
  RAISE NOTICE 'Test query executed - view is functional';
END $$;

-- Sample data showing vehicle matches
SELECT
  event_id,
  driver_name,
  vehicle_registration,
  resolved_registration,
  resolved_fleet,
  resolved_depot,
  vehicle_id,
  match_type
FROM lytx_events_enriched
ORDER BY event_datetime DESC
LIMIT 10;

-- Match quality statistics
SELECT
  match_type,
  COUNT(*) as event_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM lytx_events_enriched
GROUP BY match_type
ORDER BY event_count DESC;

-- Events without vehicle matches (needs attention)
SELECT COUNT(*) as unmatched_events
FROM lytx_events_enriched
WHERE match_type = 'NO_MATCH';

-- Show sample of unmatched for investigation
SELECT
  event_id,
  vehicle_registration,
  device_serial,
  driver_name,
  event_datetime
FROM lytx_events_enriched
WHERE match_type = 'NO_MATCH'
ORDER BY event_datetime DESC
LIMIT 10;

-- =====================================================
-- NOTES
-- =====================================================

-- Dependencies:
--   ✓ lytx_safety_events (table)
--   ✓ vehicles (table)
--
-- Matching logic:
--   1. First tries to match by vehicle_registration (case-insensitive)
--   2. Falls back to matching by device_serial if registration doesn't match
--   3. Uses COALESCE to prefer non-empty registration from LYTX data
--
-- Match types:
--   - EXACT_REGISTRATION: Matched by registration number
--   - EXACT_DEVICE: Matched by LYTX device serial
--   - PARTIAL_MATCH: Matched but unclear which field
--   - NO_MATCH: No vehicle found
--
-- Used by:
--   ✓ LYTXEventTable.tsx (to display vehicle info)
--   ✓ Driver profile analytics (to link events to vehicles)
--   ✓ Vehicle performance metrics
--
-- Performance notes:
--   - View recalculates on every query
--   - For large datasets, consider materialized version
--   - LEFT JOIN ensures all events included even without vehicle match
--
-- Troubleshooting unmatched events:
--   1. Check for registration format differences (spaces, dashes)
--   2. Verify device_serial populated in both tables
--   3. Look for typos in vehicle registration
--   4. Consider fuzzy matching for close matches
