-- =====================================================
-- CREATE ANALYTICS FOREIGN KEY CONSTRAINTS
-- =====================================================
-- Establishes proper relationships between analytics tables
-- Improves data integrity and enables JOIN optimizations
-- =====================================================
-- SCOPE: Analytics tables only - NO fuel tank tables
-- =====================================================

\echo '========================================='
\echo 'ANALYTICS FOREIGN KEY CONSTRAINTS'
\echo 'Creating relationships between tables...'
\echo '========================================='
\echo ''

-- Set error handling (continue on constraint already exists)
\set ON_ERROR_STOP off

-- =====================================================
-- SECTION 1: LYTX SAFETY EVENTS → VEHICLES
-- =====================================================

\echo 'SECTION 1: LYTX to Vehicles relationships...'

-- Add vehicle_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lytx_safety_events'
        AND column_name = 'vehicle_id'
    ) THEN
        ALTER TABLE lytx_safety_events
        ADD COLUMN vehicle_id UUID;
        RAISE NOTICE 'Added vehicle_id column to lytx_safety_events';
    ELSE
        RAISE NOTICE 'vehicle_id column already exists';
    END IF;
END $$;

-- Create foreign key for vehicle_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_lytx_vehicle_id'
    ) THEN
        ALTER TABLE lytx_safety_events
        ADD CONSTRAINT fk_lytx_vehicle_id
        FOREIGN KEY (vehicle_id)
        REFERENCES vehicles(id)
        ON DELETE SET NULL;
        RAISE NOTICE '✓ Created FK: lytx_safety_events.vehicle_id → vehicles.id';
    ELSE
        RAISE NOTICE 'FK fk_lytx_vehicle_id already exists';
    END IF;
END $$;

-- Create index on vehicle_id for performance
CREATE INDEX IF NOT EXISTS idx_lytx_vehicle_id
ON lytx_safety_events(vehicle_id)
WHERE vehicle_id IS NOT NULL;

\echo ''

-- =====================================================
-- SECTION 2: GUARDIAN EVENTS → DRIVERS
-- =====================================================

\echo 'SECTION 2: Guardian Events to Drivers relationships...'

-- Add driver_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'guardian_events'
        AND column_name = 'driver_id'
    ) THEN
        ALTER TABLE guardian_events
        ADD COLUMN driver_id UUID;
        RAISE NOTICE 'Added driver_id column to guardian_events';
    ELSE
        RAISE NOTICE 'driver_id column already exists';
    END IF;
END $$;

-- Create foreign key for driver_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_guardian_driver_id'
    ) THEN
        ALTER TABLE guardian_events
        ADD CONSTRAINT fk_guardian_driver_id
        FOREIGN KEY (driver_id)
        REFERENCES drivers(id)
        ON DELETE SET NULL;
        RAISE NOTICE '✓ Created FK: guardian_events.driver_id → drivers.id';
    ELSE
        RAISE NOTICE 'FK fk_guardian_driver_id already exists';
    END IF;
END $$;

-- Create index on driver_id for performance
CREATE INDEX IF NOT EXISTS idx_guardian_driver_id
ON guardian_events(driver_id)
WHERE driver_id IS NOT NULL;

\echo ''

-- =====================================================
-- SECTION 3: CAPTIVE PAYMENT RECORDS → CREATED BY
-- =====================================================

\echo 'SECTION 3: Captive Payments to User relationships...'

-- Foreign key for created_by
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_captive_created_by'
    ) THEN
        ALTER TABLE captive_payment_records
        ADD CONSTRAINT fk_captive_created_by
        FOREIGN KEY (created_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
        RAISE NOTICE '✓ Created FK: captive_payment_records.created_by → auth.users.id';
    ELSE
        RAISE NOTICE 'FK fk_captive_created_by already exists';
    END IF;
END $$;

\echo ''

-- =====================================================
-- SECTION 4: DATA FRESHNESS TRACKING → REGISTRY
-- =====================================================

\echo 'SECTION 4: Data Freshness System relationships...'

-- Check if data_freshness_tracking table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'data_freshness_tracking'
    ) THEN
        -- Create foreign key for source_key
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_freshness_source_key'
        ) THEN
            ALTER TABLE data_freshness_tracking
            ADD CONSTRAINT fk_freshness_source_key
            FOREIGN KEY (source_key)
            REFERENCES data_source_registry(source_key)
            ON DELETE CASCADE;
            RAISE NOTICE '✓ Created FK: data_freshness_tracking.source_key → data_source_registry.source_key';
        ELSE
            RAISE NOTICE 'FK fk_freshness_source_key already exists';
        END IF;
    ELSE
        RAISE NOTICE 'Skipping: data_freshness_tracking table does not exist';
    END IF;
END $$;

\echo ''

-- =====================================================
-- SECTION 5: DRIVER ASSOCIATION TABLES
-- =====================================================

\echo 'SECTION 5: Driver Association relationships...'

-- LYTX Driver Associations
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'driver_lytx_associations'
    ) THEN
        -- FK to drivers
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_driver_lytx_driver'
        ) THEN
            ALTER TABLE driver_lytx_associations
            ADD CONSTRAINT fk_driver_lytx_driver
            FOREIGN KEY (driver_id)
            REFERENCES drivers(id)
            ON DELETE CASCADE;
            RAISE NOTICE '✓ Created FK: driver_lytx_associations.driver_id → drivers.id';
        END IF;

        -- FK to lytx events
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_driver_lytx_event'
        ) THEN
            ALTER TABLE driver_lytx_associations
            ADD CONSTRAINT fk_driver_lytx_event
            FOREIGN KEY (lytx_event_id)
            REFERENCES lytx_safety_events(id)
            ON DELETE CASCADE;
            RAISE NOTICE '✓ Created FK: driver_lytx_associations.lytx_event_id → lytx_safety_events.id';
        END IF;
    ELSE
        RAISE NOTICE 'Skipping: driver_lytx_associations table does not exist';
    END IF;
END $$;

-- Guardian Driver Associations
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'driver_guardian_associations'
    ) THEN
        -- FK to drivers
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_driver_guardian_driver'
        ) THEN
            ALTER TABLE driver_guardian_associations
            ADD CONSTRAINT fk_driver_guardian_driver
            FOREIGN KEY (driver_id)
            REFERENCES drivers(id)
            ON DELETE CASCADE;
            RAISE NOTICE '✓ Created FK: driver_guardian_associations.driver_id → drivers.id';
        END IF;

        -- FK to guardian events
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_driver_guardian_event'
        ) THEN
            ALTER TABLE driver_guardian_associations
            ADD CONSTRAINT fk_driver_guardian_event
            FOREIGN KEY (guardian_event_id)
            REFERENCES guardian_events(id)
            ON DELETE CASCADE;
            RAISE NOTICE '✓ Created FK: driver_guardian_associations.guardian_event_id → guardian_events.id';
        END IF;
    ELSE
        RAISE NOTICE 'Skipping: driver_guardian_associations table does not exist';
    END IF;
END $$;

\echo ''

-- =====================================================
-- SECTION 6: PERFORMANCE INDEXES
-- =====================================================

\echo 'SECTION 6: Creating performance indexes...'

-- LYTX indexes
CREATE INDEX IF NOT EXISTS idx_lytx_carrier_depot ON lytx_safety_events(carrier, depot);
CREATE INDEX IF NOT EXISTS idx_lytx_event_datetime ON lytx_safety_events(event_datetime DESC);
CREATE INDEX IF NOT EXISTS idx_lytx_driver_name ON lytx_safety_events(driver_name);
CREATE INDEX IF NOT EXISTS idx_lytx_excluded ON lytx_safety_events(excluded) WHERE excluded = false;

-- Guardian indexes
CREATE INDEX IF NOT EXISTS idx_guardian_fleet ON guardian_events(fleet);
CREATE INDEX IF NOT EXISTS idx_guardian_detection_time ON guardian_events(detection_time DESC);
CREATE INDEX IF NOT EXISTS idx_guardian_verified ON guardian_events(verified) WHERE verified = true;

-- Captive payments indexes (if not already created)
CREATE INDEX IF NOT EXISTS idx_captive_carrier_date ON captive_payment_records(carrier, delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_captive_terminal ON captive_payment_records(terminal);
CREATE INDEX IF NOT EXISTS idx_captive_customer ON captive_payment_records(customer);

-- Vehicle indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_registration ON vehicles(UPPER(registration));
CREATE INDEX IF NOT EXISTS idx_vehicles_lytx_device ON vehicles(lytx_device) WHERE lytx_device IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);

\echo '✓ Performance indexes created'
\echo ''

-- =====================================================
-- VALIDATION
-- =====================================================

\echo '========================================='
\echo 'VALIDATION: Checking constraints...'
\echo '========================================='

SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'lytx_safety_events',
    'guardian_events',
    'captive_payment_records',
    'data_freshness_tracking',
    'driver_lytx_associations',
    'driver_guardian_associations'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- =====================================================
-- SUMMARY
-- =====================================================

\echo ''
\echo '========================================='
\echo 'SUCCESS: Foreign keys created!'
\echo '========================================='
\echo ''
\echo 'Created relationships:'
\echo '  ✓ LYTX events → Vehicles'
\echo '  ✓ Guardian events → Drivers'
\echo '  ✓ Captive payments → Users (created_by)'
\echo '  ✓ Data freshness → Source registry'
\echo '  ✓ Driver associations → Drivers & Events'
\echo ''
\echo 'Benefits:'
\echo '  - Improved data integrity'
\echo '  - Faster JOIN queries'
\echo '  - Automatic cleanup on deletion'
\echo '  - Better query planning'
\echo ''
\echo 'Next steps:'
\echo '  1. Populate vehicle_id and driver_id columns'
\echo '  2. Create driver-vehicle assignment tracking'
\echo '  3. Build trip-delivery correlation system'
\echo ''
