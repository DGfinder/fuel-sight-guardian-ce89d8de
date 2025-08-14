-- Migration: Create Driver Profile Analytics System
-- Comprehensive database functions for unified driver profile analytics
-- Integrates MtData trips, LYTX safety events, and Guardian distraction/fatigue monitoring

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_driver_profile_summary(UUID, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS get_driver_trip_analytics(UUID, TEXT);
DROP FUNCTION IF EXISTS get_driver_lytx_analytics(UUID, TEXT);
DROP FUNCTION IF EXISTS get_driver_guardian_analytics(UUID, TEXT);
DROP FUNCTION IF EXISTS get_driver_performance_comparison(UUID, TEXT);
DROP FUNCTION IF EXISTS get_drivers_requiring_attention(TEXT);

-- Function: Get comprehensive driver profile summary
CREATE OR REPLACE FUNCTION get_driver_profile_summary(
  p_driver_id UUID,
  p_start_date TIMESTAMPTZ,
  p_timeframe TEXT
)
RETURNS TABLE (
  driver_id UUID,
  first_name TEXT,
  last_name TEXT,
  employee_id TEXT,
  fleet TEXT,
  depot TEXT,
  status TEXT,
  overall_safety_score NUMERIC,
  lytx_safety_score NUMERIC,
  guardian_risk_level TEXT,
  total_trips INTEGER,
  total_km NUMERIC,
  active_days INTEGER,
  last_activity_date TIMESTAMPTZ,
  lytx_events INTEGER,
  guardian_events INTEGER,
  high_risk_events INTEGER,
  coaching_sessions INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  driver_record RECORD;
  trip_stats RECORD;
  lytx_stats RECORD;
  guardian_stats RECORD;
BEGIN
  -- Get base driver information with RLS
  SELECT dp.id, dp.first_name, dp.last_name, dp.employee_id, dp.fleet, dp.depot, dp.status,
         COALESCE(dp.lytx_score, 0) as lytx_score
  INTO driver_record
  FROM driver_profiles dp
  WHERE dp.id = p_driver_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver not found or access denied';
  END IF;
  
  -- Get trip statistics from MtData
  SELECT 
    COUNT(*) as trip_count,
    COALESCE(SUM(distance_km), 0) as total_distance,
    COUNT(DISTINCT DATE(start_time)) as active_day_count,
    MAX(start_time) as last_trip
  INTO trip_stats
  FROM mtdata_trip_history mth
  WHERE mth.driver_name = driver_record.first_name || ' ' || driver_record.last_name
    AND mth.start_time >= p_start_date;
  
  -- Get LYTX statistics
  SELECT 
    COUNT(*) as event_count,
    COUNT(*) FILTER (WHERE score >= 7) as high_risk_count,
    COUNT(*) FILTER (WHERE status = 'Face-To-Face') as coaching_count,
    AVG(score) as avg_score
  INTO lytx_stats
  FROM lytx_safety_events lse
  WHERE lse.driver_name = driver_record.first_name || ' ' || driver_record.last_name
    AND lse.event_datetime >= p_start_date;
  
  -- Get Guardian statistics
  SELECT 
    COUNT(*) as event_count,
    COUNT(*) FILTER (WHERE severity IN ('High', 'Critical')) as high_severity_count,
    CASE 
      WHEN COUNT(*) FILTER (WHERE severity = 'Critical') > 0 THEN 'Critical'
      WHEN COUNT(*) FILTER (WHERE severity = 'High') > 2 THEN 'High'
      WHEN COUNT(*) FILTER (WHERE severity = 'Medium') > 5 THEN 'Medium'
      ELSE 'Low'
    END as risk_level
  INTO guardian_stats
  FROM guardian_events ge
  WHERE ge.driver_name = driver_record.first_name || ' ' || driver_record.last_name
    AND ge.detection_time >= p_start_date;
  
  -- Calculate overall safety score
  DECLARE
    overall_score NUMERIC := 0;
  BEGIN
    IF lytx_stats.avg_score IS NOT NULL THEN
      overall_score := (10 - lytx_stats.avg_score) * 10; -- Convert LYTX score (lower is better) to 0-100 scale
    END IF;
    
    -- Adjust based on Guardian events
    IF guardian_stats.high_severity_count > 0 THEN
      overall_score := overall_score - (guardian_stats.high_severity_count * 5);
    END IF;
    
    overall_score := GREATEST(0, LEAST(100, overall_score));
  END;
  
  RETURN QUERY SELECT
    driver_record.id,
    driver_record.first_name,
    driver_record.last_name,
    driver_record.employee_id,
    driver_record.fleet,
    driver_record.depot,
    driver_record.status,
    overall_score,
    driver_record.lytx_score,
    guardian_stats.risk_level,
    COALESCE(trip_stats.trip_count, 0)::INTEGER,
    COALESCE(trip_stats.total_distance, 0),
    COALESCE(trip_stats.active_day_count, 0)::INTEGER,
    trip_stats.last_trip,
    COALESCE(lytx_stats.event_count, 0)::INTEGER,
    COALESCE(guardian_stats.event_count, 0)::INTEGER,
    COALESCE(lytx_stats.high_risk_count + guardian_stats.high_severity_count, 0)::INTEGER,
    COALESCE(lytx_stats.coaching_count, 0)::INTEGER;
END;
$$;

-- Function: Get driver trip analytics from MtData
CREATE OR REPLACE FUNCTION get_driver_trip_analytics(
  p_driver_id UUID,
  p_timeframe TEXT
)
RETURNS TABLE (
  total_trips INTEGER,
  total_km NUMERIC,
  avg_trip_distance NUMERIC,
  avg_trip_duration NUMERIC,
  vehicles_driven INTEGER,
  primary_vehicle TEXT,
  depot_coverage TEXT[],
  most_active_hours JSONB,
  daily_patterns JSONB,
  monthly_trends JSONB,
  fuel_efficiency_score NUMERIC,
  route_optimization_score NUMERIC,
  vehicle_care_score NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  driver_name TEXT;
  days_back INTEGER;
  start_date TIMESTAMPTZ;
BEGIN
  -- Get driver name
  SELECT dp.first_name || ' ' || dp.last_name INTO driver_name
  FROM driver_profiles dp WHERE dp.id = p_driver_id;
  
  IF driver_name IS NULL THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;
  
  -- Calculate date range
  days_back := CASE p_timeframe
    WHEN '30d' THEN 30
    WHEN '90d' THEN 90
    WHEN '1y' THEN 365
    ELSE 30
  END;
  
  start_date := NOW() - INTERVAL '1 day' * days_back;
  
  RETURN QUERY
  WITH trip_data AS (
    SELECT 
      mth.*,
      EXTRACT(HOUR FROM start_time) as trip_hour,
      EXTRACT(DOW FROM start_time) as trip_dow,
      DATE_TRUNC('month', start_time) as trip_month
    FROM mtdata_trip_history mth
    WHERE mth.driver_name = driver_name
      AND mth.start_time >= start_date
  ),
  hourly_patterns AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'hour', trip_hour,
        'trip_count', COUNT(*)
      ) ORDER BY trip_hour
    ) as hours
    FROM (
      SELECT trip_hour, COUNT(*)
      FROM trip_data
      GROUP BY trip_hour
    ) h
  ),
  daily_patterns AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'day', CASE trip_dow
          WHEN 0 THEN 'Sunday'
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
        END,
        'trips', COUNT(*),
        'km', COALESCE(SUM(distance_km), 0)
      ) ORDER BY trip_dow
    ) as days
    FROM (
      SELECT trip_dow, COUNT(*), SUM(distance_km)
      FROM trip_data
      GROUP BY trip_dow
    ) d
  ),
  monthly_patterns AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'month', TO_CHAR(trip_month, 'Mon YY'),
        'trips', COUNT(*),
        'km', COALESCE(SUM(distance_km), 0)
      ) ORDER BY trip_month
    ) as months
    FROM (
      SELECT trip_month, COUNT(*), SUM(distance_km)
      FROM trip_data
      GROUP BY trip_month
    ) m
  )
  SELECT 
    COUNT(*)::INTEGER,
    COALESCE(SUM(td.distance_km), 0),
    COALESCE(AVG(td.distance_km), 0),
    COALESCE(AVG(EXTRACT(EPOCH FROM (td.end_time - td.start_time))/60), 0),
    COUNT(DISTINCT td.vehicle_registration)::INTEGER,
    (SELECT vehicle_registration FROM trip_data GROUP BY vehicle_registration ORDER BY COUNT(*) DESC LIMIT 1),
    ARRAY(SELECT DISTINCT depot FROM trip_data WHERE depot IS NOT NULL),
    (SELECT hours FROM hourly_patterns),
    (SELECT days FROM daily_patterns),
    (SELECT months FROM monthly_patterns),
    -- Placeholder scores (would be calculated based on actual performance metrics)
    85.0::NUMERIC, -- fuel_efficiency_score
    78.0::NUMERIC, -- route_optimization_score
    92.0::NUMERIC  -- vehicle_care_score
  FROM trip_data td;
END;
$$;

-- Function: Get driver LYTX safety analytics
CREATE OR REPLACE FUNCTION get_driver_lytx_analytics(
  p_driver_id UUID,
  p_timeframe TEXT
)
RETURNS TABLE (
  total_events INTEGER,
  events_by_trigger JSONB,
  resolution_rate NUMERIC,
  coaching_history JSONB,
  trend NUMERIC,
  high_risk_events INTEGER,
  speeding_events INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  driver_name TEXT;
  days_back INTEGER;
  start_date TIMESTAMPTZ;
BEGIN
  -- Get driver name
  SELECT dp.first_name || ' ' || dp.last_name INTO driver_name
  FROM driver_profiles dp WHERE dp.id = p_driver_id;
  
  IF driver_name IS NULL THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;
  
  -- Calculate date range
  days_back := CASE p_timeframe
    WHEN '30d' THEN 30
    WHEN '90d' THEN 90
    WHEN '1y' THEN 365
    ELSE 30
  END;
  
  start_date := NOW() - INTERVAL '1 day' * days_back;
  
  RETURN QUERY
  WITH lytx_data AS (
    SELECT lse.*
    FROM lytx_safety_events lse
    WHERE lse.driver_name = driver_name
      AND lse.event_datetime >= start_date
  ),
  trigger_stats AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'trigger', trigger,
        'count', event_count,
        'avg_score', avg_score
      ) ORDER BY event_count DESC
    ) as triggers
    FROM (
      SELECT 
        trigger,
        COUNT(*) as event_count,
        AVG(score) as avg_score
      FROM lytx_data
      GROUP BY trigger
    ) t
  ),
  coaching_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'date', event_datetime,
        'trigger', trigger,
        'coach', COALESCE(reviewed_by, 'Unknown'),
        'status', status
      ) ORDER BY event_datetime DESC
    ) as coaching
    FROM lytx_data
    WHERE status = 'Face-To-Face'
    LIMIT 10
  )
  SELECT 
    COUNT(*)::INTEGER,
    (SELECT triggers FROM trigger_stats),
    CASE 
      WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE status = 'Resolved') * 100.0 / COUNT(*))
      ELSE 0
    END,
    (SELECT coaching FROM coaching_data),
    -- Calculate trend (simplified - compare first and second half of period)
    CASE 
      WHEN COUNT(*) > 10 THEN
        (COUNT(*) FILTER (WHERE event_datetime >= start_date + (NOW() - start_date) / 2) * 100.0 / 
         NULLIF(COUNT(*) FILTER (WHERE event_datetime < start_date + (NOW() - start_date) / 2), 0)) - 100
      ELSE 0
    END,
    COUNT(*) FILTER (WHERE score >= 7)::INTEGER,
    COUNT(*) FILTER (WHERE trigger ILIKE '%speed%')::INTEGER
  FROM lytx_data;
END;
$$;

-- Function: Get driver Guardian analytics
CREATE OR REPLACE FUNCTION get_driver_guardian_analytics(
  p_driver_id UUID,
  p_timeframe TEXT
)
RETURNS TABLE (
  total_events INTEGER,
  events_by_type JSONB,
  confirmation_rate NUMERIC,
  severity_trends JSONB,
  trend NUMERIC,
  fatigue_events INTEGER,
  distraction_events INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  driver_name TEXT;
  days_back INTEGER;
  start_date TIMESTAMPTZ;
BEGIN
  -- Get driver name
  SELECT dp.first_name || ' ' || dp.last_name INTO driver_name
  FROM driver_profiles dp WHERE dp.id = p_driver_id;
  
  IF driver_name IS NULL THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;
  
  -- Calculate date range
  days_back := CASE p_timeframe
    WHEN '30d' THEN 30
    WHEN '90d' THEN 90
    WHEN '1y' THEN 365
    ELSE 30
  END;
  
  start_date := NOW() - INTERVAL '1 day' * days_back;
  
  RETURN QUERY
  WITH guardian_data AS (
    SELECT ge.*,
      CASE 
        WHEN event_type ILIKE '%fatigue%' THEN 'Fatigue'
        WHEN event_type ILIKE '%distraction%' THEN 'Distraction'
        WHEN event_type ILIKE '%field%' OR event_type ILIKE '%view%' THEN 'Field of View'
        ELSE 'Other'
      END as event_category
    FROM guardian_events ge
    WHERE ge.driver_name = driver_name
      AND ge.detection_time >= start_date
  ),
  type_stats AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'type', event_category,
        'count', event_count,
        'severity_breakdown', severity_breakdown
      )
    ) as types
    FROM (
      SELECT 
        event_category,
        COUNT(*) as event_count,
        jsonb_object_agg(severity, severity_count) as severity_breakdown
      FROM (
        SELECT 
          event_category,
          severity,
          COUNT(*) as severity_count
        FROM guardian_data
        GROUP BY event_category, severity
      ) severity_data
      GROUP BY event_category
    ) t
  ),
  monthly_severity AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'month', month_year,
        'low', COALESCE(low_count, 0),
        'medium', COALESCE(medium_count, 0),
        'high', COALESCE(high_count, 0),
        'critical', COALESCE(critical_count, 0)
      ) ORDER BY month_date
    ) as trends
    FROM (
      SELECT 
        TO_CHAR(DATE_TRUNC('month', detection_time), 'Mon YY') as month_year,
        DATE_TRUNC('month', detection_time) as month_date,
        COUNT(*) FILTER (WHERE severity = 'Low') as low_count,
        COUNT(*) FILTER (WHERE severity = 'Medium') as medium_count,
        COUNT(*) FILTER (WHERE severity = 'High') as high_count,
        COUNT(*) FILTER (WHERE severity = 'Critical') as critical_count
      FROM guardian_data
      GROUP BY DATE_TRUNC('month', detection_time)
    ) m
  )
  SELECT 
    COUNT(*)::INTEGER,
    (SELECT types FROM type_stats),
    CASE 
      WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE confirmation = 'verified') * 100.0 / COUNT(*))
      ELSE 0
    END,
    (SELECT trends FROM monthly_severity),
    -- Calculate trend (simplified)
    CASE 
      WHEN COUNT(*) > 5 THEN
        (COUNT(*) FILTER (WHERE detection_time >= start_date + (NOW() - start_date) / 2) * 100.0 / 
         NULLIF(COUNT(*) FILTER (WHERE detection_time < start_date + (NOW() - start_date) / 2), 0)) - 100
      ELSE 0
    END,
    COUNT(*) FILTER (WHERE event_category = 'Fatigue')::INTEGER,
    COUNT(*) FILTER (WHERE event_category = 'Distraction')::INTEGER
  FROM guardian_data;
END;
$$;

-- Function: Get driver performance comparison
CREATE OR REPLACE FUNCTION get_driver_performance_comparison(
  p_driver_id UUID,
  p_timeframe TEXT
)
RETURNS TABLE (
  fleet_rank INTEGER,
  fleet_percentile NUMERIC,
  safety_score_vs_fleet NUMERIC,
  trips_vs_fleet NUMERIC,
  km_vs_fleet NUMERIC,
  improvement_areas TEXT[],
  strengths TEXT[]
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  driver_fleet TEXT;
  driver_safety_score NUMERIC;
  driver_trips INTEGER;
  driver_km NUMERIC;
  fleet_avg_safety NUMERIC;
  fleet_avg_trips NUMERIC;
  fleet_avg_km NUMERIC;
  driver_rank INTEGER;
  total_drivers INTEGER;
BEGIN
  -- Get driver's fleet and basic metrics
  SELECT 
    dp.fleet,
    COALESCE(dp.lytx_score, 0),
    summary.total_trips,
    summary.total_km
  INTO driver_fleet, driver_safety_score, driver_trips, driver_km
  FROM driver_profiles dp
  CROSS JOIN LATERAL (
    SELECT * FROM get_driver_profile_summary(p_driver_id, NOW() - INTERVAL '30 days', p_timeframe)
  ) summary
  WHERE dp.id = p_driver_id;
  
  -- Get fleet averages
  SELECT 
    AVG(COALESCE(lytx_score, 0)),
    AVG(summary.total_trips),
    AVG(summary.total_km),
    COUNT(*)
  INTO fleet_avg_safety, fleet_avg_trips, fleet_avg_km, total_drivers
  FROM driver_profiles dp
  CROSS JOIN LATERAL (
    SELECT * FROM get_driver_profile_summary(dp.id, NOW() - INTERVAL '30 days', p_timeframe)
  ) summary
  WHERE dp.fleet = driver_fleet AND dp.status = 'Active';
  
  -- Calculate rank
  SELECT COUNT(*) + 1 INTO driver_rank
  FROM driver_profiles dp
  CROSS JOIN LATERAL (
    SELECT * FROM get_driver_profile_summary(dp.id, NOW() - INTERVAL '30 days', p_timeframe)
  ) summary
  WHERE dp.fleet = driver_fleet 
    AND dp.status = 'Active'
    AND COALESCE(dp.lytx_score, 0) > driver_safety_score;
  
  RETURN QUERY SELECT 
    driver_rank,
    CASE WHEN total_drivers > 0 THEN ((total_drivers - driver_rank + 1) * 100.0 / total_drivers) ELSE 0 END,
    CASE WHEN fleet_avg_safety > 0 THEN ((driver_safety_score - fleet_avg_safety) / fleet_avg_safety * 100) ELSE 0 END,
    CASE WHEN fleet_avg_trips > 0 THEN ((driver_trips - fleet_avg_trips) / fleet_avg_trips * 100) ELSE 0 END,
    CASE WHEN fleet_avg_km > 0 THEN ((driver_km - fleet_avg_km) / fleet_avg_km * 100) ELSE 0 END,
    -- Improvement areas (placeholder logic)
    CASE 
      WHEN driver_safety_score < fleet_avg_safety THEN ARRAY['Safety event management', 'Defensive driving techniques']
      WHEN driver_trips < fleet_avg_trips * 0.8 THEN ARRAY['Route efficiency', 'Time management']
      ELSE ARRAY[]::TEXT[]
    END,
    -- Strengths (placeholder logic)
    CASE 
      WHEN driver_safety_score > fleet_avg_safety * 1.1 THEN ARRAY['Excellent safety record', 'Consistent performance']
      WHEN driver_trips > fleet_avg_trips * 1.2 THEN ARRAY['High productivity', 'Reliable service delivery']
      ELSE ARRAY['Steady performance']
    END;
END;
$$;

-- Function: Get drivers requiring attention
CREATE OR REPLACE FUNCTION get_drivers_requiring_attention(
  p_fleet TEXT DEFAULT NULL
)
RETURNS TABLE (
  driver_id UUID,
  first_name TEXT,
  last_name TEXT,
  employee_id TEXT,
  fleet TEXT,
  depot TEXT,
  status TEXT,
  overall_safety_score NUMERIC,
  lytx_safety_score NUMERIC,
  guardian_risk_level TEXT,
  total_trips INTEGER,
  total_km NUMERIC,
  active_days INTEGER,
  last_activity_date TIMESTAMPTZ,
  lytx_events INTEGER,
  guardian_events INTEGER,
  high_risk_events INTEGER,
  coaching_sessions INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT summary.*
  FROM driver_profiles dp
  CROSS JOIN LATERAL (
    SELECT * FROM get_driver_profile_summary(dp.id, NOW() - INTERVAL '30 days', '30d')
  ) summary
  WHERE dp.status = 'Active'
    AND (p_fleet IS NULL OR dp.fleet = p_fleet)
    AND (
      summary.high_risk_events > 3 OR
      summary.guardian_risk_level IN ('High', 'Critical') OR
      summary.overall_safety_score < 60 OR
      summary.lytx_events > 5
    )
  ORDER BY summary.high_risk_events DESC, summary.overall_safety_score ASC;
END;
$$;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_driver_profile_summary(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_trip_analytics(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_lytx_analytics(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_guardian_analytics(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_performance_comparison(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_drivers_requiring_attention(TEXT) TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mtdata_trip_history_driver_time ON mtdata_trip_history(driver_name, start_time);
CREATE INDEX IF NOT EXISTS idx_lytx_safety_events_driver_time ON lytx_safety_events(driver_name, event_datetime);
CREATE INDEX IF NOT EXISTS idx_guardian_events_driver_time ON guardian_events(driver_name, detection_time);
CREATE INDEX IF NOT EXISTS idx_drivers_fleet_status ON drivers(fleet, status) WHERE status = 'Active';