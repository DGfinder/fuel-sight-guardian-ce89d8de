-- =====================================================
-- PHASE 3 MASTER EXECUTION SCRIPT
-- =====================================================
-- Executes all Phase 3 data relationship fixes
-- Run this in Supabase SQL Editor for complete Phase 3
-- =====================================================
-- WHAT THIS DOES:
-- 1. Links LYTX events to vehicles (registration/device matching)
-- 2. Links Guardian events to drivers (name matching)
-- 3. Creates driver-vehicle assignment tracking system
-- 4. Infers historical assignments from event data
-- 5. Correlates GPS trips with fuel deliveries
-- 6. Creates data quality monitoring dashboards
-- =====================================================

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  PHASE 3: DATA RELATIONSHIP POPULATION             ║';
  RAISE NOTICE '║  Multi-Source Data Integration                     ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- PHASE 3.1: POPULATE LYTX VEHICLE IDs
-- =====================================================

DO $$ BEGIN RAISE NOTICE '=== PHASE 3.1: LINKING LYTX EVENTS TO VEHICLES ==='; END $$;

-- Pre-population statistics
DO $$
DECLARE
  total_events INTEGER;
  events_with_vehicle INTEGER;
  events_without_vehicle INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_events FROM lytx_safety_events;
  SELECT COUNT(*) INTO events_with_vehicle FROM lytx_safety_events WHERE vehicle_id IS NOT NULL;
  SELECT COUNT(*) INTO events_without_vehicle FROM lytx_safety_events WHERE vehicle_id IS NULL;

  RAISE NOTICE '';
  RAISE NOTICE 'BEFORE POPULATION:';
  RAISE NOTICE '  Total LYTX events: %', total_events;
  RAISE NOTICE '  Already linked: % (%.1f%%)', events_with_vehicle, (events_with_vehicle::DECIMAL / NULLIF(total_events, 0) * 100);
  RAISE NOTICE '  Need linking: % (%.1f%%)', events_without_vehicle, (events_without_vehicle::DECIMAL / NULLIF(total_events, 0) * 100);
  RAISE NOTICE '';
END $$;

DO $$ BEGIN RAISE NOTICE 'Step 1/3: Matching by registration number...'; END $$;

UPDATE lytx_safety_events
SET vehicle_id = v.id, updated_at = NOW()
FROM vehicles v
WHERE lytx_safety_events.vehicle_id IS NULL
  AND lytx_safety_events.vehicle_registration IS NOT NULL
  AND TRIM(lytx_safety_events.vehicle_registration) != ''
  AND UPPER(TRIM(lytx_safety_events.vehicle_registration)) = UPPER(TRIM(v.registration));

DO $$
DECLARE matched_count INTEGER;
BEGIN
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE '✓ Matched % events by registration', matched_count;
END $$;

DO $$ BEGIN RAISE NOTICE 'Step 2/3: Matching by device serial...'; END $$;

UPDATE lytx_safety_events
SET vehicle_id = v.id, updated_at = NOW()
FROM vehicles v
WHERE lytx_safety_events.vehicle_id IS NULL
  AND lytx_safety_events.device_serial IS NOT NULL
  AND v.lytx_device IS NOT NULL
  AND lytx_safety_events.device_serial = v.lytx_device;

DO $$
DECLARE matched_count INTEGER;
BEGIN
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE '✓ Matched % events by device serial', matched_count;
END $$;

DO $$ BEGIN RAISE NOTICE 'Step 3/3: Fuzzy matching (>85%% similarity)...'; END $$;

WITH fuzzy_matches AS (
  SELECT DISTINCT ON (lse.id)
    lse.id as event_id,
    v.id as vehicle_id
  FROM lytx_safety_events lse
  CROSS JOIN vehicles v
  WHERE lse.vehicle_id IS NULL
    AND lse.vehicle_registration IS NOT NULL
    AND v.registration IS NOT NULL
    AND similarity(UPPER(TRIM(lse.vehicle_registration)), UPPER(TRIM(v.registration))) > 0.85
  ORDER BY lse.id, similarity(UPPER(TRIM(lse.vehicle_registration)), UPPER(TRIM(v.registration))) DESC
)
UPDATE lytx_safety_events
SET vehicle_id = fm.vehicle_id, updated_at = NOW()
FROM fuzzy_matches fm
WHERE lytx_safety_events.id = fm.event_id;

DO $$
DECLARE matched_count INTEGER;
BEGIN
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE '✓ Matched % events by fuzzy matching', matched_count;
END $$;

-- Create unmatched view
CREATE OR REPLACE VIEW unmatched_lytx_events AS
SELECT
  event_id, event_datetime, driver_name, vehicle_registration, device_serial, carrier, depot,
  (
    SELECT string_agg(match_str, ', ')
    FROM (
      SELECT v.registration || ' (' || ROUND(similarity(UPPER(TRIM(lse.vehicle_registration)), UPPER(TRIM(v.registration))) * 100) || '%)'as match_str
      FROM vehicles v
      WHERE similarity(UPPER(TRIM(lse.vehicle_registration)), UPPER(TRIM(v.registration))) > 0.5
      ORDER BY similarity(UPPER(TRIM(lse.vehicle_registration)), UPPER(TRIM(v.registration))) DESC
      LIMIT 3
    ) matches
  ) as potential_matches
FROM lytx_safety_events lse
WHERE vehicle_id IS NULL AND excluded IS NOT TRUE
ORDER BY event_datetime DESC;

GRANT SELECT ON unmatched_lytx_events TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ Phase 3.1 complete';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- PHASE 3.1B: ADD VEHICLE FK TO GUARDIAN EVENTS
-- =====================================================

DO $$ BEGIN RAISE NOTICE '=== PHASE 3.1B: ADDING VEHICLE FK TO GUARDIAN EVENTS ==='; END $$;

-- Add vehicle_id column if it doesn't exist
ALTER TABLE guardian_events
ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guardian_events_vehicle_id ON guardian_events(vehicle_id);

DO $$ BEGIN RAISE NOTICE 'Step 1/2: Matching guardian events to vehicles by registration...'; END $$;

-- Populate vehicle_id by matching vehicle_registration to vehicles table
UPDATE guardian_events ge
SET vehicle_id = v.id, updated_at = NOW()
FROM vehicles v
WHERE ge.vehicle_id IS NULL
  AND ge.vehicle_registration IS NOT NULL
  AND TRIM(ge.vehicle_registration) != ''
  AND UPPER(TRIM(ge.vehicle_registration)) = UPPER(TRIM(v.registration));

DO $$
DECLARE matched_count INTEGER;
BEGIN
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE '✓ Matched % Guardian events to vehicles', matched_count;
END $$;

-- Statistics
DO $$
DECLARE
  total_events INTEGER;
  events_with_vehicle INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_events FROM guardian_events WHERE verified = true;
  SELECT COUNT(*) INTO events_with_vehicle FROM guardian_events WHERE vehicle_id IS NOT NULL AND verified = true;

  RAISE NOTICE '';
  RAISE NOTICE 'VEHICLE LINKING RESULTS:';
  RAISE NOTICE '  Total Guardian events: %', total_events;
  RAISE NOTICE '  Linked to vehicles: % (%.1f%%)', events_with_vehicle, (events_with_vehicle::DECIMAL / NULLIF(total_events, 0) * 100);
  RAISE NOTICE '';
END $$;

DO $$ BEGIN
  RAISE NOTICE '✓ Phase 3.1B complete';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- PHASE 3.2: POPULATE GUARDIAN DRIVER IDs
-- =====================================================

DO $$ BEGIN RAISE NOTICE '=== PHASE 3.2: LINKING GUARDIAN EVENTS TO DRIVERS ==='; END $$;

-- Create normalization function
CREATE OR REPLACE FUNCTION normalize_driver_name(name TEXT)
RETURNS TEXT AS $$
BEGIN
  IF name IS NULL THEN RETURN NULL; END IF;
  RETURN UPPER(TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DO $$ BEGIN RAISE NOTICE 'Step 1/4: Matching by exact name...'; END $$;

UPDATE guardian_events
SET driver_id = d.id, updated_at = NOW()
FROM drivers d
WHERE guardian_events.driver_id IS NULL
  AND guardian_events.verified = true
  AND guardian_events.driver_name IS NOT NULL
  AND normalize_driver_name(guardian_events.driver_name) = normalize_driver_name(d.full_name);

DO $$
DECLARE matched_count INTEGER;
BEGIN
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE '✓ Matched % events by exact name', matched_count;
END $$;

DO $$ BEGIN RAISE NOTICE 'Step 2/4: Matching name variations...'; END $$;

WITH name_variations AS (
  SELECT ge.id as event_id, d.id as driver_id
  FROM guardian_events ge
  CROSS JOIN drivers d
  WHERE ge.driver_id IS NULL AND ge.verified = true AND ge.driver_name IS NOT NULL
    AND (
      (normalize_driver_name(ge.driver_name) = normalize_driver_name(
        CASE WHEN POSITION(',' IN d.full_name) > 0
        THEN TRIM(SPLIT_PART(d.full_name, ',', 2)) || ' ' || TRIM(SPLIT_PART(d.full_name, ',', 1))
        ELSE d.full_name END))
      OR
      (CASE WHEN POSITION(',' IN ge.driver_name) > 0
        THEN normalize_driver_name(TRIM(SPLIT_PART(ge.driver_name, ',', 2)) || ' ' || TRIM(SPLIT_PART(ge.driver_name, ',', 1)))
        ELSE normalize_driver_name(ge.driver_name) END = normalize_driver_name(d.full_name))
    )
)
UPDATE guardian_events
SET driver_id = nv.driver_id, updated_at = NOW()
FROM name_variations nv
WHERE guardian_events.id = nv.event_id;

DO $$
DECLARE matched_count INTEGER;
BEGIN
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE '✓ Matched % events by name variations', matched_count;
END $$;

DO $$ BEGIN RAISE NOTICE 'Step 3/4: Fuzzy matching (>80%% similarity)...'; END $$;

WITH fuzzy_matches AS (
  SELECT DISTINCT ON (ge.id)
    ge.id as event_id,
    d.id as driver_id
  FROM guardian_events ge
  CROSS JOIN drivers d
  WHERE ge.driver_id IS NULL AND ge.verified = true AND ge.driver_name IS NOT NULL
    AND similarity(normalize_driver_name(ge.driver_name), normalize_driver_name(d.full_name)) > 0.80
  ORDER BY ge.id, similarity(normalize_driver_name(ge.driver_name), normalize_driver_name(d.full_name)) DESC
)
UPDATE guardian_events
SET driver_id = fm.driver_id, updated_at = NOW()
FROM fuzzy_matches fm
WHERE guardian_events.id = fm.event_id;

DO $$
DECLARE matched_count INTEGER;
BEGIN
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE '✓ Matched % events by fuzzy matching', matched_count;
END $$;

-- Create unmatched views
CREATE OR REPLACE VIEW unmatched_guardian_events AS
SELECT
  id as event_id, detection_time, driver_name as driver_name_in_event, event_type, fleet, depot, vehicle_registration as vehicle,
  (
    SELECT string_agg(match_str, ', ')
    FROM (
      SELECT d.full_name || ' (' || ROUND(similarity(normalize_driver_name(ge.driver_name), normalize_driver_name(d.full_name)) * 100) || '%)'as match_str
      FROM drivers d
      WHERE similarity(normalize_driver_name(ge.driver_name), normalize_driver_name(d.full_name)) > 0.5
      ORDER BY similarity(normalize_driver_name(ge.driver_name), normalize_driver_name(d.full_name)) DESC
      LIMIT 3
    ) matches
  ) as potential_driver_matches
FROM guardian_events ge
WHERE driver_id IS NULL AND verified = true AND driver_name IS NOT NULL
ORDER BY detection_time DESC;

GRANT SELECT ON unmatched_guardian_events TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ Phase 3.2 complete';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- PHASE 3.3: CREATE DRIVER-VEHICLE ASSIGNMENTS
-- =====================================================

DO $$ BEGIN RAISE NOTICE '=== PHASE 3.3: CREATING DRIVER-VEHICLE ASSIGNMENT TRACKING ==='; END $$;

CREATE TABLE IF NOT EXISTS driver_vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('primary', 'temporary', 'backup')),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT valid_time_range CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT no_overlapping_primary_assignments
    EXCLUDE USING GIST (driver_id WITH =, tstzrange(valid_from, valid_until, '[)') WITH &&)
    WHERE (assignment_type = 'primary')
);

CREATE INDEX IF NOT EXISTS idx_assignments_driver ON driver_vehicle_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_assignments_vehicle ON driver_vehicle_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_assignments_time_range ON driver_vehicle_assignments USING GIST (tstzrange(valid_from, valid_until, '[)'));

CREATE OR REPLACE VIEW current_driver_assignments AS
SELECT
  dva.id as assignment_id, dva.driver_id, d.full_name as driver_name, dva.vehicle_id,
  v.registration as vehicle_registration, dva.assignment_type, dva.valid_from, dva.valid_until,
  CASE WHEN dva.valid_until IS NULL OR dva.valid_until > NOW() THEN true ELSE false END as is_active
FROM driver_vehicle_assignments dva
JOIN drivers d ON dva.driver_id = d.id
JOIN vehicles v ON dva.vehicle_id = v.id
WHERE dva.valid_until IS NULL OR dva.valid_until > NOW()
ORDER BY dva.assignment_type, d.full_name;

GRANT SELECT ON driver_vehicle_assignments TO authenticated;
GRANT SELECT ON current_driver_assignments TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ Phase 3.3 complete';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- PHASE 3.4: INFER HISTORICAL ASSIGNMENTS
-- =====================================================

DO $$ BEGIN RAISE NOTICE '=== PHASE 3.4: INFERRING DRIVER-VEHICLE ASSIGNMENTS ==='; END $$;

-- Infer primary assignments
WITH driver_vehicle_usage AS (
  SELECT
    driver_id, vehicle_id, COUNT(*) as event_count,
    MIN(detection_time) as first_seen, MAX(detection_time) as last_seen,
    EXTRACT(DAY FROM MAX(detection_time) - MIN(detection_time))::INTEGER as span_days
  FROM guardian_events
  WHERE driver_id IS NOT NULL AND vehicle_id IS NOT NULL AND verified = true
  GROUP BY driver_id, vehicle_id
),
driver_primary_vehicle AS (
  SELECT DISTINCT ON (driver_id)
    driver_id, vehicle_id, event_count, first_seen, last_seen, span_days
  FROM driver_vehicle_usage
  WHERE event_count >= 3 AND span_days >= 1
  ORDER BY driver_id, event_count DESC, span_days DESC
)
INSERT INTO driver_vehicle_assignments (
  driver_id, vehicle_id, valid_from, valid_until, assignment_type,
  confidence_score, source, notes
)
SELECT
  driver_id, vehicle_id, first_seen, last_seen, 'primary',
  LEAST(1.0, (event_count::DECIMAL / 100))::DECIMAL(3,2),
  'inferred_from_events',
  format('Inferred from %s Guardian events over %s days', event_count, span_days)
FROM driver_primary_vehicle
WHERE NOT EXISTS (
  SELECT 1 FROM driver_vehicle_assignments dva
  WHERE dva.driver_id = driver_primary_vehicle.driver_id
    AND dva.vehicle_id = driver_primary_vehicle.vehicle_id
    AND dva.assignment_type = 'primary'
);

DO $$
DECLARE inserted_count INTEGER;
BEGIN
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '✓ Created % primary assignments', inserted_count;
END $$;

CREATE OR REPLACE VIEW guardian_events_without_assignments AS
SELECT
  ge.id as event_id, ge.detection_time, ge.driver_id, d.full_name as driver_name,
  ge.vehicle_id, v.registration as vehicle_registration, ge.event_type
FROM guardian_events ge
JOIN drivers d ON ge.driver_id = d.id
JOIN vehicles v ON ge.vehicle_id = v.id
WHERE ge.verified = true
  AND NOT EXISTS (
    SELECT 1 FROM driver_vehicle_assignments dva
    WHERE dva.driver_id = ge.driver_id AND dva.vehicle_id = ge.vehicle_id
      AND dva.valid_from <= ge.detection_time
      AND (dva.valid_until IS NULL OR dva.valid_until > ge.detection_time)
  )
ORDER BY ge.detection_time DESC;

GRANT SELECT ON guardian_events_without_assignments TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ Phase 3.4 complete';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- PHASE 3.5: CREATE TRIP-DELIVERY CORRELATIONS
-- =====================================================

DO $$ BEGIN RAISE NOTICE '=== PHASE 3.5: CORRELATING TRIPS WITH DELIVERIES ==='; END $$;

CREATE TABLE IF NOT EXISTS trip_delivery_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES mtdata_raw(id) ON DELETE CASCADE,
  trip_start TIMESTAMPTZ,
  trip_end TIMESTAMPTZ,
  trip_vehicle_id UUID REFERENCES vehicles(id),
  delivery_id UUID REFERENCES captive_deliveries(id) ON DELETE CASCADE,
  delivery_time TIMESTAMPTZ,
  delivery_volume_litres DECIMAL,
  match_confidence DECIMAL(3,2),
  match_method TEXT,
  time_difference_minutes INTEGER,
  needs_review BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_trip_delivery UNIQUE (trip_id, delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_correlations_trip ON trip_delivery_correlations(trip_id);
CREATE INDEX IF NOT EXISTS idx_correlations_delivery ON trip_delivery_correlations(delivery_id);

-- Correlate trips to deliveries
WITH trip_windows AS (
  SELECT
    mt.id as trip_id, mt.start_time as trip_start, mt.end_time as trip_end, mt.vehicle_id as trip_vehicle_id,
    mt.start_time - INTERVAL '30 minutes' as match_start,
    mt.end_time + INTERVAL '30 minutes' as match_end
  FROM mtdata_raw mt
  WHERE mt.start_time IS NOT NULL AND mt.end_time IS NOT NULL
),
delivery_candidates AS (
  SELECT
    cd.id as delivery_id, cd.delivery_date as delivery_time,
    cd.total_volume_litres_abs as delivery_volume,
    tw.trip_id, tw.trip_start, tw.trip_end, tw.trip_vehicle_id,
    CASE
      WHEN cd.vehicle_id = tw.trip_vehicle_id AND cd.delivery_date >= tw.trip_start AND cd.delivery_date <= tw.trip_end THEN 1.0
      WHEN cd.vehicle_id = tw.trip_vehicle_id THEN 0.85
      WHEN cd.delivery_date >= tw.trip_start AND cd.delivery_date <= tw.trip_end THEN 0.60
      ELSE 0.40
    END as confidence,
    EXTRACT(EPOCH FROM (cd.delivery_date - tw.trip_start)) / 60 as time_diff
  FROM trip_windows tw
  CROSS JOIN captive_deliveries cd
  WHERE cd.delivery_date >= tw.match_start AND cd.delivery_date <= tw.match_end
),
best_matches AS (
  SELECT DISTINCT ON (trip_id)
    trip_id, delivery_id, trip_start, trip_end, trip_vehicle_id,
    delivery_time, delivery_volume, confidence, time_diff
  FROM delivery_candidates
  WHERE confidence >= 0.40
  ORDER BY trip_id, confidence DESC, ABS(time_diff) ASC
)
INSERT INTO trip_delivery_correlations (
  trip_id, trip_start, trip_end, trip_vehicle_id, delivery_id, delivery_time,
  delivery_volume_litres, match_confidence, time_difference_minutes, needs_review
)
SELECT
  trip_id, trip_start, trip_end, trip_vehicle_id, delivery_id, delivery_time,
  delivery_volume, confidence::DECIMAL(3,2), time_diff::INTEGER,
  CASE WHEN confidence < 0.70 THEN true ELSE false END
FROM best_matches
ON CONFLICT (trip_id, delivery_id) DO NOTHING;

DO $$
DECLARE inserted_count INTEGER;
BEGIN
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '✓ Created % trip-delivery correlations', inserted_count;
END $$;

GRANT SELECT ON trip_delivery_correlations TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ Phase 3.5 complete';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- PHASE 3.6: DATA QUALITY MONITORING
-- =====================================================

DO $$ BEGIN RAISE NOTICE '=== PHASE 3.6: CREATING DATA QUALITY MONITORING ==='; END $$;

CREATE OR REPLACE VIEW data_quality_dashboard AS
SELECT
  data_source,
  total_records,
  linked_records,
  (linked_records::DECIMAL / NULLIF(total_records, 0) * 100)::DECIMAL(5,2) as link_percentage,
  quality_score
FROM (
  SELECT 'LYTX Events' as data_source,
    (SELECT COUNT(*) FROM lytx_safety_events) as total_records,
    (SELECT COUNT(*) FROM lytx_safety_events WHERE vehicle_id IS NOT NULL) as linked_records,
    70 as quality_score
  UNION ALL
  SELECT 'Guardian Events',
    (SELECT COUNT(*) FROM guardian_events WHERE verified = true),
    (SELECT COUNT(*) FROM guardian_events WHERE driver_id IS NOT NULL AND verified = true),
    75
  UNION ALL
  SELECT 'Captive Deliveries',
    (SELECT COUNT(*) FROM captive_deliveries),
    (SELECT COUNT(*) FROM captive_deliveries WHERE vehicle_id IS NOT NULL),
    80
) stats;

GRANT SELECT ON data_quality_dashboard TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ Phase 3.6 complete';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- FINAL SUMMARY
-- =====================================================

DO $$
DECLARE
  lytx_link_rate DECIMAL;
  guardian_link_rate DECIMAL;
  assignments_count INTEGER;
  correlations_count INTEGER;
BEGIN
  SELECT (COUNT(*) FILTER (WHERE vehicle_id IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0) * 100)::DECIMAL(5,1)
  INTO lytx_link_rate FROM lytx_safety_events;

  SELECT (COUNT(*) FILTER (WHERE driver_id IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0) * 100)::DECIMAL(5,1)
  INTO guardian_link_rate FROM guardian_events WHERE verified = true;

  SELECT COUNT(*) INTO assignments_count FROM driver_vehicle_assignments;
  SELECT COUNT(*) INTO correlations_count FROM trip_delivery_correlations;

  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ✓ PHASE 3 COMPLETE - DATA RELATIONSHIPS BUILT    ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'RESULTS SUMMARY:';
  RAISE NOTICE '  ✓ LYTX → Vehicle link rate: %.1f%%', lytx_link_rate;
  RAISE NOTICE '  ✓ Guardian → Driver link rate: %.1f%%', guardian_link_rate;
  RAISE NOTICE '  ✓ Driver-vehicle assignments: %', assignments_count;
  RAISE NOTICE '  ✓ Trip-delivery correlations: %', correlations_count;
  RAISE NOTICE '';
  RAISE NOTICE 'MONITORING VIEWS CREATED:';
  RAISE NOTICE '  • data_quality_dashboard';
  RAISE NOTICE '  • current_driver_assignments';
  RAISE NOTICE '  • unmatched_lytx_events';
  RAISE NOTICE '  • unmatched_guardian_events';
  RAISE NOTICE '  • guardian_events_without_assignments';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  1. Review: SELECT * FROM data_quality_dashboard;';
  RAISE NOTICE '  2. Review: SELECT * FROM unmatched_lytx_events LIMIT 20;';
  RAISE NOTICE '  3. Review: SELECT * FROM unmatched_guardian_events LIMIT 20;';
  RAISE NOTICE '  4. Add manual assignments/corrections as needed';
  RAISE NOTICE '';
END $$;
