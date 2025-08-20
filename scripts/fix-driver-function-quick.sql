-- Quick fix for the specific column ambiguity issue in get_driver_profile_summary
-- This addresses the immediate error without recreating all functions

-- Drop and recreate just the problematic function with proper table aliases
DROP FUNCTION IF EXISTS get_driver_profile_summary(UUID, TIMESTAMPTZ, TEXT);

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
    COALESCE(SUM(mth.distance_km), 0) as total_distance,
    COUNT(DISTINCT DATE(mth.start_time)) as active_day_count,
    MAX(mth.start_time) as last_trip
  INTO trip_stats
  FROM mtdata_trip_history mth
  WHERE mth.driver_name = driver_record.first_name || ' ' || driver_record.last_name
    AND mth.start_time >= p_start_date;
  
  -- Get LYTX statistics with proper table aliases
  SELECT 
    COUNT(*) as event_count,
    COUNT(*) FILTER (WHERE lse.score >= 7) as high_risk_count,
    COUNT(*) FILTER (WHERE lse.status = 'Face-To-Face') as coaching_count,
    AVG(lse.score) as avg_score
  INTO lytx_stats
  FROM lytx_safety_events lse
  WHERE lse.driver_name = driver_record.first_name || ' ' || driver_record.last_name
    AND lse.event_datetime >= p_start_date;
  
  -- Get Guardian statistics
  SELECT 
    COUNT(*) as event_count,
    COUNT(*) FILTER (WHERE ge.severity IN ('High', 'Critical')) as high_severity_count,
    CASE 
      WHEN COUNT(*) FILTER (WHERE ge.severity = 'Critical') > 0 THEN 'Critical'
      WHEN COUNT(*) FILTER (WHERE ge.severity = 'High') > 2 THEN 'High'
      WHEN COUNT(*) FILTER (WHERE ge.severity = 'Medium') > 5 THEN 'Medium'
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_driver_profile_summary(UUID, TIMESTAMPTZ, TEXT) TO authenticated;