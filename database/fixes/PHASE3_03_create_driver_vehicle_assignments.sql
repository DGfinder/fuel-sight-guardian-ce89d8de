-- =====================================================
-- PHASE 3.3: DRIVER-VEHICLE ASSIGNMENT TRACKING
-- =====================================================
-- Tracks which driver uses which vehicle during time periods
-- Supports primary/temporary/backup assignments
-- Enables correlation of events to driver-vehicle pairs
-- =====================================================

DO $$ BEGIN RAISE NOTICE '=== PHASE 3.3: CREATING DRIVER-VEHICLE ASSIGNMENT TRACKING ==='; END $$;

-- =====================================================
-- STEP 1: CREATE ASSIGNMENT TABLE
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 1/5: Creating driver_vehicle_assignments table...'; END $$;

CREATE TABLE IF NOT EXISTS driver_vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,

  -- Time period (NULL valid_until = ongoing assignment)
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,

  -- Assignment type
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('primary', 'temporary', 'backup')),

  -- Metadata
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  source TEXT, -- 'manual', 'inferred_from_events', 'fleet_management_system'
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT valid_time_range CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT no_overlapping_primary_assignments
    EXCLUDE USING GIST (
      driver_id WITH =,
      tstzrange(valid_from, valid_until, '[)') WITH &&
    ) WHERE (assignment_type = 'primary')
);

DO $$ BEGIN RAISE NOTICE '✓ driver_vehicle_assignments table created'; END $$;

-- =====================================================
-- STEP 2: CREATE INDEXES
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 2/5: Creating performance indexes...'; END $$;

CREATE INDEX IF NOT EXISTS idx_assignments_driver
  ON driver_vehicle_assignments(driver_id);

CREATE INDEX IF NOT EXISTS idx_assignments_vehicle
  ON driver_vehicle_assignments(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_assignments_time_range
  ON driver_vehicle_assignments USING GIST (tstzrange(valid_from, valid_until, '[)'));

CREATE INDEX IF NOT EXISTS idx_assignments_active
  ON driver_vehicle_assignments(driver_id, vehicle_id)
  WHERE valid_until IS NULL OR valid_until > NOW();

CREATE INDEX IF NOT EXISTS idx_assignments_type
  ON driver_vehicle_assignments(assignment_type);

DO $$ BEGIN RAISE NOTICE '✓ 5 indexes created'; END $$;

-- =====================================================
-- STEP 3: CREATE CURRENT ASSIGNMENTS VIEW
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 3/5: Creating current_driver_assignments view...'; END $$;

CREATE OR REPLACE VIEW current_driver_assignments AS
SELECT
  dva.id as assignment_id,
  dva.driver_id,
  d.full_name as driver_name,
  d.drivers_license as licence_number,
  dva.vehicle_id,
  v.registration as vehicle_registration,
  v.fleet_number,
  v.make,
  v.model,
  dva.assignment_type,
  dva.valid_from,
  dva.valid_until,
  dva.confidence_score,
  dva.source,
  dva.notes,
  -- Days assigned
  CASE
    WHEN dva.valid_until IS NULL THEN EXTRACT(DAY FROM NOW() - dva.valid_from)::INTEGER
    ELSE EXTRACT(DAY FROM dva.valid_until - dva.valid_from)::INTEGER
  END as days_assigned,
  -- Active status
  CASE
    WHEN dva.valid_until IS NULL THEN true
    WHEN dva.valid_until > NOW() THEN true
    ELSE false
  END as is_active
FROM driver_vehicle_assignments dva
JOIN drivers d ON dva.driver_id = d.id
JOIN vehicles v ON dva.vehicle_id = v.id
WHERE dva.valid_until IS NULL OR dva.valid_until > NOW()
ORDER BY dva.assignment_type, d.full_name;

GRANT SELECT ON current_driver_assignments TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ current_driver_assignments view created'; END $$;

-- =====================================================
-- STEP 4: CREATE ASSIGNMENT HISTORY VIEW
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 4/5: Creating driver_assignment_history view...'; END $$;

CREATE OR REPLACE VIEW driver_assignment_history AS
SELECT
  dva.id as assignment_id,
  dva.driver_id,
  d.full_name as driver_name,
  dva.vehicle_id,
  v.registration as vehicle_registration,
  v.fleet_number,
  dva.assignment_type,
  dva.valid_from,
  dva.valid_until,
  CASE
    WHEN dva.valid_until IS NULL THEN EXTRACT(DAY FROM NOW() - dva.valid_from)::INTEGER
    ELSE EXTRACT(DAY FROM dva.valid_until - dva.valid_from)::INTEGER
  END as duration_days,
  dva.confidence_score,
  dva.source,
  dva.notes,
  dva.created_at,
  -- Status
  CASE
    WHEN dva.valid_until IS NULL THEN 'active'
    WHEN dva.valid_until > NOW() THEN 'active'
    ELSE 'ended'
  END as status
FROM driver_vehicle_assignments dva
JOIN drivers d ON dva.driver_id = d.id
JOIN vehicles v ON dva.vehicle_id = v.id
ORDER BY dva.valid_from DESC;

GRANT SELECT ON driver_assignment_history TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ driver_assignment_history view created'; END $$;

-- =====================================================
-- STEP 5: CREATE HELPER FUNCTION
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 5/5: Creating get_driver_for_vehicle_at_time() function...'; END $$;

CREATE OR REPLACE FUNCTION get_driver_for_vehicle_at_time(
  p_vehicle_id UUID,
  p_timestamp TIMESTAMPTZ
)
RETURNS TABLE (
  driver_id UUID,
  driver_name TEXT,
  assignment_type TEXT,
  confidence_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dva.driver_id,
    d.full_name as driver_name,
    dva.assignment_type,
    dva.confidence_score
  FROM driver_vehicle_assignments dva
  JOIN drivers d ON dva.driver_id = d.id
  WHERE dva.vehicle_id = p_vehicle_id
    AND dva.valid_from <= p_timestamp
    AND (dva.valid_until IS NULL OR dva.valid_until > p_timestamp)
  ORDER BY
    CASE dva.assignment_type
      WHEN 'primary' THEN 1
      WHEN 'temporary' THEN 2
      WHEN 'backup' THEN 3
    END,
    dva.confidence_score DESC NULLS LAST
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

DO $$ BEGIN RAISE NOTICE '✓ get_driver_for_vehicle_at_time() function created'; END $$;

-- =====================================================
-- STEP 6: GRANT PERMISSIONS
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Granting permissions...'; END $$;

GRANT SELECT ON driver_vehicle_assignments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON driver_vehicle_assignments TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ Permissions granted'; END $$;

-- =====================================================
-- STEP 7: STATISTICS
-- =====================================================

DO $$
DECLARE
  assignment_count INTEGER;
  active_count INTEGER;
  driver_count INTEGER;
  vehicle_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO assignment_count FROM driver_vehicle_assignments;
  SELECT COUNT(*) INTO active_count FROM current_driver_assignments;
  SELECT COUNT(DISTINCT driver_id) INTO driver_count FROM driver_vehicle_assignments;
  SELECT COUNT(DISTINCT vehicle_id) INTO vehicle_count FROM driver_vehicle_assignments;

  RAISE NOTICE '';
  RAISE NOTICE 'CURRENT STATE:';
  RAISE NOTICE '  Total assignments: %', assignment_count;
  RAISE NOTICE '  Active assignments: %', active_count;
  RAISE NOTICE '  Drivers with assignments: %', driver_count;
  RAISE NOTICE '  Vehicles with assignments: %', vehicle_count;
  RAISE NOTICE '';
END $$;

-- =====================================================
-- SUCCESS
-- =====================================================

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== PHASE 3.3 COMPLETE ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  ✓ driver_vehicle_assignments table';
  RAISE NOTICE '  ✓ current_driver_assignments view';
  RAISE NOTICE '  ✓ driver_assignment_history view';
  RAISE NOTICE '  ✓ get_driver_for_vehicle_at_time() function';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run Phase 3.4 to infer assignments from events';
  RAISE NOTICE '  2. Add manual assignments as needed';
  RAISE NOTICE '  3. Use assignments for trip-delivery correlation';
  RAISE NOTICE '';
  RAISE NOTICE 'Example queries:';
  RAISE NOTICE '  SELECT * FROM current_driver_assignments;';
  RAISE NOTICE '  SELECT * FROM driver_assignment_history LIMIT 20;';
  RAISE NOTICE '  SELECT * FROM get_driver_for_vehicle_at_time(''vehicle-uuid'', NOW());';
  RAISE NOTICE '';
END $$;
