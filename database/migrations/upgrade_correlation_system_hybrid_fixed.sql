-- ============================================================================
-- UPGRADE CORRELATION SYSTEM TO HYBRID MATCHING (FIXED VERSION)
-- Enhance existing correlation system to use hybrid text/geospatial matching
-- ============================================================================

-- Add new columns to support hybrid matching (one by one to avoid syntax errors)
ALTER TABLE mtdata_captive_correlations ADD COLUMN IF NOT EXISTS confidence_breakdown JSONB;
ALTER TABLE mtdata_captive_correlations ADD COLUMN IF NOT EXISTS match_methods TEXT[];
ALTER TABLE mtdata_captive_correlations ADD COLUMN IF NOT EXISTS match_quality TEXT;
ALTER TABLE mtdata_captive_correlations ADD COLUMN IF NOT EXISTS text_confidence INTEGER;
ALTER TABLE mtdata_captive_correlations ADD COLUMN IF NOT EXISTS text_match_method TEXT;
ALTER TABLE mtdata_captive_correlations ADD COLUMN IF NOT EXISTS normalized_trip_location TEXT;
ALTER TABLE mtdata_captive_correlations ADD COLUMN IF NOT EXISTS normalized_customer_name TEXT;
ALTER TABLE mtdata_captive_correlations ADD COLUMN IF NOT EXISTS business_identifier_match BOOLEAN DEFAULT FALSE;
ALTER TABLE mtdata_captive_correlations ADD COLUMN IF NOT EXISTS location_reference_match BOOLEAN DEFAULT FALSE;
ALTER TABLE mtdata_captive_correlations ADD COLUMN IF NOT EXISTS geo_confidence INTEGER;
ALTER TABLE mtdata_captive_correlations ADD COLUMN IF NOT EXISTS temporal_confidence INTEGER;
ALTER TABLE mtdata_captive_correlations ADD COLUMN IF NOT EXISTS temporal_score DECIMAL(5,2);
ALTER TABLE mtdata_captive_correlations ADD COLUMN IF NOT EXISTS matching_algorithm_version TEXT DEFAULT 'hybrid_v1.0';

-- Add constraint for match_quality after the column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'mtdata_captive_correlations_match_quality_check'
  ) THEN
    ALTER TABLE mtdata_captive_correlations ADD CONSTRAINT mtdata_captive_correlations_match_quality_check 
    CHECK (match_quality IN ('excellent', 'good', 'fair', 'poor'));
  END IF;
END $$;

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
  p_analysis_run_id UUID
)
RETURNS UUID AS $$
DECLARE
  trip_date DATE;
  trip_external_id TEXT;
  correlation_id UUID;
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
    'multi_criteria'::correlation_match_type,
    p_overall_confidence,
    CASE 
      WHEN p_overall_confidence >= 90 THEN 'very_high'::correlation_confidence_level
      WHEN p_overall_confidence >= 75 THEN 'high'::correlation_confidence_level
      WHEN p_overall_confidence >= 50 THEN 'medium'::correlation_confidence_level
      WHEN p_overall_confidence >= 25 THEN 'low'::correlation_confidence_level
      ELSE 'very_low'::correlation_confidence_level
    END,
    
    -- Hybrid matching fields
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
    p_analysis_run_id,
    'hybrid_v1.0'
  )
  ON CONFLICT (mtdata_trip_id, delivery_key) DO UPDATE SET
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
    date_difference_days = EXCLUDED.date_difference_days,
    temporal_score = EXCLUDED.temporal_score,
    delivery_volume_litres = EXCLUDED.delivery_volume_litres,
    requires_manual_review = EXCLUDED.requires_manual_review,
    quality_flags = EXCLUDED.quality_flags,
    matching_algorithm_version = EXCLUDED.matching_algorithm_version,
    updated_at = NOW()
  RETURNING id INTO correlation_id;
  
  RETURN correlation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- BATCH CORRELATION ANALYSIS FUNCTION
-- ============================================================================

-- Function to run batch correlation analysis
CREATE OR REPLACE FUNCTION run_batch_correlation_analysis(
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
  
  RETURN QUERY SELECT 
    run_id,
    trips_count,
    correlations_count,
    high_conf_count,
    review_count,
    CASE WHEN correlations_count > 0 THEN (confidence_sum / correlations_count)::DECIMAL(5,2) ELSE 0 END,
    EXTRACT(EPOCH FROM (end_time - start_time))::DECIMAL(8,2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION insert_hybrid_correlation(UUID, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, INTEGER, JSONB, TEXT[], TEXT, INTEGER, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, INTEGER, DECIMAL, BOOLEAN, TEXT, INTEGER, INTEGER, DECIMAL, NUMERIC, BOOLEAN, TEXT[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION run_batch_correlation_analysis(DATE, DATE, TEXT, INTEGER, INTEGER, BOOLEAN) TO authenticated;

-- Success message
SELECT 'Correlation system upgraded to hybrid matching successfully' as result;
