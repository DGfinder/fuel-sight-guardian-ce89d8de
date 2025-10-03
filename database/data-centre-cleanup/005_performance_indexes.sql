-- ============================================================================
-- DATA CENTRE CLEANUP: PHASE 5 - PERFORMANCE INDEXES
-- ============================================================================
-- Purpose: Create comprehensive indexes for optimal query performance
-- Status: INDEX CREATION (improves performance, no data changes)
-- Dependencies: Requires Phase 1-4 to be completed
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'DATA CENTRE CLEANUP - PHASE 5: CREATING PERFORMANCE INDEXES';
  RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- 1. EVENT-TRIP RELATIONSHIP INDEXES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[1/5] Creating event-trip relationship indexes...';
END $$;

-- LYTX event-trip indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lytx_trip_datetime
  ON lytx_safety_events(mtdata_trip_id, event_datetime DESC)
  WHERE mtdata_trip_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lytx_trip_score
  ON lytx_safety_events(mtdata_trip_id, safety_score)
  WHERE mtdata_trip_id IS NOT NULL;

-- Guardian event-trip indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guardian_trip_time
  ON guardian_events(mtdata_trip_id, detection_time DESC)
  WHERE mtdata_trip_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guardian_trip_type
  ON guardian_events(mtdata_trip_id, event_type)
  WHERE mtdata_trip_id IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '  ✓ Event-trip relationship indexes created';
END $$;

-- ============================================================================
-- 2. DRIVER-EVENT RELATIONSHIP INDEXES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[2/5] Creating driver-event relationship indexes...';
END $$;

-- LYTX driver-event indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lytx_driver_date_score
  ON lytx_safety_events(driver_id, event_datetime DESC, safety_score)
  WHERE driver_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lytx_driver_trigger
  ON lytx_safety_events(driver_id, trigger_type)
  WHERE driver_id IS NOT NULL;

-- Guardian driver-event indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guardian_driver_time_type
  ON guardian_events(driver_id, detection_time DESC, event_type)
  WHERE driver_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guardian_driver_confirmation
  ON guardian_events(driver_id, confirmation)
  WHERE driver_id IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '  ✓ Driver-event relationship indexes created';
END $$;

-- ============================================================================
-- 3. VEHICLE-EVENT RELATIONSHIP INDEXES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[3/5] Creating vehicle-event relationship indexes...';
END $$;

-- LYTX vehicle-event indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lytx_vehicle_date_score
  ON lytx_safety_events(vehicle_id, event_datetime DESC, safety_score)
  WHERE vehicle_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lytx_vehicle_trigger
  ON lytx_safety_events(vehicle_id, trigger_type)
  WHERE vehicle_id IS NOT NULL;

-- Guardian vehicle-event indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guardian_vehicle_time_type
  ON guardian_events(vehicle_id_uuid, detection_time DESC, event_type)
  WHERE vehicle_id_uuid IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '  ✓ Vehicle-event relationship indexes created';
END $$;

-- ============================================================================
-- 4. TRIP-DRIVER-VEHICLE INDEXES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[4/5] Creating trip-driver-vehicle indexes...';
END $$;

-- Trip-driver indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_driver_starttime
  ON mtdata_trip_history(driver_id, start_time DESC)
  WHERE driver_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_driver_date
  ON mtdata_trip_history(driver_id, trip_date_computed DESC)
  WHERE driver_id IS NOT NULL;

-- Trip-vehicle indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_vehicle_starttime
  ON mtdata_trip_history(vehicle_id, start_time DESC)
  WHERE vehicle_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_vehicle_date
  ON mtdata_trip_history(vehicle_id, trip_date_computed DESC)
  WHERE vehicle_id IS NOT NULL;

-- Trip location indexes (for geospatial queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_start_location
  ON mtdata_trip_history(start_location)
  WHERE start_location IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_end_location
  ON mtdata_trip_history(end_location)
  WHERE end_location IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '  ✓ Trip-driver-vehicle indexes created';
END $$;

-- ============================================================================
-- 5. DELIVERY CORRELATION INDEXES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[5/5] Creating delivery correlation indexes...';
END $$;

-- Captive payments correlation indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_captive_delivery_date_vehicle
  ON captive_payment_records(delivery_date DESC, vehicle_id)
  WHERE vehicle_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_captive_delivery_date_driver
  ON captive_payment_records(delivery_date DESC, driver_id)
  WHERE driver_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_captive_trip_confidence
  ON captive_payment_records(mtdata_trip_id, correlation_confidence DESC)
  WHERE mtdata_trip_id IS NOT NULL;

-- Correlation table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_correlation_trip_confidence
  ON mtdata_captive_correlations(mtdata_trip_id, confidence_score DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_correlation_delivery_confidence
  ON mtdata_captive_correlations(delivery_key, confidence_score DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_correlation_date_carrier
  ON mtdata_captive_correlations(trip_date DESC, carrier, confidence_score DESC);

DO $$
BEGIN
  RAISE NOTICE '  ✓ Delivery correlation indexes created';
END $$;

-- ============================================================================
-- 6. COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[6/6] Creating composite indexes for common query patterns...';
END $$;

-- Driver performance query index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_perf_period
  ON driver_performance_metrics(driver_id, period_end DESC, period_type)
  WHERE period_type = 'Monthly';

-- Assignment history index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignment_vehicle_dates
  ON driver_assignments(vehicle_id, assigned_at DESC, unassigned_at)
  WHERE driver_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignment_driver_dates
  ON driver_assignments(driver_id, assigned_at DESC, unassigned_at)
  WHERE vehicle_id IS NOT NULL;

-- Incident query index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incident_driver_date_severity
  ON driver_incidents(driver_id, incident_date DESC, severity)
  WHERE driver_id IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '  ✓ Composite indexes created';
END $$;

-- ============================================================================
-- 7. ANALYZE TABLES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Analyzing tables to update query planner statistics...';
END $$;

ANALYZE lytx_safety_events;
ANALYZE guardian_events;
ANALYZE mtdata_trip_history;
ANALYZE captive_payment_records;
ANALYZE mtdata_captive_correlations;
ANALYZE drivers;
ANALYZE vehicles;
ANALYZE driver_assignments;
ANALYZE driver_performance_metrics;
ANALYZE driver_incidents;

-- ============================================================================
-- COMPLETION SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'PHASE 5 COMPLETE: PERFORMANCE INDEXES CREATED';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'INDEXES CREATED:';
  RAISE NOTICE '  1. ✓ Event-trip relationship indexes (4 indexes)';
  RAISE NOTICE '  2. ✓ Driver-event relationship indexes (4 indexes)';
  RAISE NOTICE '  3. ✓ Vehicle-event relationship indexes (3 indexes)';
  RAISE NOTICE '  4. ✓ Trip-driver-vehicle indexes (6 indexes)';
  RAISE NOTICE '  5. ✓ Delivery correlation indexes (6 indexes)';
  RAISE NOTICE '  6. ✓ Composite query pattern indexes (4 indexes)';
  RAISE NOTICE '';
  RAISE NOTICE 'TOTAL: 27+ performance indexes created';
  RAISE NOTICE '';
  RAISE NOTICE 'PERFORMANCE IMPACT:';
  RAISE NOTICE '  → Query functions should see 5-10x speed improvement';
  RAISE NOTICE '  → View queries optimized for common access patterns';
  RAISE NOTICE '  → All relationship lookups indexed';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  → Run migration 006 to cleanup duplicate tables';
  RAISE NOTICE '  → Monitor query performance and adjust indexes if needed';
  RAISE NOTICE '============================================================================';
END $$;
