-- =====================================================
-- ANALYTICS PLATFORM FIX - SUPABASE SQL EDITOR VERSION
-- =====================================================
-- This script is compatible with Supabase SQL Editor
-- Copy/paste this entire file and click "Run"
-- =====================================================
-- Creates: 4 critical views + foreign key constraints
-- Time: ~30 seconds
-- =====================================================

-- Progress indicator
DO $$ BEGIN RAISE NOTICE '=== STARTING ANALYTICS PLATFORM FIXES ==='; END $$;

-- =====================================================
-- STEP 1: CREATE cross_analytics_summary VIEW
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 1/5: Creating cross_analytics_summary view...'; END $$;

DROP VIEW IF EXISTS cross_analytics_summary CASCADE;

CREATE OR REPLACE VIEW cross_analytics_summary AS

WITH monthly_captive AS (
    SELECT
        CASE
            WHEN carrier = 'SMB' THEN 'Stevemacs'
            WHEN carrier = 'GSF' THEN 'Great Southern Fuels'
            ELSE carrier::text
        END as fleet,
        terminal as depot,
        TO_CHAR(delivery_date, 'Mon') as month,
        EXTRACT(YEAR FROM delivery_date)::INTEGER as year,
        EXTRACT(MONTH FROM delivery_date)::INTEGER as month_num,
        COUNT(DISTINCT delivery_key) as deliveries,
        (SUM(total_volume_litres_abs) / 1000000)::DECIMAL(12,4) as volume_ml
    FROM captive_deliveries
    WHERE delivery_date IS NOT NULL
    GROUP BY
        CASE
            WHEN carrier = 'SMB' THEN 'Stevemacs'
            WHEN carrier = 'GSF' THEN 'Great Southern Fuels'
            ELSE carrier::text
        END,
        terminal,
        DATE_TRUNC('month', delivery_date),
        EXTRACT(YEAR FROM delivery_date),
        EXTRACT(MONTH FROM delivery_date),
        TO_CHAR(delivery_date, 'Mon')
),
monthly_lytx AS (
    SELECT
        carrier as fleet,
        depot,
        TO_CHAR(event_datetime, 'Mon') as month,
        EXTRACT(YEAR FROM event_datetime)::INTEGER as year,
        EXTRACT(MONTH FROM event_datetime)::INTEGER as month_num,
        COUNT(*)::INTEGER as safety_events,
        AVG(score)::DECIMAL(5,2) as avg_safety_score
    FROM lytx_safety_events
    WHERE excluded IS NOT TRUE
      AND event_datetime IS NOT NULL
    GROUP BY
        carrier,
        depot,
        DATE_TRUNC('month', event_datetime),
        EXTRACT(YEAR FROM event_datetime),
        EXTRACT(MONTH FROM event_datetime),
        TO_CHAR(event_datetime, 'Mon')
),
monthly_guardian AS (
    SELECT
        fleet,
        depot,
        TO_CHAR(detection_time, 'Mon') as month,
        EXTRACT(YEAR FROM detection_time)::INTEGER as year,
        EXTRACT(MONTH FROM detection_time)::INTEGER as month_num,
        COUNT(*)::INTEGER as guardian_events
    FROM guardian_events
    WHERE verified = true
      AND detection_time IS NOT NULL
    GROUP BY
        fleet,
        depot,
        DATE_TRUNC('month', detection_time),
        EXTRACT(YEAR FROM detection_time),
        EXTRACT(MONTH FROM detection_time),
        TO_CHAR(detection_time, 'Mon')
),
monthly_vehicles AS (
    SELECT
        fleet,
        depot,
        COUNT(DISTINCT id)::INTEGER as active_vehicles
    FROM vehicles
    WHERE status = 'Active'
    GROUP BY fleet, depot
)
SELECT
    COALESCE(mc.fleet, ml.fleet, mg.fleet)::TEXT as fleet,
    COALESCE(mc.depot, ml.depot, mg.depot)::TEXT as depot,
    COALESCE(mc.month, ml.month, mg.month)::TEXT as month,
    COALESCE(mc.year, ml.year, mg.year)::INTEGER as year,
    COALESCE(mc.month_num, ml.month_num, mg.month_num)::INTEGER as month_num,
    COALESCE(mc.deliveries, 0)::INTEGER as captive_deliveries,
    COALESCE(mc.volume_ml, 0)::DECIMAL(12,4) as captive_volume_ml,
    COALESCE(ml.safety_events, 0)::INTEGER as safety_events,
    COALESCE(mg.guardian_events, 0)::INTEGER as guardian_events,
    COALESCE(mv.active_vehicles, 0)::INTEGER as active_vehicles,
    COALESCE(ml.avg_safety_score, 0)::DECIMAL(5,2) as avg_safety_score,
    CASE
        WHEN COALESCE(mv.active_vehicles, 0) > 0
        THEN ((COALESCE(ml.safety_events, 0) + COALESCE(mg.guardian_events, 0))::DECIMAL / mv.active_vehicles)::DECIMAL(6,2)
        ELSE 0
    END as events_per_vehicle,
    CASE
        WHEN COALESCE(mv.active_vehicles, 0) > 0
        THEN (COALESCE(mc.volume_ml, 0) / mv.active_vehicles)::DECIMAL(8,2)
        ELSE 0
    END as volume_per_vehicle
FROM monthly_captive mc
FULL OUTER JOIN monthly_lytx ml
    ON mc.fleet = ml.fleet AND mc.depot = ml.depot AND mc.month = ml.month AND mc.year = ml.year
FULL OUTER JOIN monthly_guardian mg
    ON COALESCE(mc.fleet, ml.fleet) = mg.fleet
    AND COALESCE(mc.depot, ml.depot) = mg.depot
    AND COALESCE(mc.month, ml.month) = mg.month
    AND COALESCE(mc.year, ml.year) = mg.year
LEFT JOIN monthly_vehicles mv
    ON COALESCE(mc.fleet, ml.fleet, mg.fleet) = mv.fleet
    AND COALESCE(mc.depot, ml.depot, mg.depot) = mv.depot
WHERE COALESCE(mc.fleet, ml.fleet, mg.fleet) IS NOT NULL
ORDER BY year DESC, month_num DESC, fleet, depot;

ALTER VIEW cross_analytics_summary SET (security_invoker = true);
GRANT SELECT ON cross_analytics_summary TO authenticated;
GRANT SELECT ON cross_analytics_summary TO service_role;

DO $$ BEGIN RAISE NOTICE '✓ cross_analytics_summary created'; END $$;

-- =====================================================
-- STEP 2: CREATE captive_payments_analytics VIEW
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 2/5: Creating captive_payments_analytics view...'; END $$;

DROP VIEW IF EXISTS captive_payments_analytics CASCADE;

CREATE OR REPLACE VIEW captive_payments_analytics AS

WITH monthly_summary AS (
    SELECT
        carrier,
        TO_CHAR(delivery_date, 'Mon') as month,
        EXTRACT(YEAR FROM delivery_date)::INTEGER as year,
        EXTRACT(MONTH FROM delivery_date)::INTEGER as month_num,
        DATE_TRUNC('month', delivery_date) as month_start,
        COUNT(DISTINCT delivery_key)::INTEGER as total_deliveries,
        SUM(total_volume_litres_abs)::DECIMAL(15,2) as total_volume_litres,
        (SUM(total_volume_litres_abs) / 1000000)::DECIMAL(12,4) as total_volume_megalitres,
        COUNT(DISTINCT customer)::INTEGER as unique_customers,
        CASE
            WHEN COUNT(DISTINCT delivery_key) > 0
            THEN (SUM(total_volume_litres_abs) / COUNT(DISTINCT delivery_key))::DECIMAL(10,2)
            ELSE 0
        END as avg_delivery_size
    FROM captive_deliveries
    WHERE delivery_date IS NOT NULL
    GROUP BY
        carrier,
        DATE_TRUNC('month', delivery_date),
        EXTRACT(YEAR FROM delivery_date),
        EXTRACT(MONTH FROM delivery_date),
        TO_CHAR(delivery_date, 'Mon')
),
customer_rankings AS (
    SELECT
        carrier,
        DATE_TRUNC('month', delivery_date) as month_start,
        customer,
        SUM(total_volume_litres_abs)::DECIMAL(15,2) as customer_volume,
        ROW_NUMBER() OVER (
            PARTITION BY carrier, DATE_TRUNC('month', delivery_date)
            ORDER BY SUM(total_volume_litres_abs) DESC
        ) as rank
    FROM captive_deliveries
    WHERE delivery_date IS NOT NULL
    GROUP BY carrier, DATE_TRUNC('month', delivery_date), customer
)
SELECT
    ms.carrier::TEXT,
    ms.month::TEXT,
    ms.year,
    ms.month_num,
    ms.total_deliveries,
    ms.total_volume_litres,
    ms.total_volume_megalitres,
    ms.unique_customers,
    COALESCE(cr.customer, 'N/A')::TEXT as top_customer,
    COALESCE(cr.customer_volume, 0)::DECIMAL(15,2) as top_customer_volume,
    ms.avg_delivery_size
FROM monthly_summary ms
LEFT JOIN customer_rankings cr
    ON ms.carrier = cr.carrier
    AND ms.month_start = cr.month_start
    AND cr.rank = 1
ORDER BY ms.year DESC, ms.month_num DESC, ms.carrier;

ALTER VIEW captive_payments_analytics SET (security_invoker = true);
GRANT SELECT ON captive_payments_analytics TO authenticated;
GRANT SELECT ON captive_payments_analytics TO service_role;

DO $$ BEGIN RAISE NOTICE '✓ captive_payments_analytics created'; END $$;

-- =====================================================
-- STEP 3: CREATE lytx_safety_analytics VIEW
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 3/5: Creating lytx_safety_analytics view...'; END $$;

DROP VIEW IF EXISTS lytx_safety_analytics CASCADE;

CREATE OR REPLACE VIEW lytx_safety_analytics AS

SELECT
    carrier::TEXT,
    depot::TEXT,
    TO_CHAR(event_datetime, 'Mon') as month,
    EXTRACT(YEAR FROM event_datetime)::INTEGER as year,
    EXTRACT(MONTH FROM event_datetime)::INTEGER as month_num,
    COUNT(*)::INTEGER as total_events,
    COUNT(CASE WHEN event_type = 'Coachable' THEN 1 END)::INTEGER as coachable_events,
    COUNT(CASE WHEN event_type = 'Driver Tagged' THEN 1 END)::INTEGER as driver_tagged_events,
    COUNT(CASE WHEN status = 'New' THEN 1 END)::INTEGER as new_events,
    COUNT(CASE WHEN status = 'Resolved' THEN 1 END)::INTEGER as resolved_events,
    COALESCE(AVG(score), 0)::DECIMAL(5,2) as avg_score,
    COUNT(DISTINCT driver_name)::INTEGER as unique_drivers,
    COUNT(DISTINCT CASE WHEN score >= 80 THEN driver_name END)::INTEGER as high_risk_drivers
FROM lytx_safety_events
WHERE excluded IS NOT TRUE
  AND event_datetime IS NOT NULL
GROUP BY
    carrier,
    depot,
    DATE_TRUNC('month', event_datetime),
    EXTRACT(YEAR FROM event_datetime),
    EXTRACT(MONTH FROM event_datetime),
    TO_CHAR(event_datetime, 'Mon')
ORDER BY year DESC, month_num DESC, carrier, depot;

ALTER VIEW lytx_safety_analytics SET (security_invoker = true);
GRANT SELECT ON lytx_safety_analytics TO authenticated;
GRANT SELECT ON lytx_safety_analytics TO service_role;

DO $$ BEGIN RAISE NOTICE '✓ lytx_safety_analytics created'; END $$;

-- =====================================================
-- STEP 4: CREATE lytx_events_enriched VIEW
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 4/5: Creating lytx_events_enriched view...'; END $$;

DROP VIEW IF EXISTS lytx_events_enriched CASCADE;

CREATE OR REPLACE VIEW lytx_events_enriched AS

SELECT
    e.*,
    v.id AS vehicle_id,
    COALESCE(NULLIF(e.vehicle_registration, ''), v.registration) AS resolved_registration,
    v.fleet AS resolved_fleet,
    v.depot AS resolved_depot,
    v.make AS vehicle_make,
    v.model AS vehicle_model,
    v.vin AS vehicle_vin,
    v.guardian_unit AS vehicle_guardian_unit,
    v.lytx_device AS vehicle_lytx_device,
    CASE
        WHEN UPPER(TRIM(e.vehicle_registration)) = UPPER(TRIM(v.registration)) THEN 'EXACT_REGISTRATION'
        WHEN e.device_serial IS NOT NULL AND e.device_serial = v.lytx_device THEN 'EXACT_DEVICE'
        WHEN v.id IS NOT NULL THEN 'PARTIAL_MATCH'
        ELSE 'NO_MATCH'
    END AS match_type
FROM lytx_safety_events e
LEFT JOIN vehicles v
    ON (
        UPPER(TRIM(e.vehicle_registration)) = UPPER(TRIM(v.registration))
        OR
        (e.device_serial IS NOT NULL AND e.device_serial = v.lytx_device)
    );

ALTER VIEW lytx_events_enriched SET (security_invoker = true);
GRANT SELECT ON lytx_events_enriched TO authenticated;
GRANT SELECT ON lytx_events_enriched TO service_role;

DO $$ BEGIN RAISE NOTICE '✓ lytx_events_enriched created'; END $$;

-- =====================================================
-- STEP 5: CREATE FOREIGN KEY CONSTRAINTS
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 5/5: Creating foreign key constraints...'; END $$;

-- Add vehicle_id column to lytx_safety_events if needed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lytx_safety_events' AND column_name = 'vehicle_id'
    ) THEN
        ALTER TABLE lytx_safety_events ADD COLUMN vehicle_id UUID;
        RAISE NOTICE 'Added vehicle_id column to lytx_safety_events';
    END IF;
END $$;

-- Add driver_id column to guardian_events if needed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'guardian_events' AND column_name = 'driver_id'
    ) THEN
        ALTER TABLE guardian_events ADD COLUMN driver_id UUID;
        RAISE NOTICE 'Added driver_id column to guardian_events';
    END IF;
END $$;

-- Foreign key: lytx_safety_events → vehicles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_lytx_vehicle_id'
    ) THEN
        ALTER TABLE lytx_safety_events
        ADD CONSTRAINT fk_lytx_vehicle_id
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
        RAISE NOTICE '✓ Created FK: lytx_safety_events.vehicle_id → vehicles.id';
    END IF;
END $$;

-- Foreign key: guardian_events → drivers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_guardian_driver_id'
    ) THEN
        ALTER TABLE guardian_events
        ADD CONSTRAINT fk_guardian_driver_id
        FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;
        RAISE NOTICE '✓ Created FK: guardian_events.driver_id → drivers.id';
    END IF;
END $$;

-- Foreign key: captive_payment_records → auth.users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_captive_created_by'
    ) THEN
        ALTER TABLE captive_payment_records
        ADD CONSTRAINT fk_captive_created_by
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
        RAISE NOTICE '✓ Created FK: captive_payment_records.created_by → auth.users.id';
    END IF;
END $$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_lytx_vehicle_id ON lytx_safety_events(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guardian_driver_id ON guardian_events(driver_id) WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lytx_carrier_depot ON lytx_safety_events(carrier, depot);
CREATE INDEX IF NOT EXISTS idx_lytx_event_datetime ON lytx_safety_events(event_datetime DESC);
CREATE INDEX IF NOT EXISTS idx_lytx_excluded ON lytx_safety_events(excluded) WHERE excluded = false;
CREATE INDEX IF NOT EXISTS idx_guardian_verified ON guardian_events(verified) WHERE verified = true;
CREATE INDEX IF NOT EXISTS idx_vehicles_registration ON vehicles(UPPER(registration));
CREATE INDEX IF NOT EXISTS idx_vehicles_lytx_device ON vehicles(lytx_device) WHERE lytx_device IS NOT NULL;

DO $$ BEGIN RAISE NOTICE '✓ Foreign keys and indexes created'; END $$;

-- =====================================================
-- VALIDATION
-- =====================================================

DO $$ BEGIN RAISE NOTICE '=== VALIDATING FIXES ==='; END $$;

-- Test all views
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM cross_analytics_summary LIMIT 1;
    RAISE NOTICE '✓ cross_analytics_summary is queryable';

    SELECT COUNT(*) INTO v_count FROM captive_payments_analytics LIMIT 1;
    RAISE NOTICE '✓ captive_payments_analytics is queryable';

    SELECT COUNT(*) INTO v_count FROM lytx_safety_analytics LIMIT 1;
    RAISE NOTICE '✓ lytx_safety_analytics is queryable';

    SELECT COUNT(*) INTO v_count FROM lytx_events_enriched LIMIT 1;
    RAISE NOTICE '✓ lytx_events_enriched is queryable';
END $$;

-- =====================================================
-- SUCCESS!
-- =====================================================

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== SUCCESS: ALL FIXES APPLIED! ===';
    RAISE NOTICE '';
    RAISE NOTICE 'Created views:';
    RAISE NOTICE '  ✓ cross_analytics_summary';
    RAISE NOTICE '  ✓ captive_payments_analytics';
    RAISE NOTICE '  ✓ lytx_safety_analytics';
    RAISE NOTICE '  ✓ lytx_events_enriched';
    RAISE NOTICE '';
    RAISE NOTICE 'Added relationships:';
    RAISE NOTICE '  ✓ LYTX events → Vehicles';
    RAISE NOTICE '  ✓ Guardian events → Drivers';
    RAISE NOTICE '  ✓ Captive payments → Users';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Test DataCentre page in your application';
    RAISE NOTICE '  2. Verify analytics cards populate';
    RAISE NOTICE '  3. Check browser console for errors';
    RAISE NOTICE '';
    RAISE NOTICE 'If everything works, you are done!';
END $$;
