-- =====================================================
-- PHASE 3.4: INFER HISTORICAL DRIVER-VEHICLE ASSIGNMENTS
-- =====================================================
-- Analyzes Guardian events to infer which drivers used which vehicles
-- Creates assignment records based on event patterns
-- Handles multiple assignment types (primary, temporary)
-- =====================================================

DO $$ BEGIN RAISE NOTICE '=== PHASE 3.4: INFERRING DRIVER-VEHICLE ASSIGNMENTS FROM EVENTS ==='; END $$;

-- =====================================================
-- STEP 1: PRE-INFERENCE STATISTICS
-- =====================================================

DO $$
DECLARE
  guardian_events_with_both INTEGER;
  unique_driver_vehicle_pairs INTEGER;
  existing_assignments INTEGER;
BEGIN
  SELECT COUNT(*) INTO guardian_events_with_both
  FROM guardian_events
  WHERE driver_id IS NOT NULL AND vehicle_id IS NOT NULL AND verified = true;

  SELECT COUNT(DISTINCT (driver_id, vehicle_id)) INTO unique_driver_vehicle_pairs
  FROM guardian_events
  WHERE driver_id IS NOT NULL AND vehicle_id IS NOT NULL AND verified = true;

  SELECT COUNT(*) INTO existing_assignments
  FROM driver_vehicle_assignments;

  RAISE NOTICE '';
  RAISE NOTICE 'BEFORE INFERENCE:';
  RAISE NOTICE '  Guardian events with driver + vehicle: %', guardian_events_with_both;
  RAISE NOTICE '  Unique driver-vehicle pairs in events: %', unique_driver_vehicle_pairs;
  RAISE NOTICE '  Existing assignments: %', existing_assignments;
  RAISE NOTICE '';
END $$;

-- =====================================================
-- STEP 2: IDENTIFY PRIMARY ASSIGNMENTS
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 1/4: Identifying primary driver-vehicle assignments...'; END $$;

-- Find driver-vehicle pairs that occur frequently over long periods
-- Primary = most common vehicle for each driver
WITH driver_vehicle_usage AS (
  SELECT
    driver_id,
    vehicle_id,
    COUNT(*) as event_count,
    MIN(detection_time) as first_seen,
    MAX(detection_time) as last_seen,
    EXTRACT(DAY FROM MAX(detection_time) - MIN(detection_time))::INTEGER as span_days
  FROM guardian_events
  WHERE driver_id IS NOT NULL
    AND vehicle_id IS NOT NULL
    AND verified = true
  GROUP BY driver_id, vehicle_id
),
driver_primary_vehicle AS (
  SELECT DISTINCT ON (driver_id)
    driver_id,
    vehicle_id,
    event_count,
    first_seen,
    last_seen,
    span_days
  FROM driver_vehicle_usage
  WHERE event_count >= 3  -- At least 3 events to be considered primary
    AND span_days >= 1    -- Spanning at least 1 day
  ORDER BY driver_id, event_count DESC, span_days DESC
)
INSERT INTO driver_vehicle_assignments (
  driver_id,
  vehicle_id,
  valid_from,
  valid_until,
  assignment_type,
  confidence_score,
  source,
  notes
)
SELECT
  dpv.driver_id,
  dpv.vehicle_id,
  dpv.first_seen,
  dpv.last_seen,
  'primary',
  LEAST(1.0, (dpv.event_count::DECIMAL / 100))::DECIMAL(3,2), -- Max confidence at 100 events
  'inferred_from_events',
  format(
    'Inferred from %s Guardian events over %s days',
    dpv.event_count,
    dpv.span_days
  )
FROM driver_primary_vehicle dpv
WHERE NOT EXISTS (
  -- Don't create duplicate assignments
  SELECT 1 FROM driver_vehicle_assignments dva
  WHERE dva.driver_id = dpv.driver_id
    AND dva.vehicle_id = dpv.vehicle_id
    AND dva.assignment_type = 'primary'
    AND dva.valid_from = dpv.first_seen
);

DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '✓ Created % primary assignments', inserted_count;
END $$;

-- =====================================================
-- STEP 3: IDENTIFY TEMPORARY ASSIGNMENTS
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 2/4: Identifying temporary driver-vehicle assignments...'; END $$;

-- Find driver-vehicle pairs that don't overlap with primary assignments
-- Temporary = short-term or secondary vehicle usage
WITH driver_vehicle_usage AS (
  SELECT
    driver_id,
    vehicle_id,
    COUNT(*) as event_count,
    MIN(detection_time) as first_seen,
    MAX(detection_time) as last_seen,
    EXTRACT(DAY FROM MAX(detection_time) - MIN(detection_time))::INTEGER as span_days
  FROM guardian_events
  WHERE driver_id IS NOT NULL
    AND vehicle_id IS NOT NULL
    AND verified = true
  GROUP BY driver_id, vehicle_id
),
temporary_usage AS (
  SELECT
    dvu.driver_id,
    dvu.vehicle_id,
    dvu.event_count,
    dvu.first_seen,
    dvu.last_seen,
    dvu.span_days
  FROM driver_vehicle_usage dvu
  WHERE dvu.event_count >= 2  -- At least 2 events
    AND NOT EXISTS (
      -- Not already a primary assignment
      SELECT 1 FROM driver_vehicle_assignments dva
      WHERE dva.driver_id = dvu.driver_id
        AND dva.vehicle_id = dvu.vehicle_id
        AND dva.assignment_type = 'primary'
        AND tstzrange(dva.valid_from, dva.valid_until, '[)') @> dvu.first_seen
    )
)
INSERT INTO driver_vehicle_assignments (
  driver_id,
  vehicle_id,
  valid_from,
  valid_until,
  assignment_type,
  confidence_score,
  source,
  notes
)
SELECT
  tu.driver_id,
  tu.vehicle_id,
  tu.first_seen,
  tu.last_seen,
  'temporary',
  LEAST(0.75, (tu.event_count::DECIMAL / 50))::DECIMAL(3,2), -- Lower confidence for temporary
  'inferred_from_events',
  format(
    'Inferred from %s Guardian events over %s days',
    tu.event_count,
    tu.span_days
  )
FROM temporary_usage tu
WHERE NOT EXISTS (
  -- Don't create duplicate assignments
  SELECT 1 FROM driver_vehicle_assignments dva
  WHERE dva.driver_id = tu.driver_id
    AND dva.vehicle_id = tu.vehicle_id
    AND dva.valid_from = tu.first_seen
    AND dva.valid_until = tu.last_seen
);

DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '✓ Created % temporary assignments', inserted_count;
END $$;

-- =====================================================
-- STEP 4: EXTEND ONGOING ASSIGNMENTS
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 3/4: Extending assignments with recent activity...'; END $$;

-- If a driver-vehicle pair has recent events (last 30 days), extend valid_until to NULL (ongoing)
UPDATE driver_vehicle_assignments dva
SET valid_until = NULL,
    updated_at = NOW(),
    notes = notes || ' [Extended to ongoing based on recent activity]'
WHERE dva.assignment_type = 'primary'
  AND dva.valid_until IS NOT NULL
  AND dva.valid_until < NOW()
  AND EXISTS (
    SELECT 1 FROM guardian_events ge
    WHERE ge.driver_id = dva.driver_id
      AND ge.vehicle_id = dva.vehicle_id
      AND ge.verified = true
      AND ge.detection_time >= NOW() - INTERVAL '30 days'
      AND ge.detection_time > dva.valid_until
  );

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✓ Extended % assignments to ongoing', updated_count;
END $$;

-- =====================================================
-- STEP 5: CREATE ASSIGNMENT COVERAGE REPORT
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 4/4: Creating assignment coverage views...'; END $$;

CREATE OR REPLACE VIEW driver_assignment_coverage AS
SELECT
  d.id as driver_id,
  d.full_name as driver_name,
  COUNT(DISTINCT dva.vehicle_id) as vehicles_assigned,
  MIN(dva.valid_from) as first_assignment,
  MAX(COALESCE(dva.valid_until, NOW())) as last_assignment,
  SUM(
    EXTRACT(DAY FROM COALESCE(dva.valid_until, NOW()) - dva.valid_from)
  )::INTEGER as total_days_assigned,
  COUNT(*) FILTER (WHERE dva.assignment_type = 'primary') as primary_assignments,
  COUNT(*) FILTER (WHERE dva.assignment_type = 'temporary') as temporary_assignments,
  -- Guardian events coverage
  (
    SELECT COUNT(*)
    FROM guardian_events ge
    WHERE ge.driver_id = d.id
      AND ge.verified = true
      AND EXISTS (
        SELECT 1 FROM driver_vehicle_assignments dva2
        WHERE dva2.driver_id = ge.driver_id
          AND dva2.vehicle_id = ge.vehicle_id
          AND dva2.valid_from <= ge.detection_time
          AND (dva2.valid_until IS NULL OR dva2.valid_until > ge.detection_time)
      )
  ) as events_with_assignment,
  (
    SELECT COUNT(*)
    FROM guardian_events ge
    WHERE ge.driver_id = d.id
      AND ge.verified = true
  ) as total_events,
  -- Coverage percentage
  CASE
    WHEN (SELECT COUNT(*) FROM guardian_events WHERE driver_id = d.id AND verified = true) > 0
    THEN (
      (
        SELECT COUNT(*)
        FROM guardian_events ge
        WHERE ge.driver_id = d.id
          AND ge.verified = true
          AND EXISTS (
            SELECT 1 FROM driver_vehicle_assignments dva2
            WHERE dva2.driver_id = ge.driver_id
              AND dva2.vehicle_id = ge.vehicle_id
              AND dva2.valid_from <= ge.detection_time
              AND (dva2.valid_until IS NULL OR dva2.valid_until > ge.detection_time)
          )
      )::DECIMAL / (SELECT COUNT(*) FROM guardian_events WHERE driver_id = d.id AND verified = true) * 100
    )
    ELSE 0
  END::DECIMAL(5,2) as coverage_percentage
FROM drivers d
LEFT JOIN driver_vehicle_assignments dva ON d.id = dva.driver_id
GROUP BY d.id, d.full_name
HAVING COUNT(dva.id) > 0
ORDER BY coverage_percentage DESC;

GRANT SELECT ON driver_assignment_coverage TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ driver_assignment_coverage view created'; END $$;

-- Create view for events without assignments
CREATE OR REPLACE VIEW guardian_events_without_assignments AS
SELECT
  ge.id as event_id,
  ge.detection_time,
  ge.driver_id,
  d.full_name as driver_name,
  ge.vehicle_id,
  v.registration as vehicle_registration,
  ge.event_type,
  ge.fleet,
  ge.depot
FROM guardian_events ge
JOIN drivers d ON ge.driver_id = d.id
JOIN vehicles v ON ge.vehicle_id = v.id
WHERE ge.verified = true
  AND NOT EXISTS (
    SELECT 1 FROM driver_vehicle_assignments dva
    WHERE dva.driver_id = ge.driver_id
      AND dva.vehicle_id = ge.vehicle_id
      AND dva.valid_from <= ge.detection_time
      AND (dva.valid_until IS NULL OR dva.valid_until > ge.detection_time)
  )
ORDER BY ge.detection_time DESC;

GRANT SELECT ON guardian_events_without_assignments TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ guardian_events_without_assignments view created'; END $$;

-- =====================================================
-- STEP 6: POST-INFERENCE STATISTICS
-- =====================================================

DO $$
DECLARE
  total_assignments INTEGER;
  primary_assignments INTEGER;
  temporary_assignments INTEGER;
  active_assignments INTEGER;
  drivers_with_assignments INTEGER;
  vehicles_with_assignments INTEGER;
  avg_coverage DECIMAL;
  events_without_assignment INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_assignments FROM driver_vehicle_assignments;
  SELECT COUNT(*) INTO primary_assignments FROM driver_vehicle_assignments WHERE assignment_type = 'primary';
  SELECT COUNT(*) INTO temporary_assignments FROM driver_vehicle_assignments WHERE assignment_type = 'temporary';
  SELECT COUNT(*) INTO active_assignments FROM current_driver_assignments;
  SELECT COUNT(DISTINCT driver_id) INTO drivers_with_assignments FROM driver_vehicle_assignments;
  SELECT COUNT(DISTINCT vehicle_id) INTO vehicles_with_assignments FROM driver_vehicle_assignments;
  SELECT AVG(coverage_percentage) INTO avg_coverage FROM driver_assignment_coverage;
  SELECT COUNT(*) INTO events_without_assignment FROM guardian_events_without_assignments;

  RAISE NOTICE '';
  RAISE NOTICE 'AFTER INFERENCE:';
  RAISE NOTICE '  Total assignments: %', total_assignments;
  RAISE NOTICE '  Primary assignments: %', primary_assignments;
  RAISE NOTICE '  Temporary assignments: %', temporary_assignments;
  RAISE NOTICE '  Active (ongoing) assignments: %', active_assignments;
  RAISE NOTICE '  Drivers with assignments: %', drivers_with_assignments;
  RAISE NOTICE '  Vehicles with assignments: %', vehicles_with_assignments;
  RAISE NOTICE '  Average event coverage: %.1f%%', avg_coverage;
  RAISE NOTICE '  Events without assignments: %', events_without_assignment;
  RAISE NOTICE '';
END $$;

-- =====================================================
-- SUCCESS
-- =====================================================

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== PHASE 3.4 COMPLETE ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  ✓ Primary driver-vehicle assignments';
  RAISE NOTICE '  ✓ Temporary assignments for secondary vehicles';
  RAISE NOTICE '  ✓ Extended ongoing assignments based on recent activity';
  RAISE NOTICE '  ✓ driver_assignment_coverage view';
  RAISE NOTICE '  ✓ guardian_events_without_assignments view';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Review driver_assignment_coverage for gaps';
  RAISE NOTICE '  2. Review guardian_events_without_assignments';
  RAISE NOTICE '  3. Add manual assignments where needed';
  RAISE NOTICE '  4. Proceed to Phase 3.5 (Trip-delivery correlation)';
  RAISE NOTICE '';
  RAISE NOTICE 'Useful queries:';
  RAISE NOTICE '  SELECT * FROM driver_assignment_coverage ORDER BY coverage_percentage ASC LIMIT 10;';
  RAISE NOTICE '  SELECT * FROM guardian_events_without_assignments LIMIT 20;';
  RAISE NOTICE '  SELECT * FROM current_driver_assignments;';
  RAISE NOTICE '';
END $$;
