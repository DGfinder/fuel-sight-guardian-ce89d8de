-- =====================================================
-- Vehicle-Based Driver Association Functions
-- =====================================================
-- Functions to associate events with drivers via vehicle assignments
-- Strategy: Driver UUID → Vehicle Assignment → Vehicle Registration → Events → Driver UUID
--
-- Author: Claude Code
-- Created: 2025-08-25

-- =====================================================
-- Function: associate_events_by_vehicle_assignment
-- =====================================================
-- Associates all events (MTData trips, Guardian events) for a specific vehicle 
-- with the assigned driver based on driver_assignments table
--
-- Usage:
--   SELECT associate_events_by_vehicle_assignment('202f3cb3-adc6-4af9-bfbb-069b87505287', '1IDB419');

CREATE OR REPLACE FUNCTION associate_events_by_vehicle_assignment(
    p_driver_uuid UUID,
    p_vehicle_registration TEXT,
    p_date_from TIMESTAMPTZ DEFAULT NULL,
    p_date_to TIMESTAMPTZ DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    mtdata_updated INTEGER := 0;
    guardian_updated INTEGER := 0;
    lytx_updated INTEGER := 0;
    vehicle_uuid UUID;
    assignment_exists BOOLEAN := FALSE;
    result JSON;
    date_filter_from TIMESTAMPTZ;
    date_filter_to TIMESTAMPTZ;
BEGIN
    -- Set default date range (last 2 years if not specified)
    date_filter_from := COALESCE(p_date_from, NOW() - INTERVAL '2 years');
    date_filter_to := COALESCE(p_date_to, NOW());

    -- Verify driver exists
    IF NOT EXISTS(SELECT 1 FROM drivers WHERE id = p_driver_uuid) THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Driver UUID not found',
            'driver_uuid', p_driver_uuid
        );
    END IF;

    -- Get vehicle UUID if it exists
    SELECT id INTO vehicle_uuid
    FROM vehicles 
    WHERE registration = p_vehicle_registration;

    -- Check if there's a driver assignment for this vehicle (current or historical)
    IF vehicle_uuid IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM driver_assignments 
            WHERE vehicle_id = vehicle_uuid 
            AND driver_id = p_driver_uuid
            AND (
                unassigned_at IS NULL OR  -- Currently assigned
                (assigned_at <= date_filter_to AND (unassigned_at >= date_filter_from OR unassigned_at IS NULL)) -- Historical assignment overlaps date range
            )
        ) INTO assignment_exists;
    END IF;

    -- Associate MTData trips for the vehicle with the driver
    UPDATE mtdata_trip_history 
    SET 
        driver_id = p_driver_uuid,
        driver_association_confidence = CASE 
            WHEN assignment_exists THEN 1.0  -- High confidence if assignment exists
            ELSE 0.9  -- Still high confidence for known vehicle-driver relationship
        END,
        driver_association_method = 'vehicle_assignment',
        driver_association_updated_at = NOW()
    WHERE 
        vehicle_registration = p_vehicle_registration
        AND start_time BETWEEN date_filter_from AND date_filter_to
        AND (driver_id IS NULL OR driver_id != p_driver_uuid);
    
    GET DIAGNOSTICS mtdata_updated = ROW_COUNT;

    -- Associate Guardian events for the vehicle with the driver
    UPDATE guardian_events 
    SET 
        driver_id = p_driver_uuid,
        driver_association_confidence = CASE 
            WHEN assignment_exists THEN 1.0  -- High confidence if assignment exists
            ELSE 0.9  -- Still high confidence for known vehicle-driver relationship
        END,
        driver_association_method = 'vehicle_assignment',
        driver_association_updated_at = NOW()
    WHERE 
        vehicle_registration = p_vehicle_registration
        AND detection_time BETWEEN date_filter_from AND date_filter_to
        AND (driver_id IS NULL OR driver_id != p_driver_uuid);
    
    GET DIAGNOSTICS guardian_updated = ROW_COUNT;

    -- Also update any LYTX events that might be associated with this driver by name
    -- (since LYTX doesn't have vehicle registration in events)
    WITH driver_names AS (
        SELECT DISTINCT 
            COALESCE(first_name || ' ' || last_name, 'Unknown Driver') as full_name,
            first_name,
            last_name
        FROM drivers 
        WHERE id = p_driver_uuid
    )
    UPDATE lytx_safety_events lse
    SET 
        driver_id = p_driver_uuid,
        driver_association_confidence = 0.8,  -- Lower confidence for name-based association
        driver_association_method = 'vehicle_assignment_name_match',
        driver_association_updated_at = NOW()
    FROM driver_names dn
    WHERE 
        lse.event_datetime BETWEEN date_filter_from AND date_filter_to
        AND (lse.driver_id IS NULL OR lse.driver_id != p_driver_uuid)
        AND (
            lse.driver_name ILIKE ('%' || dn.first_name || '%' || dn.last_name || '%') OR
            lse.driver_name ILIKE ('%' || dn.last_name || '%' || dn.first_name || '%') OR
            lse.driver_name ILIKE dn.full_name
        );
    
    GET DIAGNOSTICS lytx_updated = ROW_COUNT;

    -- Build result
    result := json_build_object(
        'success', TRUE,
        'driver_uuid', p_driver_uuid,
        'vehicle_registration', p_vehicle_registration,
        'vehicle_uuid', vehicle_uuid,
        'formal_assignment_exists', assignment_exists,
        'date_range', json_build_object(
            'from', date_filter_from,
            'to', date_filter_to
        ),
        'associations_created', json_build_object(
            'mtdata_trips', mtdata_updated,
            'guardian_events', guardian_updated,
            'lytx_events', lytx_updated,
            'total', mtdata_updated + guardian_updated + lytx_updated
        ),
        'timestamp', NOW()
    );

    RETURN result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', SQLERRM,
            'error_detail', SQLSTATE,
            'driver_uuid', p_driver_uuid,
            'vehicle_registration', p_vehicle_registration,
            'timestamp', NOW()
        );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: bulk_associate_all_vehicle_assignments
-- =====================================================
-- Processes all current driver assignments and associates events via vehicles
--
-- Usage:
--   SELECT bulk_associate_all_vehicle_assignments();

CREATE OR REPLACE FUNCTION bulk_associate_all_vehicle_assignments(
    p_date_from TIMESTAMPTZ DEFAULT NULL,
    p_date_to TIMESTAMPTZ DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    assignment_record RECORD;
    function_result JSON;
    total_assignments INTEGER := 0;
    successful_associations INTEGER := 0;
    failed_associations INTEGER := 0;
    summary_results JSON[] := ARRAY[]::JSON[];
    final_result JSON;
BEGIN
    -- Process all current active driver assignments
    FOR assignment_record IN 
        SELECT 
            da.driver_id,
            v.registration as vehicle_registration,
            d.first_name || ' ' || d.last_name as driver_name,
            da.assigned_at,
            da.unassigned_at
        FROM driver_assignments da
        JOIN vehicles v ON da.vehicle_id = v.id
        JOIN drivers d ON da.driver_id = d.id
        WHERE da.unassigned_at IS NULL  -- Currently active assignments
        ORDER BY da.assigned_at DESC
    LOOP
        total_assignments := total_assignments + 1;
        
        -- Call the association function for each driver-vehicle pair
        SELECT associate_events_by_vehicle_assignment(
            assignment_record.driver_id,
            assignment_record.vehicle_registration,
            p_date_from,
            p_date_to
        ) INTO function_result;
        
        -- Track success/failure
        IF (function_result->>'success')::BOOLEAN THEN
            successful_associations := successful_associations + 1;
        ELSE
            failed_associations := failed_associations + 1;
        END IF;
        
        -- Add to results summary
        summary_results := summary_results || json_build_object(
            'driver_name', assignment_record.driver_name,
            'driver_uuid', assignment_record.driver_id,
            'vehicle_registration', assignment_record.vehicle_registration,
            'success', (function_result->>'success')::BOOLEAN,
            'associations', COALESCE(function_result->'associations_created', '{}'),
            'error', COALESCE(function_result->>'error', NULL)
        );
        
        -- Log progress every 10 assignments
        IF total_assignments % 10 = 0 THEN
            RAISE NOTICE 'Processed % assignments, % successful, % failed', 
                total_assignments, successful_associations, failed_associations;
        END IF;
        
    END LOOP;

    -- Build final result
    final_result := json_build_object(
        'success', TRUE,
        'summary', json_build_object(
            'total_assignments_processed', total_assignments,
            'successful_associations', successful_associations,
            'failed_associations', failed_associations,
            'success_rate', CASE 
                WHEN total_assignments > 0 THEN ROUND((successful_associations::DECIMAL / total_assignments) * 100, 2)
                ELSE 0 
            END
        ),
        'date_range', json_build_object(
            'from', COALESCE(p_date_from, NOW() - INTERVAL '2 years'),
            'to', COALESCE(p_date_to, NOW())
        ),
        'detailed_results', summary_results,
        'timestamp', NOW()
    );

    RETURN final_result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', SQLERRM,
            'error_detail', SQLSTATE,
            'processed_count', total_assignments,
            'timestamp', NOW()
        );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: get_vehicle_driver_associations_summary
-- =====================================================
-- Gets comprehensive summary of driver-vehicle associations and their event counts
--
-- Usage:
--   SELECT get_vehicle_driver_associations_summary('202f3cb3-adc6-4af9-bfbb-069b87505287', '1IDB419');

CREATE OR REPLACE FUNCTION get_vehicle_driver_associations_summary(
    p_driver_uuid UUID,
    p_vehicle_registration TEXT,
    p_days_back INTEGER DEFAULT 180
) RETURNS JSON AS $$
DECLARE
    driver_info RECORD;
    vehicle_info RECORD;
    assignment_info RECORD;
    date_threshold TIMESTAMPTZ;
    mtdata_stats JSON;
    guardian_stats JSON;
    lytx_stats JSON;
    result JSON;
BEGIN
    date_threshold := NOW() - (p_days_back || ' days')::INTERVAL;
    
    -- Get driver information
    SELECT 
        first_name || ' ' || last_name as name,
        fleet,
        depot,
        status
    INTO driver_info
    FROM drivers 
    WHERE id = p_driver_uuid;
    
    IF driver_info IS NULL THEN
        RETURN json_build_object('error', 'Driver not found', 'success', FALSE);
    END IF;
    
    -- Get vehicle information
    SELECT 
        id as vehicle_uuid,
        fleet as vehicle_fleet,
        depot as vehicle_depot,
        make,
        model,
        status as vehicle_status
    INTO vehicle_info
    FROM vehicles 
    WHERE registration = p_vehicle_registration;
    
    -- Get assignment information
    SELECT 
        assigned_at,
        unassigned_at,
        CASE WHEN unassigned_at IS NULL THEN TRUE ELSE FALSE END as currently_assigned
    INTO assignment_info
    FROM driver_assignments da
    JOIN vehicles v ON da.vehicle_id = v.id
    WHERE da.driver_id = p_driver_uuid 
    AND v.registration = p_vehicle_registration
    ORDER BY assigned_at DESC
    LIMIT 1;
    
    -- MTData statistics
    SELECT json_build_object(
        'total_trips', COUNT(*),
        'associated_trips', COUNT(*) FILTER (WHERE driver_id = p_driver_uuid),
        'date_range', json_build_object(
            'earliest', MIN(start_time),
            'latest', MAX(start_time)
        ),
        'total_distance_km', COALESCE(SUM(distance_km) FILTER (WHERE driver_id = p_driver_uuid), 0),
        'total_fuel_litres', COALESCE(SUM(fuel_used_litres) FILTER (WHERE driver_id = p_driver_uuid), 0)
    ) INTO mtdata_stats
    FROM mtdata_trip_history
    WHERE vehicle_registration = p_vehicle_registration 
    AND start_time >= date_threshold;
    
    -- Guardian statistics  
    SELECT json_build_object(
        'total_events', COUNT(*),
        'associated_events', COUNT(*) FILTER (WHERE driver_id = p_driver_uuid),
        'date_range', json_build_object(
            'earliest', MIN(detection_time),
            'latest', MAX(detection_time)
        ),
        'event_types', COALESCE(json_agg(DISTINCT event_type) FILTER (WHERE driver_id = p_driver_uuid), '[]'),
        'severity_breakdown', COALESCE(
            json_object_agg(severity, cnt) FILTER (WHERE driver_id = p_driver_uuid),
            '{}'
        )
    ) INTO guardian_stats
    FROM (
        SELECT 
            detection_time,
            event_type,
            severity,
            driver_id,
            COUNT(*) OVER (PARTITION BY severity) as cnt
        FROM guardian_events
        WHERE vehicle_registration = p_vehicle_registration 
        AND detection_time >= date_threshold
    ) ge;
    
    -- LYTX statistics (by driver name since LYTX doesn't have vehicle registration)
    SELECT json_build_object(
        'total_events', COUNT(*),
        'date_range', json_build_object(
            'earliest', MIN(event_datetime),
            'latest', MAX(event_datetime)
        ),
        'average_score', ROUND(AVG(score), 2),
        'event_types', COALESCE(json_agg(DISTINCT event_type), '[]')
    ) INTO lytx_stats
    FROM lytx_safety_events
    WHERE driver_id = p_driver_uuid
    AND event_datetime >= date_threshold;
    
    -- Build comprehensive result
    result := json_build_object(
        'success', TRUE,
        'driver', json_build_object(
            'uuid', p_driver_uuid,
            'name', driver_info.name,
            'fleet', driver_info.fleet,
            'depot', driver_info.depot,
            'status', driver_info.status
        ),
        'vehicle', json_build_object(
            'registration', p_vehicle_registration,
            'uuid', vehicle_info.vehicle_uuid,
            'fleet', vehicle_info.vehicle_fleet,
            'make_model', COALESCE(vehicle_info.make || ' ' || vehicle_info.model, 'Unknown'),
            'status', vehicle_info.vehicle_status
        ),
        'assignment', COALESCE(
            json_build_object(
                'currently_assigned', COALESCE(assignment_info.currently_assigned, FALSE),
                'assigned_at', assignment_info.assigned_at,
                'unassigned_at', assignment_info.unassigned_at
            ),
            json_build_object('currently_assigned', FALSE)
        ),
        'events_summary', json_build_object(
            'date_threshold', date_threshold,
            'days_analyzed', p_days_back,
            'mtdata_trips', COALESCE(mtdata_stats, json_build_object('total_trips', 0)),
            'guardian_events', COALESCE(guardian_stats, json_build_object('total_events', 0)),
            'lytx_events', COALESCE(lytx_stats, json_build_object('total_events', 0))
        ),
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
-- Grant Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION associate_events_by_vehicle_assignment TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_associate_all_vehicle_assignments TO authenticated;  
GRANT EXECUTE ON FUNCTION get_vehicle_driver_associations_summary TO authenticated;