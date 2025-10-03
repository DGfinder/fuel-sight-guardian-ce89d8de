-- ============================================================================
-- DATA CENTRE CLEANUP: PHASE 3 - COMPREHENSIVE QUERY FUNCTIONS
-- ============================================================================
-- Purpose: Create functions to retrieve complete profiles for drivers, vehicles, trips
-- Status: FUNCTION CREATION (no data changes)
-- Dependencies: Requires Phase 1 & 2 to be completed
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'DATA CENTRE CLEANUP - PHASE 3: CREATING QUERY FUNCTIONS';
  RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- 1. GET_DRIVER_COMPLETE_PROFILE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[1/6] Creating get_driver_complete_profile function...';
END $$;

CREATE OR REPLACE FUNCTION get_driver_complete_profile(p_driver_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    -- Core driver information
    'driver_info', (
      SELECT json_build_object(
        'id', d.id,
        'name', json_build_object(
          'first_name', d.first_name,
          'last_name', d.last_name,
          'full_name', d.first_name || ' ' || d.last_name,
          'preferred_name', d.preferred_name
        ),
        'employment', json_build_object(
          'employee_id', d.employee_id,
          'fleet', d.fleet,
          'depot', d.depot,
          'hire_date', d.hire_date,
          'status', d.status
        ),
        'contact', json_build_object(
          'email', d.email,
          'phone', d.phone,
          'address', d.address
        ),
        'licensing', json_build_object(
          'drivers_license', d.drivers_license,
          'license_expiry', d.license_expiry,
          'certifications', d.certifications
        ),
        'performance_scores', json_build_object(
          'safety_score', d.safety_score,
          'lytx_score', d.lytx_score,
          'guardian_score', d.guardian_score,
          'overall_rating', d.overall_performance_rating
        )
      )
      FROM drivers d WHERE d.id = p_driver_id
    ),

    -- Name mappings across systems
    'name_mappings', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'system', dnm.system_name,
          'mapped_name', dnm.mapped_name,
          'is_primary', dnm.is_primary,
          'confidence_score', dnm.confidence_score
        ) ORDER BY dnm.is_primary DESC, dnm.system_name
      ), '[]'::json)
      FROM driver_name_mappings dnm
      WHERE dnm.driver_id = p_driver_id
    ),

    -- Current vehicle assignment
    'current_assignment', (
      SELECT json_build_object(
        'vehicle_id', v.id,
        'registration', v.registration,
        'fleet', v.fleet,
        'depot', v.depot,
        'make', v.make,
        'model', v.model,
        'assigned_at', da.assigned_at,
        'assignment_duration_days', EXTRACT(DAY FROM NOW() - da.assigned_at)
      )
      FROM driver_assignments da
      JOIN vehicles v ON da.vehicle_id = v.id
      WHERE da.driver_id = p_driver_id AND da.unassigned_at IS NULL
      LIMIT 1
    ),

    -- Assignment history
    'assignment_history', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'vehicle_registration', v.registration,
          'assigned_at', da.assigned_at,
          'unassigned_at', da.unassigned_at,
          'duration_days', EXTRACT(DAY FROM COALESCE(da.unassigned_at, NOW()) - da.assigned_at)
        ) ORDER BY da.assigned_at DESC
      ), '[]'::json)
      FROM driver_assignments da
      JOIN vehicles v ON da.vehicle_id = v.id
      WHERE da.driver_id = p_driver_id
    ),

    -- Latest performance metrics
    'latest_performance', (
      SELECT json_build_object(
        'period', json_build_object(
          'start', dpm.period_start,
          'end', dpm.period_end,
          'type', dpm.period_type
        ),
        'lytx_metrics', json_build_object(
          'events_count', dpm.lytx_events_count,
          'safety_score', dpm.lytx_safety_score,
          'harsh_acceleration', dpm.lytx_harsh_acceleration,
          'harsh_braking', dpm.lytx_harsh_braking,
          'speeding_events', dpm.lytx_speeding_events
        ),
        'guardian_metrics', json_build_object(
          'events_count', dpm.guardian_events_count,
          'safety_score', dpm.guardian_safety_score,
          'fuel_events', dpm.guardian_fuel_events,
          'safety_violations', dpm.guardian_safety_violations
        ),
        'operational_metrics', json_build_object(
          'total_deliveries', dpm.total_deliveries,
          'total_kilometers', dpm.total_kilometers,
          'fuel_efficiency', dpm.fuel_efficiency,
          'on_time_delivery_rate', dpm.on_time_delivery_rate
        ),
        'risk_assessment', json_build_object(
          'risk_level', dpm.risk_level,
          'trend', dpm.trend
        )
      )
      FROM driver_performance_metrics dpm
      WHERE dpm.driver_id = p_driver_id
        AND dpm.period_type = 'Monthly'
      ORDER BY dpm.period_end DESC
      LIMIT 1
    ),

    -- LYTX safety events summary
    'lytx_events_summary', (
      SELECT json_build_object(
        'total_events', COUNT(*),
        'last_30_days', COUNT(*) FILTER (WHERE event_datetime >= NOW() - INTERVAL '30 days'),
        'avg_safety_score', ROUND(AVG(safety_score), 2),
        'top_triggers', (
          SELECT json_agg(trigger_data ORDER BY event_count DESC)
          FROM (
            SELECT
              trigger_type,
              COUNT(*) as event_count
            FROM lytx_safety_events
            WHERE driver_id = p_driver_id
            GROUP BY trigger_type
            ORDER BY event_count DESC
            LIMIT 5
          ) trigger_data
        ),
        'recent_events', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'event_id', le.event_id,
              'datetime', le.event_datetime,
              'vehicle', v.registration,
              'safety_score', le.safety_score,
              'trigger_type', le.trigger_type,
              'status', le.status
            ) ORDER BY le.event_datetime DESC
          ), '[]'::json)
          FROM lytx_safety_events le
          LEFT JOIN vehicles v ON le.vehicle_id = v.id
          WHERE le.driver_id = p_driver_id
          ORDER BY le.event_datetime DESC
          LIMIT 10
        )
      )
      FROM lytx_safety_events
      WHERE driver_id = p_driver_id
    ),

    -- Guardian events summary
    'guardian_events_summary', (
      SELECT json_build_object(
        'total_events', COUNT(*),
        'last_30_days', COUNT(*) FILTER (WHERE detection_time >= NOW() - INTERVAL '30 days'),
        'distraction_events', COUNT(*) FILTER (WHERE event_type = 'distraction'),
        'fatigue_events', COUNT(*) FILTER (WHERE event_type = 'fatigue'),
        'verified_events', COUNT(*) FILTER (WHERE confirmation = 'verified'),
        'recent_events', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'event_id', ge.event_id,
              'detection_time', ge.detection_time,
              'vehicle', v.registration,
              'event_type', ge.event_type,
              'confirmation', ge.confirmation,
              'duration_seconds', ge.duration_seconds,
              'speed_kph', ge.speed_kph
            ) ORDER BY ge.detection_time DESC
          ), '[]'::json)
          FROM guardian_events ge
          LEFT JOIN vehicles v ON ge.vehicle_id_uuid = v.id
          WHERE ge.driver_id = p_driver_id
          ORDER BY ge.detection_time DESC
          LIMIT 10
        )
      )
      FROM guardian_events
      WHERE driver_id = p_driver_id
    ),

    -- Trip history summary
    'trip_history_summary', (
      SELECT json_build_object(
        'total_trips', COUNT(*),
        'total_distance_km', ROUND(SUM(distance_km), 2),
        'total_travel_hours', ROUND(SUM(travel_time_hours), 2),
        'avg_speed_kph', ROUND(AVG(average_speed_kph), 2),
        'last_30_days_trips', COUNT(*) FILTER (WHERE start_time >= NOW() - INTERVAL '30 days'),
        'recent_trips', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'trip_id', th.id,
              'start_time', th.start_time,
              'end_time', th.end_time,
              'vehicle', v.registration,
              'distance_km', th.distance_km,
              'start_location', th.start_location,
              'end_location', th.end_location,
              'has_delivery', th.mtdata_trip_id IS NOT NULL
            ) ORDER BY th.start_time DESC
          ), '[]'::json)
          FROM mtdata_trip_history th
          LEFT JOIN vehicles v ON th.vehicle_id = v.id
          WHERE th.driver_id = p_driver_id
          ORDER BY th.start_time DESC
          LIMIT 10
        )
      )
      FROM mtdata_trip_history
      WHERE driver_id = p_driver_id
    ),

    -- Delivery summary (via trip correlations)
    'delivery_summary', (
      SELECT json_build_object(
        'total_deliveries', COUNT(DISTINCT mcc.delivery_key),
        'total_volume_litres', ROUND(SUM(mcc.delivery_volume_litres), 2),
        'carriers', json_agg(DISTINCT mcc.carrier),
        'avg_confidence_score', ROUND(AVG(mcc.confidence_score), 2),
        'recent_deliveries', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'delivery_key', mcc.delivery_key,
              'delivery_date', mcc.delivery_date,
              'customer', mcc.customer_name,
              'terminal', mcc.terminal_name,
              'volume_litres', mcc.delivery_volume_litres,
              'carrier', mcc.carrier,
              'confidence_score', mcc.confidence_score
            ) ORDER BY mcc.delivery_date DESC
          ), '[]'::json)
          FROM (
            SELECT DISTINCT ON (mcc2.delivery_key) mcc2.*
            FROM mtdata_captive_correlations mcc2
            JOIN mtdata_trip_history th2 ON mcc2.mtdata_trip_id = th2.id
            WHERE th2.driver_id = p_driver_id
            ORDER BY mcc2.delivery_key, mcc2.confidence_score DESC
          ) mcc
          ORDER BY mcc.delivery_date DESC
          LIMIT 10
        )
      )
      FROM mtdata_captive_correlations mcc
      JOIN mtdata_trip_history th ON mcc.mtdata_trip_id = th.id
      WHERE th.driver_id = p_driver_id
    ),

    -- Incident summary
    'incident_summary', (
      SELECT json_build_object(
        'total_incidents', COUNT(*),
        'open_incidents', COUNT(*) FILTER (WHERE status IN ('Open', 'Under Review')),
        'last_30_days', COUNT(*) FILTER (WHERE incident_date >= NOW() - INTERVAL '30 days'),
        'by_severity', json_object_agg(severity, severity_count),
        'recent_incidents', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'incident_id', di.id,
              'incident_date', di.incident_date,
              'incident_type', di.incident_type,
              'severity', di.severity,
              'status', di.status,
              'description', di.description
            ) ORDER BY di.incident_date DESC
          ), '[]'::json)
          FROM driver_incidents di
          WHERE di.driver_id = p_driver_id
          ORDER BY di.incident_date DESC
          LIMIT 5
        )
      )
      FROM (
        SELECT
          driver_id,
          incident_date,
          status,
          severity,
          COUNT(*) as severity_count
        FROM driver_incidents
        WHERE driver_id = p_driver_id
        GROUP BY driver_id, incident_date, status, severity
      ) incidents
      WHERE driver_id = p_driver_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_driver_complete_profile(UUID) IS 'Returns comprehensive driver profile including assignments, performance, events, trips, deliveries, and incidents';

DO $$
BEGIN
  RAISE NOTICE '  ✓ get_driver_complete_profile created successfully';
END $$;

-- ============================================================================
-- 2. GET_VEHICLE_COMPLETE_PROFILE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[2/6] Creating get_vehicle_complete_profile function...';
END $$;

CREATE OR REPLACE FUNCTION get_vehicle_complete_profile(p_vehicle_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    -- Core vehicle information
    'vehicle_info', (
      SELECT json_build_object(
        'id', v.id,
        'registration', v.registration,
        'fleet', v.fleet,
        'depot', v.depot,
        'status', v.status,
        'specifications', json_build_object(
          'make', v.make,
          'model', v.model,
          'year', v.year,
          'vin', v.vin
        ),
        'devices', json_build_object(
          'guardian_unit', v.guardian_unit,
          'lytx_device', v.lytx_device
        ),
        'metrics', json_build_object(
          'safety_score', v.safety_score,
          'fuel_efficiency', v.fuel_efficiency,
          'utilization', v.utilization,
          'total_deliveries', v.total_deliveries,
          'total_kilometers', v.total_kilometers,
          'fatigue_events', v.fatigue_events,
          'safety_events', v.safety_events
        )
      )
      FROM vehicles v WHERE v.id = p_vehicle_id
    ),

    -- Current driver assignment
    'current_driver', (
      SELECT json_build_object(
        'driver_id', d.id,
        'driver_name', d.first_name || ' ' || d.last_name,
        'employee_id', d.employee_id,
        'assigned_at', da.assigned_at,
        'assignment_duration_days', EXTRACT(DAY FROM NOW() - da.assigned_at)
      )
      FROM driver_assignments da
      JOIN drivers d ON da.driver_id = d.id
      WHERE da.vehicle_id = p_vehicle_id AND da.unassigned_at IS NULL
      LIMIT 1
    ),

    -- Assignment history
    'assignment_history', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'driver_id', d.id,
          'driver_name', d.first_name || ' ' || d.last_name,
          'assigned_at', da.assigned_at,
          'unassigned_at', da.unassigned_at,
          'duration_days', EXTRACT(DAY FROM COALESCE(da.unassigned_at, NOW()) - da.assigned_at)
        ) ORDER BY da.assigned_at DESC
      ), '[]'::json)
      FROM driver_assignments da
      JOIN drivers d ON da.driver_id = d.id
      WHERE da.vehicle_id = p_vehicle_id
    ),

    -- Maintenance records
    'maintenance_records', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'record_number', mr.record_number,
          'type', mr.type,
          'status', mr.status,
          'priority', mr.priority,
          'scheduled_date', mr.scheduled_date,
          'completed_date', mr.completed_date,
          'description', mr.description,
          'actual_cost', mr.actual_cost,
          'workshop', mr.workshop
        ) ORDER BY mr.scheduled_date DESC
      ), '[]'::json)
      FROM maintenance_records mr
      WHERE mr.vehicle_id = p_vehicle_id
    ),

    -- Compliance status
    'compliance_status', (
      SELECT json_build_object(
        'registration_expiry', (SELECT v.registration_expiry FROM vehicles v WHERE v.id = p_vehicle_id),
        'insurance_expiry', (SELECT v.insurance_expiry FROM vehicles v WHERE v.id = p_vehicle_id),
        'inspection_due', (SELECT v.inspection_due FROM vehicles v WHERE v.id = p_vehicle_id),
        'next_service', (SELECT v.next_service FROM vehicles v WHERE v.id = p_vehicle_id),
        'compliance_items', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'type', ac.compliance_type,
              'due_date', ac.due_date,
              'status', ac.status,
              'alert_sent', ac.alert_sent_at IS NOT NULL
            ) ORDER BY ac.due_date
          ), '[]'::json)
          FROM asset_compliance ac
          WHERE ac.vehicle_id = p_vehicle_id
        )
      )
    ),

    -- LYTX events summary
    'lytx_events_summary', (
      SELECT json_build_object(
        'total_events', COUNT(*),
        'last_30_days', COUNT(*) FILTER (WHERE event_datetime >= NOW() - INTERVAL '30 days'),
        'avg_safety_score', ROUND(AVG(safety_score), 2),
        'recent_events', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'event_id', le.event_id,
              'datetime', le.event_datetime,
              'driver_name', d.first_name || ' ' || d.last_name,
              'safety_score', le.safety_score,
              'trigger_type', le.trigger_type
            ) ORDER BY le.event_datetime DESC
          ), '[]'::json)
          FROM lytx_safety_events le
          LEFT JOIN drivers d ON le.driver_id = d.id
          WHERE le.vehicle_id = p_vehicle_id
          ORDER BY le.event_datetime DESC
          LIMIT 10
        )
      )
      FROM lytx_safety_events
      WHERE vehicle_id = p_vehicle_id
    ),

    -- Guardian events summary
    'guardian_events_summary', (
      SELECT json_build_object(
        'total_events', COUNT(*),
        'last_30_days', COUNT(*) FILTER (WHERE detection_time >= NOW() - INTERVAL '30 days'),
        'distraction_events', COUNT(*) FILTER (WHERE event_type = 'distraction'),
        'fatigue_events', COUNT(*) FILTER (WHERE event_type = 'fatigue'),
        'recent_events', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'event_id', ge.event_id,
              'detection_time', ge.detection_time,
              'driver_name', d.first_name || ' ' || d.last_name,
              'event_type', ge.event_type,
              'confirmation', ge.confirmation
            ) ORDER BY ge.detection_time DESC
          ), '[]'::json)
          FROM guardian_events ge
          LEFT JOIN drivers d ON ge.driver_id = d.id
          WHERE ge.vehicle_id_uuid = p_vehicle_id
          ORDER BY ge.detection_time DESC
          LIMIT 10
        )
      )
      FROM guardian_events
      WHERE vehicle_id_uuid = p_vehicle_id
    ),

    -- Trip history summary
    'trip_history_summary', (
      SELECT json_build_object(
        'total_trips', COUNT(*),
        'total_distance_km', ROUND(SUM(distance_km), 2),
        'total_travel_hours', ROUND(SUM(travel_time_hours), 2),
        'avg_speed_kph', ROUND(AVG(average_speed_kph), 2),
        'last_30_days_trips', COUNT(*) FILTER (WHERE start_time >= NOW() - INTERVAL '30 days'),
        'recent_trips', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'trip_id', th.id,
              'start_time', th.start_time,
              'driver_name', d.first_name || ' ' || d.last_name,
              'distance_km', th.distance_km,
              'start_location', th.start_location,
              'end_location', th.end_location
            ) ORDER BY th.start_time DESC
          ), '[]'::json)
          FROM mtdata_trip_history th
          LEFT JOIN drivers d ON th.driver_id = d.id
          WHERE th.vehicle_id = p_vehicle_id
          ORDER BY th.start_time DESC
          LIMIT 10
        )
      )
      FROM mtdata_trip_history
      WHERE vehicle_id = p_vehicle_id
    ),

    -- Delivery summary
    'delivery_summary', (
      SELECT json_build_object(
        'total_deliveries', COUNT(DISTINCT mcc.delivery_key),
        'total_volume_litres', ROUND(SUM(mcc.delivery_volume_litres), 2),
        'recent_deliveries', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'delivery_date', mcc.delivery_date,
              'customer', mcc.customer_name,
              'volume_litres', mcc.delivery_volume_litres,
              'driver_name', d.first_name || ' ' || d.last_name
            ) ORDER BY mcc.delivery_date DESC
          ), '[]'::json)
          FROM (
            SELECT DISTINCT ON (mcc2.delivery_key)
              mcc2.*,
              th2.driver_id
            FROM mtdata_captive_correlations mcc2
            JOIN mtdata_trip_history th2 ON mcc2.mtdata_trip_id = th2.id
            WHERE th2.vehicle_id = p_vehicle_id
            ORDER BY mcc2.delivery_key, mcc2.confidence_score DESC
          ) mcc
          LEFT JOIN drivers d ON mcc.driver_id = d.id
          ORDER BY mcc.delivery_date DESC
          LIMIT 10
        )
      )
      FROM mtdata_captive_correlations mcc
      JOIN mtdata_trip_history th ON mcc.mtdata_trip_id = th.id
      WHERE th.vehicle_id = p_vehicle_id
    ),

    -- Efficiency metrics
    'efficiency_metrics', (
      SELECT json_build_object(
        'fuel_efficiency', v.fuel_efficiency,
        'utilization_rate', v.utilization,
        'avg_idling_percentage', (
          SELECT ROUND(AVG((idling_time_hours / NULLIF(travel_time_hours, 0)) * 100), 2)
          FROM mtdata_trip_history
          WHERE vehicle_id = p_vehicle_id
        ),
        'avg_trip_efficiency', (
          SELECT ROUND(AVG(route_efficiency_score), 2)
          FROM mtdata_trip_history
          WHERE vehicle_id = p_vehicle_id
        )
      )
      FROM vehicles v
      WHERE v.id = p_vehicle_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_vehicle_complete_profile(UUID) IS 'Returns comprehensive vehicle profile including driver history, maintenance, events, trips, and deliveries';

DO $$
BEGIN
  RAISE NOTICE '  ✓ get_vehicle_complete_profile created successfully';
END $$;

-- ============================================================================
-- 3. GET_TRIP_COMPLETE_DATA
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[3/6] Creating get_trip_complete_data function...';
END $$;

CREATE OR REPLACE FUNCTION get_trip_complete_data(p_trip_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    -- Core trip information
    'trip_data', (
      SELECT json_build_object(
        'trip_id', th.id,
        'trip_external_id', th.trip_external_id,
        'trip_number', th.trip_number,
        'timing', json_build_object(
          'start_time', th.start_time,
          'end_time', th.end_time,
          'travel_time_hours', th.travel_time_hours,
          'idling_time_hours', th.idling_time_hours
        ),
        'locations', json_build_object(
          'start_location', th.start_location,
          'start_latitude', th.start_latitude,
          'start_longitude', th.start_longitude,
          'end_location', th.end_location,
          'end_latitude', th.end_latitude,
          'end_longitude', th.end_longitude
        ),
        'metrics', json_build_object(
          'distance_km', th.distance_km,
          'average_speed_kph', th.average_speed_kph,
          'route_efficiency_score', th.route_efficiency_score,
          'odometer_reading', th.odometer_reading
        )
      )
      FROM mtdata_trip_history th
      WHERE th.id = p_trip_id
    ),

    -- Vehicle information
    'vehicle_info', (
      SELECT json_build_object(
        'vehicle_id', v.id,
        'registration', v.registration,
        'fleet', v.fleet,
        'depot', v.depot,
        'make', v.make,
        'model', v.model
      )
      FROM mtdata_trip_history th
      JOIN vehicles v ON th.vehicle_id = v.id
      WHERE th.id = p_trip_id
    ),

    -- Driver information
    'driver_info', (
      SELECT json_build_object(
        'driver_id', d.id,
        'driver_name', d.first_name || ' ' || d.last_name,
        'employee_id', d.employee_id,
        'fleet', d.fleet,
        'depot', d.depot
      )
      FROM mtdata_trip_history th
      JOIN drivers d ON th.driver_id = d.id
      WHERE th.id = p_trip_id
    ),

    -- LYTX events during trip
    'lytx_events', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'event_id', le.event_id,
          'event_datetime', le.event_datetime,
          'safety_score', le.safety_score,
          'trigger_type', le.trigger_type,
          'behaviors', le.behaviors,
          'status', le.status
        ) ORDER BY le.event_datetime
      ), '[]'::json)
      FROM lytx_safety_events le
      WHERE le.mtdata_trip_id = p_trip_id
    ),

    -- Guardian events during trip
    'guardian_events', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'event_id', ge.event_id,
          'detection_time', ge.detection_time,
          'event_type', ge.event_type,
          'confirmation', ge.confirmation,
          'classification', ge.classification,
          'duration_seconds', ge.duration_seconds,
          'speed_kph', ge.speed_kph
        ) ORDER BY ge.detection_time
      ), '[]'::json)
      FROM guardian_events ge
      WHERE ge.mtdata_trip_id = p_trip_id
    ),

    -- Event summary
    'event_summary', (
      SELECT json_build_object(
        'total_events',
          (SELECT COUNT(*) FROM lytx_safety_events WHERE mtdata_trip_id = p_trip_id) +
          (SELECT COUNT(*) FROM guardian_events WHERE mtdata_trip_id = p_trip_id),
        'lytx_event_count', (SELECT COUNT(*) FROM lytx_safety_events WHERE mtdata_trip_id = p_trip_id),
        'guardian_event_count', (SELECT COUNT(*) FROM guardian_events WHERE mtdata_trip_id = p_trip_id),
        'avg_lytx_safety_score', (SELECT ROUND(AVG(safety_score), 2) FROM lytx_safety_events WHERE mtdata_trip_id = p_trip_id)
      )
    ),

    -- Correlated deliveries
    'correlated_deliveries', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'delivery_key', mcc.delivery_key,
          'delivery_date', mcc.delivery_date,
          'bill_of_lading', mcc.bill_of_lading,
          'customer_name', mcc.customer_name,
          'terminal_name', mcc.terminal_name,
          'carrier', mcc.carrier,
          'delivery_volume_litres', mcc.delivery_volume_litres,
          'correlation', json_build_object(
            'confidence_score', mcc.confidence_score,
            'match_type', mcc.match_type,
            'terminal_distance_km', mcc.terminal_distance_km,
            'within_service_area', mcc.within_terminal_service_area
          )
        ) ORDER BY mcc.confidence_score DESC
      ), '[]'::json)
      FROM mtdata_captive_correlations mcc
      WHERE mcc.mtdata_trip_id = p_trip_id
    ),

    -- Delivery summary
    'delivery_summary', (
      SELECT json_build_object(
        'total_deliveries', COUNT(*),
        'total_volume_litres', ROUND(SUM(delivery_volume_litres), 2),
        'avg_confidence_score', ROUND(AVG(confidence_score), 2),
        'high_confidence_count', COUNT(*) FILTER (WHERE confidence_score >= 80)
      )
      FROM mtdata_captive_correlations
      WHERE mtdata_trip_id = p_trip_id
    ),

    -- Route analysis
    'route_analysis', (
      SELECT json_build_object(
        'route_pattern', (
          SELECT json_build_object(
            'route_hash', rp.route_hash,
            'start_location', rp.start_location,
            'end_location', rp.end_location,
            'usage_stats', json_build_object(
              'trip_count', rp.trip_count,
              'avg_distance_km', rp.average_distance_km,
              'avg_time_hours', rp.average_travel_time_hours,
              'best_time_hours', rp.best_time_hours,
              'efficiency_rating', rp.efficiency_rating
            )
          )
          FROM route_patterns rp
          JOIN mtdata_trip_history th ON
            MD5(th.start_location || '-' || th.end_location) = rp.route_hash
          WHERE th.id = p_trip_id
          LIMIT 1
        ),
        'efficiency_metrics', (
          SELECT json_build_object(
            'route_efficiency_score', th.route_efficiency_score,
            'avg_speed_kph', th.average_speed_kph,
            'idling_percentage', ROUND((th.idling_time_hours / NULLIF(th.travel_time_hours, 0)) * 100, 2)
          )
          FROM mtdata_trip_history th
          WHERE th.id = p_trip_id
        )
      )
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_trip_complete_data(UUID) IS 'Returns comprehensive trip data including vehicle, driver, events, deliveries, and route analysis';

DO $$
BEGIN
  RAISE NOTICE '  ✓ get_trip_complete_data created successfully';
END $$;

-- ============================================================================
-- 4. SEARCH_DRIVER_BY_NAME
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[4/6] Creating search_driver_by_name function...';
END $$;

CREATE OR REPLACE FUNCTION search_driver_by_name(p_name TEXT)
RETURNS TABLE (
  driver_id UUID,
  full_name TEXT,
  matched_systems TEXT[],
  highest_confidence DECIMAL,
  employee_id TEXT,
  fleet TEXT,
  depot TEXT,
  status TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH name_matches AS (
    -- Search in drivers table
    SELECT
      d.id as driver_id,
      d.first_name || ' ' || d.last_name as full_name,
      ARRAY['Standard']::TEXT[] as matched_systems,
      1.0::DECIMAL as confidence
    FROM drivers d
    WHERE
      LOWER(d.first_name || ' ' || d.last_name) LIKE LOWER('%' || p_name || '%')
      OR LOWER(d.preferred_name) LIKE LOWER('%' || p_name || '%')
      OR d.employee_id = p_name

    UNION

    -- Search in driver_name_mappings
    SELECT
      dnm.driver_id,
      d.first_name || ' ' || d.last_name,
      ARRAY[dnm.system_name]::TEXT[],
      dnm.confidence_score
    FROM driver_name_mappings dnm
    JOIN drivers d ON dnm.driver_id = d.id
    WHERE LOWER(dnm.mapped_name) LIKE LOWER('%' || p_name || '%')
  ),
  aggregated_matches AS (
    SELECT
      nm.driver_id,
      nm.full_name,
      array_agg(DISTINCT s) as matched_systems,
      MAX(nm.confidence) as highest_confidence
    FROM name_matches nm,
    UNNEST(nm.matched_systems) s
    GROUP BY nm.driver_id, nm.full_name
  )
  SELECT
    am.driver_id,
    am.full_name,
    am.matched_systems,
    am.highest_confidence,
    d.employee_id,
    d.fleet,
    d.depot,
    d.status
  FROM aggregated_matches am
  JOIN drivers d ON am.driver_id = d.id
  ORDER BY am.highest_confidence DESC, am.full_name;
END;
$$;

COMMENT ON FUNCTION search_driver_by_name(TEXT) IS 'Search for drivers by name across all system name mappings';

DO $$
BEGIN
  RAISE NOTICE '  ✓ search_driver_by_name created successfully';
END $$;

-- ============================================================================
-- 5. SEARCH_VEHICLE_BY_REGO
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[5/6] Creating search_vehicle_by_rego function...';
END $$;

CREATE OR REPLACE FUNCTION search_vehicle_by_rego(p_rego TEXT)
RETURNS TABLE (
  vehicle_id UUID,
  primary_registration TEXT,
  all_registrations TEXT[],
  fleet TEXT,
  depot TEXT,
  status TEXT,
  make TEXT,
  model TEXT,
  current_driver TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH vehicle_matches AS (
    SELECT DISTINCT
      v.id as vehicle_id,
      v.registration as primary_registration,
      v.fleet,
      v.depot,
      v.status,
      v.make,
      v.model
    FROM vehicles v
    WHERE UPPER(TRIM(v.registration)) LIKE UPPER('%' || TRIM(p_rego) || '%')

    UNION

    -- Also search in trip history for alternative registration formats
    SELECT DISTINCT
      v.id,
      v.registration,
      v.fleet,
      v.depot,
      v.status,
      v.make,
      v.model
    FROM mtdata_trip_history th
    JOIN vehicles v ON th.vehicle_id = v.id
    WHERE UPPER(TRIM(th.vehicle_registration)) LIKE UPPER('%' || TRIM(p_rego) || '%')
  ),
  registration_variants AS (
    SELECT
      vm.vehicle_id,
      array_agg(DISTINCT th.vehicle_registration ORDER BY th.vehicle_registration) as all_registrations
    FROM vehicle_matches vm
    LEFT JOIN mtdata_trip_history th ON vm.vehicle_id = th.vehicle_id
    GROUP BY vm.vehicle_id
  )
  SELECT
    vm.vehicle_id,
    vm.primary_registration,
    COALESCE(rv.all_registrations, ARRAY[vm.primary_registration]) as all_registrations,
    vm.fleet,
    vm.depot,
    vm.status,
    vm.make,
    vm.model,
    d.first_name || ' ' || d.last_name as current_driver
  FROM vehicle_matches vm
  LEFT JOIN registration_variants rv ON vm.vehicle_id = rv.vehicle_id
  LEFT JOIN driver_assignments da ON vm.vehicle_id = da.vehicle_id AND da.unassigned_at IS NULL
  LEFT JOIN drivers d ON da.driver_id = d.id;
END;
$$;

COMMENT ON FUNCTION search_vehicle_by_rego(TEXT) IS 'Search for vehicles by registration including alternative formats';

DO $$
BEGIN
  RAISE NOTICE '  ✓ search_vehicle_by_rego created successfully';
END $$;

-- ============================================================================
-- 6. GET_DELIVERY_CHAIN
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '[6/6] Creating get_delivery_chain function...';
END $$;

CREATE OR REPLACE FUNCTION get_delivery_chain(p_delivery_key TEXT)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    -- Delivery information
    'delivery', (
      SELECT json_build_object(
        'delivery_key', cd.delivery_key,
        'bill_of_lading', cd.bill_of_lading,
        'delivery_date', cd.delivery_date,
        'customer', cd.customer,
        'terminal', cd.terminal,
        'carrier', cd.carrier,
        'products', cd.products,
        'total_volume_litres', cd.total_volume_litres,
        'record_count', cd.record_count
      )
      FROM captive_deliveries cd
      WHERE cd.delivery_key = p_delivery_key
    ),

    -- Correlated trips
    'trips', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'trip_id', th.id,
          'trip_external_id', th.trip_external_id,
          'start_time', th.start_time,
          'end_time', th.end_time,
          'distance_km', th.distance_km,
          'vehicle', json_build_object(
            'vehicle_id', v.id,
            'registration', v.registration,
            'fleet', v.fleet
          ),
          'driver', json_build_object(
            'driver_id', d.id,
            'name', d.first_name || ' ' || d.last_name
          ),
          'correlation', json_build_object(
            'confidence_score', mcc.confidence_score,
            'match_type', mcc.match_type,
            'terminal_distance_km', mcc.terminal_distance_km
          )
        ) ORDER BY mcc.confidence_score DESC
      ), '[]'::json)
      FROM mtdata_captive_correlations mcc
      JOIN mtdata_trip_history th ON mcc.mtdata_trip_id = th.id
      LEFT JOIN vehicles v ON th.vehicle_id = v.id
      LEFT JOIN drivers d ON th.driver_id = d.id
      WHERE mcc.delivery_key = p_delivery_key
    ),

    -- Events associated with trips
    'events', (
      SELECT json_build_object(
        'lytx_events', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'event_id', le.event_id,
              'event_datetime', le.event_datetime,
              'safety_score', le.safety_score,
              'trigger_type', le.trigger_type,
              'trip_id', le.mtdata_trip_id
            )
          ), '[]'::json)
          FROM lytx_safety_events le
          WHERE le.mtdata_trip_id IN (
            SELECT mtdata_trip_id
            FROM mtdata_captive_correlations
            WHERE delivery_key = p_delivery_key
          )
        ),
        'guardian_events', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'event_id', ge.event_id,
              'detection_time', ge.detection_time,
              'event_type', ge.event_type,
              'confirmation', ge.confirmation,
              'trip_id', ge.mtdata_trip_id
            )
          ), '[]'::json)
          FROM guardian_events ge
          WHERE ge.mtdata_trip_id IN (
            SELECT mtdata_trip_id
            FROM mtdata_captive_correlations
            WHERE delivery_key = p_delivery_key
          )
        )
      )
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_delivery_chain(TEXT) IS 'Returns complete delivery chain including trips, vehicles, drivers, and events';

DO $$
BEGIN
  RAISE NOTICE '  ✓ get_delivery_chain created successfully';
END $$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Granting function permissions to authenticated users...';
END $$;

GRANT EXECUTE ON FUNCTION get_driver_complete_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_vehicle_complete_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trip_complete_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_driver_by_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_vehicle_by_rego(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_delivery_chain(TEXT) TO authenticated;

-- ============================================================================
-- COMPLETION SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'PHASE 3 COMPLETE: QUERY FUNCTIONS CREATED';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'FUNCTIONS CREATED:';
  RAISE NOTICE '  1. ✓ get_driver_complete_profile(driver_id) → Full driver profile';
  RAISE NOTICE '  2. ✓ get_vehicle_complete_profile(vehicle_id) → Full vehicle profile';
  RAISE NOTICE '  3. ✓ get_trip_complete_data(trip_id) → Complete trip details';
  RAISE NOTICE '  4. ✓ search_driver_by_name(name) → Find drivers by name';
  RAISE NOTICE '  5. ✓ search_vehicle_by_rego(rego) → Find vehicles by registration';
  RAISE NOTICE '  6. ✓ get_delivery_chain(delivery_key) → Delivery-trip-event chain';
  RAISE NOTICE '';
  RAISE NOTICE 'USAGE EXAMPLES:';
  RAISE NOTICE '  SELECT get_driver_complete_profile(''<uuid>'')::json;';
  RAISE NOTICE '  SELECT * FROM search_driver_by_name(''John'');';
  RAISE NOTICE '  SELECT get_delivery_chain(''BOL123-2025-01-15-CustomerA'')::json;';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  → Run migration 004 to create relationship views';
  RAISE NOTICE '  → Test functions with sample data';
  RAISE NOTICE '============================================================================';
END $$;
