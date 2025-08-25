-- =====================================================
-- Wayne Bowron Vehicle-Based Association Migration
-- =====================================================
-- Associates Wayne Bowron (UUID: 202f3cb3-adc6-4af9-bfbb-069b87505287) 
-- with vehicle 1IDB419 using vehicle-based association strategy
--
-- Strategy: Driver UUID → Vehicle Registration → All Events → Driver UUID
-- Author: Claude Code
-- Created: 2025-08-25

BEGIN;

-- =====================================================
-- CONSTANTS & VERIFICATION
-- =====================================================

-- Wayne Bowron's confirmed driver UUID
DO $$
DECLARE
    wayne_uuid UUID := '202f3cb3-adc6-4af9-bfbb-069b87505287';
    vehicle_reg TEXT := '1IDB419';
    driver_exists BOOLEAN := FALSE;
    vehicle_exists BOOLEAN := FALSE;
    association_result JSON;
BEGIN
    -- Verify Wayne Bowron exists with this UUID
    SELECT EXISTS(
        SELECT 1 FROM drivers 
        WHERE id = wayne_uuid
    ) INTO driver_exists;
    
    IF NOT driver_exists THEN
        RAISE EXCEPTION 'Wayne Bowron driver UUID % not found in drivers table', wayne_uuid;
    END IF;
    
    RAISE NOTICE '✅ Wayne Bowron driver UUID verified: %', wayne_uuid;
    
    -- Check if vehicle exists in vehicles table
    SELECT EXISTS(
        SELECT 1 FROM vehicles 
        WHERE registration = vehicle_reg
    ) INTO vehicle_exists;
    
    IF vehicle_exists THEN
        RAISE NOTICE '✅ Vehicle % found in vehicles table', vehicle_reg;
    ELSE
        RAISE NOTICE '⚠️  Vehicle % not found in vehicles table (will proceed with events association)', vehicle_reg;
    END IF;

-- =====================================================
-- 1. CREATE DRIVER-VEHICLE ASSIGNMENT (if vehicle exists)
-- =====================================================

    -- Create or update driver assignment if vehicle exists in vehicles table
    IF vehicle_exists THEN
        -- First, unassign any current driver from this vehicle
        UPDATE driver_assignments 
        SET 
            unassigned_at = NOW(),
            updated_at = NOW()
        WHERE vehicle_id = (SELECT id FROM vehicles WHERE registration = vehicle_reg)
        AND unassigned_at IS NULL
        AND driver_id != wayne_uuid;
        
        -- Create or update assignment for Wayne Bowron
        INSERT INTO driver_assignments (
            vehicle_id,
            driver_id,
            driver_name,
            assigned_at,
            created_at,
            updated_at
        ) VALUES (
            (SELECT id FROM vehicles WHERE registration = vehicle_reg),
            wayne_uuid,
            'Wayne Bowron',
            NOW(),
            NOW(),
            NOW()
        )
        ON CONFLICT (vehicle_id, driver_id) 
        WHERE unassigned_at IS NULL
        DO UPDATE SET
            assigned_at = EXCLUDED.assigned_at,
            updated_at = EXCLUDED.updated_at;
            
        RAISE NOTICE '✅ Created/updated vehicle assignment: Wayne Bowron ↔ %', vehicle_reg;
    END IF;

-- =====================================================
-- 2. ASSOCIATE MTDATA TRIPS VIA VEHICLE
-- =====================================================

    -- Associate all MTData trips for vehicle 1IDB419 with Wayne Bowron
    DECLARE 
        mtdata_row_count INTEGER;
    BEGIN
        UPDATE mtdata_trip_history 
        SET 
            driver_id = wayne_uuid,
            driver_association_confidence = 1.0,
            driver_association_method = 'vehicle_assignment',
            driver_association_updated_at = NOW()
        WHERE 
            vehicle_registration = vehicle_reg
            AND (driver_id IS NULL OR driver_id != wayne_uuid);
        
        GET DIAGNOSTICS mtdata_row_count = ROW_COUNT;
        RAISE NOTICE '✅ Associated % MTData trips for vehicle % with Wayne Bowron', mtdata_row_count, vehicle_reg;

-- =====================================================
-- 3. ASSOCIATE GUARDIAN EVENTS VIA VEHICLE
-- =====================================================

        -- Associate all Guardian events for vehicle 1IDB419 with Wayne Bowron
        DECLARE 
            guardian_row_count INTEGER;
        BEGIN
            UPDATE guardian_events 
            SET 
                driver_id = wayne_uuid,
                driver_association_confidence = 1.0,
                driver_association_method = 'vehicle_assignment',
                driver_association_updated_at = NOW()
            WHERE 
                vehicle_registration = vehicle_reg
                AND (driver_id IS NULL OR driver_id != wayne_uuid);
            
            GET DIAGNOSTICS guardian_row_count = ROW_COUNT;
            RAISE NOTICE '✅ Associated % Guardian events for vehicle % with Wayne Bowron', guardian_row_count, vehicle_reg;

-- =====================================================
-- 4. ASSOCIATE LYTX EVENTS BY NAME (fallback)
-- =====================================================

            -- Associate LYTX events by Wayne Bowron's name variations
            -- (since LYTX events don't have vehicle registration)
            DECLARE 
                lytx_row_count INTEGER;
            BEGIN
                UPDATE lytx_safety_events 
                SET 
                    driver_id = wayne_uuid,
                    driver_association_confidence = 0.95,
                    driver_association_method = 'vehicle_assignment_name_match',
                    driver_association_updated_at = NOW()
                WHERE 
                    (driver_id IS NULL OR driver_id != wayne_uuid)
                    AND (
                        driver_name ILIKE '%wayne%bowron%' OR
                        driver_name ILIKE '%bowron%wayne%' OR
                        driver_name ILIKE 'wayne bowron' OR
                        driver_name ILIKE 'bowron wayne' OR
                        driver_name ILIKE 'w%bowron' OR
                        driver_name ILIKE 'wayne b%'
                    );
                
                GET DIAGNOSTICS lytx_row_count = ROW_COUNT;
                RAISE NOTICE '✅ Associated % LYTX events with Wayne Bowron by name matching', lytx_row_count;

-- =====================================================
-- 5. VERIFICATION & SUMMARY
-- =====================================================

    -- Get comprehensive summary using the new function
    SELECT get_vehicle_driver_associations_summary(
        wayne_uuid, 
        vehicle_reg, 
        365  -- Check last year of data
    ) INTO association_result;
    
    RAISE NOTICE '📊 ASSOCIATION SUMMARY:';
    RAISE NOTICE '   Driver: Wayne Bowron (UUID: %)', wayne_uuid;
    RAISE NOTICE '   Vehicle: %', vehicle_reg;
    RAISE NOTICE '   Vehicle in DB: %', vehicle_exists;
    RAISE NOTICE '   MTData trips: %', (association_result->'events_summary'->'mtdata_trips'->>'associated_trips');
    RAISE NOTICE '   Guardian events: %', (association_result->'events_summary'->'guardian_events'->>'associated_events');
    RAISE NOTICE '   LYTX events: %', (association_result->'events_summary'->'lytx_events'->>'total_events');
    
    -- Verify associations worked
    DECLARE 
        mtdata_count INTEGER;
        guardian_count INTEGER;
        lytx_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO mtdata_count
        FROM mtdata_trip_history 
        WHERE vehicle_registration = vehicle_reg AND driver_id = wayne_uuid;
        
        SELECT COUNT(*) INTO guardian_count
        FROM guardian_events 
        WHERE vehicle_registration = vehicle_reg AND driver_id = wayne_uuid;
        
        SELECT COUNT(*) INTO lytx_count
        FROM lytx_safety_events 
        WHERE driver_id = wayne_uuid;
        
        RAISE NOTICE '🎯 FINAL VERIFICATION:';
        RAISE NOTICE '   ✅ MTData trips associated: %', mtdata_count;
        RAISE NOTICE '   ✅ Guardian events associated: %', guardian_count;
        RAISE NOTICE '   ✅ LYTX events associated: %', lytx_count;
        RAISE NOTICE '   ✅ Total event associations: %', (mtdata_count + guardian_count + lytx_count);
        
        IF (mtdata_count + guardian_count + lytx_count) > 0 THEN
            RAISE NOTICE '🎉 SUCCESS: Wayne Bowron is now properly associated with vehicle % events!', vehicle_reg;
        ELSE
            RAISE NOTICE '⚠️  WARNING: No events were associated - check data availability';
        END IF;
    END;

END $$;

COMMIT;

-- =====================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- =====================================================

-- Quick verification queries to run after migration
SELECT 
    'MTData Trips' as event_type,
    COUNT(*) as associated_count,
    MIN(start_time) as earliest_event,
    MAX(start_time) as latest_event
FROM mtdata_trip_history 
WHERE vehicle_registration = '1IDB419' 
AND driver_id = '202f3cb3-adc6-4af9-bfbb-069b87505287'

UNION ALL

SELECT 
    'Guardian Events' as event_type,
    COUNT(*) as associated_count,
    MIN(detection_time) as earliest_event,
    MAX(detection_time) as latest_event
FROM guardian_events 
WHERE vehicle_registration = '1IDB419' 
AND driver_id = '202f3cb3-adc6-4af9-bfbb-069b87505287'

UNION ALL

SELECT 
    'LYTX Events' as event_type,
    COUNT(*) as associated_count,
    MIN(event_datetime) as earliest_event,
    MAX(event_datetime) as latest_event
FROM lytx_safety_events 
WHERE driver_id = '202f3cb3-adc6-4af9-bfbb-069b87505287';

-- Test the vehicle-based association function
SELECT get_vehicle_driver_associations_summary(
    '202f3cb3-adc6-4af9-bfbb-069b87505287'::UUID,
    '1IDB419',
    180
);