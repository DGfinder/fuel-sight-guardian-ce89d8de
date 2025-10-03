-- ============================================================================
-- DATA CENTRE CLEANUP: PHASE 2 - POPULATE RELATIONSHIP DATA
-- ============================================================================
-- Purpose: Populate foreign key relationships using text-based matching
-- Status: DATA MIGRATION (updates existing records)
-- Dependencies: Requires Phase 1 (001_add_foreign_keys.sql) to be completed
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'DATA CENTRE CLEANUP - PHASE 2: POPULATING RELATIONSHIPS';
  RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- 1. POPULATE LYTX_SAFETY_EVENTS.VEHICLE_ID
-- ============================================================================

DO $$
DECLARE
  v_matched_count INTEGER;
  v_total_count INTEGER;
  v_match_rate DECIMAL(5,2);
BEGIN
  RAISE NOTICE '[1/4] Populating lytx_safety_events.vehicle_id...';

  -- Count total events
  SELECT COUNT(*) INTO v_total_count FROM lytx_safety_events WHERE vehicle_id IS NULL;

  -- Strategy 1: Match by LYTX device ID
  WITH device_matches AS (
    SELECT
      le.id as event_id,
      v.id as vehicle_id,
      1.0 as confidence,
      'device_match' as method
    FROM lytx_safety_events le
    JOIN vehicles v ON le.device = v.lytx_device
    WHERE le.vehicle_id IS NULL
      AND le.device IS NOT NULL
      AND v.lytx_device IS NOT NULL
  )
  UPDATE lytx_safety_events le
  SET
    vehicle_id = dm.vehicle_id,
    vehicle_association_confidence = dm.confidence,
    vehicle_association_method = dm.method,
    vehicle_association_updated_at = NOW()
  FROM device_matches dm
  WHERE le.id = dm.event_id;

  GET DIAGNOSTICS v_matched_count = ROW_COUNT;
  RAISE NOTICE '  ✓ Matched % events by LYTX device ID', v_matched_count;

  -- Strategy 2: Match by vehicle registration (exact)
  WITH registration_matches AS (
    SELECT
      le.id as event_id,
      v.id as vehicle_id,
      0.95 as confidence,
      'exact_match' as method
    FROM lytx_safety_events le
    JOIN vehicles v ON UPPER(TRIM(le.vehicle)) = UPPER(TRIM(v.registration))
    WHERE le.vehicle_id IS NULL
      AND le.vehicle IS NOT NULL
      AND v.registration IS NOT NULL
  )
  UPDATE lytx_safety_events le
  SET
    vehicle_id = rm.vehicle_id,
    vehicle_association_confidence = rm.confidence,
    vehicle_association_method = rm.method,
    vehicle_association_updated_at = NOW()
  FROM registration_matches rm
  WHERE le.id = rm.event_id;

  GET DIAGNOSTICS v_matched_count = ROW_COUNT;
  RAISE NOTICE '  ✓ Matched % events by vehicle registration (exact)', v_matched_count;

  -- Calculate match rate
  SELECT
    COUNT(*) FILTER (WHERE vehicle_id IS NOT NULL),
    COUNT(*),
    ROUND((COUNT(*) FILTER (WHERE vehicle_id IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2)
  INTO v_matched_count, v_total_count, v_match_rate
  FROM lytx_safety_events;

  RAISE NOTICE '  → Total LYTX events: %, Matched: %, Rate: %%',
    v_total_count, v_matched_count, v_match_rate;
  RAISE NOTICE '  ✓ LYTX vehicle_id population complete';
END $$;

-- ============================================================================
-- 2. POPULATE GUARDIAN_EVENTS.VEHICLE_ID_UUID
-- ============================================================================

DO $$
DECLARE
  v_matched_count INTEGER;
  v_total_count INTEGER;
  v_match_rate DECIMAL(5,2);
BEGIN
  RAISE NOTICE '[2/4] Populating guardian_events.vehicle_id_uuid...';

  -- Count total events
  SELECT COUNT(*) INTO v_total_count FROM guardian_events WHERE vehicle_id_uuid IS NULL;

  -- Strategy 1: Match by Guardian unit serial number
  WITH unit_matches AS (
    SELECT
      ge.id as event_id,
      v.id as vehicle_id,
      1.0 as confidence,
      'unit_serial_match' as method
    FROM guardian_events ge
    JOIN vehicles v ON ge.guardian_unit = v.guardian_unit
    WHERE ge.vehicle_id_uuid IS NULL
      AND ge.guardian_unit IS NOT NULL
      AND v.guardian_unit IS NOT NULL
  )
  UPDATE guardian_events ge
  SET
    vehicle_id_uuid = um.vehicle_id,
    vehicle_association_confidence = um.confidence,
    vehicle_association_method = um.method,
    vehicle_association_updated_at = NOW()
  FROM unit_matches um
  WHERE ge.id = um.event_id;

  GET DIAGNOSTICS v_matched_count = ROW_COUNT;
  RAISE NOTICE '  ✓ Matched % events by Guardian unit serial', v_matched_count;

  -- Strategy 2: Match by vehicle registration text (exact)
  WITH registration_matches AS (
    SELECT
      ge.id as event_id,
      v.id as vehicle_id,
      0.95 as confidence,
      'exact_match' as method
    FROM guardian_events ge
    JOIN vehicles v ON UPPER(TRIM(ge.vehicle)) = UPPER(TRIM(v.registration))
    WHERE ge.vehicle_id_uuid IS NULL
      AND ge.vehicle IS NOT NULL
      AND v.registration IS NOT NULL
  )
  UPDATE guardian_events ge
  SET
    vehicle_id_uuid = rm.vehicle_id,
    vehicle_association_confidence = rm.confidence,
    vehicle_association_method = rm.method,
    vehicle_association_updated_at = NOW()
  FROM registration_matches rm
  WHERE ge.id = rm.event_id;

  GET DIAGNOSTICS v_matched_count = ROW_COUNT;
  RAISE NOTICE '  ✓ Matched % events by vehicle registration (exact)', v_matched_count;

  -- Calculate match rate
  SELECT
    COUNT(*) FILTER (WHERE vehicle_id_uuid IS NOT NULL),
    COUNT(*),
    ROUND((COUNT(*) FILTER (WHERE vehicle_id_uuid IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2)
  INTO v_matched_count, v_total_count, v_match_rate
  FROM guardian_events;

  RAISE NOTICE '  → Total Guardian events: %, Matched: %, Rate: %%',
    v_total_count, v_matched_count, v_match_rate;
  RAISE NOTICE '  ✓ Guardian vehicle_id_uuid population complete';
END $$;

-- ============================================================================
-- 3. POPULATE CAPTIVE_PAYMENT_RECORDS CORRELATIONS
-- ============================================================================

DO $$
DECLARE
  v_matched_count INTEGER;
  v_total_deliveries INTEGER;
  v_match_rate DECIMAL(5,2);
BEGIN
  RAISE NOTICE '[3/4] Populating captive_payment_records correlations via mtdata_captive_correlations...';

  -- Count total deliveries
  SELECT COUNT(DISTINCT delivery_key) INTO v_total_deliveries FROM captive_deliveries;

  -- Populate from high-confidence correlations
  WITH correlation_data AS (
    SELECT DISTINCT ON (cd.bill_of_lading, cd.delivery_date, cd.customer)
      cpr.id as payment_record_id,
      th.vehicle_id,
      th.driver_id,
      mcc.mtdata_trip_id,
      mcc.confidence_score,
      mcc.match_type::TEXT as correlation_method
    FROM captive_payment_records cpr
    JOIN captive_deliveries cd ON
      cpr.bill_of_lading = cd.bill_of_lading
      AND cpr.delivery_date = cd.delivery_date
      AND cpr.customer = cd.customer
    JOIN mtdata_captive_correlations mcc ON cd.delivery_key = mcc.delivery_key
    JOIN mtdata_trip_history th ON mcc.mtdata_trip_id = th.id
    WHERE cpr.vehicle_id IS NULL
      AND mcc.confidence_score >= 60  -- Minimum 60% confidence
      AND mcc.is_potential_match = TRUE
    ORDER BY cd.bill_of_lading, cd.delivery_date, cd.customer, mcc.confidence_score DESC
  )
  UPDATE captive_payment_records cpr
  SET
    vehicle_id = cd.vehicle_id,
    driver_id = cd.driver_id,
    mtdata_trip_id = cd.mtdata_trip_id,
    correlation_confidence = cd.confidence_score,
    correlation_method = cd.correlation_method,
    correlation_updated_at = NOW()
  FROM correlation_data cd
  WHERE cpr.id = cd.payment_record_id;

  GET DIAGNOSTICS v_matched_count = ROW_COUNT;
  RAISE NOTICE '  ✓ Correlated % payment records to trips/vehicles/drivers', v_matched_count;

  -- Calculate correlation statistics
  WITH stats AS (
    SELECT
      COUNT(DISTINCT bill_of_lading || '-' || delivery_date || '-' || customer) as correlated_deliveries,
      COUNT(DISTINCT vehicle_id) as unique_vehicles,
      COUNT(DISTINCT driver_id) as unique_drivers,
      COUNT(DISTINCT mtdata_trip_id) as unique_trips,
      ROUND(AVG(correlation_confidence), 2) as avg_confidence
    FROM captive_payment_records
    WHERE vehicle_id IS NOT NULL
  )
  SELECT * INTO v_matched_count, v_total_deliveries
  FROM stats
  LIMIT 1;

  RAISE NOTICE '  → Deliveries correlated: %', v_matched_count;
  RAISE NOTICE '  → Unique vehicles: % | Unique drivers: % | Unique trips: %',
    (SELECT unique_vehicles FROM stats),
    (SELECT unique_drivers FROM stats),
    (SELECT unique_trips FROM stats);
  RAISE NOTICE '  → Average confidence: %', (SELECT avg_confidence FROM stats);
  RAISE NOTICE '  ✓ Captive payments correlation complete';
END $$;

-- ============================================================================
-- 4. CREATE RELATIONSHIP QUALITY REPORT
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[4/4] Generating relationship quality report...';
END $$;

-- Create temporary report view
DROP VIEW IF EXISTS relationship_quality_report CASCADE;
CREATE TEMP VIEW relationship_quality_report AS
SELECT
  'LYTX Safety Events' as data_source,
  COUNT(*) as total_records,
  COUNT(vehicle_id) as vehicle_matched,
  COUNT(driver_id) as driver_matched,
  COUNT(mtdata_trip_id) as trip_matched,
  ROUND((COUNT(vehicle_id)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2) as vehicle_match_rate,
  ROUND((COUNT(driver_id)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2) as driver_match_rate,
  ROUND((COUNT(mtdata_trip_id)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2) as trip_match_rate
FROM lytx_safety_events

UNION ALL

SELECT
  'Guardian Events',
  COUNT(*),
  COUNT(vehicle_id_uuid),
  COUNT(driver_id),
  COUNT(mtdata_trip_id),
  ROUND((COUNT(vehicle_id_uuid)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2),
  ROUND((COUNT(driver_id)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2),
  ROUND((COUNT(mtdata_trip_id)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2)
FROM guardian_events

UNION ALL

SELECT
  'Captive Payments',
  COUNT(*),
  COUNT(vehicle_id),
  COUNT(driver_id),
  COUNT(mtdata_trip_id),
  ROUND((COUNT(vehicle_id)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2),
  ROUND((COUNT(driver_id)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2),
  ROUND((COUNT(mtdata_trip_id)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2)
FROM captive_payment_records

UNION ALL

SELECT
  'MTData Trip History',
  COUNT(*),
  COUNT(vehicle_id),
  COUNT(driver_id),
  0,
  ROUND((COUNT(vehicle_id)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2),
  ROUND((COUNT(driver_id)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2),
  0.00
FROM mtdata_trip_history;

-- Display report
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'RELATIONSHIP QUALITY REPORT';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '%-25s | %10s | %8s | %8s | %8s',
    'Data Source', 'Total', 'Vehicle%', 'Driver%', 'Trip%';
  RAISE NOTICE '%-25s-+-%10s-+-%8s-+-%8s-+-%8s',
    '-------------------------', '----------', '--------', '--------', '--------';

  FOR r IN SELECT * FROM relationship_quality_report ORDER BY data_source LOOP
    RAISE NOTICE '%-25s | %10s | %7s%% | %7s%% | %7s%%',
      r.data_source,
      r.total_records::TEXT,
      r.vehicle_match_rate::TEXT,
      r.driver_match_rate::TEXT,
      r.trip_match_rate::TEXT;
  END LOOP;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- COMPLETION SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'PHASE 2 COMPLETE: RELATIONSHIPS POPULATED';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'ACTIONS COMPLETED:';
  RAISE NOTICE '  1. ✓ LYTX events matched to vehicles (device + registration)';
  RAISE NOTICE '  2. ✓ Guardian events matched to vehicles (unit serial + registration)';
  RAISE NOTICE '  3. ✓ Captive payments correlated to trips/vehicles/drivers';
  RAISE NOTICE '  4. ✓ Relationship quality report generated';
  RAISE NOTICE '';
  RAISE NOTICE 'DATA QUALITY NOTES:';
  RAISE NOTICE '  → Review unmatched records for manual association';
  RAISE NOTICE '  → Low confidence matches may need verification';
  RAISE NOTICE '  → Missing vehicle/driver data should be investigated';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  → Run migration 003 to create comprehensive query functions';
  RAISE NOTICE '  → Review match rates and address data quality issues';
  RAISE NOTICE '============================================================================';
END $$;

-- Analyze tables to update statistics
ANALYZE lytx_safety_events;
ANALYZE guardian_events;
ANALYZE captive_payment_records;
ANALYZE mtdata_trip_history;
