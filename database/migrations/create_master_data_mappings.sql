/**
 * Master Data Mappings System
 *
 * Creates mapping tables, sync functions, and validation views for cross-system data attribution.
 * Establishes vehicles and drivers tables as single source of truth for fleet assignments.
 *
 * Systems integrated:
 * - LYTX Safety (device_serial → vehicle)
 * - Guardian Events (guardian_unit → vehicle)
 * - MtData Trips (mtdata_vehicle_id → vehicle)
 * - Captive Payments (already has fleet attribution)
 *
 * Components:
 * - Mapping tables for device/unit/vehicle ID cross-references
 * - Sync functions to update event/trip records with correct fleet assignments
 * - Validation views to detect orphaned/unmapped records
 * - Audit logging for data quality tracking
 */

-- ============================================================================
-- MAPPING TABLES
-- ============================================================================

-- LYTX Device Mappings
-- Maps LYTX device serial numbers to vehicles in the master vehicles table
CREATE TABLE IF NOT EXISTS lytx_device_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_serial TEXT NOT NULL UNIQUE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  vehicle_registration TEXT NOT NULL,
  fleet TEXT NOT NULL,

  -- Mapping metadata
  mapping_source TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'auto', 'import'
  confidence_score NUMERIC(3,2) DEFAULT 1.00, -- 0.00 to 1.00
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Notes
  notes TEXT,

  CONSTRAINT lytx_device_mappings_fleet_check
    CHECK (fleet IN ('Stevemacs', 'Great Southern Fuels'))
);

COMMENT ON TABLE lytx_device_mappings IS
'Maps LYTX device serial numbers to vehicles. Single source of truth for LYTX device → vehicle attribution.';


-- Guardian Unit Mappings
-- Maps Guardian unit IDs to vehicles in the master vehicles table
CREATE TABLE IF NOT EXISTS guardian_unit_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_unit TEXT NOT NULL UNIQUE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  vehicle_registration TEXT NOT NULL,
  fleet TEXT NOT NULL,

  -- Mapping metadata
  mapping_source TEXT NOT NULL DEFAULT 'manual',
  confidence_score NUMERIC(3,2) DEFAULT 1.00,
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Notes
  notes TEXT,

  CONSTRAINT guardian_unit_mappings_fleet_check
    CHECK (fleet IN ('Stevemacs', 'Great Southern Fuels'))
);

COMMENT ON TABLE guardian_unit_mappings IS
'Maps Guardian unit IDs to vehicles. Single source of truth for Guardian unit → vehicle attribution.';


-- MtData Vehicle Mappings
-- Maps MtData vehicle IDs to vehicles in the master vehicles table
CREATE TABLE IF NOT EXISTS mtdata_vehicle_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mtdata_vehicle_id TEXT NOT NULL UNIQUE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  vehicle_registration TEXT NOT NULL,
  fleet TEXT NOT NULL,

  -- Mapping metadata
  mapping_source TEXT NOT NULL DEFAULT 'manual',
  confidence_score NUMERIC(3,2) DEFAULT 1.00,
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Notes
  notes TEXT,

  CONSTRAINT mtdata_vehicle_mappings_fleet_check
    CHECK (fleet IN ('Stevemacs', 'Great Southern Fuels'))
);

COMMENT ON TABLE mtdata_vehicle_mappings IS
'Maps MtData vehicle IDs to vehicles. Single source of truth for MtData vehicle → vehicle attribution.';


-- Master Data Sync Log
-- Audit trail for all sync operations
CREATE TABLE IF NOT EXISTS master_data_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL, -- 'lytx_events', 'guardian_events', 'mtdata_trips'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'

  -- Sync results
  records_updated INTEGER DEFAULT 0,
  mismatches_before INTEGER DEFAULT 0,
  mismatches_after INTEGER DEFAULT 0,
  execution_time_ms INTEGER,

  -- Error tracking
  error_message TEXT,
  error_details JSONB,

  -- User tracking
  triggered_by UUID REFERENCES auth.users(id),

  CONSTRAINT master_data_sync_log_sync_type_check
    CHECK (sync_type IN ('lytx_events', 'guardian_events', 'mtdata_trips', 'all_systems')),
  CONSTRAINT master_data_sync_log_status_check
    CHECK (status IN ('running', 'completed', 'failed'))
);

COMMENT ON TABLE master_data_sync_log IS
'Audit trail for master data synchronization operations. Tracks sync execution, results, and errors.';


-- ============================================================================
-- SYNC FUNCTIONS
-- ============================================================================

-- Sync LYTX Event Fleets from Device Mappings
CREATE OR REPLACE FUNCTION sync_lytx_event_fleets()
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
  v_sync_log_id UUID;
BEGIN
  v_start_time := clock_timestamp();

  -- Create sync log entry
  INSERT INTO master_data_sync_log (sync_type, status, triggered_by)
  VALUES ('lytx_events', 'running', auth.uid())
  RETURNING id INTO v_sync_log_id;

  -- Count mismatches before sync
  SELECT COUNT(*)
  INTO v_mismatch_before
  FROM lytx_safety_events lse
  INNER JOIN lytx_device_mappings ldm ON lse.device_serial = ldm.device_serial
  WHERE lse.fleet != ldm.fleet;

  -- Update lytx_safety_events.fleet to match lytx_device_mappings.fleet
  WITH updates AS (
    UPDATE lytx_safety_events lse
    SET
      fleet = ldm.fleet,
      vehicle_registration = ldm.vehicle_registration
    FROM lytx_device_mappings ldm
    WHERE lse.device_serial = ldm.device_serial
      AND (lse.fleet != ldm.fleet OR lse.vehicle_registration != ldm.vehicle_registration)
    RETURNING lse.id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updates;

  -- Count mismatches after sync (should be 0)
  SELECT COUNT(*)
  INTO v_mismatch_after
  FROM lytx_safety_events lse
  INNER JOIN lytx_device_mappings ldm ON lse.device_serial = ldm.device_serial
  WHERE lse.fleet != ldm.fleet;

  v_end_time := clock_timestamp();

  -- Update sync log
  UPDATE master_data_sync_log
  SET
    completed_at = v_end_time,
    status = 'completed',
    records_updated = v_updated_count,
    mismatches_before = v_mismatch_before,
    mismatches_after = v_mismatch_after,
    execution_time_ms = EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::INTEGER
  WHERE id = v_sync_log_id;

  -- Return results
  RETURN QUERY
  SELECT
    v_updated_count,
    v_mismatch_before,
    v_mismatch_after,
    EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::INTEGER;

EXCEPTION WHEN OTHERS THEN
  -- Log error
  UPDATE master_data_sync_log
  SET
    completed_at = clock_timestamp(),
    status = 'failed',
    error_message = SQLERRM,
    error_details = jsonb_build_object(
      'sqlstate', SQLSTATE,
      'message', SQLERRM,
      'context', PG_EXCEPTION_CONTEXT
    )
  WHERE id = v_sync_log_id;

  RAISE;
END;
$$;

COMMENT ON FUNCTION sync_lytx_event_fleets() IS
'Synchronizes lytx_safety_events.fleet with lytx_device_mappings.fleet based on device_serial.
Returns counts of updated records and mismatches before/after sync.';


-- Sync MtData Trip Fleets from Vehicle Mappings
CREATE OR REPLACE FUNCTION sync_mtdata_trip_fleets()
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
  v_sync_log_id UUID;
BEGIN
  v_start_time := clock_timestamp();

  -- Create sync log entry
  INSERT INTO master_data_sync_log (sync_type, status, triggered_by)
  VALUES ('mtdata_trips', 'running', auth.uid())
  RETURNING id INTO v_sync_log_id;

  -- Count mismatches before sync
  SELECT COUNT(*)
  INTO v_mismatch_before
  FROM mtdata_trip_history mth
  INNER JOIN mtdata_vehicle_mappings mvm ON mth.vehicle_id = mvm.mtdata_vehicle_id
  WHERE mth.fleet != mvm.fleet;

  -- Update mtdata_trip_history.fleet to match mtdata_vehicle_mappings.fleet
  WITH updates AS (
    UPDATE mtdata_trip_history mth
    SET
      fleet = mvm.fleet,
      vehicle_registration = mvm.vehicle_registration
    FROM mtdata_vehicle_mappings mvm
    WHERE mth.vehicle_id = mvm.mtdata_vehicle_id
      AND (mth.fleet != mvm.fleet OR mth.vehicle_registration != mvm.vehicle_registration)
    RETURNING mth.id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updates;

  -- Count mismatches after sync (should be 0)
  SELECT COUNT(*)
  INTO v_mismatch_after
  FROM mtdata_trip_history mth
  INNER JOIN mtdata_vehicle_mappings mvm ON mth.vehicle_id = mvm.mtdata_vehicle_id
  WHERE mth.fleet != mvm.fleet;

  v_end_time := clock_timestamp();

  -- Update sync log
  UPDATE master_data_sync_log
  SET
    completed_at = v_end_time,
    status = 'completed',
    records_updated = v_updated_count,
    mismatches_before = v_mismatch_before,
    mismatches_after = v_mismatch_after,
    execution_time_ms = EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::INTEGER
  WHERE id = v_sync_log_id;

  -- Return results
  RETURN QUERY
  SELECT
    v_updated_count,
    v_mismatch_before,
    v_mismatch_after,
    EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::INTEGER;

EXCEPTION WHEN OTHERS THEN
  -- Log error
  UPDATE master_data_sync_log
  SET
    completed_at = clock_timestamp(),
    status = 'failed',
    error_message = SQLERRM,
    error_details = jsonb_build_object(
      'sqlstate', SQLSTATE,
      'message', SQLERRM,
      'context', PG_EXCEPTION_CONTEXT
    )
  WHERE id = v_sync_log_id;

  RAISE;
END;
$$;

COMMENT ON FUNCTION sync_mtdata_trip_fleets() IS
'Synchronizes mtdata_trip_history.fleet with mtdata_vehicle_mappings.fleet based on vehicle_id.
Returns counts of updated records and mismatches before/after sync.';


-- Sync Guardian Event Fleets from Unit Mappings
-- Extends the existing sync_guardian_event_fleets() to use guardian_unit_mappings table
CREATE OR REPLACE FUNCTION sync_guardian_event_fleets_from_mappings()
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
  v_sync_log_id UUID;
BEGIN
  v_start_time := clock_timestamp();

  -- Create sync log entry
  INSERT INTO master_data_sync_log (sync_type, status, triggered_by)
  VALUES ('guardian_events', 'running', auth.uid())
  RETURNING id INTO v_sync_log_id;

  -- Count mismatches before sync
  SELECT COUNT(*)
  INTO v_mismatch_before
  FROM guardian_events ge
  INNER JOIN guardian_unit_mappings gum ON ge.guardian_unit = gum.guardian_unit
  WHERE ge.fleet != gum.fleet;

  -- Update guardian_events.fleet to match guardian_unit_mappings.fleet
  WITH updates AS (
    UPDATE guardian_events ge
    SET
      fleet = gum.fleet,
      vehicle_registration = gum.vehicle_registration
    FROM guardian_unit_mappings gum
    WHERE ge.guardian_unit = gum.guardian_unit
      AND (ge.fleet != gum.fleet OR ge.vehicle_registration != gum.vehicle_registration)
    RETURNING ge.id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updates;

  -- Count mismatches after sync (should be 0)
  SELECT COUNT(*)
  INTO v_mismatch_after
  FROM guardian_events ge
  INNER JOIN guardian_unit_mappings gum ON ge.guardian_unit = gum.guardian_unit
  WHERE ge.fleet != gum.fleet;

  v_end_time := clock_timestamp();

  -- Update sync log
  UPDATE master_data_sync_log
  SET
    completed_at = v_end_time,
    status = 'completed',
    records_updated = v_updated_count,
    mismatches_before = v_mismatch_before,
    mismatches_after = v_mismatch_after,
    execution_time_ms = EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::INTEGER
  WHERE id = v_sync_log_id;

  -- Return results
  RETURN QUERY
  SELECT
    v_updated_count,
    v_mismatch_before,
    v_mismatch_after,
    EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::INTEGER;

EXCEPTION WHEN OTHERS THEN
  -- Log error
  UPDATE master_data_sync_log
  SET
    completed_at = clock_timestamp(),
    status = 'failed',
    error_message = SQLERRM,
    error_details = jsonb_build_object(
      'sqlstate', SQLSTATE,
      'message', SQLERRM,
      'context', PG_EXCEPTION_CONTEXT
    )
  WHERE id = v_sync_log_id;

  RAISE;
END;
$$;

COMMENT ON FUNCTION sync_guardian_event_fleets_from_mappings() IS
'Synchronizes guardian_events.fleet with guardian_unit_mappings.fleet based on guardian_unit.
Returns counts of updated records and mismatches before/after sync.';


-- Sync All Systems
CREATE OR REPLACE FUNCTION sync_all_master_data()
RETURNS TABLE (
  system TEXT,
  updated_count INTEGER,
  mismatch_count_before INTEGER,
  mismatch_count_after INTEGER,
  execution_time_ms INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sync_log_id UUID;
BEGIN
  -- Create sync log entry for all systems
  INSERT INTO master_data_sync_log (sync_type, status, triggered_by)
  VALUES ('all_systems', 'running', auth.uid())
  RETURNING id INTO v_sync_log_id;

  -- Return results from all sync operations
  RETURN QUERY

  -- LYTX sync
  SELECT
    'LYTX Safety'::TEXT as system,
    r.updated_count,
    r.mismatch_count_before,
    r.mismatch_count_after,
    r.execution_time_ms
  FROM sync_lytx_event_fleets() r

  UNION ALL

  -- Guardian sync
  SELECT
    'Guardian Events'::TEXT as system,
    r.updated_count,
    r.mismatch_count_before,
    r.mismatch_count_after,
    r.execution_time_ms
  FROM sync_guardian_event_fleets_from_mappings() r

  UNION ALL

  -- MtData sync
  SELECT
    'MtData Trips'::TEXT as system,
    r.updated_count,
    r.mismatch_count_before,
    r.mismatch_count_after,
    r.execution_time_ms
  FROM sync_mtdata_trip_fleets() r;

  -- Update sync log
  UPDATE master_data_sync_log
  SET
    completed_at = NOW(),
    status = 'completed'
  WHERE id = v_sync_log_id;

EXCEPTION WHEN OTHERS THEN
  -- Log error
  UPDATE master_data_sync_log
  SET
    completed_at = clock_timestamp(),
    status = 'failed',
    error_message = SQLERRM
  WHERE id = v_sync_log_id;

  RAISE;
END;
$$;

COMMENT ON FUNCTION sync_all_master_data() IS
'Synchronizes all systems (LYTX, Guardian, MtData) with master data mappings.
Returns individual results for each system.';


-- ============================================================================
-- VALIDATION VIEWS
-- ============================================================================

-- LYTX Orphaned Events
-- Events that don't have a device mapping
CREATE OR REPLACE VIEW lytx_orphaned_events AS
SELECT
  lse.device_serial,
  lse.fleet AS current_fleet,
  COUNT(*) AS event_count,
  MIN(lse.occurred_at) AS first_event,
  MAX(lse.occurred_at) AS last_event,
  COUNT(DISTINCT lse.driver_name) AS unique_drivers
FROM lytx_safety_events lse
LEFT JOIN lytx_device_mappings ldm ON lse.device_serial = ldm.device_serial
WHERE ldm.device_serial IS NULL
  AND lse.device_serial IS NOT NULL
GROUP BY lse.device_serial, lse.fleet
ORDER BY event_count DESC;

COMMENT ON VIEW lytx_orphaned_events IS
'LYTX safety events that lack a device mapping. These events cannot be attributed to specific vehicles.';


-- Guardian Orphaned Events
-- Events that don't have a unit mapping
CREATE OR REPLACE VIEW guardian_orphaned_events AS
SELECT
  ge.guardian_unit,
  ge.fleet AS current_fleet,
  COUNT(*) AS event_count,
  MIN(ge.occurred_at) AS first_event,
  MAX(ge.occurred_at) AS last_event,
  COUNT(DISTINCT ge.driver_name) AS unique_drivers
FROM guardian_events ge
LEFT JOIN guardian_unit_mappings gum ON ge.guardian_unit = gum.guardian_unit
WHERE gum.guardian_unit IS NULL
  AND ge.guardian_unit IS NOT NULL
GROUP BY ge.guardian_unit, ge.fleet
ORDER BY event_count DESC;

COMMENT ON VIEW guardian_orphaned_events IS
'Guardian events that lack a unit mapping. These events cannot be attributed to specific vehicles.';


-- MtData Orphaned Trips
-- Trips that don't have a vehicle mapping
CREATE OR REPLACE VIEW mtdata_orphaned_trips AS
SELECT
  mth.vehicle_id AS mtdata_vehicle_id,
  mth.fleet AS current_fleet,
  COUNT(*) AS trip_count,
  MIN(mth.trip_start_time) AS first_trip,
  MAX(mth.trip_end_time) AS last_trip,
  COUNT(DISTINCT mth.driver_name) AS unique_drivers,
  SUM(mth.distance_km) AS total_distance_km
FROM mtdata_trip_history mth
LEFT JOIN mtdata_vehicle_mappings mvm ON mth.vehicle_id = mvm.mtdata_vehicle_id
WHERE mvm.mtdata_vehicle_id IS NULL
  AND mth.vehicle_id IS NOT NULL
GROUP BY mth.vehicle_id, mth.fleet
ORDER BY trip_count DESC;

COMMENT ON VIEW mtdata_orphaned_trips IS
'MtData trips that lack a vehicle mapping. These trips cannot be attributed to specific vehicles.';


-- Master Data Quality Dashboard
-- Comprehensive view of mapping coverage and data quality across all systems
CREATE OR REPLACE VIEW master_data_quality_dashboard AS
WITH lytx_stats AS (
  SELECT
    COUNT(DISTINCT device_serial) AS total_devices,
    COUNT(DISTINCT CASE WHEN ldm.device_serial IS NOT NULL THEN lse.device_serial END) AS mapped_devices,
    COUNT(*) AS total_events,
    COUNT(CASE WHEN ldm.device_serial IS NOT NULL THEN 1 END) AS mapped_events
  FROM lytx_safety_events lse
  LEFT JOIN lytx_device_mappings ldm ON lse.device_serial = ldm.device_serial
),
guardian_stats AS (
  SELECT
    COUNT(DISTINCT guardian_unit) AS total_units,
    COUNT(DISTINCT CASE WHEN gum.guardian_unit IS NOT NULL THEN ge.guardian_unit END) AS mapped_units,
    COUNT(*) AS total_events,
    COUNT(CASE WHEN gum.guardian_unit IS NOT NULL THEN 1 END) AS mapped_events
  FROM guardian_events ge
  LEFT JOIN guardian_unit_mappings gum ON ge.guardian_unit = gum.guardian_unit
),
mtdata_stats AS (
  SELECT
    COUNT(DISTINCT vehicle_id) AS total_vehicles,
    COUNT(DISTINCT CASE WHEN mvm.mtdata_vehicle_id IS NOT NULL THEN mth.vehicle_id END) AS mapped_vehicles,
    COUNT(*) AS total_trips,
    COUNT(CASE WHEN mvm.mtdata_vehicle_id IS NOT NULL THEN 1 END) AS mapped_trips
  FROM mtdata_trip_history mth
  LEFT JOIN mtdata_vehicle_mappings mvm ON mth.vehicle_id = mvm.mtdata_vehicle_id
),
recent_syncs AS (
  SELECT
    sync_type,
    MAX(completed_at) AS last_sync,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS successful_syncs,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_syncs
  FROM master_data_sync_log
  WHERE completed_at > NOW() - INTERVAL '7 days'
  GROUP BY sync_type
)
SELECT
  -- LYTX metrics
  ls.total_devices AS lytx_total_devices,
  ls.mapped_devices AS lytx_mapped_devices,
  ls.total_events AS lytx_total_events,
  ls.mapped_events AS lytx_mapped_events,
  ROUND((ls.mapped_devices::NUMERIC / NULLIF(ls.total_devices, 0)) * 100, 2) AS lytx_device_coverage_pct,
  ROUND((ls.mapped_events::NUMERIC / NULLIF(ls.total_events, 0)) * 100, 2) AS lytx_event_coverage_pct,

  -- Guardian metrics
  gs.total_units AS guardian_total_units,
  gs.mapped_units AS guardian_mapped_units,
  gs.total_events AS guardian_total_events,
  gs.mapped_events AS guardian_mapped_events,
  ROUND((gs.mapped_units::NUMERIC / NULLIF(gs.total_units, 0)) * 100, 2) AS guardian_unit_coverage_pct,
  ROUND((gs.mapped_events::NUMERIC / NULLIF(gs.total_events, 0)) * 100, 2) AS guardian_event_coverage_pct,

  -- MtData metrics
  ms.total_vehicles AS mtdata_total_vehicles,
  ms.mapped_vehicles AS mtdata_mapped_vehicles,
  ms.total_trips AS mtdata_total_trips,
  ms.mapped_trips AS mtdata_mapped_trips,
  ROUND((ms.mapped_vehicles::NUMERIC / NULLIF(ms.total_vehicles, 0)) * 100, 2) AS mtdata_vehicle_coverage_pct,
  ROUND((ms.mapped_trips::NUMERIC / NULLIF(ms.total_trips, 0)) * 100, 2) AS mtdata_trip_coverage_pct,

  -- Overall quality score (average of all event coverage percentages)
  ROUND((
    COALESCE((ls.mapped_events::NUMERIC / NULLIF(ls.total_events, 0)) * 100, 0) +
    COALESCE((gs.mapped_events::NUMERIC / NULLIF(gs.total_events, 0)) * 100, 0) +
    COALESCE((ms.mapped_trips::NUMERIC / NULLIF(ms.total_trips, 0)) * 100, 0)
  ) / 3, 2) AS overall_quality_score,

  -- Sync status
  (SELECT last_sync FROM recent_syncs WHERE sync_type = 'lytx_events') AS lytx_last_sync,
  (SELECT last_sync FROM recent_syncs WHERE sync_type = 'guardian_events') AS guardian_last_sync,
  (SELECT last_sync FROM recent_syncs WHERE sync_type = 'mtdata_trips') AS mtdata_last_sync,

  NOW() AS generated_at
FROM lytx_stats ls
CROSS JOIN guardian_stats gs
CROSS JOIN mtdata_stats ms;

COMMENT ON VIEW master_data_quality_dashboard IS
'Comprehensive master data quality metrics across all systems. Shows mapping coverage,
event attribution rates, and sync status for LYTX, Guardian, and MtData.';


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get unmapped devices/units/vehicles across all systems
CREATE OR REPLACE FUNCTION get_all_unmapped_identifiers()
RETURNS TABLE (
  system TEXT,
  identifier TEXT,
  event_count BIGINT,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY

  -- LYTX unmapped devices
  SELECT
    'LYTX'::TEXT as system,
    device_serial as identifier,
    event_count,
    first_event as first_seen,
    last_event as last_seen
  FROM lytx_orphaned_events

  UNION ALL

  -- Guardian unmapped units
  SELECT
    'Guardian'::TEXT as system,
    guardian_unit as identifier,
    event_count,
    first_event as first_seen,
    last_event as last_seen
  FROM guardian_orphaned_events

  UNION ALL

  -- MtData unmapped vehicles
  SELECT
    'MtData'::TEXT as system,
    mtdata_vehicle_id as identifier,
    trip_count as event_count,
    first_trip as first_seen,
    last_trip as last_seen
  FROM mtdata_orphaned_trips

  ORDER BY event_count DESC;
END;
$$;

COMMENT ON FUNCTION get_all_unmapped_identifiers() IS
'Returns all unmapped devices, units, and vehicles across LYTX, Guardian, and MtData systems.
Useful for identifying which identifiers need manual mapping.';


-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Mapping table indexes
CREATE INDEX IF NOT EXISTS idx_lytx_device_mappings_device_serial
  ON lytx_device_mappings(device_serial);

CREATE INDEX IF NOT EXISTS idx_lytx_device_mappings_vehicle_id
  ON lytx_device_mappings(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_lytx_device_mappings_fleet
  ON lytx_device_mappings(fleet);

CREATE INDEX IF NOT EXISTS idx_guardian_unit_mappings_guardian_unit
  ON guardian_unit_mappings(guardian_unit);

CREATE INDEX IF NOT EXISTS idx_guardian_unit_mappings_vehicle_id
  ON guardian_unit_mappings(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_guardian_unit_mappings_fleet
  ON guardian_unit_mappings(fleet);

CREATE INDEX IF NOT EXISTS idx_mtdata_vehicle_mappings_mtdata_vehicle_id
  ON mtdata_vehicle_mappings(mtdata_vehicle_id);

CREATE INDEX IF NOT EXISTS idx_mtdata_vehicle_mappings_vehicle_id
  ON mtdata_vehicle_mappings(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_mtdata_vehicle_mappings_fleet
  ON mtdata_vehicle_mappings(fleet);

-- Sync log indexes
CREATE INDEX IF NOT EXISTS idx_master_data_sync_log_sync_type
  ON master_data_sync_log(sync_type);

CREATE INDEX IF NOT EXISTS idx_master_data_sync_log_completed_at
  ON master_data_sync_log(completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_master_data_sync_log_status
  ON master_data_sync_log(status);


-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON lytx_device_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON guardian_unit_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mtdata_vehicle_mappings TO authenticated;
GRANT SELECT ON master_data_sync_log TO authenticated;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION sync_lytx_event_fleets() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_mtdata_trip_fleets() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_guardian_event_fleets_from_mappings() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_all_master_data() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_unmapped_identifiers() TO authenticated;

-- Grant view permissions
GRANT SELECT ON lytx_orphaned_events TO authenticated;
GRANT SELECT ON guardian_orphaned_events TO authenticated;
GRANT SELECT ON mtdata_orphaned_trips TO authenticated;
GRANT SELECT ON master_data_quality_dashboard TO authenticated;


-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Auto-update updated_at timestamp on mapping tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lytx_device_mappings_updated_at
  BEFORE UPDATE ON lytx_device_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guardian_unit_mappings_updated_at
  BEFORE UPDATE ON guardian_unit_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mtdata_vehicle_mappings_updated_at
  BEFORE UPDATE ON mtdata_vehicle_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Master Data Mappings System Created Successfully';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables Created:';
  RAISE NOTICE '  - lytx_device_mappings       - LYTX device → vehicle mapping';
  RAISE NOTICE '  - guardian_unit_mappings     - Guardian unit → vehicle mapping';
  RAISE NOTICE '  - mtdata_vehicle_mappings    - MtData vehicle → vehicle mapping';
  RAISE NOTICE '  - master_data_sync_log       - Sync operation audit trail';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions Created:';
  RAISE NOTICE '  - sync_lytx_event_fleets()              - Sync LYTX events';
  RAISE NOTICE '  - sync_guardian_event_fleets_from_mappings() - Sync Guardian events';
  RAISE NOTICE '  - sync_mtdata_trip_fleets()             - Sync MtData trips';
  RAISE NOTICE '  - sync_all_master_data()                - Sync all systems';
  RAISE NOTICE '  - get_all_unmapped_identifiers()        - Get unmapped items';
  RAISE NOTICE '';
  RAISE NOTICE 'Views Created:';
  RAISE NOTICE '  - lytx_orphaned_events              - Unmapped LYTX events';
  RAISE NOTICE '  - guardian_orphaned_events          - Unmapped Guardian events';
  RAISE NOTICE '  - mtdata_orphaned_trips             - Unmapped MtData trips';
  RAISE NOTICE '  - master_data_quality_dashboard     - Overall quality metrics';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage Examples:';
  RAISE NOTICE '  SELECT * FROM sync_all_master_data();';
  RAISE NOTICE '  SELECT * FROM get_all_unmapped_identifiers();';
  RAISE NOTICE '  SELECT * FROM master_data_quality_dashboard;';
  RAISE NOTICE '=================================================================';
END $$;
