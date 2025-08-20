-- ============================================================================
-- SETUP COMPLETE CORRELATION SYSTEM
-- This script creates all missing components in the correct order
-- ============================================================================

-- Step 1: Check what exists and what's missing
DO $$
DECLARE
  missing_components TEXT[] := ARRAY[]::TEXT[];
BEGIN
  RAISE NOTICE '🔍 Checking system components...';
  
  -- Check captive_payment_records table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'captive_payment_records') THEN
    missing_components := array_append(missing_components, 'captive_payment_records table');
  END IF;
  
  -- Check mtdata_trip_history table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mtdata_trip_history') THEN
    missing_components := array_append(missing_components, 'mtdata_trip_history table');
  END IF;
  
  -- Check captive_deliveries materialized view
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'captive_deliveries') THEN
    missing_components := array_append(missing_components, 'captive_deliveries materialized view');
  END IF;
  
  -- Check mtdata_captive_correlations table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mtdata_captive_correlations') THEN
    missing_components := array_append(missing_components, 'mtdata_captive_correlations table');
  END IF;
  
  -- Report findings
  IF array_length(missing_components, 1) > 0 THEN
    RAISE NOTICE '❌ Missing components: %', array_to_string(missing_components, ', ');
  ELSE
    RAISE NOTICE '✅ All base components exist!';
  END IF;
END $$;

-- Step 2: Create captive_deliveries materialized view if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'captive_deliveries') THEN
    RAISE NOTICE '📦 Creating captive_deliveries materialized view...';
    
    -- Create the view
    CREATE MATERIALIZED VIEW captive_deliveries AS
    SELECT 
      bill_of_lading,
      delivery_date,
      customer,
      terminal,
      carrier,
      array_agg(DISTINCT product ORDER BY product) as products,
      sum(volume_litres) as total_volume_litres,
      abs(sum(volume_litres)) as total_volume_litres_abs,
      count(*) as record_count,
      min(created_at) as first_created_at,
      max(updated_at) as last_updated_at,
      bill_of_lading || '-' || delivery_date || '-' || customer as delivery_key
    FROM captive_payment_records 
    GROUP BY bill_of_lading, delivery_date, customer, terminal, carrier
    ORDER BY delivery_date DESC, bill_of_lading;
    
    -- Create indexes
    CREATE UNIQUE INDEX idx_captive_deliveries_key ON captive_deliveries (delivery_key);
    CREATE INDEX idx_captive_deliveries_date ON captive_deliveries (delivery_date DESC);
    CREATE INDEX idx_captive_deliveries_carrier ON captive_deliveries (carrier);
    CREATE INDEX idx_captive_deliveries_customer ON captive_deliveries (customer);
    CREATE INDEX idx_captive_deliveries_terminal ON captive_deliveries (terminal);
    
    -- Grant permissions
    GRANT SELECT ON captive_deliveries TO authenticated;
    
    RAISE NOTICE '✅ captive_deliveries view created successfully!';
  ELSE
    RAISE NOTICE '✅ captive_deliveries view already exists';
  END IF;
END $$;

-- Step 3: Create mtdata_captive_correlations table if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mtdata_captive_correlations') THEN
    RAISE NOTICE '🔗 Creating mtdata_captive_correlations table...';
    
    -- Create the table
    CREATE TABLE mtdata_captive_correlations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mtdata_trip_id UUID NOT NULL REFERENCES mtdata_trip_history(id) ON DELETE CASCADE,
      trip_external_id TEXT,
      trip_date DATE NOT NULL,
      delivery_key TEXT,
      bill_of_lading TEXT,
      delivery_date DATE,
      customer_name TEXT,
      terminal_name TEXT,
      carrier TEXT,
      match_type TEXT CHECK (match_type IN ('geospatial', 'text', 'temporal', 'multi_criteria')),
      confidence_score DECIMAL(5,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
      confidence_level TEXT CHECK (confidence_level IN ('very_high', 'high', 'medium', 'low', 'very_low')),
      terminal_distance_km DECIMAL(8,2),
      within_terminal_service_area BOOLEAN DEFAULT FALSE,
      matching_trip_point TEXT,
      date_difference_days INTEGER,
      temporal_correlation_score DECIMAL(5,2),
      customer_name_similarity REAL,
      customer_match_type TEXT,
      delivery_volume_litres NUMERIC,
      estimated_fuel_efficiency DECIMAL(8,2),
      correlation_algorithm_version TEXT DEFAULT 'v1.0',
      analysis_run_id UUID,
      verified_by_user BOOLEAN DEFAULT FALSE,
      verification_notes TEXT,
      is_potential_match BOOLEAN DEFAULT TRUE,
      requires_manual_review BOOLEAN DEFAULT FALSE,
      quality_flags TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      verified_at TIMESTAMPTZ,
      verified_by UUID REFERENCES auth.users(id)
    );
    
    -- Create indexes
    CREATE INDEX idx_correlations_trip_id ON mtdata_captive_correlations (mtdata_trip_id);
    CREATE INDEX idx_correlations_delivery_key ON mtdata_captive_correlations (delivery_key);
    CREATE INDEX idx_correlations_trip_date ON mtdata_captive_correlations (trip_date);
    CREATE INDEX idx_correlations_confidence ON mtdata_captive_correlations (confidence_score DESC);
    CREATE INDEX idx_correlations_customer ON mtdata_captive_correlations (customer_name);
    CREATE INDEX idx_correlations_terminal ON mtdata_captive_correlations (terminal_name);
    
    -- Grant permissions
    GRANT ALL ON mtdata_captive_correlations TO authenticated;
    
    RAISE NOTICE '✅ mtdata_captive_correlations table created successfully!';
  ELSE
    RAISE NOTICE '✅ mtdata_captive_correlations table already exists';
  END IF;
END $$;

-- Step 4: Add hybrid matching columns if they don't exist
DO $$
BEGIN
  RAISE NOTICE '🔧 Adding hybrid matching columns...';
  
  -- Add columns one by one
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
  
  RAISE NOTICE '✅ Hybrid matching columns added successfully!';
END $$;

-- Step 5: Create the hybrid correlation functions
DO $$
BEGIN
  RAISE NOTICE '⚙️ Creating hybrid correlation functions...';
  
  -- Create insert_hybrid_correlation function
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
      mtdata_trip_id, trip_external_id, trip_date, delivery_key, bill_of_lading,
      delivery_date, customer_name, terminal_name, carrier, match_type,
      confidence_score, confidence_level, confidence_breakdown, match_methods,
      match_quality, text_confidence, text_match_method, normalized_trip_location,
      normalized_customer_name, business_identifier_match, location_reference_match,
      geo_confidence, terminal_distance_km, within_terminal_service_area,
      matching_trip_point, temporal_confidence, date_difference_days,
      temporal_score, delivery_volume_litres, requires_manual_review,
      quality_flags, analysis_run_id, matching_algorithm_version
    )
    VALUES (
      p_mtdata_trip_id, trip_external_id, trip_date, p_delivery_key, p_bill_of_lading,
      p_delivery_date, p_customer_name, p_terminal_name, p_carrier, 'multi_criteria',
      p_overall_confidence, 
      CASE 
        WHEN p_overall_confidence >= 90 THEN 'very_high'
        WHEN p_overall_confidence >= 75 THEN 'high'
        WHEN p_overall_confidence >= 50 THEN 'medium'
        WHEN p_overall_confidence >= 25 THEN 'low'
        ELSE 'very_low'
      END,
      p_confidence_breakdown, p_match_methods, p_match_quality, p_text_confidence,
      p_text_match_method, p_normalized_trip_location, p_normalized_customer_name,
      p_business_identifier_match, p_location_reference_match, p_geo_confidence,
      p_terminal_distance_km, p_within_service_area, p_matching_trip_point,
      p_temporal_confidence, p_date_difference_days, p_temporal_score,
      p_delivery_volume_litres, p_requires_manual_review, p_quality_flags,
      p_analysis_run_id, 'hybrid_v1.0'
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
  
  RAISE NOTICE '✅ insert_hybrid_correlation function created successfully!';
END $$;

-- Step 6: Grant permissions
GRANT EXECUTE ON FUNCTION insert_hybrid_correlation(UUID, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, INTEGER, JSONB, TEXT[], TEXT, INTEGER, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, INTEGER, DECIMAL, BOOLEAN, TEXT, INTEGER, INTEGER, DECIMAL, NUMERIC, BOOLEAN, TEXT[], UUID) TO authenticated;

-- Step 7: Final verification
SELECT 
  '🎯 CORRELATION SYSTEM SETUP COMPLETE' as status,
  (SELECT COUNT(*) FROM captive_payment_records) as payment_records,
  (SELECT COUNT(*) FROM captive_deliveries) as deliveries,
  (SELECT COUNT(*) FROM mtdata_trip_history) as trips,
  (SELECT COUNT(*) FROM mtdata_captive_correlations) as correlations,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name = 'insert_hybrid_correlation') as functions_created;

-- Show sample data for verification
SELECT 
  '📊 Sample Data Verification' as info,
  'captive_payment_records' as table_name,
  COUNT(*) as record_count,
  MIN(delivery_date) as earliest_date,
  MAX(delivery_date) as latest_date
FROM captive_payment_records
UNION ALL
SELECT 
  'captive_deliveries' as table_name,
  COUNT(*) as record_count,
  MIN(delivery_date) as earliest_date,
  MAX(delivery_date) as latest_date
FROM captive_deliveries
UNION ALL
SELECT 
  'mtdata_trip_history' as table_name,
  COUNT(*) as record_count,
  MIN(trip_date_computed) as earliest_date,
  MAX(trip_date_computed) as latest_date
FROM mtdata_trip_history;

-- Success message
SELECT '🚀 Correlation system is now ready! You can run correlation analysis.' as next_step;
