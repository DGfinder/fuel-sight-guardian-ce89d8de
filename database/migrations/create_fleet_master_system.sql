/**
 * Fleet Master Configuration System
 *
 * Creates database functions and views for centralized fleet management:
 * - Fleet synchronization function to update guardian_events from vehicles table
 * - Fleet mismatch detection view for data quality monitoring
 * - Helper functions for fleet data validation
 *
 * This ensures vehicles table is the single source of truth for fleet assignments.
 */

-- ============================================================================
-- FUNCTION: Sync Guardian Event Fleets from Vehicle Master Data
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_guardian_event_fleets()
RETURNS TABLE (
  updated_count INTEGER,
  mismatch_count_before INTEGER,
  mismatch_count_after INTEGER,
  execution_time_ms INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
  v_updated_count INTEGER;
  v_mismatch_before INTEGER;
  v_mismatch_after INTEGER;
BEGIN
  v_start_time := clock_timestamp();

  -- Count mismatches before sync
  SELECT COUNT(*)
  INTO v_mismatch_before
  FROM guardian_events ge
  INNER JOIN vehicles v ON ge.vehicle_registration = v.registration
  WHERE ge.fleet != v.fleet;

  -- Update guardian_events.fleet to match vehicles.fleet
  -- Uses vehicle_registration as the joining key
  WITH updates AS (
    UPDATE guardian_events ge
    SET fleet = v.fleet
    FROM vehicles v
    WHERE ge.vehicle_registration = v.registration
      AND ge.fleet != v.fleet
    RETURNING ge.id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updates;

  -- Count mismatches after sync (should be 0)
  SELECT COUNT(*)
  INTO v_mismatch_after
  FROM guardian_events ge
  INNER JOIN vehicles v ON ge.vehicle_registration = v.registration
  WHERE ge.fleet != v.fleet;

  v_end_time := clock_timestamp();

  -- Return results
  RETURN QUERY
  SELECT
    v_updated_count,
    v_mismatch_before,
    v_mismatch_after,
    EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::INTEGER;
END;
$$;

COMMENT ON FUNCTION sync_guardian_event_fleets() IS
'Synchronizes guardian_events.fleet with vehicles.fleet based on vehicle_registration.
Returns counts of updated records and mismatches before/after sync.';


-- ============================================================================
-- FUNCTION: Get Fleet Mismatches
-- ============================================================================

CREATE OR REPLACE FUNCTION get_fleet_mismatches()
RETURNS TABLE (
  vehicle_registration TEXT,
  vehicle_fleet TEXT,
  event_fleet TEXT,
  event_count BIGINT,
  first_mismatch TIMESTAMPTZ,
  last_mismatch TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ge.vehicle_registration,
    v.fleet AS vehicle_fleet,
    ge.fleet AS event_fleet,
    COUNT(*) AS event_count,
    MIN(ge.occurred_at) AS first_mismatch,
    MAX(ge.occurred_at) AS last_mismatch
  FROM guardian_events ge
  INNER JOIN vehicles v ON ge.vehicle_registration = v.registration
  WHERE ge.fleet != v.fleet
  GROUP BY ge.vehicle_registration, v.fleet, ge.fleet
  ORDER BY event_count DESC, vehicle_registration;
END;
$$;

COMMENT ON FUNCTION get_fleet_mismatches() IS
'Returns all vehicles with Guardian events that have incorrect fleet assignments.
Shows vehicle registration, correct fleet, incorrect fleet, and count of affected events.';


-- ============================================================================
-- VIEW: Fleet Data Quality
-- ============================================================================

CREATE OR REPLACE VIEW fleet_data_quality AS
WITH vehicle_stats AS (
  SELECT
    fleet,
    COUNT(*) AS total_vehicles,
    COUNT(CASE WHEN guardian_unit IS NOT NULL THEN 1 END) AS vehicles_with_guardian,
    COUNT(CASE WHEN lytx_device IS NOT NULL THEN 1 END) AS vehicles_with_lytx,
    COUNT(CASE WHEN status = 'Active' THEN 1 END) AS active_vehicles
  FROM vehicles
  GROUP BY fleet
),
driver_stats AS (
  SELECT
    fleet,
    COUNT(*) AS total_drivers,
    COUNT(CASE WHEN status = 'Active' THEN 1 END) AS active_drivers,
    COUNT(DISTINCT depot) AS unique_depots
  FROM drivers
  GROUP BY fleet
),
guardian_event_stats AS (
  SELECT
    fleet,
    COUNT(*) AS total_events,
    COUNT(DISTINCT vehicle_registration) AS unique_vehicles_with_events,
    MIN(occurred_at) AS earliest_event,
    MAX(occurred_at) AS latest_event
  FROM guardian_events
  GROUP BY fleet
),
mismatch_stats AS (
  SELECT
    v.fleet,
    COUNT(*) AS mismatched_events,
    COUNT(DISTINCT ge.vehicle_registration) AS vehicles_with_mismatches
  FROM guardian_events ge
  INNER JOIN vehicles v ON ge.vehicle_registration = v.registration
  WHERE ge.fleet != v.fleet
  GROUP BY v.fleet
)
SELECT
  vs.fleet,
  vs.total_vehicles,
  vs.vehicles_with_guardian,
  vs.vehicles_with_lytx,
  vs.active_vehicles,
  COALESCE(ds.total_drivers, 0) AS total_drivers,
  COALESCE(ds.active_drivers, 0) AS active_drivers,
  COALESCE(ds.unique_depots, 0) AS unique_depots,
  COALESCE(ges.total_events, 0) AS total_guardian_events,
  COALESCE(ges.unique_vehicles_with_events, 0) AS vehicles_with_events,
  COALESCE(ms.mismatched_events, 0) AS mismatched_events,
  COALESCE(ms.vehicles_with_mismatches, 0) AS vehicles_with_mismatches,
  ges.earliest_event,
  ges.latest_event,
  CASE
    WHEN COALESCE(ms.mismatched_events, 0) = 0 THEN 100.0
    WHEN COALESCE(ges.total_events, 0) = 0 THEN 100.0
    ELSE ROUND((1 - (COALESCE(ms.mismatched_events, 0)::NUMERIC / ges.total_events::NUMERIC)) * 100, 2)
  END AS data_quality_score
FROM vehicle_stats vs
LEFT JOIN driver_stats ds ON vs.fleet = ds.fleet
LEFT JOIN guardian_event_stats ges ON vs.fleet = ges.fleet
LEFT JOIN mismatch_stats ms ON vs.fleet = ms.fleet
ORDER BY vs.fleet;

COMMENT ON VIEW fleet_data_quality IS
'Comprehensive fleet data quality metrics including vehicle counts, driver counts,
Guardian event statistics, and mismatch detection. Shows data quality score (0-100).';


-- ============================================================================
-- VIEW: Fleet Master Summary
-- ============================================================================

CREATE OR REPLACE VIEW fleet_master_summary AS
SELECT
  (SELECT COUNT(*) FROM vehicles) AS total_vehicles,
  (SELECT COUNT(*) FROM vehicles WHERE fleet = 'Stevemacs') AS stevemacs_vehicles,
  (SELECT COUNT(*) FROM vehicles WHERE fleet = 'Great Southern Fuels') AS gsf_vehicles,
  (SELECT COUNT(*) FROM drivers) AS total_drivers,
  (SELECT COUNT(*) FROM drivers WHERE fleet = 'Stevemacs') AS stevemacs_drivers,
  (SELECT COUNT(*) FROM drivers WHERE fleet = 'Great Southern Fuels') AS gsf_drivers,
  (SELECT COUNT(*) FROM guardian_events) AS total_guardian_events,
  (SELECT COUNT(*) FROM (
    SELECT 1
    FROM guardian_events ge
    INNER JOIN vehicles v ON ge.vehicle_registration = v.registration
    WHERE ge.fleet != v.fleet
    LIMIT 1
  ) AS mismatches) > 0 AS has_mismatches,
  (SELECT COUNT(*) FROM get_fleet_mismatches()) AS total_mismatches,
  NOW() AS generated_at;

COMMENT ON VIEW fleet_master_summary IS
'Quick summary of fleet configuration status for dashboard display.
Shows total counts and indicates if any fleet mismatches exist.';


-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permission on functions to authenticated users
GRANT EXECUTE ON FUNCTION sync_guardian_event_fleets() TO authenticated;
GRANT EXECUTE ON FUNCTION get_fleet_mismatches() TO authenticated;

-- Grant select permission on views
GRANT SELECT ON fleet_data_quality TO authenticated;
GRANT SELECT ON fleet_master_summary TO authenticated;


-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Ensure we have indexes for efficient fleet synchronization
CREATE INDEX IF NOT EXISTS idx_guardian_events_fleet_registration
  ON guardian_events(fleet, vehicle_registration);

CREATE INDEX IF NOT EXISTS idx_vehicles_fleet_registration
  ON vehicles(fleet, registration);

CREATE INDEX IF NOT EXISTS idx_drivers_fleet_depot
  ON drivers(fleet, depot);

-- Partial index for finding mismatches quickly
CREATE INDEX IF NOT EXISTS idx_guardian_events_needs_sync
  ON guardian_events(vehicle_registration, fleet)
  WHERE vehicle_registration IS NOT NULL;


-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Fleet Master System Created Successfully';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions Created:';
  RAISE NOTICE '  - sync_guardian_event_fleets()  - Sync Guardian events with vehicle fleet';
  RAISE NOTICE '  - get_fleet_mismatches()        - Get list of fleet mismatches';
  RAISE NOTICE '';
  RAISE NOTICE 'Views Created:';
  RAISE NOTICE '  - fleet_data_quality     - Comprehensive fleet data quality metrics';
  RAISE NOTICE '  - fleet_master_summary   - Quick fleet configuration summary';
  RAISE NOTICE '';
  RAISE NOTICE 'Indexes Created:';
  RAISE NOTICE '  - Performance indexes for fleet sync operations';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  SELECT * FROM sync_guardian_event_fleets();';
  RAISE NOTICE '  SELECT * FROM get_fleet_mismatches();';
  RAISE NOTICE '  SELECT * FROM fleet_data_quality;';
  RAISE NOTICE '=================================================================';
END $$;
