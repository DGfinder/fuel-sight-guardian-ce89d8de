-- ============================================================================
-- DATA CENTRE CLEANUP: PHASE 4 - RELATIONSHIP VIEWS
-- ============================================================================
-- Purpose: Create views that expose relationships between entities
-- Status: VIEW CREATION (read-only, no data changes)
-- Dependencies: Requires Phase 1, 2, 3 to be completed
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'DATA CENTRE CLEANUP - PHASE 4: CREATING RELATIONSHIP VIEWS';
  RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- 1. UNIFIED_EVENT_TIMELINE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[1/3] Creating unified_event_timeline view...';
END $$;

DROP VIEW IF EXISTS unified_event_timeline CASCADE;

CREATE OR REPLACE VIEW unified_event_timeline AS
-- LYTX Events
SELECT
  'lytx' as source,
  le.event_id::TEXT as event_id,
  le.event_datetime as occurred_at,
  le.driver_id,
  COALESCE(d.first_name || ' ' || d.last_name, le.driver_name) as driver_name,
  le.vehicle_id,
  COALESCE(v.registration, le.vehicle) as vehicle_registration,
  le.safety_score::DECIMAL as severity_score,
  le.mtdata_trip_id,
  ('LYTX: ' || le.trigger_type) as description,
  le.status,
  json_build_object(
    'trigger_type', le.trigger_type,
    'behaviors', le.behaviors,
    'device', le.device,
    'employee_id', le.employee_id
  ) as metadata
FROM lytx_safety_events le
LEFT JOIN drivers d ON le.driver_id = d.id
LEFT JOIN vehicles v ON le.vehicle_id = v.id

UNION ALL

-- Guardian Events
SELECT
  'guardian',
  ge.event_id::TEXT,
  ge.detection_time,
  ge.driver_id,
  COALESCE(d.first_name || ' ' || d.last_name, ge.driver) as driver_name,
  ge.vehicle_id_uuid,
  COALESCE(v.registration, ge.vehicle) as vehicle_registration,
  CASE ge.event_type
    WHEN 'distraction' THEN 7.0
    WHEN 'fatigue' THEN 5.0
    ELSE 6.0
  END as severity_score,
  ge.mtdata_trip_id,
  ('Guardian: ' || ge.event_type || ' - ' || COALESCE(ge.detected_event_type, 'unspecified')) as description,
  ge.confirmation as status,
  json_build_object(
    'event_type', ge.event_type,
    'detected_event_type', ge.detected_event_type,
    'confirmation', ge.confirmation,
    'classification', ge.classification,
    'duration_seconds', ge.duration_seconds,
    'speed_kph', ge.speed_kph,
    'guardian_unit', ge.guardian_unit
  ) as metadata
FROM guardian_events ge
LEFT JOIN drivers d ON ge.driver_id = d.id
LEFT JOIN vehicles v ON ge.vehicle_id_uuid = v.id

ORDER BY occurred_at DESC;

COMMENT ON VIEW unified_event_timeline IS 'Combined timeline of all safety events from LYTX and Guardian systems';

GRANT SELECT ON unified_event_timeline TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '  ✓ unified_event_timeline created successfully';
END $$;

-- ============================================================================
-- 2. DRIVER_VEHICLE_TRIP_DELIVERY_RELATIONSHIPS (DVTD)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[2/3] Creating dvtd_relationships view...';
END $$;

DROP VIEW IF EXISTS dvtd_relationships CASCADE;

CREATE OR REPLACE VIEW dvtd_relationships AS
SELECT
  -- Trip identification
  th.id as trip_id,
  th.trip_external_id,
  th.trip_date_computed as trip_date,

  -- Vehicle information
  th.vehicle_id,
  v.registration as vehicle_registration,
  v.fleet as vehicle_fleet,
  v.depot as vehicle_depot,

  -- Driver information
  th.driver_id,
  COALESCE(d.first_name || ' ' || d.last_name, th.driver_name) as driver_name,
  d.employee_id,

  -- Trip details
  th.start_time,
  th.end_time,
  th.distance_km,
  th.travel_time_hours,
  th.start_location,
  th.end_location,

  -- Delivery correlation (best match)
  mcc.delivery_key,
  mcc.bill_of_lading,
  mcc.customer_name,
  mcc.terminal_name,
  mcc.carrier,
  mcc.delivery_volume_litres,
  mcc.confidence_score as correlation_confidence,
  mcc.match_type as correlation_method,

  -- Event counts
  COUNT(DISTINCT le.id) as lytx_event_count,
  COUNT(DISTINCT ge.id) as guardian_event_count,
  COUNT(DISTINCT le.id) + COUNT(DISTINCT ge.id) as total_event_count,

  -- Safety metrics
  ROUND(AVG(le.safety_score), 2) as avg_lytx_safety_score,

  -- Delivery correlation quality
  CASE
    WHEN mcc.confidence_score >= 90 THEN 'very_high'
    WHEN mcc.confidence_score >= 75 THEN 'high'
    WHEN mcc.confidence_score >= 60 THEN 'medium'
    WHEN mcc.confidence_score >= 40 THEN 'low'
    ELSE 'very_low'
  END as correlation_quality

FROM mtdata_trip_history th
LEFT JOIN vehicles v ON th.vehicle_id = v.id
LEFT JOIN drivers d ON th.driver_id = d.id
LEFT JOIN LATERAL (
  -- Get best correlation per trip
  SELECT *
  FROM mtdata_captive_correlations
  WHERE mtdata_trip_id = th.id
  ORDER BY confidence_score DESC
  LIMIT 1
) mcc ON true
LEFT JOIN lytx_safety_events le ON th.id = le.mtdata_trip_id
LEFT JOIN guardian_events ge ON th.id = ge.mtdata_trip_id

GROUP BY
  th.id, th.trip_external_id, th.trip_date_computed, th.vehicle_id, v.registration,
  v.fleet, v.depot, th.driver_id, d.first_name, d.last_name, th.driver_name,
  d.employee_id, th.start_time, th.end_time, th.distance_km, th.travel_time_hours,
  th.start_location, th.end_location, mcc.delivery_key, mcc.bill_of_lading,
  mcc.customer_name, mcc.terminal_name, mcc.carrier, mcc.delivery_volume_litres,
  mcc.confidence_score, mcc.match_type

ORDER BY th.start_time DESC;

COMMENT ON VIEW dvtd_relationships IS 'Driver-Vehicle-Trip-Delivery relationships with event counts and correlation quality';

GRANT SELECT ON dvtd_relationships TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '  ✓ dvtd_relationships created successfully';
END $$;

-- ============================================================================
-- 3. DATA_QUALITY_DASHBOARD
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[3/3] Creating data_quality_dashboard view...';
END $$;

DROP VIEW IF EXISTS data_quality_dashboard CASCADE;

CREATE OR REPLACE VIEW data_quality_dashboard AS
SELECT
  -- Overall statistics
  'Summary' as category,
  'Total Records' as metric,
  (
    SELECT COUNT(*) FROM drivers
  ) + (
    SELECT COUNT(*) FROM vehicles
  ) + (
    SELECT COUNT(*) FROM mtdata_trip_history
  ) + (
    SELECT COUNT(*) FROM lytx_safety_events
  ) + (
    SELECT COUNT(*) FROM guardian_events
  ) + (
    SELECT COUNT(*) FROM captive_payment_records
  ) as value,
  '' as details

UNION ALL

-- Driver relationship quality
SELECT
  'Drivers',
  'Total Drivers',
  COUNT(*),
  json_build_object(
    'active', COUNT(*) FILTER (WHERE status = 'Active'),
    'with_name_mappings', COUNT(DISTINCT dnm.driver_id)
  )::TEXT
FROM drivers d
LEFT JOIN driver_name_mappings dnm ON d.id = dnm.driver_id

UNION ALL

-- Vehicle relationship quality
SELECT
  'Vehicles',
  'Total Vehicles',
  COUNT(*),
  json_build_object(
    'active', COUNT(*) FILTER (WHERE status = 'Active'),
    'with_current_driver', COUNT(*) FILTER (WHERE da.id IS NOT NULL),
    'with_devices', COUNT(*) FILTER (WHERE guardian_unit IS NOT NULL OR lytx_device IS NOT NULL)
  )::TEXT
FROM vehicles v
LEFT JOIN driver_assignments da ON v.id = da.vehicle_id AND da.unassigned_at IS NULL

UNION ALL

-- Trip correlation quality
SELECT
  'Trips',
  'Total Trips',
  COUNT(*),
  json_build_object(
    'with_driver', COUNT(*) FILTER (WHERE driver_id IS NOT NULL),
    'with_vehicle', COUNT(*) FILTER (WHERE vehicle_id IS NOT NULL),
    'with_delivery', COUNT(DISTINCT mcc.mtdata_trip_id)
  )::TEXT
FROM mtdata_trip_history th
LEFT JOIN mtdata_captive_correlations mcc ON th.id = mcc.mtdata_trip_id

UNION ALL

-- LYTX event quality
SELECT
  'LYTX Events',
  'Total Events',
  COUNT(*),
  json_build_object(
    'with_driver', COUNT(*) FILTER (WHERE driver_id IS NOT NULL),
    'with_vehicle', COUNT(*) FILTER (WHERE vehicle_id IS NOT NULL),
    'with_trip', COUNT(*) FILTER (WHERE mtdata_trip_id IS NOT NULL),
    'driver_match_rate', ROUND((COUNT(*) FILTER (WHERE driver_id IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2),
    'vehicle_match_rate', ROUND((COUNT(*) FILTER (WHERE vehicle_id IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2)
  )::TEXT
FROM lytx_safety_events

UNION ALL

-- Guardian event quality
SELECT
  'Guardian Events',
  'Total Events',
  COUNT(*),
  json_build_object(
    'with_driver', COUNT(*) FILTER (WHERE driver_id IS NOT NULL),
    'with_vehicle', COUNT(*) FILTER (WHERE vehicle_id_uuid IS NOT NULL),
    'with_trip', COUNT(*) FILTER (WHERE mtdata_trip_id IS NOT NULL),
    'driver_match_rate', ROUND((COUNT(*) FILTER (WHERE driver_id IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2),
    'vehicle_match_rate', ROUND((COUNT(*) FILTER (WHERE vehicle_id_uuid IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2)
  )::TEXT
FROM guardian_events

UNION ALL

-- Delivery correlation quality
SELECT
  'Deliveries',
  'Total Deliveries',
  COUNT(DISTINCT delivery_key),
  json_build_object(
    'total_records', COUNT(*),
    'with_trip', COUNT(*) FILTER (WHERE mtdata_trip_id IS NOT NULL),
    'with_vehicle', COUNT(*) FILTER (WHERE vehicle_id IS NOT NULL),
    'with_driver', COUNT(*) FILTER (WHERE driver_id IS NOT NULL),
    'correlation_rate', ROUND((COUNT(*) FILTER (WHERE mtdata_trip_id IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2)
  )::TEXT
FROM captive_payment_records

UNION ALL

-- Correlation quality distribution
SELECT
  'Correlations',
  'High Confidence (≥70%)',
  COUNT(*),
  json_build_object(
    'avg_confidence', ROUND(AVG(confidence_score), 2),
    'match_types', json_object_agg(match_type, type_count)
  )::TEXT
FROM mtdata_captive_correlations mcc
LEFT JOIN (
  SELECT match_type, COUNT(*) as type_count
  FROM mtdata_captive_correlations
  WHERE confidence_score >= 70
  GROUP BY match_type
) match_counts ON true
WHERE mcc.confidence_score >= 70

ORDER BY category, metric;

COMMENT ON VIEW data_quality_dashboard IS 'Data quality metrics and relationship health dashboard';

GRANT SELECT ON data_quality_dashboard TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '  ✓ data_quality_dashboard created successfully';
END $$;

-- ============================================================================
-- COMPLETION SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'PHASE 4 COMPLETE: RELATIONSHIP VIEWS CREATED';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'VIEWS CREATED:';
  RAISE NOTICE '  1. ✓ unified_event_timeline - All safety events in chronological order';
  RAISE NOTICE '  2. ✓ dvtd_relationships - Driver-Vehicle-Trip-Delivery relationships';
  RAISE NOTICE '  3. ✓ data_quality_dashboard - Data quality metrics';
  RAISE NOTICE '';
  RAISE NOTICE 'USAGE EXAMPLES:';
  RAISE NOTICE '  SELECT * FROM unified_event_timeline WHERE driver_id = ''<uuid>'' LIMIT 10;';
  RAISE NOTICE '  SELECT * FROM dvtd_relationships WHERE correlation_quality = ''high'';';
  RAISE NOTICE '  SELECT * FROM data_quality_dashboard;';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  → Run migration 005 to create performance indexes';
  RAISE NOTICE '  → Query views to verify data relationships';
  RAISE NOTICE '============================================================================';
END $$;
