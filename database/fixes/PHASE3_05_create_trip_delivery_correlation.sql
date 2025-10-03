-- =====================================================
-- PHASE 3.5: TRIP-DELIVERY CORRELATION SYSTEM
-- =====================================================
-- Correlates GPS trips (mtdata_raw) with fuel deliveries (captive_deliveries)
-- Matches based on vehicle, time proximity, and driver assignments
-- Enables analysis of delivery efficiency and routing
-- =====================================================

DO $$ BEGIN RAISE NOTICE '=== PHASE 3.5: CREATING TRIP-DELIVERY CORRELATION SYSTEM ==='; END $$;

-- =====================================================
-- STEP 1: CREATE CORRELATION TABLE
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 1/5: Creating trip_delivery_correlations table...'; END $$;

CREATE TABLE IF NOT EXISTS trip_delivery_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Trip information
  trip_id UUID REFERENCES mtdata_raw(id) ON DELETE CASCADE,
  trip_start TIMESTAMPTZ,
  trip_end TIMESTAMPTZ,
  trip_vehicle_id UUID REFERENCES vehicles(id),

  -- Delivery information
  delivery_id UUID REFERENCES captive_deliveries(id) ON DELETE CASCADE,
  delivery_time TIMESTAMPTZ,
  delivery_volume_litres DECIMAL,
  delivery_customer TEXT,

  -- Correlation metadata
  match_confidence DECIMAL(3,2) CHECK (match_confidence >= 0 AND match_confidence <= 1),
  match_method TEXT, -- 'exact_time', 'time_proximity', 'vehicle_and_time', 'driver_and_time'
  time_difference_minutes INTEGER,

  -- Flags
  is_verified BOOLEAN DEFAULT false,
  needs_review BOOLEAN DEFAULT false,

  -- Notes
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_confidence CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1)),
  CONSTRAINT unique_trip_delivery UNIQUE (trip_id, delivery_id)
);

DO $$ BEGIN RAISE NOTICE '✓ trip_delivery_correlations table created'; END $$;

-- =====================================================
-- STEP 2: CREATE INDEXES
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 2/5: Creating performance indexes...'; END $$;

CREATE INDEX IF NOT EXISTS idx_correlations_trip
  ON trip_delivery_correlations(trip_id);

CREATE INDEX IF NOT EXISTS idx_correlations_delivery
  ON trip_delivery_correlations(delivery_id);

CREATE INDEX IF NOT EXISTS idx_correlations_trip_vehicle
  ON trip_delivery_correlations(trip_vehicle_id);

CREATE INDEX IF NOT EXISTS idx_correlations_confidence
  ON trip_delivery_correlations(match_confidence DESC)
  WHERE match_confidence IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_correlations_needs_review
  ON trip_delivery_correlations(needs_review)
  WHERE needs_review = true;

DO $$ BEGIN RAISE NOTICE '✓ 5 indexes created'; END $$;

-- =====================================================
-- STEP 3: CORRELATE TRIPS TO DELIVERIES
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 3/5: Correlating trips to deliveries...'; END $$;

-- Match trips to deliveries based on:
-- 1. Vehicle match (if available)
-- 2. Time proximity (delivery time within trip or near trip time)
-- 3. Driver assignment (if we know driver was assigned to vehicle during trip)

WITH trip_windows AS (
  SELECT
    mt.id as trip_id,
    mt.start_time as trip_start,
    mt.end_time as trip_end,
    mt.vehicle_id as trip_vehicle_id,
    -- Expand window by 30 minutes on each side for matching
    mt.start_time - INTERVAL '30 minutes' as match_start,
    mt.end_time + INTERVAL '30 minutes' as match_end
  FROM mtdata_raw mt
  WHERE mt.start_time IS NOT NULL
    AND mt.end_time IS NOT NULL
),
delivery_candidates AS (
  SELECT
    cd.id as delivery_id,
    cd.delivery_date as delivery_time,
    cd.total_volume_litres_abs as delivery_volume,
    cd.customer as delivery_customer,
    cd.vehicle_id as delivery_vehicle_id,
    tw.trip_id,
    tw.trip_start,
    tw.trip_end,
    tw.trip_vehicle_id,
    -- Calculate match quality
    CASE
      -- Perfect match: same vehicle and delivery within trip time
      WHEN cd.vehicle_id = tw.trip_vehicle_id
           AND cd.delivery_date >= tw.trip_start
           AND cd.delivery_date <= tw.trip_end
      THEN 1.0
      -- Good match: same vehicle and delivery near trip time
      WHEN cd.vehicle_id = tw.trip_vehicle_id
           AND cd.delivery_date >= tw.match_start
           AND cd.delivery_date <= tw.match_end
      THEN 0.85
      -- Possible match: delivery within trip time but no vehicle match
      WHEN cd.delivery_date >= tw.trip_start
           AND cd.delivery_date <= tw.trip_end
      THEN 0.60
      -- Weak match: delivery near trip time
      WHEN cd.delivery_date >= tw.match_start
           AND cd.delivery_date <= tw.match_end
      THEN 0.40
      ELSE 0
    END as confidence,
    -- Match method
    CASE
      WHEN cd.vehicle_id = tw.trip_vehicle_id
           AND cd.delivery_date >= tw.trip_start
           AND cd.delivery_date <= tw.trip_end
      THEN 'vehicle_and_time_exact'
      WHEN cd.vehicle_id = tw.trip_vehicle_id
      THEN 'vehicle_and_time_proximity'
      WHEN cd.delivery_date >= tw.trip_start
           AND cd.delivery_date <= tw.trip_end
      THEN 'time_exact'
      ELSE 'time_proximity'
    END as match_method,
    -- Time difference in minutes
    EXTRACT(EPOCH FROM (cd.delivery_date - tw.trip_start)) / 60 as time_diff_minutes
  FROM trip_windows tw
  CROSS JOIN captive_deliveries cd
  WHERE cd.delivery_date >= tw.match_start
    AND cd.delivery_date <= tw.match_end
    AND (
      -- Either vehicles match, or we don't have vehicle info
      cd.vehicle_id IS NULL
      OR tw.trip_vehicle_id IS NULL
      OR cd.vehicle_id = tw.trip_vehicle_id
    )
),
best_matches AS (
  -- For each trip, get the best matching delivery
  SELECT DISTINCT ON (trip_id)
    trip_id,
    delivery_id,
    trip_start,
    trip_end,
    trip_vehicle_id,
    delivery_time,
    delivery_volume,
    delivery_customer,
    confidence,
    match_method,
    time_diff_minutes
  FROM delivery_candidates
  WHERE confidence >= 0.40  -- Only keep matches with at least 40% confidence
  ORDER BY trip_id, confidence DESC, ABS(time_diff_minutes) ASC
)
INSERT INTO trip_delivery_correlations (
  trip_id,
  trip_start,
  trip_end,
  trip_vehicle_id,
  delivery_id,
  delivery_time,
  delivery_volume_litres,
  delivery_customer,
  match_confidence,
  match_method,
  time_difference_minutes,
  needs_review,
  notes
)
SELECT
  bm.trip_id,
  bm.trip_start,
  bm.trip_end,
  bm.trip_vehicle_id,
  bm.delivery_id,
  bm.delivery_time,
  bm.delivery_volume,
  bm.delivery_customer,
  bm.confidence::DECIMAL(3,2),
  bm.match_method,
  bm.time_diff_minutes::INTEGER,
  CASE WHEN bm.confidence < 0.70 THEN true ELSE false END, -- Flag low-confidence matches for review
  CASE
    WHEN bm.confidence >= 0.85 THEN 'High confidence match'
    WHEN bm.confidence >= 0.60 THEN 'Good match - review recommended'
    ELSE 'Low confidence - manual verification needed'
  END
FROM best_matches bm
ON CONFLICT (trip_id, delivery_id) DO NOTHING;

DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '✓ Created % trip-delivery correlations', inserted_count;
END $$;

-- =====================================================
-- STEP 4: CREATE REPORTING VIEWS
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 4/5: Creating correlation reporting views...'; END $$;

-- View: High-confidence correlations
CREATE OR REPLACE VIEW trip_delivery_correlations_verified AS
SELECT
  tdc.id as correlation_id,
  tdc.trip_id,
  tdc.trip_start,
  tdc.trip_end,
  v.registration as vehicle_registration,
  v.fleet_number,
  tdc.delivery_id,
  tdc.delivery_time,
  tdc.delivery_volume_litres,
  tdc.delivery_customer,
  tdc.match_confidence,
  tdc.match_method,
  tdc.time_difference_minutes,
  tdc.notes,
  -- Calculate trip duration
  EXTRACT(EPOCH FROM (tdc.trip_end - tdc.trip_start)) / 3600 as trip_duration_hours
FROM trip_delivery_correlations tdc
LEFT JOIN vehicles v ON tdc.trip_vehicle_id = v.id
WHERE tdc.match_confidence >= 0.70
ORDER BY tdc.trip_start DESC;

GRANT SELECT ON trip_delivery_correlations_verified TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ trip_delivery_correlations_verified view created'; END $$;

-- View: Correlations needing review
CREATE OR REPLACE VIEW trip_delivery_correlations_review AS
SELECT
  tdc.id as correlation_id,
  tdc.trip_id,
  tdc.trip_start,
  tdc.trip_end,
  v.registration as vehicle_registration,
  tdc.delivery_id,
  tdc.delivery_time,
  tdc.delivery_volume_litres,
  tdc.delivery_customer,
  tdc.match_confidence,
  tdc.match_method,
  tdc.time_difference_minutes,
  tdc.notes,
  CASE
    WHEN tdc.match_confidence < 0.50 THEN 'Low confidence'
    WHEN tdc.trip_vehicle_id IS NULL THEN 'Missing vehicle info'
    WHEN ABS(tdc.time_difference_minutes) > 60 THEN 'Large time gap'
    ELSE 'Review recommended'
  END as review_reason
FROM trip_delivery_correlations tdc
LEFT JOIN vehicles v ON tdc.trip_vehicle_id = v.id
WHERE tdc.needs_review = true
ORDER BY tdc.match_confidence ASC, ABS(tdc.time_difference_minutes) DESC;

GRANT SELECT ON trip_delivery_correlations_review TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ trip_delivery_correlations_review view created'; END $$;

-- View: Uncorrelated deliveries
CREATE OR REPLACE VIEW deliveries_without_trips AS
SELECT
  cd.id as delivery_id,
  cd.delivery_date,
  cd.delivery_key,
  cd.customer,
  cd.total_volume_litres_abs as volume_litres,
  CASE WHEN cd.carrier = 'SMB' THEN 'Stevemacs' ELSE cd.carrier END as fleet,
  cd.terminal as depot,
  v.registration as vehicle_registration,
  cd.vehicle_id,
  -- Find nearest trip (if any)
  (
    SELECT json_build_object(
      'trip_id', mt.id,
      'trip_start', mt.start_time,
      'trip_end', mt.end_time,
      'time_diff_minutes', EXTRACT(EPOCH FROM (cd.delivery_date - mt.start_time)) / 60
    )
    FROM mtdata_raw mt
    WHERE mt.vehicle_id = cd.vehicle_id
      AND ABS(EXTRACT(EPOCH FROM (cd.delivery_date - mt.start_time))) < 7200 -- Within 2 hours
    ORDER BY ABS(EXTRACT(EPOCH FROM (cd.delivery_date - mt.start_time))) ASC
    LIMIT 1
  ) as nearest_trip
FROM captive_deliveries cd
LEFT JOIN vehicles v ON cd.vehicle_id = v.id
WHERE NOT EXISTS (
  SELECT 1 FROM trip_delivery_correlations tdc
  WHERE tdc.delivery_id = cd.id
)
ORDER BY cd.delivery_date DESC;

GRANT SELECT ON deliveries_without_trips TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ deliveries_without_trips view created'; END $$;

-- View: Uncorrelated trips
CREATE OR REPLACE VIEW trips_without_deliveries AS
SELECT
  mt.id as trip_id,
  mt.start_time,
  mt.end_time,
  mt.vehicle_id,
  v.registration as vehicle_registration,
  v.fleet_number,
  EXTRACT(EPOCH FROM (mt.end_time - mt.start_time)) / 3600 as duration_hours,
  mt.trip_distance_kms,
  -- Check if this is a delivery vehicle
  CASE WHEN v.id IS NOT NULL THEN true ELSE false END as is_tracked_vehicle
FROM mtdata_raw mt
LEFT JOIN vehicles v ON mt.vehicle_id = v.id
WHERE NOT EXISTS (
  SELECT 1 FROM trip_delivery_correlations tdc
  WHERE tdc.trip_id = mt.id
)
  AND mt.start_time IS NOT NULL
  AND mt.end_time IS NOT NULL
ORDER BY mt.start_time DESC;

GRANT SELECT ON trips_without_deliveries TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ trips_without_deliveries view created'; END $$;

-- =====================================================
-- STEP 5: STATISTICS AND SUMMARY
-- =====================================================

DO $$
DECLARE
  total_correlations INTEGER;
  high_confidence INTEGER;
  medium_confidence INTEGER;
  low_confidence INTEGER;
  needs_review INTEGER;
  total_trips INTEGER;
  total_deliveries INTEGER;
  trips_with_correlation INTEGER;
  deliveries_with_correlation INTEGER;
  avg_time_diff INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_correlations FROM trip_delivery_correlations;
  SELECT COUNT(*) INTO high_confidence FROM trip_delivery_correlations WHERE match_confidence >= 0.85;
  SELECT COUNT(*) INTO medium_confidence FROM trip_delivery_correlations WHERE match_confidence >= 0.60 AND match_confidence < 0.85;
  SELECT COUNT(*) INTO low_confidence FROM trip_delivery_correlations WHERE match_confidence < 0.60;
  SELECT COUNT(*) INTO needs_review FROM trip_delivery_correlations WHERE needs_review = true;

  SELECT COUNT(*) INTO total_trips FROM mtdata_raw WHERE start_time IS NOT NULL;
  SELECT COUNT(*) INTO total_deliveries FROM captive_deliveries;
  SELECT COUNT(DISTINCT trip_id) INTO trips_with_correlation FROM trip_delivery_correlations;
  SELECT COUNT(DISTINCT delivery_id) INTO deliveries_with_correlation FROM trip_delivery_correlations;
  SELECT AVG(ABS(time_difference_minutes))::INTEGER INTO avg_time_diff FROM trip_delivery_correlations;

  RAISE NOTICE '';
  RAISE NOTICE 'CORRELATION STATISTICS:';
  RAISE NOTICE '  Total correlations created: %', total_correlations;
  RAISE NOTICE '  High confidence (>=85%%): %', high_confidence;
  RAISE NOTICE '  Medium confidence (60-84%%): %', medium_confidence;
  RAISE NOTICE '  Low confidence (<60%%): %', low_confidence;
  RAISE NOTICE '  Flagged for review: %', needs_review;
  RAISE NOTICE '';
  RAISE NOTICE 'COVERAGE:';
  RAISE NOTICE '  Total trips: %', total_trips;
  RAISE NOTICE '  Trips with correlations: % (%.1f%%)', trips_with_correlation,
    (trips_with_correlation::DECIMAL / NULLIF(total_trips, 0) * 100);
  RAISE NOTICE '  Total deliveries: %', total_deliveries;
  RAISE NOTICE '  Deliveries with correlations: % (%.1f%%)', deliveries_with_correlation,
    (deliveries_with_correlation::DECIMAL / NULLIF(total_deliveries, 0) * 100);
  RAISE NOTICE '';
  RAISE NOTICE 'MATCH QUALITY:';
  RAISE NOTICE '  Average time difference: % minutes', avg_time_diff;
  RAISE NOTICE '';
END $$;

-- =====================================================
-- SUCCESS
-- =====================================================

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== PHASE 3.5 COMPLETE ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  ✓ trip_delivery_correlations table';
  RAISE NOTICE '  ✓ trip_delivery_correlations_verified view';
  RAISE NOTICE '  ✓ trip_delivery_correlations_review view';
  RAISE NOTICE '  ✓ deliveries_without_trips view';
  RAISE NOTICE '  ✓ trips_without_deliveries view';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Review trip_delivery_correlations_review';
  RAISE NOTICE '  2. Manually verify/adjust low-confidence matches';
  RAISE NOTICE '  3. Investigate uncorrelated deliveries/trips';
  RAISE NOTICE '  4. Proceed to Phase 3.6 (Data quality monitoring)';
  RAISE NOTICE '';
  RAISE NOTICE 'Useful queries:';
  RAISE NOTICE '  SELECT * FROM trip_delivery_correlations_verified LIMIT 20;';
  RAISE NOTICE '  SELECT * FROM trip_delivery_correlations_review LIMIT 20;';
  RAISE NOTICE '  SELECT * FROM deliveries_without_trips LIMIT 20;';
  RAISE NOTICE '  SELECT * FROM trips_without_deliveries LIMIT 20;';
  RAISE NOTICE '';
END $$;
