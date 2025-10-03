-- =====================================================
-- Simplified Driver Association Function (Debug Version)
-- =====================================================
-- Ultra-simple version to isolate and fix the composite type error
-- This eliminates ALL potential sources of the error step by step
--
-- Author: Claude Code
-- Created: 2025-08-25

-- Step 1: Minimal function with basic operations only
CREATE OR REPLACE FUNCTION get_driver_summary_simple(
    p_driver_uuid UUID,
    p_vehicle_registration TEXT
) RETURNS JSON AS $$
DECLARE
    driver_name TEXT;
    result JSON;
BEGIN
    -- Simple scalar query
    SELECT first_name || ' ' || last_name 
    INTO driver_name
    FROM drivers 
    WHERE id = p_driver_uuid;
    
    IF driver_name IS NULL THEN
        RETURN json_build_object('error', 'Driver not found', 'success', FALSE);
    END IF;
    
    -- Build simple result
    result := json_build_object(
        'success', TRUE,
        'driver_name', driver_name,
        'driver_uuid', p_driver_uuid,
        'vehicle_registration', p_vehicle_registration,
        'timestamp', NOW()
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

-- Step 2: Add basic counts (no FILTER clauses)
CREATE OR REPLACE FUNCTION get_driver_summary_with_counts(
    p_driver_uuid UUID,
    p_vehicle_registration TEXT
) RETURNS JSON AS $$
DECLARE
    driver_name TEXT;
    mtdata_total INTEGER;
    guardian_total INTEGER;
    result JSON;
BEGIN
    -- Get driver name
    SELECT first_name || ' ' || last_name 
    INTO driver_name
    FROM drivers 
    WHERE id = p_driver_uuid;
    
    IF driver_name IS NULL THEN
        RETURN json_build_object('error', 'Driver not found', 'success', FALSE);
    END IF;
    
    -- Simple counts without FILTER clauses
    SELECT COUNT(*) INTO mtdata_total
    FROM mtdata_trip_history
    WHERE vehicle_registration = p_vehicle_registration;
    
    SELECT COUNT(*) INTO guardian_total
    FROM guardian_events
    WHERE vehicle_registration = p_vehicle_registration;
    
    -- Build result
    result := json_build_object(
        'success', TRUE,
        'driver_name', driver_name,
        'mtdata_total', mtdata_total,
        'guardian_total', guardian_total,
        'timestamp', NOW()
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

-- Step 3: Test FILTER clauses individually
CREATE OR REPLACE FUNCTION get_driver_summary_with_filter(
    p_driver_uuid UUID,
    p_vehicle_registration TEXT
) RETURNS JSON AS $$
DECLARE
    driver_name TEXT;
    mtdata_total INTEGER;
    mtdata_associated INTEGER;
    result JSON;
BEGIN
    -- Get driver name
    SELECT first_name || ' ' || last_name 
    INTO driver_name
    FROM drivers 
    WHERE id = p_driver_uuid;
    
    IF driver_name IS NULL THEN
        RETURN json_build_object('error', 'Driver not found', 'success', FALSE);
    END IF;
    
    -- Test simple count
    SELECT COUNT(*) INTO mtdata_total
    FROM mtdata_trip_history
    WHERE vehicle_registration = p_vehicle_registration;
    
    -- Test FILTER clause separately
    SELECT COUNT(CASE WHEN driver_id = p_driver_uuid THEN 1 END) INTO mtdata_associated
    FROM mtdata_trip_history
    WHERE vehicle_registration = p_vehicle_registration;
    
    -- Build result
    result := json_build_object(
        'success', TRUE,
        'driver_name', driver_name,
        'mtdata_total', mtdata_total,
        'mtdata_associated', mtdata_associated,
        'timestamp', NOW()
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_driver_summary_simple TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_summary_with_counts TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_summary_with_filter TO authenticated;