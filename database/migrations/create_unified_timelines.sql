-- =====================================================
-- UNIFIED TIMELINE VIEWS
-- =====================================================
-- Simple, elegant approach to viewing all data by vehicle or driver
--
-- Philosophy:
--   - Keep source data pure and separate
--   - Create unified views that UNION all sources
--   - Simple queries: Just filter by vehicle_id or driver_id
--
-- Views created:
--   1. vehicle_unified_timeline - All events for a vehicle (Guardian + LYTX + MTData)
--   2. driver_event_correlation - Maps Guardian events to drivers (simple inference)
--   3. driver_unified_timeline - All events for a driver (all sources)
-- =====================================================

-- =====================================================
-- DROP EXISTING VIEWS
-- =====================================================

DROP VIEW IF EXISTS driver_unified_timeline CASCADE;
DROP VIEW IF EXISTS driver_event_correlation CASCADE;
DROP VIEW IF EXISTS vehicle_unified_timeline CASCADE;

-- =====================================================
-- 1. VEHICLE UNIFIED TIMELINE
-- =====================================================
-- All events for a vehicle from all sources
-- Usage: SELECT * FROM vehicle_unified_timeline WHERE vehicle_id = 'abc' ORDER BY occurred_at DESC;

CREATE OR REPLACE VIEW vehicle_unified_timeline AS

-- Guardian events
SELECT
  v.id as vehicle_id,
  v.registration as vehicle_registration,
  v.fleet,
  v.depot,
  'guardian' as source,
  ge.id as event_id,
  ge.detection_time as occurred_at,
  ge.event_type,
  ge.severity,
  ge.driver_name,
  NULL::uuid as driver_id, -- Will be resolved in driver correlation
  ge.latitude,
  ge.longitude,
  ge.speed_kph,
  ge.duration_seconds,
  ge.verified,
  ge.confirmation,
  -- Source-specific fields as JSONB
  jsonb_build_object(
    'external_event_id', ge.external_event_id,
    'detected_event_type', ge.detected_event_type,
    'classification', ge.classification,
    'guardian_unit', ge.guardian_unit,
    'confirmation_time', ge.confirmation_time
  ) as source_data
FROM vehicles v
INNER JOIN guardian_events ge ON UPPER(TRIM(v.registration)) = UPPER(TRIM(ge.vehicle_registration))

UNION ALL

-- LYTX events
SELECT
  v.id as vehicle_id,
  v.registration as vehicle_registration,
  v.fleet,
  v.depot,
  'lytx' as source,
  l.id as event_id,
  l.event_datetime as occurred_at,
  l.trigger as event_type,
  CASE
    WHEN l.score >= 50 THEN 'Critical'
    WHEN l.score >= 30 THEN 'High'
    WHEN l.score >= 15 THEN 'Medium'
    ELSE 'Low'
  END as severity,
  l.driver_name,
  NULL::uuid as driver_id, -- Will be resolved separately
  NULL::decimal as latitude,
  NULL::decimal as longitude,
  NULL::decimal as speed_kph,
  NULL::decimal as duration_seconds,
  CASE WHEN l.status = 'Resolved' THEN true ELSE false END as verified,
  l.status as confirmation,
  -- Source-specific fields as JSONB
  jsonb_build_object(
    'event_id', l.event_id,
    'device_serial', l.device_serial,
    'employee_id', l.employee_id,
    'score', l.score,
    'behaviors', l.behaviors,
    'event_type', l.event_type,
    'assigned_date', l.assigned_date,
    'reviewed_by', l.reviewed_by
  ) as source_data
FROM vehicles v
INNER JOIN lytx_safety_events l ON UPPER(TRIM(v.registration)) = UPPER(TRIM(l.vehicle_registration))

UNION ALL

-- MTData trips
SELECT
  v.id as vehicle_id,
  v.registration as vehicle_registration,
  v.fleet,
  v.depot,
  'mtdata' as source,
  m.id as event_id,
  m.start_time as occurred_at,
  'Trip' as event_type,
  'Low' as severity, -- Trips are not safety events
  m.driver_name,
  m.driver_id,
  m.start_latitude as latitude,
  m.start_longitude as longitude,
  m.average_speed_kph as speed_kph,
  m.travel_time_hours * 3600 as duration_seconds, -- Convert hours to seconds
  true as verified, -- Trips are always verified
  'Completed' as confirmation,
  -- Source-specific fields as JSONB
  jsonb_build_object(
    'trip_number', m.trip_number,
    'trip_external_id', m.trip_external_id,
    'end_time', m.end_time,
    'distance_km', m.distance_km,
    'start_location', m.start_location,
    'end_location', m.end_location,
    'idling_time_hours', m.idling_time_hours,
    'route_efficiency_score', m.route_efficiency_score,
    'odometer_reading', m.odometer_reading
  ) as source_data
FROM vehicles v
INNER JOIN mtdata_trip_history m ON v.id = m.vehicle_id

ORDER BY occurred_at DESC;

COMMENT ON VIEW vehicle_unified_timeline IS 'Unified timeline of all events (Guardian, LYTX, MTData) for vehicles. Filter by vehicle_id to see everything for a truck.';

-- =====================================================
-- 2. DRIVER EVENT CORRELATION
-- =====================================================
-- Maps Guardian events to drivers using simple temporal inference
-- Tries multiple methods and picks the best match

CREATE OR REPLACE VIEW driver_event_correlation AS

WITH
-- Method 1: Guardian event has driver_name directly
direct_matches AS (
  SELECT
    ge.id as guardian_event_id,
    d.id as driver_id,
    d.full_name as driver_name,
    'direct_guardian' as correlation_method,
    1.0 as confidence,
    NULL::interval as time_difference
  FROM guardian_events ge
  INNER JOIN drivers d ON UPPER(TRIM(ge.driver_name)) = UPPER(TRIM(d.full_name))
  WHERE ge.driver_name IS NOT NULL AND ge.driver_name != ''
),

-- Method 2: LYTX event within 1 hour, same vehicle
lytx_hourly_matches AS (
  SELECT
    ge.id as guardian_event_id,
    d.id as driver_id,
    d.full_name as driver_name,
    'lytx_hourly' as correlation_method,
    CASE
      WHEN ABS(EXTRACT(EPOCH FROM (l.event_datetime - ge.detection_time))) <= 1800 THEN 0.85 -- ±30 min
      ELSE 0.75 -- ±1 hour
    END as confidence,
    (l.event_datetime - ge.detection_time) as time_difference
  FROM guardian_events ge
  INNER JOIN lytx_safety_events l ON
    UPPER(TRIM(ge.vehicle_registration)) = UPPER(TRIM(l.vehicle_registration))
    AND ABS(EXTRACT(EPOCH FROM (l.event_datetime - ge.detection_time))) <= 3600 -- Within 1 hour
  INNER JOIN drivers d ON UPPER(TRIM(l.driver_name)) = UPPER(TRIM(d.full_name))
  WHERE (ge.driver_name IS NULL OR ge.driver_name = '')
    AND l.driver_name IS NOT NULL
),

-- Method 3: MTData trip contains Guardian event
mtdata_trip_matches AS (
  SELECT
    ge.id as guardian_event_id,
    m.driver_id,
    d.full_name as driver_name,
    'mtdata_trip' as correlation_method,
    0.80 as confidence, -- High confidence: event during active trip
    (ge.detection_time - m.start_time) as time_difference -- Time since trip start
  FROM guardian_events ge
  INNER JOIN mtdata_trip_history m ON
    UPPER(TRIM(ge.vehicle_registration)) = UPPER(TRIM(m.vehicle_registration))
    AND ge.detection_time >= m.start_time
    AND ge.detection_time <= m.end_time
  INNER JOIN drivers d ON m.driver_id = d.id
  WHERE (ge.driver_name IS NULL OR ge.driver_name = '')
    AND m.driver_id IS NOT NULL
),

-- Method 4: LYTX event same day (fallback)
lytx_daily_matches AS (
  SELECT
    ge.id as guardian_event_id,
    d.id as driver_id,
    d.full_name as driver_name,
    'lytx_daily' as correlation_method,
    0.50 as confidence, -- Lower confidence: wider time window
    (l.event_datetime - ge.detection_time) as time_difference
  FROM guardian_events ge
  INNER JOIN lytx_safety_events l ON
    UPPER(TRIM(ge.vehicle_registration)) = UPPER(TRIM(l.vehicle_registration))
    AND DATE(l.event_datetime) = DATE(ge.detection_time)
  INNER JOIN drivers d ON UPPER(TRIM(l.driver_name)) = UPPER(TRIM(d.full_name))
  WHERE (ge.driver_name IS NULL OR ge.driver_name = '')
    AND l.driver_name IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM lytx_hourly_matches lhm WHERE lhm.guardian_event_id = ge.id
    )
),

-- Combine all methods and pick best match per Guardian event
all_matches AS (
  SELECT * FROM direct_matches
  UNION ALL
  SELECT * FROM lytx_hourly_matches
  UNION ALL
  SELECT * FROM mtdata_trip_matches
  UNION ALL
  SELECT * FROM lytx_daily_matches
),

-- Pick best match (highest confidence, closest time)
best_matches AS (
  SELECT DISTINCT ON (guardian_event_id)
    guardian_event_id,
    driver_id,
    driver_name,
    correlation_method,
    confidence,
    time_difference
  FROM all_matches
  ORDER BY
    guardian_event_id,
    confidence DESC, -- Highest confidence first
    ABS(EXTRACT(EPOCH FROM time_difference)) ASC NULLS LAST -- Closest time
)

SELECT * FROM best_matches;

COMMENT ON VIEW driver_event_correlation IS 'Maps Guardian events to drivers using temporal correlation with LYTX and MTData. Tries multiple methods and picks best match.';

-- =====================================================
-- 3. DRIVER UNIFIED TIMELINE
-- =====================================================
-- All events for a driver from all sources
-- Usage: SELECT * FROM driver_unified_timeline WHERE driver_id = '123' ORDER BY occurred_at DESC;

CREATE OR REPLACE VIEW driver_unified_timeline AS

-- Guardian events (with driver correlation)
SELECT
  COALESCE(dec.driver_id, d.id) as driver_id,
  COALESCE(dec.driver_name, d.full_name) as driver_name,
  d.drivers_license,
  d.employee_id,
  v.id as vehicle_id,
  v.registration as vehicle_registration,
  v.fleet,
  v.depot,
  'guardian' as source,
  ge.id as event_id,
  ge.detection_time as occurred_at,
  ge.event_type,
  ge.severity,
  ge.latitude,
  ge.longitude,
  ge.speed_kph,
  ge.duration_seconds,
  ge.verified,
  ge.confirmation,
  -- Correlation metadata
  dec.correlation_method,
  dec.confidence as correlation_confidence,
  -- Source-specific fields as JSONB
  jsonb_build_object(
    'external_event_id', ge.external_event_id,
    'detected_event_type', ge.detected_event_type,
    'classification', ge.classification,
    'guardian_unit', ge.guardian_unit,
    'confirmation_time', ge.confirmation_time,
    'time_difference', EXTRACT(EPOCH FROM dec.time_difference)
  ) as source_data
FROM guardian_events ge
LEFT JOIN vehicles v ON UPPER(TRIM(ge.vehicle_registration)) = UPPER(TRIM(v.registration))
LEFT JOIN driver_event_correlation dec ON dec.guardian_event_id = ge.id
LEFT JOIN drivers d ON dec.driver_id = d.id
WHERE dec.driver_id IS NOT NULL -- Only include if we could correlate to a driver

UNION ALL

-- LYTX events (already have driver)
SELECT
  d.id as driver_id,
  d.full_name as driver_name,
  d.drivers_license,
  d.employee_id,
  v.id as vehicle_id,
  v.registration as vehicle_registration,
  v.fleet,
  v.depot,
  'lytx' as source,
  l.id as event_id,
  l.event_datetime as occurred_at,
  l.trigger as event_type,
  CASE
    WHEN l.score >= 50 THEN 'Critical'
    WHEN l.score >= 30 THEN 'High'
    WHEN l.score >= 15 THEN 'Medium'
    ELSE 'Low'
  END as severity,
  NULL::decimal as latitude,
  NULL::decimal as longitude,
  NULL::decimal as speed_kph,
  NULL::decimal as duration_seconds,
  CASE WHEN l.status = 'Resolved' THEN true ELSE false END as verified,
  l.status as confirmation,
  -- Correlation metadata
  'direct_lytx' as correlation_method,
  1.0 as correlation_confidence,
  -- Source-specific fields as JSONB
  jsonb_build_object(
    'event_id', l.event_id,
    'device_serial', l.device_serial,
    'employee_id', l.employee_id,
    'score', l.score,
    'behaviors', l.behaviors,
    'event_type', l.event_type,
    'assigned_date', l.assigned_date,
    'reviewed_by', l.reviewed_by
  ) as source_data
FROM lytx_safety_events l
LEFT JOIN vehicles v ON UPPER(TRIM(l.vehicle_registration)) = UPPER(TRIM(v.registration))
INNER JOIN drivers d ON UPPER(TRIM(l.driver_name)) = UPPER(TRIM(d.full_name))
WHERE l.driver_name IS NOT NULL

UNION ALL

-- MTData trips (already have driver_id)
SELECT
  m.driver_id,
  d.full_name as driver_name,
  d.drivers_license,
  d.employee_id,
  m.vehicle_id,
  v.registration as vehicle_registration,
  v.fleet,
  v.depot,
  'mtdata' as source,
  m.id as event_id,
  m.start_time as occurred_at,
  'Trip' as event_type,
  'Low' as severity, -- Trips are not safety events
  m.start_latitude as latitude,
  m.start_longitude as longitude,
  m.average_speed_kph as speed_kph,
  m.travel_time_hours * 3600 as duration_seconds,
  true as verified,
  'Completed' as confirmation,
  -- Correlation metadata
  'direct_mtdata' as correlation_method,
  1.0 as correlation_confidence,
  -- Source-specific fields as JSONB
  jsonb_build_object(
    'trip_number', m.trip_number,
    'trip_external_id', m.trip_external_id,
    'end_time', m.end_time,
    'distance_km', m.distance_km,
    'start_location', m.start_location,
    'end_location', m.end_location,
    'idling_time_hours', m.idling_time_hours,
    'route_efficiency_score', m.route_efficiency_score,
    'odometer_reading', m.odometer_reading
  ) as source_data
FROM mtdata_trip_history m
LEFT JOIN vehicles v ON m.vehicle_id = v.id
INNER JOIN drivers d ON m.driver_id = d.id
WHERE m.driver_id IS NOT NULL

ORDER BY occurred_at DESC;

COMMENT ON VIEW driver_unified_timeline IS 'Unified timeline of all events (Guardian, LYTX, MTData) for drivers. Filter by driver_id to see everything for a driver.';

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Existing indexes should already cover most queries, but add a few more:

-- Guardian events by vehicle and time (for correlation)
CREATE INDEX IF NOT EXISTS idx_guardian_events_vehicle_time_corr
  ON guardian_events (vehicle_registration, detection_time)
  WHERE driver_name IS NULL OR driver_name = '';

-- LYTX events by vehicle and time (for correlation)
CREATE INDEX IF NOT EXISTS idx_lytx_events_vehicle_time_corr
  ON lytx_safety_events (vehicle_registration, event_datetime);

-- MTData trips by vehicle and timespan (for correlation)
CREATE INDEX IF NOT EXISTS idx_mtdata_trips_vehicle_timespan_corr
  ON mtdata_trip_history (vehicle_registration, start_time, end_time)
  WHERE driver_id IS NOT NULL;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT SELECT ON vehicle_unified_timeline TO authenticated;
GRANT SELECT ON driver_event_correlation TO authenticated;
GRANT SELECT ON driver_unified_timeline TO authenticated;

GRANT ALL ON vehicle_unified_timeline TO service_role;
GRANT ALL ON driver_event_correlation TO service_role;
GRANT ALL ON driver_unified_timeline TO service_role;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
DECLARE
  vehicle_event_count INTEGER;
  driver_event_count INTEGER;
  correlation_stats RECORD;
BEGIN
  -- Count events in unified timelines
  SELECT COUNT(*) INTO vehicle_event_count FROM vehicle_unified_timeline;
  SELECT COUNT(*) INTO driver_event_count FROM driver_unified_timeline;

  -- Get correlation stats
  SELECT
    COUNT(*) as total_correlations,
    COUNT(*) FILTER (WHERE correlation_method = 'direct_guardian') as direct,
    COUNT(*) FILTER (WHERE correlation_method = 'lytx_hourly') as lytx_hourly,
    COUNT(*) FILTER (WHERE correlation_method = 'mtdata_trip') as mtdata_trip,
    COUNT(*) FILTER (WHERE correlation_method = 'lytx_daily') as lytx_daily,
    ROUND(AVG(confidence), 2) as avg_confidence
  INTO correlation_stats
  FROM driver_event_correlation;

  RAISE NOTICE '';
  RAISE NOTICE '✓ Unified timeline views created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Views created:';
  RAISE NOTICE '  - vehicle_unified_timeline (% events across all sources)', vehicle_event_count;
  RAISE NOTICE '  - driver_event_correlation (% Guardian events correlated)', correlation_stats.total_correlations;
  RAISE NOTICE '  - driver_unified_timeline (% events across all sources)', driver_event_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Driver correlation breakdown:';
  RAISE NOTICE '  - Direct Guardian: %', correlation_stats.direct;
  RAISE NOTICE '  - LYTX Hourly: %', correlation_stats.lytx_hourly;
  RAISE NOTICE '  - MTData Trip: %', correlation_stats.mtdata_trip;
  RAISE NOTICE '  - LYTX Daily: %', correlation_stats.lytx_daily;
  RAISE NOTICE '  - Average confidence: %', correlation_stats.avg_confidence;
  RAISE NOTICE '';
  RAISE NOTICE 'Usage examples:';
  RAISE NOTICE '  -- See all events for a vehicle';
  RAISE NOTICE '  SELECT * FROM vehicle_unified_timeline WHERE vehicle_id = ''abc-123'' ORDER BY occurred_at DESC;';
  RAISE NOTICE '';
  RAISE NOTICE '  -- See all events for a driver';
  RAISE NOTICE '  SELECT * FROM driver_unified_timeline WHERE driver_id = ''123'' ORDER BY occurred_at DESC;';
  RAISE NOTICE '';
  RAISE NOTICE '  -- See how Guardian events were correlated to drivers';
  RAISE NOTICE '  SELECT * FROM driver_event_correlation ORDER BY confidence DESC LIMIT 100;';
  RAISE NOTICE '';
END $$;
