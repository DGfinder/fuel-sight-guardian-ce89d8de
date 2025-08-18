-- ============================================================================
-- UPGRADE CORRELATION SYSTEM TO HYBRID MATCHING
-- Enhance existing correlation system to use hybrid text/geospatial matching
-- ============================================================================

-- Add new columns to support hybrid matching
ALTER TABLE mtdata_captive_correlations ADD COLUMN IF NOT EXISTS 
  -- Enhanced confidence breakdown
  confidence_breakdown JSONB,
  match_methods TEXT[],
  match_quality TEXT CHECK (match_quality IN ('excellent', 'good', 'fair', 'poor')),
  
  -- Text matching details
  text_confidence INTEGER,
  text_match_method TEXT,
  normalized_trip_location TEXT,
  normalized_customer_name TEXT,
  business_identifier_match BOOLEAN DEFAULT FALSE,
  location_reference_match BOOLEAN DEFAULT FALSE,
  
  -- Enhanced geospatial details
  geo_confidence INTEGER,
  
  -- Enhanced temporal details
  temporal_confidence INTEGER,
  temporal_score DECIMAL(5,2),
  
  -- Algorithm version tracking
  matching_algorithm_version TEXT DEFAULT 'hybrid_v1.0';

-- Update existing records to have default values
UPDATE mtdata_captive_correlations 
SET 
  confidence_breakdown = jsonb_build_object(
    'text_confidence', 0,
    'geo_confidence', COALESCE(confidence_score, 0),
    'temporal_confidence', CASE 
      WHEN ABS(date_difference_days) <= 1 THEN 80
      WHEN ABS(date_difference_days) <= 2 THEN 60
      WHEN ABS(date_difference_days) <= 3 THEN 40
      ELSE 20
    END,
    'weighted_score', COALESCE(confidence_score, 0)
  ),
  match_methods = CASE 
    WHEN confidence_score > 0 THEN ARRAY['geospatial']
    ELSE ARRAY[]::TEXT[]
  END,
  match_quality = CASE 
    WHEN confidence_score >= 90 THEN 'excellent'
    WHEN confidence_score >= 75 THEN 'good'
    WHEN confidence_score >= 60 THEN 'fair'
    ELSE 'poor'
  END,
  text_confidence = 0,
  geo_confidence = COALESCE(confidence_score, 0),
  temporal_confidence = CASE 
    WHEN ABS(date_difference_days) <= 1 THEN 80
    WHEN ABS(date_difference_days) <= 2 THEN 60
    WHEN ABS(date_difference_days) <= 3 THEN 40
    ELSE 20
  END,
  temporal_score = CASE 
    WHEN ABS(date_difference_days) <= 1 THEN 80.0
    WHEN ABS(date_difference_days) <= 2 THEN 60.0
    WHEN ABS(date_difference_days) <= 3 THEN 40.0
    ELSE 20.0
  END,
  matching_algorithm_version = 'legacy_geo_v1.0'
WHERE confidence_breakdown IS NULL;

-- ============================================================================
-- HYBRID CORRELATION INSERTION FUNCTION
-- ============================================================================

-- Function to insert correlations from hybrid analysis
CREATE OR REPLACE FUNCTION insert_hybrid_correlation(
  p_mtdata_trip_id UUID,
  p_delivery_key TEXT,
  p_bill_of_lading TEXT,
  p_delivery_date DATE,
  p_customer_name TEXT,
  p_terminal_name TEXT,
  p_carrier TEXT,
  p_overall_confidence INTEGER,
  p_confidence_breakdown JSONB,
  p_match_methods TEXT[],
  p_match_quality TEXT,
  p_text_confidence INTEGER,
  p_text_match_method TEXT,
  p_normalized_trip_location TEXT,
  p_normalized_customer_name TEXT,
  p_business_identifier_match BOOLEAN,
  p_location_reference_match BOOLEAN,
  p_geo_confidence INTEGER,
  p_terminal_distance_km DECIMAL(8,2),
  p_within_service_area BOOLEAN,
  p_matching_trip_point TEXT,
  p_temporal_confidence INTEGER,
  p_date_difference_days INTEGER,
  p_temporal_score DECIMAL(5,2),
  p_delivery_volume_litres NUMERIC,
  p_requires_manual_review BOOLEAN,
  p_quality_flags TEXT[],
  p_analysis_run_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  correlation_id UUID;
  trip_date DATE;
  trip_external_id TEXT;
BEGIN
  -- Get trip metadata
  SELECT trip_date_computed, trip_external_id 
  INTO trip_date, trip_external_id
  FROM mtdata_trip_history 
  WHERE id = p_mtdata_trip_id;
  
  -- Insert correlation record
  INSERT INTO mtdata_captive_correlations (
    mtdata_trip_id,
    trip_external_id,
    trip_date,
    delivery_key,
    bill_of_lading,
    delivery_date,
    customer_name,
    terminal_name,
    carrier,
    match_type,
    confidence_score,
    confidence_level,
    
    -- Hybrid matching fields
    confidence_breakdown,
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
    within_terminal_service_area,
    matching_trip_point,
    temporal_confidence,
    date_difference_days,
    temporal_score,
    
    delivery_volume_litres,
    requires_manual_review,
    quality_flags,
    analysis_run_id,
    matching_algorithm_version
  )
  VALUES (
    p_mtdata_trip_id,
    trip_external_id,
    trip_date,
    p_delivery_key,
    p_bill_of_lading,
    p_delivery_date,
    p_customer_name,
    p_terminal_name,
    p_carrier,
    
    -- Determine match type based on methods used
    CASE 
      WHEN 'text_matching' = ANY(p_match_methods) AND 'geospatial' = ANY(p_match_methods) THEN 'multi_criteria'
      WHEN 'text_matching' = ANY(p_match_methods) THEN 'customer_name_fuzzy'
      WHEN 'geospatial' = ANY(p_match_methods) THEN 'geographic_temporal'
      ELSE 'temporal_only'
    END::correlation_match_type,
    
    p_overall_confidence,
    calculate_confidence_level(p_overall_confidence),
    
    p_confidence_breakdown,
    p_match_methods,
    p_match_quality,
    p_text_confidence,
    p_text_match_method,
    p_normalized_trip_location,
    p_normalized_customer_name,
    p_business_identifier_match,
    p_location_reference_match,
    p_geo_confidence,
    p_terminal_distance_km,
    p_within_service_area,
    p_matching_trip_point,
    p_temporal_confidence,
    p_date_difference_days,
    p_temporal_score,
    
    p_delivery_volume_litres,
    p_requires_manual_review,
    p_quality_flags,
    COALESCE(p_analysis_run_id, gen_random_uuid()),
    'hybrid_v1.0'
  )
  ON CONFLICT (mtdata_trip_id, delivery_key) 
  DO UPDATE SET
    confidence_score = EXCLUDED.confidence_score,
    confidence_level = EXCLUDED.confidence_level,
    confidence_breakdown = EXCLUDED.confidence_breakdown,
    match_methods = EXCLUDED.match_methods,
    match_quality = EXCLUDED.match_quality,
    text_confidence = EXCLUDED.text_confidence,
    text_match_method = EXCLUDED.text_match_method,
    normalized_trip_location = EXCLUDED.normalized_trip_location,
    normalized_customer_name = EXCLUDED.normalized_customer_name,
    business_identifier_match = EXCLUDED.business_identifier_match,
    location_reference_match = EXCLUDED.location_reference_match,
    geo_confidence = EXCLUDED.geo_confidence,
    terminal_distance_km = EXCLUDED.terminal_distance_km,
    within_terminal_service_area = EXCLUDED.within_terminal_service_area,
    matching_trip_point = EXCLUDED.matching_trip_point,
    temporal_confidence = EXCLUDED.temporal_confidence,
    temporal_score = EXCLUDED.temporal_score,
    delivery_volume_litres = EXCLUDED.delivery_volume_litres,
    requires_manual_review = EXCLUDED.requires_manual_review,
    quality_flags = EXCLUDED.quality_flags,
    analysis_run_id = EXCLUDED.analysis_run_id,
    matching_algorithm_version = EXCLUDED.matching_algorithm_version,
    updated_at = NOW()
  RETURNING id INTO correlation_id;
  
  RETURN correlation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BATCH HYBRID ANALYSIS FUNCTION
-- ============================================================================

-- Function to run hybrid analysis and store results
CREATE OR REPLACE FUNCTION run_hybrid_analysis_batch(
  p_start_date DATE,
  p_end_date DATE,
  p_fleet_filter TEXT DEFAULT NULL,
  p_min_confidence INTEGER DEFAULT 60,
  p_max_trips INTEGER DEFAULT 500,
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
  run_id UUID := gen_random_uuid();
  trip_record RECORD;
  correlation_record RECORD;
  trips_count INTEGER := 0;
  correlations_count INTEGER := 0;
  high_conf_count INTEGER := 0;
  review_count INTEGER := 0;
  confidence_sum DECIMAL := 0;
  start_time TIMESTAMP := clock_timestamp();
  end_time TIMESTAMP;
BEGIN
  -- Clear existing correlations if requested
  IF p_clear_existing THEN
    DELETE FROM mtdata_captive_correlations 
    WHERE trip_date BETWEEN p_start_date AND p_end_date
      AND (p_fleet_filter IS NULL OR customer_name ILIKE '%' || p_fleet_filter || '%');
  END IF;
  
  -- Process trips in date range
  FOR trip_record IN 
    SELECT id, trip_external_id, group_name
    FROM mtdata_trip_history
    WHERE trip_date_computed BETWEEN p_start_date AND p_end_date
      AND (p_fleet_filter IS NULL OR group_name ILIKE '%' || p_fleet_filter || '%')
      AND (start_location IS NOT NULL OR end_location IS NOT NULL OR 
           start_latitude IS NOT NULL OR end_latitude IS NOT NULL)
    ORDER BY trip_date_computed DESC
    LIMIT p_max_trips
  LOOP
    trips_count := trips_count + 1;
    
    -- Run hybrid correlation for this trip
    FOR correlation_record IN 
      SELECT * FROM hybrid_correlate_trip_with_deliveries(
        trip_record.id, 3, 150, p_min_confidence, TRUE, TRUE, TRUE
      )
    LOOP
      -- Insert correlation
      PERFORM insert_hybrid_correlation(
        trip_record.id,
        correlation_record.delivery_key,
        correlation_record.bill_of_lading,
        correlation_record.delivery_date,
        correlation_record.customer_name,
        correlation_record.terminal_name,
        correlation_record.carrier,
        correlation_record.overall_confidence,
        correlation_record.confidence_breakdown,
        correlation_record.match_methods,
        correlation_record.match_quality,
        correlation_record.text_confidence,
        correlation_record.text_match_method,
        correlation_record.normalized_trip_location,
        correlation_record.normalized_customer_name,
        correlation_record.business_identifier_match,
        correlation_record.location_reference_match,
        correlation_record.geo_confidence,
        correlation_record.terminal_distance_km,
        correlation_record.within_service_area,
        correlation_record.matching_trip_point,
        correlation_record.temporal_confidence,
        correlation_record.date_difference_days,
        correlation_record.temporal_score,
        correlation_record.delivery_volume_litres,
        correlation_record.requires_manual_review,
        correlation_record.quality_flags,
        run_id
      );
      
      correlations_count := correlations_count + 1;
      confidence_sum := confidence_sum + correlation_record.overall_confidence;
      
      IF correlation_record.overall_confidence >= 80 THEN
        high_conf_count := high_conf_count + 1;
      END IF;
      
      IF correlation_record.requires_manual_review THEN
        review_count := review_count + 1;
      END IF;
    END LOOP;
  END LOOP;
  
  end_time := clock_timestamp();
  
  -- Refresh materialized views
  PERFORM refresh_correlation_analytics();
  
  RETURN QUERY SELECT 
    run_id,
    trips_count,
    correlations_count,
    high_conf_count,
    review_count,
    CASE WHEN correlations_count > 0 THEN (confidence_sum / correlations_count) ELSE 0 END,
    EXTRACT(EPOCH FROM (end_time - start_time));
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ENHANCED ANALYTICS VIEWS
-- ============================================================================

-- Update high confidence correlations view to include hybrid data
DROP VIEW IF EXISTS high_confidence_correlations CASCADE;
CREATE VIEW high_confidence_correlations AS
SELECT 
  mcc.*,
  th.vehicle_registration,
  th.group_name,
  th.start_location,
  th.end_location,
  th.distance_km as trip_distance_km,
  th.travel_time_hours,
  cd.total_volume_litres_abs as delivery_volume_abs,
  cd.products as delivery_products,
  
  -- Hybrid matching insights
  CASE 
    WHEN mcc.text_confidence >= 80 AND mcc.geo_confidence >= 80 THEN 'Multi-Modal High Confidence'
    WHEN mcc.text_confidence >= 80 THEN 'Text-Based High Confidence'
    WHEN mcc.geo_confidence >= 80 THEN 'Location-Based High Confidence'
    WHEN mcc.business_identifier_match THEN 'Business Identifier Match'
    WHEN mcc.location_reference_match THEN 'Location Reference Match'
    ELSE 'Standard Correlation'
  END as match_description,
  
  -- Quality indicators
  array_length(mcc.match_methods, 1) as matching_methods_count,
  CASE 
    WHEN mcc.business_identifier_match AND mcc.within_terminal_service_area THEN 'Excellent'
    WHEN mcc.text_confidence >= 70 AND mcc.geo_confidence >= 70 THEN 'Very Good'
    WHEN mcc.text_confidence >= 60 OR mcc.geo_confidence >= 60 THEN 'Good'
    ELSE 'Fair'
  END as quality_assessment

FROM mtdata_captive_correlations mcc
LEFT JOIN mtdata_trip_history th ON mcc.mtdata_trip_id = th.id
LEFT JOIN captive_deliveries cd ON mcc.delivery_key = cd.delivery_key
WHERE mcc.confidence_score >= 70
  AND mcc.is_potential_match = TRUE
ORDER BY mcc.confidence_score DESC, mcc.trip_date DESC;

-- Create hybrid matching performance view
CREATE VIEW hybrid_matching_performance AS
SELECT 
  DATE_TRUNC('week', created_at) as week_start,
  matching_algorithm_version,
  
  -- Matching method distribution
  COUNT(*) as total_correlations,
  COUNT(*) FILTER (WHERE 'text_matching' = ANY(match_methods)) as text_matches,
  COUNT(*) FILTER (WHERE 'geospatial' = ANY(match_methods)) as geo_matches,
  COUNT(*) FILTER (WHERE 'temporal' = ANY(match_methods)) as temporal_matches,
  COUNT(*) FILTER (WHERE array_length(match_methods, 1) > 1) as multi_method_matches,
  
  -- Quality distribution
  COUNT(*) FILTER (WHERE match_quality = 'excellent') as excellent_matches,
  COUNT(*) FILTER (WHERE match_quality = 'good') as good_matches,
  COUNT(*) FILTER (WHERE match_quality = 'fair') as fair_matches,
  COUNT(*) FILTER (WHERE match_quality = 'poor') as poor_matches,
  
  -- Confidence metrics
  AVG(confidence_score) as avg_confidence,
  AVG(text_confidence) as avg_text_confidence,
  AVG(geo_confidence) as avg_geo_confidence,
  AVG(temporal_confidence) as avg_temporal_confidence,
  
  -- Business matching insights
  COUNT(*) FILTER (WHERE business_identifier_match = TRUE) as business_id_matches,
  COUNT(*) FILTER (WHERE location_reference_match = TRUE) as location_ref_matches,
  COUNT(*) FILTER (WHERE within_terminal_service_area = TRUE) as service_area_matches,
  
  -- Quality flags
  COUNT(*) FILTER (WHERE 'low_confidence' = ANY(quality_flags)) as low_confidence_flags,
  COUNT(*) FILTER (WHERE 'large_date_gap' = ANY(quality_flags)) as date_gap_flags,
  COUNT(*) FILTER (WHERE 'long_distance' = ANY(quality_flags)) as distance_flags

FROM mtdata_captive_correlations
WHERE created_at >= CURRENT_DATE - INTERVAL '12 weeks'
  AND is_potential_match = TRUE
GROUP BY DATE_TRUNC('week', created_at), matching_algorithm_version
ORDER BY week_start DESC;

-- ============================================================================
-- INDEXES AND PERMISSIONS
-- ============================================================================

-- Add indexes for new hybrid fields
CREATE INDEX IF NOT EXISTS idx_correlations_text_confidence ON mtdata_captive_correlations(text_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_correlations_geo_confidence ON mtdata_captive_correlations(geo_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_correlations_match_quality ON mtdata_captive_correlations(match_quality);
CREATE INDEX IF NOT EXISTS idx_correlations_business_match ON mtdata_captive_correlations(business_identifier_match) WHERE business_identifier_match = TRUE;
CREATE INDEX IF NOT EXISTS idx_correlations_algorithm_version ON mtdata_captive_correlations(matching_algorithm_version);

-- Grant permissions
GRANT EXECUTE ON FUNCTION insert_hybrid_correlation(UUID, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, INTEGER, JSONB, TEXT[], TEXT, INTEGER, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, INTEGER, DECIMAL, BOOLEAN, TEXT, INTEGER, INTEGER, DECIMAL, NUMERIC, BOOLEAN, TEXT[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION run_hybrid_analysis_batch(DATE, DATE, TEXT, INTEGER, INTEGER, BOOLEAN) TO authenticated;

GRANT SELECT ON hybrid_matching_performance TO authenticated;

-- Add comments
COMMENT ON FUNCTION insert_hybrid_correlation IS 'Insert correlation result from hybrid analysis engine';
COMMENT ON FUNCTION run_hybrid_analysis_batch IS 'Run hybrid correlation analysis on batch of trips and store results';
COMMENT ON VIEW hybrid_matching_performance IS 'Performance metrics for hybrid matching algorithm over time';

SELECT 'Correlation system upgraded to hybrid matching successfully' as result;