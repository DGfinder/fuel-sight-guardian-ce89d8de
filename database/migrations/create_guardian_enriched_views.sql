-- =====================================================
-- GUARDIAN ENRICHED VIEWS AND DRIVER SAFETY METRICS
-- =====================================================
-- Creates enriched views that enhance Guardian events with
-- driver attribution from vehicle assignments
-- Adds driver safety analytics and performance metrics
-- =====================================================

-- =====================================================
-- DROP EXISTING VIEWS IF THEY EXIST
-- =====================================================

DROP VIEW IF EXISTS guardian_events_enriched CASCADE;
DROP VIEW IF EXISTS driver_safety_metrics CASCADE;
DROP VIEW IF EXISTS guardian_driver_performance CASCADE;

-- =====================================================
-- GUARDIAN EVENTS ENRICHED VIEW
-- =====================================================
-- Enhances Guardian events with driver information
-- Works immediately with basic driver linking
-- Will auto-upgrade to use vehicle assignments when PHASE3 is run
-- =====================================================

CREATE OR REPLACE VIEW guardian_events_enriched AS
SELECT
  ge.id,
  ge.external_event_id,
  ge.vehicle_id as guardian_vehicle_id,
  ge.vehicle_registration,
  ge.detection_time,
  ge.utc_offset,
  ge.timezone,
  ge.latitude,
  ge.longitude,
  ge.event_type,
  ge.detected_event_type,
  ge.confirmation,
  ge.confirmation_time,
  ge.classification,
  ge.duration_seconds,
  ge.speed_kph,
  ge.travel_metres,
  ge.trip_distance_metres,
  ge.trip_time_seconds,
  ge.audio_alert,
  ge.vibration_alert,
  ge.fleet,
  ge.account,
  ge.service_provider,
  ge.shift_info,
  ge.crew,
  ge.guardian_unit,
  ge.software_version,
  ge.tags,
  ge.severity,
  ge.verified,
  ge.status,
  ge.depot,
  ge.raw_data,
  ge.import_batch_id,
  ge.created_at,
  ge.updated_at,

  -- Original driver information from Guardian CSV
  ge.driver_name as original_driver_name,
  ge.driver_id as original_driver_id,

  -- Enriched driver information (uses CSV data, will use assignments when PHASE3 run)
  ge.driver_id as enriched_driver_id,
  COALESCE(ge.driver_name, d.full_name) as enriched_driver_name,

  -- Vehicle information
  v.id as vehicle_id,
  v.fleet_number,
  v.make as vehicle_make,
  v.model as vehicle_model,
  v.vin,

  -- Driver information (from direct link only for now)
  d.id as driver_id,
  d.full_name as driver_full_name,
  d.drivers_license,
  d.phone as driver_phone,
  d.email as driver_email,

  -- Attribution metadata
  CASE
    WHEN ge.driver_id IS NOT NULL THEN 'direct'  -- Driver from Guardian CSV
    ELSE 'unknown'
  END as attribution_method,

  CASE
    WHEN ge.driver_id IS NOT NULL THEN 1.0  -- High confidence - from source data
    ELSE 0.0  -- No attribution
  END as attribution_confidence

FROM guardian_events ge
-- Join to vehicles table via registration
LEFT JOIN vehicles v ON UPPER(TRIM(ge.vehicle_registration)) = UPPER(TRIM(v.registration))
-- Join to drivers table (only direct links for now)
LEFT JOIN drivers d ON ge.driver_id = d.id;

COMMENT ON VIEW guardian_events_enriched IS 'Enriched Guardian events with driver attribution. Basic version - will auto-upgrade to use vehicle assignments when PHASE3 migration is run.';

-- =====================================================
-- DRIVER SAFETY METRICS VIEW
-- =====================================================
-- Aggregates safety metrics per driver from enriched events
-- Calculates event rates, verification rates, severity breakdown
-- =====================================================

CREATE OR REPLACE VIEW driver_safety_metrics AS
WITH driver_event_stats AS (
  SELECT
    enriched_driver_id as driver_id,
    enriched_driver_name as driver_name,
    fleet,

    -- Event counts by time period
    COUNT(*) FILTER (WHERE detection_time >= NOW() - INTERVAL '30 days') as events_30d,
    COUNT(*) FILTER (WHERE detection_time >= NOW() - INTERVAL '90 days') as events_90d,
    COUNT(*) as events_total,

    -- Event type breakdown (current month)
    COUNT(*) FILTER (
      WHERE detection_time >= DATE_TRUNC('month', NOW())
      AND event_type ILIKE '%distraction%'
    ) as distraction_events_month,
    COUNT(*) FILTER (
      WHERE detection_time >= DATE_TRUNC('month', NOW())
      AND (event_type ILIKE '%fatigue%' OR event_type ILIKE '%microsleep%')
    ) as fatigue_events_month,
    COUNT(*) FILTER (
      WHERE detection_time >= DATE_TRUNC('month', NOW())
      AND event_type ILIKE '%field of view%'
    ) as fov_events_month,

    -- Severity breakdown (current month)
    COUNT(*) FILTER (
      WHERE detection_time >= DATE_TRUNC('month', NOW())
      AND severity = 'Critical'
    ) as critical_events_month,
    COUNT(*) FILTER (
      WHERE detection_time >= DATE_TRUNC('month', NOW())
      AND severity = 'High'
    ) as high_events_month,

    -- Verification metrics (current month)
    COUNT(*) FILTER (
      WHERE detection_time >= DATE_TRUNC('month', NOW())
    ) as total_events_month,
    COUNT(*) FILTER (
      WHERE detection_time >= DATE_TRUNC('month', NOW())
      AND (verified = true OR confirmation = 'verified')
    ) as verified_events_month,

    -- Date range
    MIN(detection_time) as first_event,
    MAX(detection_time) as last_event,

    -- Average attribution confidence
    AVG(attribution_confidence) as avg_attribution_confidence

  FROM guardian_events_enriched
  WHERE enriched_driver_id IS NOT NULL
  GROUP BY enriched_driver_id, enriched_driver_name, fleet
)
SELECT
  des.*,

  -- Calculated metrics
  ROUND(
    (des.verified_events_month::DECIMAL / NULLIF(des.total_events_month, 0)) * 100,
    1
  ) as verification_rate_pct,

  EXTRACT(DAY FROM NOW() - des.first_event)::INTEGER as days_since_first_event,
  EXTRACT(DAY FROM NOW() - des.last_event)::INTEGER as days_since_last_event,

  -- Event rate per 30 days (for comparison)
  ROUND(
    des.events_30d::DECIMAL,
    1
  ) as event_rate_30d,

  -- Trend indicator (comparing last 30 days vs previous 30 days)
  CASE
    WHEN des.events_90d > 0 THEN
      ROUND(
        ((des.events_30d - (des.events_90d - des.events_30d) / 2.0) /
         NULLIF((des.events_90d - des.events_30d) / 2.0, 0)) * 100,
        1
      )
    ELSE NULL
  END as trend_pct,

  -- Risk classification based on current month events
  CASE
    WHEN des.total_events_month = 0 THEN 'No Events'
    WHEN des.critical_events_month > 2 OR des.high_events_month > 5 THEN 'High Risk'
    WHEN des.critical_events_month > 0 OR des.high_events_month > 2 THEN 'Medium Risk'
    ELSE 'Low Risk'
  END as risk_classification

FROM driver_event_stats des
ORDER BY des.events_30d DESC;

COMMENT ON VIEW driver_safety_metrics IS 'Aggregated safety metrics per driver including event counts, verification rates, severity breakdown, and risk classification.';

-- =====================================================
-- GUARDIAN DRIVER PERFORMANCE VIEW
-- =====================================================
-- Leaderboard-style view for driver safety performance
-- Includes rankings and percentiles
-- =====================================================

CREATE OR REPLACE VIEW guardian_driver_performance AS
WITH ranked_drivers AS (
  SELECT
    *,
    ROW_NUMBER() OVER (ORDER BY events_30d ASC) as safety_rank,
    PERCENT_RANK() OVER (ORDER BY events_30d ASC) as safety_percentile,
    COUNT(*) OVER () as total_drivers
  FROM driver_safety_metrics
  WHERE events_total > 0  -- Only drivers with events
)
SELECT
  rd.*,
  ROUND(rd.safety_percentile * 100, 0)::INTEGER as safety_percentile_pct,

  -- Performance category
  CASE
    WHEN rd.safety_percentile >= 0.90 THEN 'Excellent'
    WHEN rd.safety_percentile >= 0.70 THEN 'Good'
    WHEN rd.safety_percentile >= 0.40 THEN 'Average'
    WHEN rd.safety_percentile >= 0.20 THEN 'Below Average'
    ELSE 'Needs Improvement'
  END as performance_category

FROM ranked_drivers rd
ORDER BY rd.safety_rank ASC;

COMMENT ON VIEW guardian_driver_performance IS 'Driver performance leaderboard with rankings and percentiles for safety coaching and recognition.';

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes on base tables to improve view performance
CREATE INDEX IF NOT EXISTS idx_guardian_events_driver_time
  ON guardian_events (driver_id, detection_time DESC)
  WHERE driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guardian_events_vehicle_time
  ON guardian_events (vehicle_registration, detection_time);

CREATE INDEX IF NOT EXISTS idx_driver_vehicle_assignments_lookup
  ON driver_vehicle_assignments (vehicle_id, valid_from, valid_until)
  WHERE assignment_type = 'primary';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant SELECT on views to authenticated users
GRANT SELECT ON guardian_events_enriched TO authenticated;
GRANT SELECT ON driver_safety_metrics TO authenticated;
GRANT SELECT ON guardian_driver_performance TO authenticated;

-- Grant all permissions to service role
GRANT ALL ON guardian_events_enriched TO service_role;
GRANT ALL ON driver_safety_metrics TO service_role;
GRANT ALL ON guardian_driver_performance TO service_role;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✓ Guardian enriched views created successfully (BASIC VERSION)';
  RAISE NOTICE '  - guardian_events_enriched (driver attribution from CSV only)';
  RAISE NOTICE '  - driver_safety_metrics (aggregated driver metrics)';
  RAISE NOTICE '  - guardian_driver_performance (driver leaderboard)';
  RAISE NOTICE '';
  RAISE NOTICE 'NOTE: This is the basic version. To enable vehicle assignment inference:';
  RAISE NOTICE '  1. Run PHASE3 migration scripts (database/fixes/PHASE3_MASTER.sql)';
  RAISE NOTICE '  2. Then run the upgrade at the end of this file';
  RAISE NOTICE '';
  RAISE NOTICE 'Query examples:';
  RAISE NOTICE '  SELECT * FROM guardian_events_enriched LIMIT 10;';
  RAISE NOTICE '  SELECT * FROM driver_safety_metrics ORDER BY events_30d DESC LIMIT 10;';
  RAISE NOTICE '  SELECT * FROM guardian_driver_performance WHERE performance_category = ''Excellent'';';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- =====================================================
-- UPGRADE SCRIPT (RUN AFTER PHASE3)
-- =====================================================
-- =====================================================
--
-- ONLY RUN THIS SECTION AFTER YOU HAVE:
-- 1. Run database/fixes/PHASE3_MASTER.sql
-- 2. Confirmed driver_vehicle_assignments table exists
--
-- TO UPGRADE: Copy lines below and run separately
--
-- =====================================================

/*

-- CHECK IF PHASE3 IS READY
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'driver_vehicle_assignments') THEN
    RAISE EXCEPTION 'driver_vehicle_assignments table does not exist. Run PHASE3 migration first!';
  END IF;
  RAISE NOTICE 'PHASE3 detected - upgrading guardian_events_enriched view...';
END $$;

-- UPGRADE GUARDIAN_EVENTS_ENRICHED VIEW
CREATE OR REPLACE VIEW guardian_events_enriched AS
SELECT
  ge.id,
  ge.external_event_id,
  ge.vehicle_id as guardian_vehicle_id,
  ge.vehicle_registration,
  ge.detection_time,
  ge.utc_offset,
  ge.timezone,
  ge.latitude,
  ge.longitude,
  ge.event_type,
  ge.detected_event_type,
  ge.confirmation,
  ge.confirmation_time,
  ge.classification,
  ge.duration_seconds,
  ge.speed_kph,
  ge.travel_metres,
  ge.trip_distance_metres,
  ge.trip_time_seconds,
  ge.audio_alert,
  ge.vibration_alert,
  ge.fleet,
  ge.account,
  ge.service_provider,
  ge.shift_info,
  ge.crew,
  ge.guardian_unit,
  ge.software_version,
  ge.tags,
  ge.severity,
  ge.verified,
  ge.status,
  ge.depot,
  ge.raw_data,
  ge.import_batch_id,
  ge.created_at,
  ge.updated_at,

  -- Original driver information from Guardian CSV
  ge.driver_name as original_driver_name,
  ge.driver_id as original_driver_id,

  -- UPGRADED: Enriched driver information (from event OR vehicle assignment)
  COALESCE(ge.driver_id, dva.driver_id) as enriched_driver_id,
  COALESCE(ge.driver_name, d.full_name) as enriched_driver_name,

  -- Driver assignment metadata (NEW)
  dva.id as assignment_id,
  dva.assignment_type,
  dva.confidence_score as assignment_confidence,
  dva.source as assignment_source,
  dva.valid_from as assignment_start,
  dva.valid_until as assignment_end,

  -- Vehicle information
  v.id as vehicle_id,
  v.fleet_number,
  v.make as vehicle_make,
  v.model as vehicle_model,
  v.vin,

  -- Driver information
  d.id as driver_id,
  d.full_name as driver_full_name,
  d.drivers_license,
  d.phone as driver_phone,
  d.email as driver_email,

  -- UPGRADED: Attribution metadata with inference support
  CASE
    WHEN ge.driver_id IS NOT NULL THEN 'direct'  -- Driver from Guardian CSV
    WHEN dva.driver_id IS NOT NULL THEN 'inferred'  -- Driver from vehicle assignment
    ELSE 'unknown'
  END as attribution_method,

  CASE
    WHEN ge.driver_id IS NOT NULL THEN 1.0  -- High confidence - from source data
    WHEN dva.driver_id IS NOT NULL THEN COALESCE(dva.confidence_score, 0.75)  -- Medium confidence - inferred
    ELSE 0.0  -- No attribution
  END as attribution_confidence

FROM guardian_events ge
-- Join to vehicles table via registration
LEFT JOIN vehicles v ON UPPER(TRIM(ge.vehicle_registration)) = UPPER(TRIM(v.registration))
-- UPGRADED: Join to driver-vehicle assignments active at event time
LEFT JOIN driver_vehicle_assignments dva ON
  dva.vehicle_id = v.id
  AND ge.detection_time >= dva.valid_from
  AND (dva.valid_until IS NULL OR ge.detection_time <= dva.valid_until)
  AND dva.assignment_type = 'primary'  -- Prioritize primary assignments
-- Join to drivers table
LEFT JOIN drivers d ON COALESCE(ge.driver_id, dva.driver_id) = d.id;

COMMENT ON VIEW guardian_events_enriched IS 'Enriched Guardian events with driver attribution from both direct CSV data and vehicle assignments (UPGRADED). Includes confidence scoring for attribution quality.';

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✓ guardian_events_enriched UPGRADED successfully!';
  RAISE NOTICE '  - Now includes driver inference from vehicle assignments';
  RAISE NOTICE '  - attribution_method can now be: direct, inferred, or unknown';
  RAISE NOTICE '  - Confidence scores reflect assignment quality';
  RAISE NOTICE '';
  RAISE NOTICE 'Test upgraded attribution:';
  RAISE NOTICE '  SELECT attribution_method, COUNT(*) FROM guardian_events_enriched GROUP BY attribution_method;';
  RAISE NOTICE '';
END $$;

*/
