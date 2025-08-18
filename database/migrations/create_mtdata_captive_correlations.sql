-- ============================================================================
-- MTDATA CAPTIVE CORRELATIONS SYSTEM
-- Stores and manages correlations between MTdata trips and captive payment deliveries
-- ============================================================================

-- Drop existing objects if they exist
DROP MATERIALIZED VIEW IF EXISTS correlation_analytics_summary CASCADE;
DROP VIEW IF EXISTS high_confidence_correlations CASCADE;
DROP TABLE IF EXISTS mtdata_captive_correlations CASCADE;
DROP TYPE IF EXISTS correlation_match_type CASCADE;
DROP TYPE IF EXISTS correlation_confidence_level CASCADE;

-- Create custom types
CREATE TYPE correlation_match_type AS ENUM (
  'geographic_only',           -- Matched by location proximity only
  'temporal_only',            -- Matched by time correlation only
  'geographic_temporal',      -- Matched by both location and time
  'customer_name_fuzzy',      -- Matched by customer name similarity
  'multi_criteria',           -- Matched by multiple criteria
  'manual_override'           -- Manually verified/corrected
);

CREATE TYPE correlation_confidence_level AS ENUM (
  'very_high',    -- 90-100% confidence
  'high',         -- 75-89% confidence
  'medium',       -- 50-74% confidence
  'low',          -- 25-49% confidence
  'very_low'      -- 0-24% confidence
);

-- ============================================================================
-- MAIN CORRELATIONS TABLE
-- ============================================================================

CREATE TABLE mtdata_captive_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Trip reference
  mtdata_trip_id UUID NOT NULL REFERENCES mtdata_trip_history(id) ON DELETE CASCADE,
  trip_external_id TEXT,
  trip_date DATE NOT NULL,
  
  -- Delivery reference
  delivery_key TEXT, -- From captive_deliveries.delivery_key (BOL-Date-Customer)
  bill_of_lading TEXT,
  delivery_date DATE,
  customer_name TEXT,
  terminal_name TEXT,
  carrier TEXT, -- SMB/GSF/Combined
  
  -- Correlation metadata
  match_type correlation_match_type NOT NULL,
  confidence_score DECIMAL(5,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  confidence_level correlation_confidence_level NOT NULL,
  
  -- Geographic correlation details
  terminal_distance_km DECIMAL(8,2), -- Distance from trip point to terminal
  within_terminal_service_area BOOLEAN DEFAULT FALSE,
  matching_trip_point TEXT, -- 'start', 'end', or 'both'
  
  -- Temporal correlation details
  date_difference_days INTEGER, -- Trip date - delivery date
  temporal_correlation_score DECIMAL(5,2), -- 0-100 score for temporal match
  
  -- Customer name matching details
  customer_name_similarity REAL, -- 0-1 similarity score
  customer_match_type TEXT, -- Type of name match used
  
  -- Volume and efficiency metrics
  delivery_volume_litres NUMERIC,
  estimated_fuel_efficiency DECIMAL(8,2), -- Litres per km if calculable
  
  -- Analysis metadata
  correlation_algorithm_version TEXT DEFAULT 'v1.0',
  analysis_run_id UUID, -- Link to batch analysis run
  verified_by_user BOOLEAN DEFAULT FALSE,
  verification_notes TEXT,
  
  -- Data quality flags
  is_potential_match BOOLEAN DEFAULT TRUE, -- False if ruled out
  requires_manual_review BOOLEAN DEFAULT FALSE,
  quality_flags TEXT[], -- Array of quality concerns
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT valid_confidence_score CHECK (confidence_score BETWEEN 0 AND 100),
  CONSTRAINT valid_date_difference CHECK (ABS(date_difference_days) <= 30), -- Max 30 days difference
  CONSTRAINT valid_similarity_score CHECK (customer_name_similarity IS NULL OR (customer_name_similarity BETWEEN 0 AND 1))
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX idx_correlations_trip_id ON mtdata_captive_correlations(mtdata_trip_id);
CREATE INDEX idx_correlations_delivery_key ON mtdata_captive_correlations(delivery_key);
CREATE INDEX idx_correlations_trip_date ON mtdata_captive_correlations(trip_date DESC);
CREATE INDEX idx_correlations_delivery_date ON mtdata_captive_correlations(delivery_date DESC);

-- Analysis and filtering indexes
CREATE INDEX idx_correlations_confidence ON mtdata_captive_correlations(confidence_score DESC);
CREATE INDEX idx_correlations_match_type ON mtdata_captive_correlations(match_type);
CREATE INDEX idx_correlations_confidence_level ON mtdata_captive_correlations(confidence_level);
CREATE INDEX idx_correlations_terminal ON mtdata_captive_correlations(terminal_name);
CREATE INDEX idx_correlations_customer ON mtdata_captive_correlations(customer_name);
CREATE INDEX idx_correlations_carrier ON mtdata_captive_correlations(carrier);

-- Quality and verification indexes
CREATE INDEX idx_correlations_verified ON mtdata_captive_correlations(verified_by_user);
CREATE INDEX idx_correlations_potential ON mtdata_captive_correlations(is_potential_match) WHERE is_potential_match = TRUE;
CREATE INDEX idx_correlations_review_needed ON mtdata_captive_correlations(requires_manual_review) WHERE requires_manual_review = TRUE;

-- Composite indexes for common queries
CREATE INDEX idx_correlations_confidence_date ON mtdata_captive_correlations(confidence_score DESC, trip_date DESC);
CREATE INDEX idx_correlations_terminal_confidence ON mtdata_captive_correlations(terminal_name, confidence_score DESC);

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to calculate confidence level from score
CREATE OR REPLACE FUNCTION calculate_confidence_level(score DECIMAL)
RETURNS correlation_confidence_level AS $$
BEGIN
  CASE 
    WHEN score >= 90 THEN RETURN 'very_high';
    WHEN score >= 75 THEN RETURN 'high';
    WHEN score >= 50 THEN RETURN 'medium';
    WHEN score >= 25 THEN RETURN 'low';
    ELSE RETURN 'very_low';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update correlation metadata
CREATE OR REPLACE FUNCTION update_correlation_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-calculate confidence level
  NEW.confidence_level = calculate_confidence_level(NEW.confidence_score);
  
  -- Set quality flags based on analysis
  NEW.quality_flags = ARRAY[]::TEXT[];
  
  -- Flag if confidence is low
  IF NEW.confidence_score < 50 THEN
    NEW.quality_flags = array_append(NEW.quality_flags, 'low_confidence');
  END IF;
  
  -- Flag if date difference is large
  IF ABS(NEW.date_difference_days) > 5 THEN
    NEW.quality_flags = array_append(NEW.quality_flags, 'large_date_difference');
  END IF;
  
  -- Flag if distance is large
  IF NEW.terminal_distance_km > 100 THEN
    NEW.quality_flags = array_append(NEW.quality_flags, 'long_distance');
  END IF;
  
  -- Flag for manual review if needed
  IF NEW.confidence_score < 60 OR ABS(NEW.date_difference_days) > 3 THEN
    NEW.requires_manual_review = TRUE;
  END IF;
  
  -- Calculate date difference if both dates available
  IF NEW.trip_date IS NOT NULL AND NEW.delivery_date IS NOT NULL THEN
    NEW.date_difference_days = NEW.trip_date - NEW.delivery_date;
  END IF;
  
  -- Update timestamp
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for metadata updates
CREATE TRIGGER trigger_update_correlation_metadata
  BEFORE INSERT OR UPDATE ON mtdata_captive_correlations
  FOR EACH ROW
  EXECUTE FUNCTION update_correlation_metadata();

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- High confidence correlations view
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
  cd.products as delivery_products
FROM mtdata_captive_correlations mcc
LEFT JOIN mtdata_trip_history th ON mcc.mtdata_trip_id = th.id
LEFT JOIN captive_deliveries cd ON mcc.delivery_key = cd.delivery_key
WHERE mcc.confidence_score >= 70
  AND mcc.is_potential_match = TRUE
ORDER BY mcc.confidence_score DESC, mcc.trip_date DESC;

-- Correlation analytics summary (materialized for performance)
CREATE MATERIALIZED VIEW correlation_analytics_summary AS
SELECT 
  DATE_TRUNC('month', trip_date) as month,
  carrier,
  terminal_name,
  confidence_level,
  
  -- Correlation counts
  COUNT(*) as total_correlations,
  COUNT(*) FILTER (WHERE verified_by_user = TRUE) as verified_correlations,
  COUNT(*) FILTER (WHERE requires_manual_review = TRUE) as needs_review,
  
  -- Confidence distribution
  AVG(confidence_score) as avg_confidence_score,
  MIN(confidence_score) as min_confidence_score,
  MAX(confidence_score) as max_confidence_score,
  
  -- Distance analysis
  AVG(terminal_distance_km) as avg_distance_km,
  COUNT(*) FILTER (WHERE within_terminal_service_area = TRUE) as within_service_area,
  
  -- Temporal analysis
  AVG(ABS(date_difference_days)) as avg_date_difference,
  COUNT(*) FILTER (WHERE ABS(date_difference_days) <= 1) as same_day_matches,
  
  -- Volume analysis
  SUM(delivery_volume_litres) as total_correlated_volume,
  AVG(delivery_volume_litres) as avg_delivery_volume,
  
  -- Efficiency metrics
  AVG(estimated_fuel_efficiency) as avg_fuel_efficiency
  
FROM mtdata_captive_correlations
WHERE is_potential_match = TRUE
GROUP BY DATE_TRUNC('month', trip_date), carrier, terminal_name, confidence_level
ORDER BY month DESC, carrier, terminal_name;

-- Create unique index on materialized view
CREATE UNIQUE INDEX idx_correlation_analytics_summary_key 
ON correlation_analytics_summary (month, carrier, terminal_name, confidence_level);

-- ============================================================================
-- CORRELATION MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to refresh correlation analytics
CREATE OR REPLACE FUNCTION refresh_correlation_analytics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW correlation_analytics_summary;
  
  -- Update statistics
  ANALYZE mtdata_captive_correlations;
  
  RAISE NOTICE 'Correlation analytics refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to bulk insert correlations from analysis
CREATE OR REPLACE FUNCTION bulk_insert_correlations(
  correlations_json JSONB,
  analysis_run_id_input UUID DEFAULT NULL
)
RETURNS TABLE (
  inserted_count INTEGER,
  updated_count INTEGER,
  skipped_count INTEGER
) AS $$
DECLARE
  correlation_item JSONB;
  inserted INTEGER := 0;
  updated INTEGER := 0;
  skipped INTEGER := 0;
  run_id UUID;
BEGIN
  -- Generate analysis run ID if not provided
  run_id := COALESCE(analysis_run_id_input, gen_random_uuid());
  
  -- Process each correlation
  FOR correlation_item IN SELECT * FROM jsonb_array_elements(correlations_json) LOOP
    BEGIN
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
        terminal_distance_km,
        within_terminal_service_area,
        matching_trip_point,
        date_difference_days,
        temporal_correlation_score,
        customer_name_similarity,
        customer_match_type,
        delivery_volume_litres,
        analysis_run_id
      ) VALUES (
        (correlation_item->>'mtdata_trip_id')::UUID,
        correlation_item->>'trip_external_id',
        (correlation_item->>'trip_date')::DATE,
        correlation_item->>'delivery_key',
        correlation_item->>'bill_of_lading',
        (correlation_item->>'delivery_date')::DATE,
        correlation_item->>'customer_name',
        correlation_item->>'terminal_name',
        correlation_item->>'carrier',
        (correlation_item->>'match_type')::correlation_match_type,
        (correlation_item->>'confidence_score')::DECIMAL,
        (correlation_item->>'terminal_distance_km')::DECIMAL,
        (correlation_item->>'within_terminal_service_area')::BOOLEAN,
        correlation_item->>'matching_trip_point',
        (correlation_item->>'date_difference_days')::INTEGER,
        (correlation_item->>'temporal_correlation_score')::DECIMAL,
        (correlation_item->>'customer_name_similarity')::REAL,
        correlation_item->>'customer_match_type',
        (correlation_item->>'delivery_volume_litres')::NUMERIC,
        run_id
      )
      ON CONFLICT (mtdata_trip_id, delivery_key) DO UPDATE SET
        confidence_score = EXCLUDED.confidence_score,
        terminal_distance_km = EXCLUDED.terminal_distance_km,
        temporal_correlation_score = EXCLUDED.temporal_correlation_score,
        updated_at = NOW();
      
      IF FOUND THEN
        inserted := inserted + 1;
      ELSE
        updated := updated + 1;
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        skipped := skipped + 1;
        RAISE NOTICE 'Skipped correlation due to error: %', SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT inserted, updated, skipped;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PERMISSIONS AND COMMENTS
-- ============================================================================

-- Grant permissions
GRANT SELECT ON mtdata_captive_correlations TO authenticated;
GRANT INSERT, UPDATE ON mtdata_captive_correlations TO authenticated;
GRANT SELECT ON high_confidence_correlations TO authenticated;
GRANT SELECT ON correlation_analytics_summary TO authenticated;

-- Function permissions
GRANT EXECUTE ON FUNCTION refresh_correlation_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_insert_correlations(JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_confidence_level(DECIMAL) TO authenticated;

-- Add comments
COMMENT ON TABLE mtdata_captive_correlations IS 'Stores correlations between MTdata trips and captive payment deliveries with confidence scoring';
COMMENT ON VIEW high_confidence_correlations IS 'High-confidence trip-to-delivery correlations for analysis and reporting';
COMMENT ON MATERIALIZED VIEW correlation_analytics_summary IS 'Pre-aggregated correlation analytics for dashboard performance';
COMMENT ON FUNCTION bulk_insert_correlations(JSONB, UUID) IS 'Bulk insert/update correlations from analysis results';

-- Create initial indexes and refresh materialized view
SELECT refresh_correlation_analytics();

SELECT 'MTdata captive correlations system created successfully' as result;