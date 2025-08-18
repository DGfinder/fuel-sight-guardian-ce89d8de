-- ============================================================================
-- GEOSPATIAL TRIP TO TERMINAL MATCHING FUNCTIONS
-- Core spatial matching logic for MTdata trips to captive payment terminals
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- CORE MATCHING FUNCTION: FIND TERMINALS NEAR TRIP POINTS
-- ============================================================================

-- Function to find terminals within range of a trip point
CREATE OR REPLACE FUNCTION find_terminals_for_trip_point(
  input_latitude DECIMAL(10, 8),
  input_longitude DECIMAL(11, 8),
  max_distance_km INTEGER DEFAULT 100,
  carrier_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  terminal_name TEXT,
  distance_km DECIMAL(8,2),
  carrier_primary TEXT,
  within_service_area BOOLEAN,
  confidence_score DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tl.terminal_name,
    (ST_Distance(
      tl.location_point,
      ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography
    ) / 1000)::DECIMAL(8,2) AS distance_km,
    tl.carrier_primary,
    ST_Within(
      ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography,
      tl.service_area
    ) AS within_service_area,
    
    -- Confidence scoring based on distance and service area
    CASE 
      WHEN ST_Within(
        ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography,
        tl.service_area
      ) THEN 95.0 -- High confidence if within service area
      WHEN (ST_Distance(
        tl.location_point,
        ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography
      ) / 1000) <= 25 THEN 85.0 -- Very close (25km)
      WHEN (ST_Distance(
        tl.location_point,
        ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography
      ) / 1000) <= 50 THEN 70.0 -- Close (50km)
      WHEN (ST_Distance(
        tl.location_point,
        ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography
      ) / 1000) <= 100 THEN 50.0 -- Moderate (100km)
      ELSE 25.0 -- Far but possible
    END AS confidence_score
    
  FROM terminal_locations tl
  WHERE tl.active = TRUE
    AND ST_DWithin(
      tl.location_point,
      ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography,
      max_distance_km * 1000
    )
    AND (carrier_filter IS NULL OR tl.carrier_primary = carrier_filter OR tl.carrier_primary = 'Combined')
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIP-TO-TERMINAL CORRELATION FUNCTION
-- ============================================================================

-- Function to find best terminal matches for a complete trip
CREATE OR REPLACE FUNCTION correlate_trip_with_terminals(
  trip_id_input UUID,
  max_distance_km INTEGER DEFAULT 100,
  require_both_points BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  terminal_name TEXT,
  match_type TEXT,
  distance_km DECIMAL(8,2),
  confidence_score DECIMAL(5,2),
  carrier_primary TEXT,
  within_service_area BOOLEAN,
  matching_point TEXT -- 'start', 'end', or 'both'
) AS $$
DECLARE
  trip_record RECORD;
  start_matches RECORD;
  end_matches RECORD;
BEGIN
  -- Get trip details
  SELECT * INTO trip_record
  FROM mtdata_trip_history
  WHERE id = trip_id_input;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip ID % not found', trip_id_input;
  END IF;
  
  -- Return matches based on start point
  IF trip_record.start_latitude IS NOT NULL AND trip_record.start_longitude IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      ftftp.terminal_name,
      'start_point'::TEXT as match_type,
      ftftp.distance_km,
      ftftp.confidence_score,
      ftftp.carrier_primary,
      ftftp.within_service_area,
      'start'::TEXT as matching_point
    FROM find_terminals_for_trip_point(
      trip_record.start_latitude,
      trip_record.start_longitude,
      max_distance_km
    ) ftftp;
  END IF;
  
  -- Return matches based on end point
  IF trip_record.end_latitude IS NOT NULL AND trip_record.end_longitude IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      ftftp.terminal_name,
      'end_point'::TEXT as match_type,
      ftftp.distance_km,
      ftftp.confidence_score,
      ftftp.carrier_primary,
      ftftp.within_service_area,
      'end'::TEXT as matching_point
    FROM find_terminals_for_trip_point(
      trip_record.end_latitude,
      trip_record.end_longitude,
      max_distance_km
    ) ftftp
    WHERE NOT require_both_points 
      OR ftftp.terminal_name IN (
        -- Only include terminals that also match start point if require_both_points is true
        SELECT ftftp2.terminal_name
        FROM find_terminals_for_trip_point(
          trip_record.start_latitude,
          trip_record.start_longitude,
          max_distance_km
        ) ftftp2
      );
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BATCH TRIP CORRELATION FUNCTION
-- ============================================================================

-- Function to correlate multiple trips with terminals in a date range
CREATE OR REPLACE FUNCTION batch_correlate_trips_with_terminals(
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
  end_date DATE DEFAULT CURRENT_DATE,
  max_distance_km INTEGER DEFAULT 100,
  carrier_filter TEXT DEFAULT NULL,
  min_confidence DECIMAL DEFAULT 50.0
)
RETURNS TABLE (
  trip_id UUID,
  trip_external_id TEXT,
  vehicle_registration TEXT,
  group_name TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  terminal_name TEXT,
  match_type TEXT,
  distance_km DECIMAL(8,2),
  confidence_score DECIMAL(5,2),
  carrier_primary TEXT,
  within_service_area BOOLEAN,
  matching_point TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    th.id,
    th.trip_external_id,
    th.vehicle_registration,
    th.group_name,
    th.start_time,
    th.end_time,
    ctwt.terminal_name,
    ctwt.match_type,
    ctwt.distance_km,
    ctwt.confidence_score,
    ctwt.carrier_primary,
    ctwt.within_service_area,
    ctwt.matching_point
  FROM mtdata_trip_history th
  CROSS JOIN LATERAL correlate_trip_with_terminals(
    th.id,
    max_distance_km,
    FALSE
  ) ctwt
  WHERE th.trip_date_computed BETWEEN start_date AND end_date
    AND (carrier_filter IS NULL OR ctwt.carrier_primary = carrier_filter OR ctwt.carrier_primary = 'Combined')
    AND ctwt.confidence_score >= min_confidence
    AND (th.start_latitude IS NOT NULL OR th.end_latitude IS NOT NULL)
  ORDER BY th.start_time DESC, ctwt.confidence_score DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ENHANCED CORRELATION WITH DELIVERY MATCHING
-- ============================================================================

-- Function to correlate trips with both terminals and potential deliveries
CREATE OR REPLACE FUNCTION correlate_trip_with_deliveries(
  trip_id_input UUID,
  date_tolerance_days INTEGER DEFAULT 3,
  max_distance_km INTEGER DEFAULT 100
)
RETURNS TABLE (
  terminal_name TEXT,
  terminal_distance_km DECIMAL(8,2),
  terminal_confidence DECIMAL(5,2),
  potential_delivery_count BIGINT,
  delivery_date_range TEXT,
  matching_customers TEXT[],
  total_delivery_volume NUMERIC,
  correlation_score DECIMAL(5,2)
) AS $$
DECLARE
  trip_record RECORD;
BEGIN
  -- Get trip details
  SELECT * INTO trip_record
  FROM mtdata_trip_history
  WHERE id = trip_id_input;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip ID % not found', trip_id_input;
  END IF;
  
  RETURN QUERY
  WITH trip_terminal_matches AS (
    SELECT *
    FROM correlate_trip_with_terminals(trip_id_input, max_distance_km, FALSE)
  ),
  delivery_correlations AS (
    SELECT 
      ttm.terminal_name,
      ttm.distance_km as terminal_distance_km,
      ttm.confidence_score as terminal_confidence,
      COUNT(DISTINCT cd.bill_of_lading || '-' || cd.delivery_date) as potential_deliveries,
      MIN(cd.delivery_date)::TEXT || ' to ' || MAX(cd.delivery_date)::TEXT as delivery_date_range,
      ARRAY_AGG(DISTINCT cd.customer ORDER BY cd.customer) as matching_customers,
      SUM(cd.total_volume_litres_abs) as total_delivery_volume,
      
      -- Calculate correlation score based on temporal proximity and volume
      CASE 
        WHEN COUNT(DISTINCT cd.bill_of_lading || '-' || cd.delivery_date) > 0 THEN
          ttm.confidence_score * 0.6 + -- 60% weight on geographic match
          CASE 
            WHEN ABS(EXTRACT(EPOCH FROM (trip_record.start_time::DATE - cd.delivery_date)) / 86400) <= 1 THEN 40.0
            WHEN ABS(EXTRACT(EPOCH FROM (trip_record.start_time::DATE - cd.delivery_date)) / 86400) <= 2 THEN 30.0
            WHEN ABS(EXTRACT(EPOCH FROM (trip_record.start_time::DATE - cd.delivery_date)) / 86400) <= 3 THEN 20.0
            ELSE 10.0
          END * 0.4 -- 40% weight on temporal match
        ELSE ttm.confidence_score * 0.5 -- Reduce confidence if no deliveries found
      END as correlation_score
      
    FROM trip_terminal_matches ttm
    LEFT JOIN captive_deliveries cd ON cd.terminal = ttm.terminal_name
      AND ABS(EXTRACT(EPOCH FROM (trip_record.start_time::DATE - cd.delivery_date)) / 86400) <= date_tolerance_days
    GROUP BY ttm.terminal_name, ttm.distance_km, ttm.confidence_score
  )
  SELECT 
    dc.terminal_name,
    dc.terminal_distance_km,
    dc.terminal_confidence,
    dc.potential_deliveries,
    dc.delivery_date_range,
    dc.matching_customers,
    dc.total_delivery_volume,
    dc.correlation_score
  FROM delivery_correlations dc
  ORDER BY dc.correlation_score DESC, dc.potential_deliveries DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CUSTOMER NAME MATCHING WITH LOCATIONS
-- ============================================================================

-- Function to match trip location text with customer names
CREATE OR REPLACE FUNCTION match_trip_location_with_customers(
  trip_location TEXT,
  similarity_threshold REAL DEFAULT 0.3
)
RETURNS TABLE (
  customer_name TEXT,
  similarity_score REAL,
  geographic_region TEXT,
  primary_terminal TEXT,
  match_type TEXT
) AS $$
BEGIN
  IF trip_location IS NULL OR TRIM(trip_location) = '' THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH location_matches AS (
    -- Direct similarity matching
    SELECT 
      cnv.original_name,
      similarity(UPPER(trip_location), UPPER(cnv.original_name)) as sim_score,
      'direct_name_similarity' as match_type
    FROM customer_name_variants cnv
    WHERE similarity(UPPER(trip_location), UPPER(cnv.original_name)) >= similarity_threshold
    
    UNION ALL
    
    -- Key identifier matching
    SELECT 
      cnv.original_name,
      CASE 
        WHEN UPPER(trip_location) LIKE '%' || cnv.key_identifier || '%' THEN 0.8
        ELSE 0.0
      END as sim_score,
      'key_identifier_match' as match_type
    FROM customer_name_variants cnv
    WHERE cnv.key_identifier IS NOT NULL
      AND UPPER(trip_location) LIKE '%' || cnv.key_identifier || '%'
    
    UNION ALL
    
    -- Location keyword matching
    SELECT 
      cnv.original_name,
      CASE 
        WHEN cnv.location_keyword IS NOT NULL 
          AND UPPER(trip_location) LIKE '%' || cnv.location_keyword || '%' THEN 0.7
        ELSE 0.0
      END as sim_score,
      'location_keyword_match' as match_type
    FROM customer_name_variants cnv
    WHERE cnv.location_keyword IS NOT NULL
      AND UPPER(trip_location) LIKE '%' || cnv.location_keyword || '%'
  )
  SELECT 
    lm.original_name,
    lm.sim_score,
    cgc.geographic_region,
    cgc.primary_terminal,
    lm.match_type
  FROM location_matches lm
  LEFT JOIN customer_geographic_classification cgc ON cgc.customer = lm.original_name
  WHERE lm.sim_score >= similarity_threshold
  ORDER BY lm.sim_score DESC, lm.match_type;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMPREHENSIVE TRIP CORRELATION SUMMARY
-- ============================================================================

-- Function to get comprehensive correlation analysis for a trip
CREATE OR REPLACE FUNCTION get_trip_correlation_summary(
  trip_id_input UUID
)
RETURNS TABLE (
  trip_summary JSONB,
  terminal_matches JSONB,
  delivery_correlations JSONB,
  customer_name_matches JSONB,
  overall_confidence DECIMAL(5,2),
  recommended_action TEXT
) AS $$
DECLARE
  trip_record RECORD;
  max_terminal_confidence DECIMAL;
  max_delivery_correlation DECIMAL;
  customer_matches_count INTEGER;
BEGIN
  -- Get trip details
  SELECT 
    jsonb_build_object(
      'trip_id', th.id,
      'external_id', th.trip_external_id,
      'vehicle_registration', th.vehicle_registration,
      'group_name', th.group_name,
      'start_time', th.start_time,
      'end_time', th.end_time,
      'start_location', th.start_location,
      'end_location', th.end_location,
      'distance_km', th.distance_km,
      'trip_date', th.trip_date_computed
    ) INTO trip_record
  FROM mtdata_trip_history th
  WHERE th.id = trip_id_input;
  
  IF trip_record IS NULL THEN
    RAISE EXCEPTION 'Trip ID % not found', trip_id_input;
  END IF;
  
  -- Get terminal matches
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'terminal_name', terminal_name,
        'match_type', match_type,
        'distance_km', distance_km,
        'confidence_score', confidence_score,
        'carrier_primary', carrier_primary,
        'within_service_area', within_service_area,
        'matching_point', matching_point
      ) ORDER BY confidence_score DESC
    ),
    COALESCE(MAX(confidence_score), 0)
  INTO terminal_matches, max_terminal_confidence
  FROM correlate_trip_with_terminals(trip_id_input, 150, FALSE);
  
  -- Get delivery correlations
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'terminal_name', terminal_name,
        'terminal_distance_km', terminal_distance_km,
        'terminal_confidence', terminal_confidence,
        'potential_delivery_count', potential_delivery_count,
        'delivery_date_range', delivery_date_range,
        'matching_customers', matching_customers,
        'total_delivery_volume', total_delivery_volume,
        'correlation_score', correlation_score
      ) ORDER BY correlation_score DESC
    ),
    COALESCE(MAX(correlation_score), 0)
  INTO delivery_correlations, max_delivery_correlation
  FROM correlate_trip_with_deliveries(trip_id_input, 5, 150);
  
  -- Get customer name matches for start and end locations
  WITH all_location_matches AS (
    SELECT * FROM match_trip_location_with_customers(
      (trip_record ->> 'start_location')::TEXT, 0.3
    )
    UNION ALL
    SELECT * FROM match_trip_location_with_customers(
      (trip_record ->> 'end_location')::TEXT, 0.3
    )
  )
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'customer_name', customer_name,
        'similarity_score', similarity_score,
        'geographic_region', geographic_region,
        'primary_terminal', primary_terminal,
        'match_type', match_type
      ) ORDER BY similarity_score DESC
    ),
    COUNT(*)
  INTO customer_name_matches, customer_matches_count
  FROM all_location_matches;
  
  -- Calculate overall confidence and recommendation
  SELECT 
    CASE 
      WHEN max_delivery_correlation > 80 THEN max_delivery_correlation
      WHEN max_terminal_confidence > 70 AND customer_matches_count > 0 THEN 
        (max_terminal_confidence + customer_matches_count * 10) / 2
      WHEN max_terminal_confidence > 70 THEN max_terminal_confidence * 0.8
      WHEN customer_matches_count > 0 THEN customer_matches_count * 15
      ELSE max_terminal_confidence * 0.6
    END,
    CASE 
      WHEN max_delivery_correlation > 80 THEN 'High confidence match - Trip likely correlates with delivery'
      WHEN max_terminal_confidence > 85 THEN 'Very good terminal match - Investigate temporal correlation'
      WHEN max_terminal_confidence > 70 THEN 'Good terminal match - Check customer patterns'
      WHEN customer_matches_count > 0 THEN 'Customer name matches found - Verify geographic correlation'
      WHEN max_terminal_confidence > 50 THEN 'Moderate terminal match - May be related'
      ELSE 'Low confidence - Trip may not be delivery-related'
    END
  INTO overall_confidence, recommended_action;
  
  RETURN QUERY
  SELECT 
    trip_record,
    COALESCE(terminal_matches, '[]'::jsonb),
    COALESCE(delivery_correlations, '[]'::jsonb),
    COALESCE(customer_name_matches, '[]'::jsonb),
    COALESCE(overall_confidence, 0.0),
    recommended_action;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION find_terminals_for_trip_point(DECIMAL, DECIMAL, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION correlate_trip_with_terminals(UUID, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_correlate_trips_with_terminals(DATE, DATE, INTEGER, TEXT, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION correlate_trip_with_deliveries(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION match_trip_location_with_customers(TEXT, REAL) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trip_correlation_summary(UUID) TO authenticated;

-- Add comments
COMMENT ON FUNCTION find_terminals_for_trip_point(DECIMAL, DECIMAL, INTEGER, TEXT) IS 'Find terminals within range of GPS coordinates with confidence scoring';
COMMENT ON FUNCTION correlate_trip_with_terminals(UUID, INTEGER, BOOLEAN) IS 'Match a specific trip to nearby terminals using spatial analysis';
COMMENT ON FUNCTION batch_correlate_trips_with_terminals(DATE, DATE, INTEGER, TEXT, DECIMAL) IS 'Batch process trip-to-terminal correlations for a date range';
COMMENT ON FUNCTION correlate_trip_with_deliveries(UUID, INTEGER, INTEGER) IS 'Enhanced correlation including delivery temporal matching';
COMMENT ON FUNCTION match_trip_location_with_customers(TEXT, REAL) IS 'Fuzzy match trip location text with customer names';
COMMENT ON FUNCTION get_trip_correlation_summary(UUID) IS 'Comprehensive correlation analysis for a single trip';

SELECT 'Geospatial trip-to-terminal matching functions created successfully' as result;