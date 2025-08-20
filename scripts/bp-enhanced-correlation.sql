-- BP-Enhanced Correlation Function
-- This function leverages the enhanced location mapping to provide better correlation
-- for BP customers and third-party logistics relationships

CREATE OR REPLACE FUNCTION bp_enhanced_correlate_trip_with_deliveries(
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
  business_relationship_score INTEGER,
  bp_customer_bonus INTEGER,
  requires_manual_review BOOLEAN
) AS $$
DECLARE
  v_trip_record RECORD;
  v_delivery_record RECORD;
  v_location_match_score INTEGER;
  v_temporal_match_score INTEGER;
  v_volume_match_score INTEGER;
  v_business_relationship_score INTEGER;
  v_bp_customer_bonus INTEGER;
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
      -- Calculate location match score using enhanced location_mapping
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
      70 as volume_match,
      
      -- Calculate business relationship score
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM location_mapping lm 
          WHERE lm.location_name = d.customer 
            AND lm.business_relationship IS NOT NULL
        ) THEN 100
        WHEN EXISTS (
          SELECT 1 FROM location_mapping lm 
          WHERE lm.location_name = d.customer 
            AND lm.location_type = 'customer'
        ) THEN 80
        ELSE 60
      END as business_relationship_match,
      
      -- BP customer bonus score
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM location_mapping lm 
          WHERE lm.location_name = d.customer 
            AND lm.is_bp_customer = TRUE
        ) THEN 20
        ELSE 0
      END as bp_customer_bonus_score
      
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
    v_business_relationship_score := v_delivery_record.business_relationship_match;
    v_bp_customer_bonus := v_delivery_record.bp_customer_bonus_score;
    
    -- Enhanced weighted confidence calculation with BP customer bonus
    v_total_confidence := 
      (v_location_match_score * 0.35) + 
      (v_temporal_match_score * 0.35) + 
      (v_volume_match_score * 0.15) +
      (v_business_relationship_score * 0.10) +
      v_bp_customer_bonus;
    
    -- Cap confidence at 100
    v_total_confidence := LEAST(v_total_confidence, 100);
    
    -- Determine match quality
    v_match_quality := CASE 
      WHEN v_total_confidence >= 90 THEN 'excellent'
      WHEN v_total_confidence >= 80 THEN 'good'
      WHEN v_total_confidence >= 70 THEN 'fair'
      ELSE 'poor'
    END;
    
    -- Determine if manual review is needed
    v_requires_review := v_total_confidence < p_min_confidence OR v_match_quality = 'poor';
    
    -- Return the enhanced correlation result
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
        CASE WHEN v_volume_match_score > 0 THEN 'volume' END,
        CASE WHEN v_business_relationship_score > 0 THEN 'business_relationship' END,
        CASE WHEN v_bp_customer_bonus > 0 THEN 'bp_customer_bonus' END
      ] FILTER (WHERE CASE WHEN v_location_match_score > 0 THEN 'location' END IS NOT NULL),
      v_match_quality,
      v_outbound_trip_id,
      v_return_trip_id,
      v_total_distance,
      v_location_match_score,
      v_temporal_match_score,
      v_volume_match_score,
      v_business_relationship_score,
      v_bp_customer_bonus,
      v_requires_review;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to analyze BP customer correlation patterns
CREATE OR REPLACE FUNCTION analyze_bp_customer_patterns(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  analysis_type TEXT,
  customer_name TEXT,
  terminal_name TEXT,
  delivery_count INTEGER,
  total_volume_litres NUMERIC,
  avg_confidence DECIMAL(5,2),
  business_relationship TEXT,
  is_bp_customer BOOLEAN,
  logistics_provider TEXT
) AS $$
BEGIN
  -- Return BP customer delivery patterns
  RETURN QUERY
  SELECT 
    'BP Customer Delivery Pattern' as analysis_type,
    c.customer_name,
    c.terminal_name,
    COUNT(*) as delivery_count,
    SUM(c.delivery_volume_litres) as total_volume_litres,
    AVG(c.confidence_score) as avg_confidence,
    lm.business_relationship,
    lm.is_bp_customer,
    lm.logistics_provider
  FROM mtdata_captive_correlations c
  JOIN location_mapping lm ON lm.location_name = c.customer_name
  WHERE c.trip_date_computed BETWEEN p_start_date AND p_end_date
    AND lm.is_bp_customer = TRUE
  GROUP BY c.customer_name, c.terminal_name, lm.business_relationship, lm.is_bp_customer, lm.logistics_provider
  ORDER BY total_volume_litres DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get BP customer correlation summary
CREATE OR REPLACE FUNCTION get_bp_customer_correlation_summary(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  summary_type TEXT,
  metric_name TEXT,
  metric_value TEXT
) AS $$
BEGIN
  -- Return summary statistics
  RETURN QUERY
  SELECT 
    'BP Customer Correlation Summary' as summary_type,
    'Total BP Customer Deliveries' as metric_name,
    COUNT(*)::TEXT as metric_value
  FROM mtdata_captive_correlations c
  JOIN location_mapping lm ON lm.location_name = c.customer_name
  WHERE c.trip_date_computed BETWEEN p_start_date AND p_end_date
    AND lm.is_bp_customer = TRUE
  
  UNION ALL
  
  SELECT 
    'BP Customer Correlation Summary' as summary_type,
    'High Confidence BP Correlations (>=80)' as metric_name,
    COUNT(*)::TEXT as metric_value
  FROM mtdata_captive_correlations c
  JOIN location_mapping lm ON lm.location_name = c.customer_name
  WHERE c.trip_date_computed BETWEEN p_start_date AND p_end_date
    AND lm.is_bp_customer = TRUE
    AND c.confidence_score >= 80
  
  UNION ALL
  
  SELECT 
    'BP Customer Correlation Summary' as summary_type,
    'Average BP Customer Confidence' as metric_name,
    ROUND(AVG(c.confidence_score), 2)::TEXT as metric_value
  FROM mtdata_captive_correlations c
  JOIN location_mapping lm ON lm.location_name = c.customer_name
  WHERE c.trip_date_computed BETWEEN p_start_date AND p_end_date
    AND lm.is_bp_customer = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test the BP-enhanced correlation function
SELECT 'BP-enhanced correlation functions created successfully' as status;
