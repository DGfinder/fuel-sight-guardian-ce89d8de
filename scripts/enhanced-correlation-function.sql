-- Enhanced Correlation Function using Location Mapping
-- This function implements sequential delivery cycle logic with proper location validation

CREATE OR REPLACE FUNCTION enhanced_correlate_trip_with_deliveries(
  p_trip_id UUID,
  p_date_tolerance_days INTEGER DEFAULT 3,
  p_max_distance_km INTEGER DEFAULT 150,
  p_min_confidence INTEGER DEFAULT 50
)
RETURNS TABLE (
  trip_id UUID,
  delivery_key TEXT,
  customer_name TEXT,
  terminal_name TEXT,
  delivery_date DATE,
  delivery_volume_litres NUMERIC,
  correlation_confidence INTEGER,
  match_methods TEXT[],
  match_quality TEXT,
  outbound_trip_id TEXT,
  return_trip_id TEXT,
  total_distance_km DECIMAL(8,2),
  location_match_score INTEGER,
  temporal_match_score INTEGER,
  volume_match_score INTEGER,
  requires_manual_review BOOLEAN
) AS $$
DECLARE
  v_trip_record RECORD;
  v_delivery_record RECORD;
  v_location_match_score INTEGER;
  v_temporal_match_score INTEGER;
  v_volume_match_score INTEGER;
  v_total_confidence INTEGER;
  v_match_quality TEXT;
  v_requires_review BOOLEAN;
  v_outbound_trip_id TEXT;
  v_return_trip_id TEXT;
  v_total_distance DECIMAL(8,2);
BEGIN
  -- Get the trip details
  SELECT * INTO v_trip_record 
  FROM mtdata_trip_history 
  WHERE id = p_trip_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip not found: %', p_trip_id;
  END IF;
  
  -- Find potential deliveries within date tolerance
  FOR v_delivery_record IN
    SELECT 
      d.*,
      -- Calculate location match score using location_mapping
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM location_mapping lm 
          WHERE lm.location_name = d.terminal 
            AND lm.location_type = 'terminal'
        ) AND (
          v_trip_record.start_location = d.terminal OR
          v_trip_record.end_location = d.terminal OR
          EXISTS (
            SELECT 1 FROM location_mapping lm 
            WHERE lm.location_name = d.terminal 
              AND v_trip_record.start_location = ANY(lm.related_names)
          ) OR
          EXISTS (
            SELECT 1 FROM location_mapping lm 
            WHERE lm.location_name = d.terminal 
              AND v_trip_record.end_location = ANY(lm.related_names)
          )
        ) THEN 100
        WHEN EXISTS (
          SELECT 1 FROM location_mapping lm 
          WHERE lm.location_name = d.terminal 
            AND lm.location_type = 'terminal'
        ) AND (
          v_trip_record.start_location ILIKE '%' || d.terminal || '%' OR
          v_trip_record.end_location ILIKE '%' || d.terminal || '%'
        ) THEN 80
        ELSE 0
      END as location_match,
      
      -- Calculate temporal match score
      CASE 
        WHEN v_trip_record.trip_date_computed = d.delivery_date THEN 100
        WHEN ABS(v_trip_record.trip_date_computed - d.delivery_date) <= p_date_tolerance_days THEN 
          100 - (ABS(v_trip_record.trip_date_computed - d.delivery_date) * 20)
        ELSE 0
      END as temporal_match,
      
      -- Calculate volume match score (placeholder - can be enhanced with actual volume data)
      70 as volume_match
      
    FROM captive_deliveries d
    WHERE ABS(v_trip_record.trip_date_computed - d.delivery_date) <= p_date_tolerance_days
      AND d.carrier = 'SMB' -- Assuming Stevemacs carrier
  LOOP
    -- Find sequential delivery cycle (outbound + return)
    SELECT 
      t1.trip_external_id as outbound_id,
      t2.trip_external_id as return_id,
      (t1.distance_km + COALESCE(t2.distance_km, 0)) as total_km
    INTO v_outbound_trip_id, v_return_trip_id, v_total_distance
    FROM mtdata_trip_history t1
    LEFT JOIN mtdata_trip_history t2 ON 
      t2.start_location = t1.end_location -- Return starts where outbound ended
      AND t2.end_location = t1.start_location -- Return ends where outbound started
      AND t2.trip_date_computed >= t1.trip_date_computed
      AND t2.group_name = t1.group_name
      AND t2.id > t1.id -- Ensure return comes after outbound
    WHERE t1.id = p_trip_id
      AND t1.start_location IN (
        SELECT location_name FROM location_mapping 
        WHERE location_type IN ('depot', 'terminal')
      )
      AND t1.end_location NOT IN (
        SELECT location_name FROM location_mapping 
        WHERE location_type IN ('depot', 'terminal')
      );
    
    -- Calculate confidence scores
    v_location_match_score := v_delivery_record.location_match;
    v_temporal_match_score := v_delivery_record.temporal_match;
    v_volume_match_score := v_delivery_record.volume_match;
    
    -- Weighted confidence calculation
    v_total_confidence := 
      (v_location_match_score * 0.4) + 
      (v_temporal_match_score * 0.4) + 
      (v_volume_match_score * 0.2);
    
    -- Determine match quality
    v_match_quality := CASE 
      WHEN v_total_confidence >= 90 THEN 'excellent'
      WHEN v_total_confidence >= 80 THEN 'good'
      WHEN v_total_confidence >= 70 THEN 'fair'
      ELSE 'poor'
    END;
    
    -- Determine if manual review is needed
    v_requires_review := v_total_confidence < p_min_confidence OR v_match_quality = 'poor';
    
    -- Return the correlation result
    RETURN QUERY SELECT
      p_trip_id,
      v_delivery_record.delivery_key,
      v_delivery_record.customer,
      v_delivery_record.terminal,
      v_delivery_record.delivery_date,
      v_delivery_record.total_volume_litres,
      v_total_confidence::INTEGER,
      ARRAY[
        CASE WHEN v_location_match_score > 0 THEN 'location' END,
        CASE WHEN v_temporal_match_score > 0 THEN 'temporal' END,
        CASE WHEN v_volume_match_score > 0 THEN 'volume' END
      ] FILTER (WHERE CASE WHEN v_location_match_score > 0 THEN 'location' END IS NOT NULL),
      v_match_quality,
      v_outbound_trip_id,
      v_return_trip_id,
      v_total_distance,
      v_location_match_score,
      v_temporal_match_score,
      v_volume_match_score,
      v_requires_review;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to run enhanced batch correlation analysis
CREATE OR REPLACE FUNCTION run_enhanced_batch_correlation(
  p_start_date DATE,
  p_end_date DATE,
  p_min_confidence INTEGER DEFAULT 60,
  p_clear_existing BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  analysis_run_id UUID,
  trips_processed INTEGER,
  correlations_created INTEGER,
  high_confidence_matches INTEGER,
  manual_review_needed INTEGER,
  avg_confidence DECIMAL(5,2),
  processing_time_seconds DECIMAL(8,2)
) AS $$
DECLARE
  v_start_time TIMESTAMPTZ := NOW();
  v_analysis_run_id UUID := gen_random_uuid();
  v_trip_record RECORD;
  v_correlation_count INTEGER := 0;
  v_high_confidence_count INTEGER := 0;
  v_manual_review_count INTEGER := 0;
  v_total_confidence NUMERIC := 0;
  v_trip_count INTEGER := 0;
BEGIN
  -- Clear existing correlations if requested
  IF p_clear_existing THEN
    DELETE FROM mtdata_captive_correlations 
    WHERE trip_date_computed BETWEEN p_start_date AND p_end_date;
  END IF;
  
  -- Process each trip in the date range
  FOR v_trip_record IN
    SELECT id, trip_external_id, trip_date_computed
    FROM mtdata_trip_history 
    WHERE trip_date_computed BETWEEN p_start_date AND p_end_date
      AND group_name = 'Stevemacs' -- Focus on Stevemacs trips
  LOOP
    v_trip_count := v_trip_count + 1;
    
    -- Run enhanced correlation for this trip
    INSERT INTO mtdata_captive_correlations (
      mtdata_trip_id,
      delivery_key,
      customer_name,
      terminal_name,
      delivery_date,
      delivery_volume_litres,
      confidence_score,
      match_methods,
      match_quality,
      trip_date_computed,
      created_at
    )
    SELECT 
      trip_id,
      delivery_key,
      customer_name,
      terminal_name,
      delivery_date,
      delivery_volume_litres,
      correlation_confidence,
      match_methods,
      match_quality,
      v_trip_record.trip_date_computed,
      NOW()
    FROM enhanced_correlate_trip_with_deliveries(
      v_trip_record.id,
      3, -- date tolerance
      150, -- max distance
      50  -- min confidence
    );
    
    -- Count correlations and update statistics
    GET DIAGNOSTICS v_correlation_count = ROW_COUNT;
    
    -- Update counters based on correlation results
    SELECT 
      COUNT(*) as total_corrs,
      COUNT(*) FILTER (WHERE confidence_score >= 80) as high_conf,
      COUNT(*) FILTER (WHERE confidence_score < 60) as manual_review,
      AVG(confidence_score) as avg_conf
    INTO v_correlation_count, v_high_confidence_count, v_manual_review_count, v_total_confidence
    FROM mtdata_captive_correlations 
    WHERE mtdata_trip_id = v_trip_record.id;
    
  END LOOP;
  
  -- Return summary statistics
  RETURN QUERY SELECT
    v_analysis_run_id,
    v_trip_count,
    v_correlation_count,
    v_high_confidence_count,
    v_manual_review_count,
    COALESCE(v_total_confidence, 0),
    EXTRACT(EPOCH FROM (NOW() - v_start_time));
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test the enhanced correlation function
SELECT 'Enhanced correlation functions created successfully' as status;
