-- ============================================================================
-- HYBRID CORRELATION ENGINE
-- Multi-tier matching logic combining text, geospatial, and lookup-based approaches
-- ============================================================================

-- ============================================================================
-- COMPREHENSIVE TRIP-DELIVERY CORRELATION FUNCTION
-- ============================================================================

-- Main function that combines all matching approaches
CREATE OR REPLACE FUNCTION hybrid_correlate_trip_with_deliveries(
  trip_id_input UUID,
  date_tolerance_days INTEGER DEFAULT 3,
  max_distance_km INTEGER DEFAULT 150,
  min_confidence INTEGER DEFAULT 50,
  enable_geospatial BOOLEAN DEFAULT TRUE,
  enable_text_matching BOOLEAN DEFAULT TRUE,
  enable_lookup_boost BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  correlation_id UUID,
  delivery_key TEXT,
  bill_of_lading TEXT,
  delivery_date DATE,
  customer_name TEXT,
  terminal_name TEXT,
  carrier TEXT,
  
  -- Confidence and matching details
  overall_confidence INTEGER,
  confidence_breakdown JSONB,
  match_methods TEXT[],
  match_quality TEXT, -- 'excellent', 'good', 'fair', 'poor'
  
  -- Text matching details
  text_confidence INTEGER,
  text_match_method TEXT,
  normalized_trip_location TEXT,
  normalized_customer_name TEXT,
  business_identifier_match BOOLEAN,
  location_reference_match BOOLEAN,
  
  -- Geospatial matching details
  geo_confidence INTEGER,
  terminal_distance_km DECIMAL(8,2),
  within_service_area BOOLEAN,
  matching_trip_point TEXT,
  
  -- Temporal matching details
  temporal_confidence INTEGER,
  date_difference_days INTEGER,
  temporal_score DECIMAL(5,2),
  
  -- Delivery context
  delivery_volume_litres NUMERIC,
  total_delivery_records INTEGER,
  products TEXT[],
  
  -- Quality flags
  requires_manual_review BOOLEAN,
  quality_flags TEXT[]
) AS $$
DECLARE
  trip_record RECORD;
  delivery_record RECORD;
  text_matches RECORD;
  geo_matches RECORD;
  confidence_calc RECORD;
BEGIN
  -- Get trip details
  SELECT 
    id, trip_external_id, vehicle_registration, group_name,
    start_time, end_time, start_location, end_location,
    start_latitude, start_longitude, end_latitude, end_longitude,
    distance_km, travel_time_hours, trip_date_computed
  INTO trip_record
  FROM mtdata_trip_history
  WHERE id = trip_id_input;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip ID % not found', trip_id_input;
  END IF;
  
  -- Process each delivery in the temporal window
  FOR delivery_record IN 
    SELECT 
      delivery_key, bill_of_lading, delivery_date, customer, terminal, carrier,
      total_volume_litres_abs as volume_litres, record_count, products
    FROM captive_deliveries cd
    WHERE ABS(EXTRACT(EPOCH FROM (trip_record.trip_date_computed - cd.delivery_date)) / 86400) <= date_tolerance_days
    ORDER BY ABS(EXTRACT(EPOCH FROM (trip_record.trip_date_computed - cd.delivery_date)) / 86400)
  LOOP
    
    -- Initialize confidence components
    text_confidence := 0;
    text_match_method := '';
    geo_confidence := 0;
    temporal_confidence := 0;
    business_identifier_match := FALSE;
    location_reference_match := FALSE;
    terminal_distance_km := NULL;
    within_service_area := FALSE;
    matching_trip_point := '';
    
    -- TEXT MATCHING ANALYSIS
    IF enable_text_matching THEN
      -- Try matching trip locations with customer name
      IF trip_record.start_location IS NOT NULL AND trip_record.start_location != '' THEN
        SELECT * INTO text_matches
        FROM smart_text_match(
          trip_record.start_location, 
          delivery_record.customer, 
          'business'
        );
        
        IF text_matches.match_confidence > text_confidence THEN
          text_confidence := text_matches.match_confidence;
          text_match_method := text_matches.match_method || '_start';
          business_identifier_match := text_matches.business_match;
          location_reference_match := text_matches.location_match;
          normalized_trip_location := text_matches.normalized_text1;
          normalized_customer_name := text_matches.normalized_text2;
        END IF;
      END IF;
      
      -- Try end location
      IF trip_record.end_location IS NOT NULL AND trip_record.end_location != '' THEN
        SELECT * INTO text_matches
        FROM smart_text_match(
          trip_record.end_location, 
          delivery_record.customer, 
          'business'
        );
        
        IF text_matches.match_confidence > text_confidence THEN
          text_confidence := text_matches.match_confidence;
          text_match_method := text_matches.match_method || '_end';
          business_identifier_match := text_matches.business_match;
          location_reference_match := text_matches.location_match;
          normalized_trip_location := text_matches.normalized_text2;
          normalized_customer_name := text_matches.normalized_text2;
        END IF;
      END IF;
      
      -- Try matching with terminal name
      IF trip_record.start_location IS NOT NULL THEN
        SELECT * INTO text_matches
        FROM smart_text_match(
          trip_record.start_location, 
          delivery_record.terminal, 
          'terminal'
        );
        
        IF text_matches.match_confidence > text_confidence THEN
          text_confidence := text_matches.match_confidence;
          text_match_method := text_matches.match_method || '_terminal_start';
          normalized_trip_location := text_matches.normalized_text1;
        END IF;
      END IF;
      
      IF trip_record.end_location IS NOT NULL THEN
        SELECT * INTO text_matches
        FROM smart_text_match(
          trip_record.end_location, 
          delivery_record.terminal, 
          'terminal'
        );
        
        IF text_matches.match_confidence > text_confidence THEN
          text_confidence := text_matches.match_confidence;
          text_match_method := text_matches.match_method || '_terminal_end';
          normalized_trip_location := text_matches.normalized_text1;
        END IF;
      END IF;
      
      -- Apply lookup table boosts
      IF enable_lookup_boost THEN
        -- Check for business name alias matches
        IF resolve_business_name(trip_record.start_location) = resolve_business_name(delivery_record.customer)
           OR resolve_business_name(trip_record.end_location) = resolve_business_name(delivery_record.customer) THEN
          text_confidence := LEAST(text_confidence + 20, 100);
          text_match_method := text_match_method || '_alias_boost';
        END IF;
        
        -- Check for terminal alias matches
        IF resolve_terminal_name(trip_record.start_location) = delivery_record.terminal
           OR resolve_terminal_name(trip_record.end_location) = delivery_record.terminal THEN
          text_confidence := LEAST(text_confidence + 25, 100);
          text_match_method := text_match_method || '_terminal_alias';
        END IF;
      END IF;
    END IF;
    
    -- GEOSPATIAL MATCHING ANALYSIS
    IF enable_geospatial AND (trip_record.start_latitude IS NOT NULL OR trip_record.end_latitude IS NOT NULL) THEN
      -- Try start point
      IF trip_record.start_latitude IS NOT NULL AND trip_record.start_longitude IS NOT NULL THEN
        SELECT ftftp.confidence_score, ftftp.distance_km, ftftp.within_service_area
        INTO geo_matches
        FROM find_terminals_for_trip_point(
          trip_record.start_latitude,
          trip_record.start_longitude,
          max_distance_km
        ) ftftp
        WHERE ftftp.terminal_name = delivery_record.terminal
        ORDER BY ftftp.confidence_score DESC
        LIMIT 1;
        
        IF FOUND AND geo_matches.confidence_score > geo_confidence THEN
          geo_confidence := geo_matches.confidence_score::INTEGER;
          terminal_distance_km := geo_matches.distance_km;
          within_service_area := geo_matches.within_service_area;
          matching_trip_point := 'start';
        END IF;
      END IF;
      
      -- Try end point
      IF trip_record.end_latitude IS NOT NULL AND trip_record.end_longitude IS NOT NULL THEN
        SELECT ftftp.confidence_score, ftftp.distance_km, ftftp.within_service_area
        INTO geo_matches
        FROM find_terminals_for_trip_point(
          trip_record.end_latitude,
          trip_record.end_longitude,
          max_distance_km
        ) ftftp
        WHERE ftftp.terminal_name = delivery_record.terminal
        ORDER BY ftftp.confidence_score DESC
        LIMIT 1;
        
        IF FOUND AND geo_matches.confidence_score::INTEGER > geo_confidence THEN
          geo_confidence := geo_matches.confidence_score::INTEGER;
          terminal_distance_km := geo_matches.distance_km;
          within_service_area := geo_matches.within_service_area;
          matching_trip_point := 'end';
        END IF;
      END IF;
    END IF;
    
    -- TEMPORAL MATCHING ANALYSIS
    date_difference_days := ABS(EXTRACT(EPOCH FROM (trip_record.trip_date_computed - delivery_record.delivery_date)) / 86400)::INTEGER;
    
    temporal_score := CASE 
      WHEN date_difference_days = 0 THEN 100.0
      WHEN date_difference_days = 1 THEN 80.0
      WHEN date_difference_days = 2 THEN 60.0
      WHEN date_difference_days = 3 THEN 40.0
      WHEN date_difference_days <= 5 THEN 20.0
      ELSE 0.0
    END;
    
    temporal_confidence := temporal_score::INTEGER;
    
    -- CALCULATE OVERALL CONFIDENCE
    SELECT 
      -- Weighted confidence calculation
      CASE 
        WHEN text_confidence >= 85 AND geo_confidence >= 85 THEN
          -- Both high confidence: 95% + temporal bonus
          LEAST(95 + (temporal_confidence * 0.05)::INTEGER, 100)
        WHEN text_confidence >= 85 THEN
          -- High text confidence: 80% base + geo bonus + temporal bonus
          LEAST(80 + (geo_confidence * 0.1)::INTEGER + (temporal_confidence * 0.1)::INTEGER, 100)
        WHEN geo_confidence >= 85 THEN
          -- High geo confidence: 75% base + text bonus + temporal bonus
          LEAST(75 + (text_confidence * 0.1)::INTEGER + (temporal_confidence * 0.15)::INTEGER, 100)
        WHEN text_confidence >= 60 AND geo_confidence >= 60 THEN
          -- Both moderate: weighted average + temporal bonus
          LEAST(((text_confidence * 0.6 + geo_confidence * 0.4)::INTEGER) + (temporal_confidence * 0.1)::INTEGER, 100)
        WHEN text_confidence >= 60 THEN
          -- Moderate text: 60% base + geo bonus + temporal bonus
          LEAST(60 + (geo_confidence * 0.15)::INTEGER + (temporal_confidence * 0.25)::INTEGER, 100)
        WHEN geo_confidence >= 60 THEN
          -- Moderate geo: 55% base + text bonus + temporal bonus
          LEAST(55 + (text_confidence * 0.2)::INTEGER + (temporal_confidence * 0.25)::INTEGER, 100)
        ELSE
          -- Lower confidence: weighted combination
          LEAST(((text_confidence * 0.4 + geo_confidence * 0.3 + temporal_confidence * 0.3)::INTEGER), 100)
      END as calc_confidence,
      
      -- Quality assessment
      CASE 
        WHEN text_confidence >= 85 AND geo_confidence >= 85 AND temporal_confidence >= 80 THEN 'excellent'
        WHEN text_confidence >= 75 AND geo_confidence >= 70 AND temporal_confidence >= 60 THEN 'good'
        WHEN text_confidence >= 60 OR geo_confidence >= 60 THEN 'fair'
        ELSE 'poor'
      END as quality_assessment,
      
      -- Methods used
      ARRAY[
        CASE WHEN text_confidence > 0 THEN 'text_matching' END,
        CASE WHEN geo_confidence > 0 THEN 'geospatial' END,
        CASE WHEN temporal_confidence > 0 THEN 'temporal' END
      ]::TEXT[] as methods_used,
      
      -- Quality flags
      ARRAY[
        CASE WHEN date_difference_days > 3 THEN 'large_date_gap' END,
        CASE WHEN terminal_distance_km > 100 THEN 'long_distance' END,
        CASE WHEN text_confidence < 50 AND geo_confidence < 50 THEN 'low_confidence' END,
        CASE WHEN text_confidence = 0 AND geo_confidence = 0 THEN 'no_location_match' END
      ]::TEXT[] as flags
    INTO confidence_calc;
    
    overall_confidence := confidence_calc.calc_confidence;
    match_quality := confidence_calc.quality_assessment;
    match_methods := array_remove(confidence_calc.methods_used, NULL);
    quality_flags := array_remove(confidence_calc.flags, NULL);
    
    -- Determine if manual review is needed
    requires_manual_review := (
      overall_confidence < 70 OR
      date_difference_days > 3 OR
      terminal_distance_km > 100 OR
      array_length(quality_flags, 1) > 1
    );
    
    -- Only return correlations that meet minimum confidence
    IF overall_confidence >= min_confidence THEN
      RETURN QUERY SELECT
        gen_random_uuid() as correlation_id,
        delivery_record.delivery_key,
        delivery_record.bill_of_lading,
        delivery_record.delivery_date,
        delivery_record.customer,
        delivery_record.terminal,
        delivery_record.carrier,
        
        overall_confidence,
        jsonb_build_object(
          'text_confidence', text_confidence,
          'geo_confidence', geo_confidence,
          'temporal_confidence', temporal_confidence,
          'weighted_score', overall_confidence
        ) as confidence_breakdown,
        match_methods,
        match_quality,
        
        text_confidence,
        text_match_method,
        normalized_trip_location,
        normalized_customer_name,
        business_identifier_match,
        location_reference_match,
        
        geo_confidence,
        terminal_distance_km,
        within_service_area,
        matching_trip_point,
        
        temporal_confidence,
        date_difference_days,
        temporal_score,
        
        delivery_record.volume_litres,
        delivery_record.record_count,
        delivery_record.products,
        
        requires_manual_review,
        quality_flags;
    END IF;
    
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BATCH HYBRID CORRELATION FUNCTION
-- ============================================================================

-- Function to run hybrid correlation on multiple trips
CREATE OR REPLACE FUNCTION batch_hybrid_correlate_trips(
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
  end_date DATE DEFAULT CURRENT_DATE,
  fleet_filter TEXT DEFAULT NULL,
  min_confidence INTEGER DEFAULT 60,
  max_results INTEGER DEFAULT 1000
)
RETURNS TABLE (
  trip_id UUID,
  trip_external_id TEXT,
  vehicle_registration TEXT,
  group_name TEXT,
  trip_date DATE,
  correlation_count INTEGER,
  best_correlation_confidence INTEGER,
  best_correlation_customer TEXT,
  best_correlation_terminal TEXT,
  avg_correlation_confidence DECIMAL(5,2),
  has_excellent_matches BOOLEAN,
  requires_review_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH trip_correlations AS (
    SELECT 
      th.id as trip_id,
      th.trip_external_id,
      th.vehicle_registration,
      th.group_name,
      th.trip_date_computed as trip_date,
      hc.overall_confidence,
      hc.customer_name,
      hc.terminal_name,
      hc.match_quality,
      hc.requires_manual_review,
      ROW_NUMBER() OVER (PARTITION BY th.id ORDER BY hc.overall_confidence DESC) as rn
    FROM mtdata_trip_history th
    CROSS JOIN LATERAL hybrid_correlate_trip_with_deliveries(
      th.id, 3, 150, min_confidence, TRUE, TRUE, TRUE
    ) hc
    WHERE th.trip_date_computed BETWEEN start_date AND end_date
      AND (fleet_filter IS NULL OR th.group_name ILIKE '%' || fleet_filter || '%')
      AND (th.start_location IS NOT NULL OR th.end_location IS NOT NULL OR 
           th.start_latitude IS NOT NULL OR th.end_latitude IS NOT NULL)
  ),
  trip_summary AS (
    SELECT 
      tc.trip_id,
      tc.trip_external_id,
      tc.vehicle_registration,
      tc.group_name,
      tc.trip_date,
      COUNT(*) as correlation_count,
      MAX(tc.overall_confidence) as best_confidence,
      (SELECT customer_name FROM trip_correlations tc2 WHERE tc2.trip_id = tc.trip_id AND tc2.rn = 1) as best_customer,
      (SELECT terminal_name FROM trip_correlations tc2 WHERE tc2.trip_id = tc.trip_id AND tc2.rn = 1) as best_terminal,
      AVG(tc.overall_confidence) as avg_confidence,
      COUNT(*) FILTER (WHERE tc.match_quality = 'excellent') > 0 as has_excellent,
      COUNT(*) FILTER (WHERE tc.requires_manual_review = TRUE) as review_needed
    FROM trip_correlations tc
    GROUP BY tc.trip_id, tc.trip_external_id, tc.vehicle_registration, tc.group_name, tc.trip_date
  )
  SELECT 
    ts.trip_id,
    ts.trip_external_id,
    ts.vehicle_registration,
    ts.group_name,
    ts.trip_date,
    ts.correlation_count,
    ts.best_confidence,
    ts.best_customer,
    ts.best_terminal,
    ts.avg_confidence,
    ts.has_excellent,
    ts.review_needed
  FROM trip_summary ts
  ORDER BY ts.best_confidence DESC, ts.correlation_count DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CORRELATION QUALITY ASSESSMENT FUNCTION
-- ============================================================================

-- Function to assess correlation quality and provide recommendations
CREATE OR REPLACE FUNCTION assess_correlation_quality(
  correlation_data JSONB
)
RETURNS TABLE (
  quality_score INTEGER,
  quality_level TEXT,
  confidence_factors TEXT[],
  risk_factors TEXT[],
  recommendations TEXT[]
) AS $$
DECLARE
  text_conf INTEGER;
  geo_conf INTEGER;
  temporal_conf INTEGER;
  overall_conf INTEGER;
  factors TEXT[];
  risks TEXT[];
  recommendations TEXT[];
BEGIN
  -- Extract confidence values
  text_conf := (correlation_data->>'text_confidence')::INTEGER;
  geo_conf := (correlation_data->>'geo_confidence')::INTEGER;
  temporal_conf := (correlation_data->>'temporal_confidence')::INTEGER;
  overall_conf := (correlation_data->>'overall_confidence')::INTEGER;
  
  -- Identify confidence factors
  factors := ARRAY[]::TEXT[];
  IF text_conf >= 85 THEN
    factors := array_append(factors, 'High text match confidence');
  END IF;
  IF geo_conf >= 85 THEN
    factors := array_append(factors, 'High geospatial match confidence');
  END IF;
  IF temporal_conf >= 80 THEN
    factors := array_append(factors, 'Excellent temporal correlation');
  END IF;
  IF (correlation_data->>'business_identifier_match')::BOOLEAN THEN
    factors := array_append(factors, 'Business identifier match found');
  END IF;
  IF (correlation_data->>'within_service_area')::BOOLEAN THEN
    factors := array_append(factors, 'Trip within terminal service area');
  END IF;
  
  -- Identify risk factors
  risks := ARRAY[]::TEXT[];
  IF (correlation_data->>'date_difference_days')::INTEGER > 3 THEN
    risks := array_append(risks, 'Large date difference between trip and delivery');
  END IF;
  IF (correlation_data->>'terminal_distance_km')::DECIMAL > 100 THEN
    risks := array_append(risks, 'Long distance between trip and terminal');
  END IF;
  IF text_conf < 50 AND geo_conf < 50 THEN
    risks := array_append(risks, 'Low confidence in both text and location matching');
  END IF;
  
  -- Generate recommendations
  recommendations := ARRAY[]::TEXT[];
  IF overall_conf >= 90 THEN
    recommendations := array_append(recommendations, 'High confidence correlation - suitable for automatic verification');
  ELSIF overall_conf >= 75 THEN
    recommendations := array_append(recommendations, 'Good correlation - minimal manual review needed');
  ELSIF overall_conf >= 60 THEN
    recommendations := array_append(recommendations, 'Moderate correlation - recommend manual verification');
  ELSE
    recommendations := array_append(recommendations, 'Low confidence correlation - requires careful manual review');
  END IF;
  
  IF array_length(risks, 1) > 1 THEN
    recommendations := array_append(recommendations, 'Multiple risk factors present - investigate thoroughly');
  END IF;
  
  RETURN QUERY SELECT 
    overall_conf,
    CASE 
      WHEN overall_conf >= 90 THEN 'excellent'
      WHEN overall_conf >= 75 THEN 'good'
      WHEN overall_conf >= 60 THEN 'fair'
      ELSE 'poor'
    END,
    factors,
    risks,
    recommendations;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS AND COMMENTS
-- ============================================================================

-- Grant permissions
GRANT EXECUTE ON FUNCTION hybrid_correlate_trip_with_deliveries(UUID, INTEGER, INTEGER, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_hybrid_correlate_trips(DATE, DATE, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION assess_correlation_quality(JSONB) TO authenticated;

-- Add comments
COMMENT ON FUNCTION hybrid_correlate_trip_with_deliveries(UUID, INTEGER, INTEGER, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN) IS 'Advanced correlation engine combining text, geospatial, and temporal matching';
COMMENT ON FUNCTION batch_hybrid_correlate_trips(DATE, DATE, TEXT, INTEGER, INTEGER) IS 'Batch process hybrid correlations for multiple trips';
COMMENT ON FUNCTION assess_correlation_quality(JSONB) IS 'Assess correlation quality and provide recommendations';

SELECT 'Hybrid correlation engine created successfully' as result;