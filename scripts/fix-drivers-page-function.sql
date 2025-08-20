-- Fix the get_drivers_requiring_attention function to work with current data structure
-- This addresses the specific issues preventing the drivers page from showing data

-- Drop the existing function
DROP FUNCTION IF EXISTS get_drivers_requiring_attention(TEXT);

-- Create a simplified version that works with our current database structure
CREATE OR REPLACE FUNCTION get_drivers_requiring_attention(
  p_fleet TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
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
  coaching_sessions INTEGER,
  -- Additional fields for compatibility
  lytx_events_30d INTEGER,
  guardian_events_30d INTEGER,
  high_risk_events_30d INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Return drivers with calculated metrics, using simplified logic
  RETURN QUERY
  SELECT 
    d.id,
    d.first_name,
    d.last_name,
    CONCAT(d.first_name, ' ', d.last_name) as full_name,
    d.employee_id,
    d.fleet,
    d.depot,
    d.status,
    
    -- Safety scores (using available data or defaults)
    COALESCE(d.safety_score, 50.0) as overall_safety_score,
    COALESCE(d.lytx_score, 0.0) as lytx_safety_score,
    
    -- Guardian risk level (simplified calculation)
    CASE 
      WHEN COALESCE(d.safety_score, 50) < 30 THEN 'Critical'
      WHEN COALESCE(d.safety_score, 50) < 60 THEN 'High'
      WHEN COALESCE(d.safety_score, 50) < 80 THEN 'Medium'
      ELSE 'Low'
    END as guardian_risk_level,
    
    -- Trip metrics (from MtData if available, otherwise defaults)
    COALESCE(trip_stats.trip_count, 0)::INTEGER as total_trips,
    COALESCE(trip_stats.total_distance, 0.0) as total_km,
    COALESCE(trip_stats.active_days, 0)::INTEGER as active_days,
    trip_stats.last_trip as last_activity_date,
    
    -- Safety event counts (defaults for now)
    COALESCE(lytx_stats.event_count, 0)::INTEGER as lytx_events,
    COALESCE(guardian_stats.event_count, 0)::INTEGER as guardian_events,
    COALESCE(lytx_stats.high_risk_count, 0)::INTEGER as high_risk_events,
    COALESCE(lytx_stats.coaching_count, 0)::INTEGER as coaching_sessions,
    
    -- 30-day specific metrics for compatibility
    COALESCE(lytx_stats.event_count, 0)::INTEGER as lytx_events_30d,
    COALESCE(guardian_stats.event_count, 0)::INTEGER as guardian_events_30d,
    COALESCE(lytx_stats.high_risk_count, 0)::INTEGER as high_risk_events_30d
    
  FROM drivers d
  
  -- Left join with trip statistics
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*) as trip_count,
      COALESCE(SUM(mth.distance_km), 0) as total_distance,
      COUNT(DISTINCT DATE(mth.start_time)) as active_days,
      MAX(mth.start_time) as last_trip
    FROM mtdata_trip_history mth
    WHERE mth.driver_name = d.first_name || ' ' || d.last_name
      AND mth.start_time >= NOW() - INTERVAL '30 days'
  ) trip_stats ON true
  
  -- Left join with LYTX statistics
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*) as event_count,
      COUNT(*) FILTER (WHERE lse.score >= 7) as high_risk_count,
      COUNT(*) FILTER (WHERE lse.status = 'Face-To-Face') as coaching_count
    FROM lytx_safety_events lse
    WHERE lse.driver_name = d.first_name || ' ' || d.last_name
      AND lse.event_datetime >= NOW() - INTERVAL '30 days'
  ) lytx_stats ON true
  
  -- Left join with Guardian statistics
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*) as event_count
    FROM guardian_events ge
    WHERE ge.driver_name = d.first_name || ' ' || d.last_name
      AND ge.detection_time >= NOW() - INTERVAL '30 days'
  ) guardian_stats ON true
  
  WHERE d.status = 'Active'
    AND (p_fleet IS NULL OR d.fleet = p_fleet)
    AND (
      -- Include drivers with any risk indicators
      COALESCE(d.safety_score, 50) < 80 OR
      COALESCE(lytx_stats.event_count, 0) > 0 OR
      COALESCE(guardian_stats.event_count, 0) > 0 OR
      COALESCE(lytx_stats.high_risk_count, 0) > 0
    )
  ORDER BY 
    COALESCE(d.safety_score, 50) ASC,
    COALESCE(lytx_stats.high_risk_count, 0) DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_drivers_requiring_attention(TEXT) TO authenticated;

-- Also create a simple function to get all drivers for search
CREATE OR REPLACE FUNCTION search_drivers(
  p_search_term TEXT,
  p_fleet TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  employee_id TEXT,
  fleet TEXT,
  depot TEXT,
  status TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.first_name,
    d.last_name,
    CONCAT(d.first_name, ' ', d.last_name) as full_name,
    d.employee_id,
    d.fleet,
    d.depot,
    d.status
  FROM drivers d
  WHERE d.status = 'Active'
    AND (p_fleet IS NULL OR d.fleet = p_fleet)
    AND (
      d.first_name ILIKE '%' || p_search_term || '%' OR
      d.last_name ILIKE '%' || p_search_term || '%' OR
      CONCAT(d.first_name, ' ', d.last_name) ILIKE '%' || p_search_term || '%' OR
      d.employee_id ILIKE '%' || p_search_term || '%'
    )
  ORDER BY 
    CASE 
      WHEN CONCAT(d.first_name, ' ', d.last_name) ILIKE p_search_term || '%' THEN 1
      WHEN d.first_name ILIKE p_search_term || '%' THEN 2
      WHEN d.last_name ILIKE p_search_term || '%' THEN 3
      ELSE 4
    END,
    d.first_name, d.last_name
  LIMIT p_limit;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_drivers(TEXT, TEXT, INTEGER) TO authenticated;