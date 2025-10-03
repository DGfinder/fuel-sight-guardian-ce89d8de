-- ============================================================================
-- DATA CENTRE CLEANUP: PHASE 1 - ADD MISSING FOREIGN KEYS
-- ============================================================================
-- Purpose: Add proper foreign key relationships to event and delivery tables
-- Status: NON-BREAKING (adds columns, doesn't remove existing data)
-- Dependencies: Requires drivers, vehicles, mtdata_trip_history tables to exist
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'DATA CENTRE CLEANUP - PHASE 1: ADDING FOREIGN KEYS';
  RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- 1. FIX LYTX_SAFETY_EVENTS - ADD VEHICLE_ID FK
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[1/5] Adding vehicle_id foreign key to lytx_safety_events...';

  -- Add vehicle_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lytx_safety_events' AND column_name = 'vehicle_id'
  ) THEN
    ALTER TABLE lytx_safety_events
    ADD COLUMN vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;
    RAISE NOTICE '  ✓ Added vehicle_id UUID column';
  ELSE
    RAISE NOTICE '  - vehicle_id column already exists';
  END IF;

  -- Add vehicle association metadata columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lytx_safety_events' AND column_name = 'vehicle_association_confidence'
  ) THEN
    ALTER TABLE lytx_safety_events
    ADD COLUMN vehicle_association_confidence DECIMAL(3,2) CHECK (vehicle_association_confidence >= 0.0 AND vehicle_association_confidence <= 1.0),
    ADD COLUMN vehicle_association_method TEXT CHECK (vehicle_association_method IN ('exact_match', 'device_match', 'registration_match', 'manual_assignment')),
    ADD COLUMN vehicle_association_updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE '  ✓ Added vehicle association metadata columns';
  ELSE
    RAISE NOTICE '  - Vehicle association metadata columns already exist';
  END IF;

  RAISE NOTICE '  ✓ LYTX vehicle_id foreign key added successfully';
END $$;

-- ============================================================================
-- 2. FIX GUARDIAN_EVENTS - CONVERT VEHICLE_ID TO UUID
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[2/5] Fixing guardian_events vehicle_id type (INTEGER → UUID)...';

  -- Check current vehicle_id column type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_events'
    AND column_name = 'vehicle_id'
    AND data_type = 'integer'
  ) THEN
    -- Create new UUID column
    ALTER TABLE guardian_events
    ADD COLUMN vehicle_id_uuid UUID REFERENCES vehicles(id) ON DELETE SET NULL;

    RAISE NOTICE '  ✓ Created vehicle_id_uuid column (will be populated in Phase 2)';
    RAISE NOTICE '  ! Old INTEGER vehicle_id column preserved for data migration';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_events'
    AND column_name = 'vehicle_id'
    AND data_type = 'uuid'
  ) THEN
    RAISE NOTICE '  - vehicle_id is already UUID type (no action needed)';
  ELSE
    -- No vehicle_id exists, add it
    ALTER TABLE guardian_events
    ADD COLUMN vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;
    RAISE NOTICE '  ✓ Added vehicle_id UUID column';
  END IF;

  -- Add vehicle association metadata if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_events' AND column_name = 'vehicle_association_confidence'
  ) THEN
    ALTER TABLE guardian_events
    ADD COLUMN vehicle_association_confidence DECIMAL(3,2) CHECK (vehicle_association_confidence >= 0.0 AND vehicle_association_confidence <= 1.0),
    ADD COLUMN vehicle_association_method TEXT CHECK (vehicle_association_method IN ('exact_match', 'unit_serial_match', 'registration_match', 'manual_assignment')),
    ADD COLUMN vehicle_association_updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE '  ✓ Added vehicle association metadata columns';
  END IF;

  RAISE NOTICE '  ✓ Guardian vehicle_id migration prepared';
END $$;

-- ============================================================================
-- 3. ADD CORRELATION COLUMNS TO CAPTIVE_PAYMENT_RECORDS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[3/5] Adding correlation foreign keys to captive_payment_records...';

  -- Add vehicle_id FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'captive_payment_records' AND column_name = 'vehicle_id'
  ) THEN
    ALTER TABLE captive_payment_records
    ADD COLUMN vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;
    RAISE NOTICE '  ✓ Added vehicle_id FK';
  ELSE
    RAISE NOTICE '  - vehicle_id already exists';
  END IF;

  -- Add driver_id FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'captive_payment_records' AND column_name = 'driver_id'
  ) THEN
    ALTER TABLE captive_payment_records
    ADD COLUMN driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL;
    RAISE NOTICE '  ✓ Added driver_id FK';
  ELSE
    RAISE NOTICE '  - driver_id already exists';
  END IF;

  -- Add trip correlation FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'captive_payment_records' AND column_name = 'mtdata_trip_id'
  ) THEN
    ALTER TABLE captive_payment_records
    ADD COLUMN mtdata_trip_id UUID REFERENCES mtdata_trip_history(id) ON DELETE SET NULL;
    RAISE NOTICE '  ✓ Added mtdata_trip_id FK';
  ELSE
    RAISE NOTICE '  - mtdata_trip_id already exists';
  END IF;

  -- Add correlation metadata
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'captive_payment_records' AND column_name = 'correlation_confidence'
  ) THEN
    ALTER TABLE captive_payment_records
    ADD COLUMN correlation_confidence DECIMAL(5,2),
    ADD COLUMN correlation_method TEXT,
    ADD COLUMN correlation_updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE '  ✓ Added correlation metadata columns';
  END IF;

  RAISE NOTICE '  ✓ Captive payments correlation columns added successfully';
END $$;

-- ============================================================================
-- 4. ADD INDEXES FOR PERFORMANCE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[4/5] Creating indexes for new foreign key columns...';
END $$;

-- LYTX indexes
CREATE INDEX IF NOT EXISTS idx_lytx_events_vehicle_id ON lytx_safety_events(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lytx_events_vehicle_confidence ON lytx_safety_events(vehicle_association_confidence DESC) WHERE vehicle_id IS NOT NULL;

-- Guardian indexes
CREATE INDEX IF NOT EXISTS idx_guardian_events_vehicle_uuid ON guardian_events(vehicle_id_uuid) WHERE vehicle_id_uuid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guardian_events_vehicle_id ON guardian_events(vehicle_id) WHERE vehicle_id IS NOT NULL;

-- Captive payments indexes
CREATE INDEX IF NOT EXISTS idx_captive_vehicle_id ON captive_payment_records(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_captive_driver_id ON captive_payment_records(driver_id) WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_captive_trip_id ON captive_payment_records(mtdata_trip_id) WHERE mtdata_trip_id IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '  ✓ Indexes created successfully';
END $$;

-- ============================================================================
-- 5. CREATE AUDIT COMMENTS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[5/5] Adding table and column comments for documentation...';
END $$;

-- LYTX comments
COMMENT ON COLUMN lytx_safety_events.vehicle_id IS 'Foreign key to vehicles table - resolved vehicle from device/registration matching';
COMMENT ON COLUMN lytx_safety_events.vehicle_association_confidence IS 'Confidence score (0.0-1.0) for vehicle match quality';
COMMENT ON COLUMN lytx_safety_events.vehicle_association_method IS 'Method used: exact_match, device_match, registration_match, manual_assignment';

-- Guardian comments
COMMENT ON COLUMN guardian_events.vehicle_id_uuid IS 'New UUID foreign key to vehicles table (replaces INTEGER vehicle_id)';
COMMENT ON COLUMN guardian_events.vehicle_association_confidence IS 'Confidence score (0.0-1.0) for vehicle match quality';
COMMENT ON COLUMN guardian_events.vehicle_association_method IS 'Method used: exact_match, unit_serial_match, registration_match, manual_assignment';

-- Captive payments comments
COMMENT ON COLUMN captive_payment_records.vehicle_id IS 'Foreign key to vehicles table (via trip correlation)';
COMMENT ON COLUMN captive_payment_records.driver_id IS 'Foreign key to drivers table (via trip correlation)';
COMMENT ON COLUMN captive_payment_records.mtdata_trip_id IS 'Foreign key to mtdata_trip_history (delivery-trip correlation)';
COMMENT ON COLUMN captive_payment_records.correlation_confidence IS 'Confidence score for delivery-trip-vehicle-driver correlation';

-- ============================================================================
-- COMPLETION SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'PHASE 1 COMPLETE: FOREIGN KEYS ADDED SUCCESSFULLY';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'CHANGES MADE:';
  RAISE NOTICE '  1. ✓ Added vehicle_id UUID FK to lytx_safety_events';
  RAISE NOTICE '  2. ✓ Created vehicle_id_uuid in guardian_events (migration pending)';
  RAISE NOTICE '  3. ✓ Added vehicle_id, driver_id, trip_id FKs to captive_payment_records';
  RAISE NOTICE '  4. ✓ Created indexes for all new foreign keys';
  RAISE NOTICE '  5. ✓ Added documentation comments';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  → Run migration 002 to populate relationship data';
  RAISE NOTICE '  → Validate data integrity before proceeding';
  RAISE NOTICE '============================================================================';
END $$;

-- Analyze tables to update statistics
ANALYZE lytx_safety_events;
ANALYZE guardian_events;
ANALYZE captive_payment_records;
