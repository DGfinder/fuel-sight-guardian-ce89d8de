-- =====================================================
-- Associate Wayne Bowron with Vehicle 1IDB419
-- =====================================================
-- This migration creates the driver-vehicle association between
-- Wayne Bowron and vehicle 1IDB419 for MTData trips and Guardian events
--
-- Author: Claude Code
-- Created: 2025-08-25

BEGIN;

-- =====================================================
-- 1. VERIFY/CREATE WAYNE BOWRON DRIVER RECORD
-- =====================================================

-- Check if Wayne Bowron already exists in drivers table
DO $$
DECLARE
    wayne_driver_id UUID;
    vehicle_uuid UUID;
BEGIN
    -- Look for existing Wayne Bowron record
    SELECT id INTO wayne_driver_id
    FROM drivers 
    WHERE 
        (first_name ILIKE '%wayne%' AND last_name ILIKE '%bowron%')
        OR (first_name ILIKE '%bowron%' AND last_name ILIKE '%wayne%')
        OR (first_name || ' ' || last_name) ILIKE '%wayne%bowron%'
    LIMIT 1;

    -- If Wayne Bowron doesn't exist, create the driver record
    IF wayne_driver_id IS NULL THEN
        INSERT INTO drivers (
            first_name,
            last_name,
            employee_id,
            fleet,
            depot,
            status,
            hire_date,
            created_at,
            updated_at
        ) VALUES (
            'Wayne',
            'Bowron', 
            'WB001', -- Placeholder employee ID
            'Great Southern Fuels', -- Based on MTData CSV data
            'Great Southern', -- Based on group name from data
            'active',
            '2024-01-01', -- Placeholder hire date
            NOW(),
            NOW()
        ) RETURNING id INTO wayne_driver_id;
        
        RAISE NOTICE 'Created new driver record for Wayne Bowron with ID: %', wayne_driver_id;
    ELSE
        RAISE NOTICE 'Found existing Wayne Bowron driver record with ID: %', wayne_driver_id;
    END IF;

    -- Get vehicle UUID for 1IDB419
    SELECT id INTO vehicle_uuid
    FROM vehicles
    WHERE registration = '1IDB419'
    LIMIT 1;

    IF vehicle_uuid IS NULL THEN
        RAISE NOTICE 'Vehicle 1IDB419 not found in vehicles table - will create associations anyway';
        -- Note: Vehicle may exist in trip data but not in vehicles table yet
    ELSE
        RAISE NOTICE 'Found vehicle 1IDB419 with ID: %', vehicle_uuid;
    END IF;

    -- Store IDs for use in subsequent sections
    -- Create a temporary table to hold our IDs
    DROP TABLE IF EXISTS temp_association_ids;
    CREATE TEMPORARY TABLE temp_association_ids (
        wayne_driver_id UUID,
        vehicle_uuid UUID
    );
    
    INSERT INTO temp_association_ids VALUES (wayne_driver_id, vehicle_uuid);

END $$;

-- =====================================================
-- 2. ADD DRIVER NAME VARIATIONS
-- =====================================================

-- Add Wayne Bowron name variations to driver_name_mappings
DO $$
DECLARE
    wayne_driver_id UUID;
BEGIN
    SELECT wayne_driver_id INTO wayne_driver_id FROM temp_association_ids LIMIT 1;
    
    -- Insert name variations (ignore if they already exist)
    INSERT INTO driver_name_mappings (driver_id, source_system, source_name, normalized_name, confidence_score, created_at)
    VALUES 
        (wayne_driver_id, 'mtdata', 'Wayne Bowron', 'wayne bowron', 1.0, NOW()),
        (wayne_driver_id, 'mtdata', 'Wayne B', 'wayne bowron', 0.9, NOW()),
        (wayne_driver_id, 'mtdata', 'W Bowron', 'wayne bowron', 0.9, NOW()),
        (wayne_driver_id, 'guardian', 'Wayne Bowron', 'wayne bowron', 1.0, NOW()),
        (wayne_driver_id, 'guardian', 'Bowron Wayne', 'wayne bowron', 0.95, NOW()),
        (wayne_driver_id, 'lytx', 'Wayne Bowron', 'wayne bowron', 1.0, NOW()),
        (wayne_driver_id, 'lytx', 'BOWRON WAYNE', 'wayne bowron', 0.95, NOW()),
        (wayne_driver_id, 'smartfuel', 'Wayne Bowron', 'wayne bowron', 1.0, NOW())
    ON CONFLICT (driver_id, source_system, source_name) DO NOTHING;
    
    RAISE NOTICE 'Added name variations for Wayne Bowron (driver_id: %)', wayne_driver_id;
END $$;

-- =====================================================
-- 3. CREATE VEHICLE ASSIGNMENT
-- =====================================================

-- Create vehicle assignment for 1IDB419 to Wayne Bowron
DO $$
DECLARE
    wayne_driver_id UUID;
    vehicle_uuid UUID;
    assignment_exists BOOLEAN := FALSE;
BEGIN
    SELECT wayne_driver_id, vehicle_uuid INTO wayne_driver_id, vehicle_uuid 
    FROM temp_association_ids LIMIT 1;
    
    -- Only create assignment if we have a vehicle UUID
    IF vehicle_uuid IS NOT NULL THEN
        -- Check if assignment already exists
        SELECT EXISTS(
            SELECT 1 FROM driver_assignments 
            WHERE vehicle_id = vehicle_uuid 
            AND driver_id = wayne_driver_id 
            AND unassigned_at IS NULL
        ) INTO assignment_exists;
        
        IF NOT assignment_exists THEN
            -- Unassign any current driver from this vehicle
            UPDATE driver_assignments 
            SET unassigned_at = NOW()
            WHERE vehicle_id = vehicle_uuid 
            AND unassigned_at IS NULL;
            
            -- Create new assignment
            INSERT INTO driver_assignments (
                vehicle_id,
                driver_id, 
                driver_name,
                assigned_at,
                created_by
            ) VALUES (
                vehicle_uuid,
                wayne_driver_id,
                'Wayne Bowron',
                NOW(),
                (SELECT id FROM auth.users WHERE email LIKE '%admin%' LIMIT 1) -- Use admin user if available
            );
            
            RAISE NOTICE 'Created vehicle assignment: Wayne Bowron -> 1IDB419';
        ELSE
            RAISE NOTICE 'Vehicle assignment already exists: Wayne Bowron -> 1IDB419';
        END IF;
    ELSE
        RAISE NOTICE 'Skipping vehicle assignment - vehicle 1IDB419 not found in vehicles table';
    END IF;
END $$;

-- =====================================================
-- 4. ASSOCIATE MTDATA TRIPS
-- =====================================================

-- Associate MTData trip history records for 1IDB419 with Wayne Bowron
DO $$
DECLARE
    wayne_driver_id UUID;
    updated_trips INTEGER := 0;
BEGIN
    SELECT wayne_driver_id INTO wayne_driver_id FROM temp_association_ids LIMIT 1;
    
    -- Update MTData trip history records
    UPDATE mtdata_trip_history 
    SET 
        driver_id = wayne_driver_id,
        driver_association_confidence = 1.0,
        driver_association_method = 'manual_assignment_known_vehicle',
        driver_association_updated_at = NOW()
    WHERE 
        vehicle_registration = '1IDB419'
        AND (driver_id IS NULL OR driver_id != wayne_driver_id);
    
    GET DIAGNOSTICS updated_trips = ROW_COUNT;
    
    RAISE NOTICE 'Associated % MTData trip records for vehicle 1IDB419 with Wayne Bowron', updated_trips;
END $$;

-- =====================================================
-- 5. ASSOCIATE GUARDIAN EVENTS
-- =====================================================

-- Associate Guardian events for 1IDB419 with Wayne Bowron  
DO $$
DECLARE
    wayne_driver_id UUID;
    updated_events INTEGER := 0;
BEGIN
    SELECT wayne_driver_id INTO wayne_driver_id FROM temp_association_ids LIMIT 1;
    
    -- Update Guardian events
    UPDATE guardian_events 
    SET 
        driver_id = wayne_driver_id,
        driver_association_confidence = 1.0,
        driver_association_method = 'manual_assignment_known_vehicle',
        driver_association_updated_at = NOW()
    WHERE 
        vehicle_registration = '1IDB419'
        AND (driver_id IS NULL OR driver_id != wayne_driver_id);
    
    GET DIAGNOSTICS updated_events = ROW_COUNT;
    
    RAISE NOTICE 'Associated % Guardian events for vehicle 1IDB419 with Wayne Bowron', updated_events;
END $$;

-- =====================================================
-- 6. ASSOCIATE LYTX SAFETY EVENTS (if any exist)
-- =====================================================

-- Associate any LYTX safety events that might have Wayne Bowron as driver
DO $$
DECLARE
    wayne_driver_id UUID;
    updated_lytx INTEGER := 0;
BEGIN
    SELECT wayne_driver_id INTO wayne_driver_id FROM temp_association_ids LIMIT 1;
    
    -- Update LYTX events with Wayne Bowron name variations that are unassociated
    UPDATE lytx_safety_events 
    SET 
        driver_id = wayne_driver_id,
        driver_association_confidence = 1.0,
        driver_association_method = 'manual_assignment_known_driver',
        driver_association_updated_at = NOW()
    WHERE 
        driver_id IS NULL
        AND (
            driver_name ILIKE '%wayne%bowron%'
            OR driver_name ILIKE '%bowron%wayne%' 
            OR driver_name ILIKE 'wayne bowron'
            OR driver_name ILIKE 'bowron wayne'
            OR driver_name ILIKE 'w%bowron'
            OR driver_name ILIKE 'wayne b%'
        );
    
    GET DIAGNOSTICS updated_lytx = ROW_COUNT;
    
    RAISE NOTICE 'Associated % LYTX safety events with Wayne Bowron', updated_lytx;
END $$;

-- =====================================================
-- 7. VERIFICATION QUERIES
-- =====================================================

-- Show summary of associations created
DO $$
DECLARE
    wayne_driver_id UUID;
    mtdata_count INTEGER;
    guardian_count INTEGER;
    lytx_count INTEGER;
BEGIN
    SELECT wayne_driver_id INTO wayne_driver_id FROM temp_association_ids LIMIT 1;
    
    -- Count associations
    SELECT COUNT(*) INTO mtdata_count
    FROM mtdata_trip_history 
    WHERE vehicle_registration = '1IDB419' AND driver_id = wayne_driver_id;
    
    SELECT COUNT(*) INTO guardian_count
    FROM guardian_events 
    WHERE vehicle_registration = '1IDB419' AND driver_id = wayne_driver_id;
    
    SELECT COUNT(*) INTO lytx_count
    FROM lytx_safety_events 
    WHERE driver_id = wayne_driver_id;
    
    RAISE NOTICE '=== ASSOCIATION SUMMARY ===';
    RAISE NOTICE 'Wayne Bowron Driver ID: %', wayne_driver_id;
    RAISE NOTICE 'MTData trips for 1IDB419: % records', mtdata_count;
    RAISE NOTICE 'Guardian events for 1IDB419: % records', guardian_count;
    RAISE NOTICE 'LYTX events for Wayne Bowron: % records', lytx_count;
    RAISE NOTICE '=========================';
END $$;

-- Clean up temporary table
DROP TABLE IF EXISTS temp_association_ids;

COMMIT;

-- =====================================================
-- POST-MIGRATION VERIFICATION
-- =====================================================

-- Verification query to run after migration
SELECT 
    'MTData Trips' as data_source,
    COUNT(*) as associated_records,
    MIN(start_time) as earliest_record,
    MAX(start_time) as latest_record
FROM mtdata_trip_history mth
JOIN drivers d ON mth.driver_id = d.id
WHERE mth.vehicle_registration = '1IDB419'
AND d.first_name = 'Wayne' AND d.last_name = 'Bowron'

UNION ALL

SELECT 
    'Guardian Events' as data_source,
    COUNT(*) as associated_records,
    MIN(detection_time) as earliest_record,
    MAX(detection_time) as latest_record
FROM guardian_events ge
JOIN drivers d ON ge.driver_id = d.id
WHERE ge.vehicle_registration = '1IDB419'
AND d.first_name = 'Wayne' AND d.last_name = 'Bowron'

UNION ALL

SELECT 
    'LYTX Events' as data_source,
    COUNT(*) as associated_records,
    MIN(event_datetime) as earliest_record,
    MAX(event_datetime) as latest_record
FROM lytx_safety_events lse
JOIN drivers d ON lse.driver_id = d.id
WHERE d.first_name = 'Wayne' AND d.last_name = 'Bowron';