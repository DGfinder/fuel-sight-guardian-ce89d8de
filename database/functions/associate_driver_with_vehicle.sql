-- =====================================================
-- Function: associate_driver_with_vehicle
-- =====================================================
-- Creates comprehensive driver-vehicle associations across all data sources
-- (MTData trips, Guardian events, LYTX events, vehicle assignments)
--
-- Usage:
--   SELECT associate_driver_with_vehicle('John', 'Smith', '1ABC123');
--
-- Author: Claude Code
-- Created: 2025-08-25

CREATE OR REPLACE FUNCTION associate_driver_with_vehicle(
    p_first_name TEXT,
    p_last_name TEXT, 
    p_vehicle_registration TEXT,
    p_create_assignment BOOLEAN DEFAULT TRUE
) RETURNS JSON AS $$
DECLARE
    driver_id UUID;
    vehicle_id UUID;
    mtdata_updated INTEGER := 0;
    guardian_updated INTEGER := 0;
    lytx_updated INTEGER := 0;
    assignment_created BOOLEAN := FALSE;
    result JSON;
BEGIN
    -- Find or create driver record
    SELECT id INTO driver_id
    FROM drivers 
    WHERE 
        (first_name ILIKE p_first_name AND last_name ILIKE p_last_name)
        OR (first_name || ' ' || last_name) ILIKE (p_first_name || '%' || p_last_name)
    LIMIT 1;

    IF driver_id IS NULL THEN
        RAISE EXCEPTION 'Driver % % not found in drivers table', p_first_name, p_last_name;
    END IF;

    -- Find vehicle record (optional - vehicle may not be in vehicles table yet)
    SELECT id INTO vehicle_id
    FROM vehicles
    WHERE registration = p_vehicle_registration
    LIMIT 1;

    -- Associate MTData trips
    UPDATE mtdata_trip_history 
    SET 
        driver_id = associate_driver_with_vehicle.driver_id,
        driver_association_confidence = 1.0,
        driver_association_method = 'function_assignment',
        driver_association_updated_at = NOW()
    WHERE 
        vehicle_registration = p_vehicle_registration
        AND (driver_id IS NULL OR driver_id != associate_driver_with_vehicle.driver_id);
    
    GET DIAGNOSTICS mtdata_updated = ROW_COUNT;

    -- Associate Guardian events
    UPDATE guardian_events 
    SET 
        driver_id = associate_driver_with_vehicle.driver_id,
        driver_association_confidence = 1.0,
        driver_association_method = 'function_assignment',
        driver_association_updated_at = NOW()
    WHERE 
        vehicle_registration = p_vehicle_registration
        AND (driver_id IS NULL OR driver_id != associate_driver_with_vehicle.driver_id);
    
    GET DIAGNOSTICS guardian_updated = ROW_COUNT;

    -- Associate LYTX events by driver name
    UPDATE lytx_safety_events 
    SET 
        driver_id = associate_driver_with_vehicle.driver_id,
        driver_association_confidence = 1.0,
        driver_association_method = 'function_assignment',
        driver_association_updated_at = NOW()
    WHERE 
        driver_id IS NULL
        AND (
            driver_name ILIKE ('%' || p_first_name || '%' || p_last_name || '%')
            OR driver_name ILIKE ('%' || p_last_name || '%' || p_first_name || '%')
            OR driver_name ILIKE (p_first_name || ' ' || p_last_name)
            OR driver_name ILIKE (p_last_name || ' ' || p_first_name)
        );
    
    GET DIAGNOSTICS lytx_updated = ROW_COUNT;

    -- Create vehicle assignment if requested and vehicle exists
    IF p_create_assignment AND vehicle_id IS NOT NULL THEN
        -- Check if assignment already exists
        IF NOT EXISTS(
            SELECT 1 FROM driver_assignments 
            WHERE vehicle_id = associate_driver_with_vehicle.vehicle_id 
            AND driver_id = associate_driver_with_vehicle.driver_id 
            AND unassigned_at IS NULL
        ) THEN
            -- Unassign any current driver from this vehicle
            UPDATE driver_assignments 
            SET unassigned_at = NOW()
            WHERE vehicle_id = associate_driver_with_vehicle.vehicle_id 
            AND unassigned_at IS NULL;
            
            -- Create new assignment
            INSERT INTO driver_assignments (
                vehicle_id,
                driver_id,
                driver_name,
                assigned_at
            ) VALUES (
                associate_driver_with_vehicle.vehicle_id,
                associate_driver_with_vehicle.driver_id,
                p_first_name || ' ' || p_last_name,
                NOW()
            );
            
            assignment_created := TRUE;
        END IF;
    END IF;

    -- Build result JSON
    result := json_build_object(
        'success', TRUE,
        'driver_id', driver_id,
        'vehicle_id', vehicle_id,
        'vehicle_registration', p_vehicle_registration,
        'driver_name', p_first_name || ' ' || p_last_name,
        'associations_created', json_build_object(
            'mtdata_trips', mtdata_updated,
            'guardian_events', guardian_updated,
            'lytx_events', lytx_updated
        ),
        'vehicle_assignment_created', assignment_created,
        'timestamp', NOW()
    );

    RETURN result;

EXCEPTION
    WHEN OTHERS THEN
        -- Return error information
        RETURN json_build_object(
            'success', FALSE,
            'error', SQLERRM,
            'error_detail', SQLSTATE,
            'timestamp', NOW()
        );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: get_driver_vehicle_associations
-- =====================================================
-- Retrieves comprehensive association summary for a driver-vehicle pair
--
-- Usage:
--   SELECT get_driver_vehicle_associations('Wayne', 'Bowron', '1IDB419');

CREATE OR REPLACE FUNCTION get_driver_vehicle_associations(
    p_first_name TEXT,
    p_last_name TEXT,
    p_vehicle_registration TEXT
) RETURNS JSON AS $$
DECLARE
    driver_id UUID;
    vehicle_id UUID;
    result JSON;
    mtdata_stats JSON;
    guardian_stats JSON;
    lytx_stats JSON;
    assignment_info JSON;
BEGIN
    -- Find driver
    SELECT id INTO driver_id
    FROM drivers 
    WHERE 
        (first_name ILIKE p_first_name AND last_name ILIKE p_last_name)
        OR (first_name || ' ' || last_name) ILIKE (p_first_name || '%' || p_last_name)
    LIMIT 1;

    IF driver_id IS NULL THEN
        RETURN json_build_object('error', 'Driver not found', 'success', FALSE);
    END IF;

    -- Find vehicle
    SELECT id INTO vehicle_id
    FROM vehicles
    WHERE registration = p_vehicle_registration
    LIMIT 1;

    -- Get MTData statistics
    SELECT json_build_object(
        'total_trips', COUNT(*),
        'date_range', json_build_object(
            'earliest', MIN(start_time),
            'latest', MAX(start_time)
        ),
        'total_kilometers', COALESCE(SUM(distance_km), 0),
        'total_fuel_used', COALESCE(SUM(fuel_used_litres), 0)
    ) INTO mtdata_stats
    FROM mtdata_trip_history
    WHERE vehicle_registration = p_vehicle_registration 
    AND driver_id = get_driver_vehicle_associations.driver_id;

    -- Get Guardian event statistics
    SELECT json_build_object(
        'total_events', COUNT(*),
        'date_range', json_build_object(
            'earliest', MIN(detection_time),
            'latest', MAX(detection_time)
        ),
        'event_types', json_agg(DISTINCT event_type),
        'severity_breakdown', json_object_agg(severity, severity_count)
    ) INTO guardian_stats
    FROM (
        SELECT 
            detection_time,
            event_type,
            severity,
            COUNT(*) OVER (PARTITION BY severity) as severity_count
        FROM guardian_events
        WHERE vehicle_registration = p_vehicle_registration 
        AND driver_id = get_driver_vehicle_associations.driver_id
    ) stats;

    -- Get LYTX statistics  
    SELECT json_build_object(
        'total_events', COUNT(*),
        'date_range', json_build_object(
            'earliest', MIN(event_datetime),
            'latest', MAX(event_datetime)
        ),
        'event_types', json_agg(DISTINCT event_type),
        'average_score', ROUND(AVG(score), 2)
    ) INTO lytx_stats
    FROM lytx_safety_events
    WHERE driver_id = get_driver_vehicle_associations.driver_id;

    -- Get vehicle assignment info
    SELECT json_build_object(
        'is_currently_assigned', (unassigned_at IS NULL),
        'assigned_at', assigned_at,
        'unassigned_at', unassigned_at
    ) INTO assignment_info
    FROM driver_assignments
    WHERE driver_id = get_driver_vehicle_associations.driver_id 
    AND vehicle_id = get_driver_vehicle_associations.vehicle_id
    ORDER BY assigned_at DESC
    LIMIT 1;

    -- Build comprehensive result
    result := json_build_object(
        'success', TRUE,
        'driver_id', driver_id,
        'vehicle_id', vehicle_id,
        'driver_name', p_first_name || ' ' || p_last_name,
        'vehicle_registration', p_vehicle_registration,
        'mtdata_trips', COALESCE(mtdata_stats, json_build_object('total_trips', 0)),
        'guardian_events', COALESCE(guardian_stats, json_build_object('total_events', 0)),
        'lytx_events', COALESCE(lytx_stats, json_build_object('total_events', 0)),
        'vehicle_assignment', COALESCE(assignment_info, json_build_object('is_currently_assigned', FALSE)),
        'query_timestamp', NOW()
    );

    RETURN result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', SQLERRM,
            'error_detail', SQLSTATE,
            'timestamp', NOW()
        );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Example Usage and Testing
-- =====================================================

-- Example: Associate Wayne Bowron with vehicle 1IDB419
-- SELECT associate_driver_with_vehicle('Wayne', 'Bowron', '1IDB419');

-- Example: Get association summary
-- SELECT get_driver_vehicle_associations('Wayne', 'Bowron', '1IDB419');

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION associate_driver_with_vehicle TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_vehicle_associations TO authenticated;