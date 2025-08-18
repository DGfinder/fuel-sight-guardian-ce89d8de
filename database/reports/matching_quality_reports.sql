-- ============================================================================
-- MATCHING QUALITY REPORTS AND AUDIT TRAIL
-- Comprehensive reporting system for correlation quality and algorithm performance
-- ============================================================================

-- ============================================================================
-- CORRELATION QUALITY DASHBOARD VIEW
-- ============================================================================

-- Main quality dashboard with key metrics
CREATE OR REPLACE VIEW correlation_quality_dashboard AS
WITH quality_metrics AS (
  SELECT 
    COUNT(*) as total_correlations,
    COUNT(*) FILTER (WHERE confidence_score >= 90) as excellent_correlations,
    COUNT(*) FILTER (WHERE confidence_score >= 75) as good_correlations,
    COUNT(*) FILTER (WHERE confidence_score >= 60) as fair_correlations,
    COUNT(*) FILTER (WHERE confidence_score < 60) as poor_correlations,
    
    -- Hybrid matching metrics
    COUNT(*) FILTER (WHERE matching_algorithm_version LIKE 'hybrid%') as hybrid_correlations,
    COUNT(*) FILTER (WHERE 'text_matching' = ANY(match_methods)) as text_based_matches,
    COUNT(*) FILTER (WHERE 'geospatial' = ANY(match_methods)) as geo_based_matches,
    COUNT(*) FILTER (WHERE array_length(match_methods, 1) > 1) as multi_method_matches,
    
    -- Business matching insights
    COUNT(*) FILTER (WHERE business_identifier_match = TRUE) as business_id_matches,
    COUNT(*) FILTER (WHERE location_reference_match = TRUE) as location_ref_matches,
    COUNT(*) FILTER (WHERE within_terminal_service_area = TRUE) as service_area_matches,
    
    -- Quality flags analysis
    COUNT(*) FILTER (WHERE 'low_confidence' = ANY(quality_flags)) as low_confidence_flags,
    COUNT(*) FILTER (WHERE 'large_date_gap' = ANY(quality_flags)) as date_gap_flags,
    COUNT(*) FILTER (WHERE 'long_distance' = ANY(quality_flags)) as distance_flags,
    
    -- Verification status
    COUNT(*) FILTER (WHERE verified_by_user = TRUE) as verified_correlations,
    COUNT(*) FILTER (WHERE requires_manual_review = TRUE) as review_needed,
    
    -- Performance metrics
    AVG(confidence_score) as avg_confidence,
    AVG(text_confidence) FILTER (WHERE text_confidence > 0) as avg_text_confidence,
    AVG(geo_confidence) FILTER (WHERE geo_confidence > 0) as avg_geo_confidence,
    AVG(temporal_confidence) FILTER (WHERE temporal_confidence > 0) as avg_temporal_confidence,
    
    -- Date range
    MIN(created_at) as earliest_correlation,
    MAX(created_at) as latest_correlation
    
  FROM mtdata_captive_correlations
  WHERE is_potential_match = TRUE
    AND created_at >= CURRENT_DATE - INTERVAL '30 days'
)
SELECT 
  -- Core metrics
  qm.total_correlations,
  qm.excellent_correlations,
  qm.good_correlations, 
  qm.fair_correlations,
  qm.poor_correlations,
  
  -- Quality percentages
  ROUND((qm.excellent_correlations * 100.0 / NULLIF(qm.total_correlations, 0)), 2) as excellent_percentage,
  ROUND((qm.good_correlations * 100.0 / NULLIF(qm.total_correlations, 0)), 2) as good_percentage,
  ROUND(((qm.excellent_correlations + qm.good_correlations) * 100.0 / NULLIF(qm.total_correlations, 0)), 2) as high_quality_percentage,
  
  -- Hybrid adoption
  qm.hybrid_correlations,
  ROUND((qm.hybrid_correlations * 100.0 / NULLIF(qm.total_correlations, 0)), 2) as hybrid_adoption_percentage,
  
  -- Method distribution
  qm.text_based_matches,
  qm.geo_based_matches,
  qm.multi_method_matches,
  ROUND((qm.multi_method_matches * 100.0 / NULLIF(qm.total_correlations, 0)), 2) as multi_method_percentage,
  
  -- Business matching effectiveness
  qm.business_id_matches,
  qm.location_ref_matches,
  qm.service_area_matches,
  ROUND((qm.business_id_matches * 100.0 / NULLIF(qm.total_correlations, 0)), 2) as business_match_rate,
  
  -- Quality issues
  qm.low_confidence_flags,
  qm.date_gap_flags,
  qm.distance_flags,
  (qm.low_confidence_flags + qm.date_gap_flags + qm.distance_flags) as total_quality_flags,
  
  -- Verification metrics
  qm.verified_correlations,
  qm.review_needed,
  ROUND((qm.verified_correlations * 100.0 / NULLIF(qm.total_correlations, 0)), 2) as verification_rate,
  ROUND((qm.review_needed * 100.0 / NULLIF(qm.total_correlations, 0)), 2) as review_needed_rate,
  
  -- Average confidence scores
  ROUND(qm.avg_confidence, 2) as overall_avg_confidence,
  ROUND(qm.avg_text_confidence, 2) as avg_text_confidence,
  ROUND(qm.avg_geo_confidence, 2) as avg_geo_confidence,
  ROUND(qm.avg_temporal_confidence, 2) as avg_temporal_confidence,
  
  -- Date range
  qm.earliest_correlation,
  qm.latest_correlation,
  (qm.latest_correlation - qm.earliest_correlation) as analysis_period

FROM quality_metrics qm;

-- ============================================================================
-- ALGORITHM PERFORMANCE COMPARISON VIEW
-- ============================================================================

-- Compare performance across different algorithm versions
CREATE OR REPLACE VIEW algorithm_performance_comparison AS
SELECT 
  matching_algorithm_version,
  COUNT(*) as total_correlations,
  
  -- Quality distribution
  COUNT(*) FILTER (WHERE match_quality = 'excellent') as excellent_matches,
  COUNT(*) FILTER (WHERE match_quality = 'good') as good_matches,
  COUNT(*) FILTER (WHERE match_quality = 'fair') as fair_matches,
  COUNT(*) FILTER (WHERE match_quality = 'poor') as poor_matches,
  
  -- Confidence metrics
  AVG(confidence_score) as avg_confidence,
  MIN(confidence_score) as min_confidence,
  MAX(confidence_score) as max_confidence,
  STDDEV(confidence_score) as confidence_stddev,
  
  -- Method usage (for hybrid algorithms)
  COUNT(*) FILTER (WHERE 'text_matching' = ANY(match_methods)) as text_method_usage,
  COUNT(*) FILTER (WHERE 'geospatial' = ANY(match_methods)) as geo_method_usage,
  COUNT(*) FILTER (WHERE 'temporal' = ANY(match_methods)) as temporal_method_usage,
  
  -- Quality indicators
  COUNT(*) FILTER (WHERE business_identifier_match = TRUE) as business_matches,
  COUNT(*) FILTER (WHERE within_terminal_service_area = TRUE) as service_area_matches,
  COUNT(*) FILTER (WHERE requires_manual_review = TRUE) as manual_review_needed,
  
  -- Efficiency metrics
  AVG(array_length(quality_flags, 1)) as avg_quality_flags,
  COUNT(*) FILTER (WHERE verified_by_user = TRUE) as verified_count,
  
  -- Time period
  MIN(created_at) as first_used,
  MAX(created_at) as last_used,
  COUNT(DISTINCT DATE(created_at)) as days_active

FROM mtdata_captive_correlations
WHERE is_potential_match = TRUE
  AND created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY matching_algorithm_version
ORDER BY first_used DESC;

-- ============================================================================
-- TERMINAL-SPECIFIC MATCHING PERFORMANCE
-- ============================================================================

-- Analyze matching performance by terminal
CREATE OR REPLACE VIEW terminal_matching_performance AS
SELECT 
  terminal_name,
  carrier,
  COUNT(*) as total_correlations,
  
  -- Method effectiveness by terminal
  COUNT(*) FILTER (WHERE 'text_matching' = ANY(match_methods)) as text_matches,
  COUNT(*) FILTER (WHERE 'geospatial' = ANY(match_methods)) as geo_matches,
  ROUND((COUNT(*) FILTER (WHERE 'text_matching' = ANY(match_methods)) * 100.0 / COUNT(*)), 2) as text_match_rate,
  ROUND((COUNT(*) FILTER (WHERE 'geospatial' = ANY(match_methods)) * 100.0 / COUNT(*)), 2) as geo_match_rate,
  
  -- Confidence by terminal
  AVG(confidence_score) as avg_confidence,
  AVG(text_confidence) FILTER (WHERE text_confidence > 0) as avg_text_confidence,
  AVG(geo_confidence) FILTER (WHERE geo_confidence > 0) as avg_geo_confidence,
  
  -- Quality metrics
  COUNT(*) FILTER (WHERE match_quality IN ('excellent', 'good')) as high_quality_matches,
  COUNT(*) FILTER (WHERE business_identifier_match = TRUE) as business_id_matches,
  COUNT(*) FILTER (WHERE within_terminal_service_area = TRUE) as service_area_matches,
  
  -- Distance analysis
  AVG(terminal_distance_km) FILTER (WHERE terminal_distance_km IS NOT NULL) as avg_distance_km,
  MIN(terminal_distance_km) FILTER (WHERE terminal_distance_km IS NOT NULL) as min_distance_km,
  MAX(terminal_distance_km) FILTER (WHERE terminal_distance_km IS NOT NULL) as max_distance_km,
  
  -- Temporal analysis
  AVG(ABS(date_difference_days)) as avg_date_difference,
  COUNT(*) FILTER (WHERE ABS(date_difference_days) <= 1) as same_day_matches,
  
  -- Problem indicators
  COUNT(*) FILTER (WHERE requires_manual_review = TRUE) as review_needed,
  COUNT(*) FILTER (WHERE 'long_distance' = ANY(quality_flags)) as long_distance_flags,
  
  -- Verification
  COUNT(*) FILTER (WHERE verified_by_user = TRUE) as verified_matches

FROM mtdata_captive_correlations
WHERE is_potential_match = TRUE
  AND created_at >= CURRENT_DATE - INTERVAL '60 days'
GROUP BY terminal_name, carrier
ORDER BY total_correlations DESC;

-- ============================================================================
-- MATCHING QUALITY TRENDS VIEW
-- ============================================================================

-- Track quality improvements over time
CREATE OR REPLACE VIEW matching_quality_trends AS
SELECT 
  DATE_TRUNC('week', created_at) as week_start,
  matching_algorithm_version,
  
  -- Volume metrics
  COUNT(*) as correlations_created,
  COUNT(DISTINCT mtdata_trip_id) as unique_trips_correlated,
  
  -- Quality trends
  AVG(confidence_score) as avg_confidence,
  COUNT(*) FILTER (WHERE confidence_score >= 80) as high_confidence_count,
  ROUND((COUNT(*) FILTER (WHERE confidence_score >= 80) * 100.0 / COUNT(*)), 2) as high_confidence_rate,
  
  -- Method evolution
  COUNT(*) FILTER (WHERE 'text_matching' = ANY(match_methods)) as text_method_count,
  COUNT(*) FILTER (WHERE 'geospatial' = ANY(match_methods)) as geo_method_count,
  COUNT(*) FILTER (WHERE array_length(match_methods, 1) > 1) as multi_method_count,
  
  -- Business matching evolution
  COUNT(*) FILTER (WHERE business_identifier_match = TRUE) as business_match_count,
  ROUND((COUNT(*) FILTER (WHERE business_identifier_match = TRUE) * 100.0 / COUNT(*)), 2) as business_match_rate,
  
  -- Quality flag trends
  AVG(array_length(quality_flags, 1)) as avg_quality_flags,
  COUNT(*) FILTER (WHERE requires_manual_review = TRUE) as manual_review_count,
  
  -- Verification trends
  COUNT(*) FILTER (WHERE verified_by_user = TRUE) as verified_count

FROM mtdata_captive_correlations
WHERE is_potential_match = TRUE
  AND created_at >= CURRENT_DATE - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', created_at), matching_algorithm_version
ORDER BY week_start DESC, matching_algorithm_version;

-- ============================================================================
-- CORRELATION AUDIT TRAIL
-- ============================================================================

-- Create audit log for correlation changes
CREATE TABLE IF NOT EXISTS correlation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Correlation reference
  correlation_id UUID NOT NULL,
  mtdata_trip_id UUID NOT NULL,
  delivery_key TEXT NOT NULL,
  
  -- Change details
  action_type TEXT NOT NULL, -- 'created', 'updated', 'verified', 'rejected', 'deleted'
  changed_fields JSONB, -- Fields that were changed
  old_values JSONB, -- Previous values
  new_values JSONB, -- New values
  
  -- Confidence changes
  old_confidence INTEGER,
  new_confidence INTEGER,
  confidence_change INTEGER,
  
  -- User and system info
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  system_notes TEXT,
  
  -- Algorithm info
  algorithm_version TEXT,
  analysis_run_id UUID,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Create indexes for audit trail
CREATE INDEX idx_correlation_audit_correlation_id ON correlation_audit_log(correlation_id);
CREATE INDEX idx_correlation_audit_trip_id ON correlation_audit_log(mtdata_trip_id);
CREATE INDEX idx_correlation_audit_action_type ON correlation_audit_log(action_type);
CREATE INDEX idx_correlation_audit_created_at ON correlation_audit_log(created_at DESC);
CREATE INDEX idx_correlation_audit_changed_by ON correlation_audit_log(changed_by);

-- ============================================================================
-- AUDIT TRAIL FUNCTIONS
-- ============================================================================

-- Function to log correlation changes
CREATE OR REPLACE FUNCTION log_correlation_change()
RETURNS TRIGGER AS $$
DECLARE
  action_type TEXT;
  changed_fields JSONB := '{}';
  old_vals JSONB := '{}';
  new_vals JSONB := '{}';
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_type := 'created';
    new_vals := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    action_type := CASE 
      WHEN OLD.verified_by_user = FALSE AND NEW.verified_by_user = TRUE THEN 'verified'
      WHEN OLD.is_potential_match = TRUE AND NEW.is_potential_match = FALSE THEN 'rejected'
      ELSE 'updated'
    END;
    
    -- Track changed fields
    IF OLD.confidence_score != NEW.confidence_score THEN
      changed_fields := jsonb_set(changed_fields, '{confidence_score}', 'true');
    END IF;
    IF OLD.requires_manual_review != NEW.requires_manual_review THEN
      changed_fields := jsonb_set(changed_fields, '{requires_manual_review}', 'true');
    END IF;
    IF OLD.verified_by_user != NEW.verified_by_user THEN
      changed_fields := jsonb_set(changed_fields, '{verified_by_user}', 'true');
    END IF;
    
    old_vals := to_jsonb(OLD);
    new_vals := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    action_type := 'deleted';
    old_vals := to_jsonb(OLD);
  END IF;
  
  -- Insert audit record
  INSERT INTO correlation_audit_log (
    correlation_id,
    mtdata_trip_id,
    delivery_key,
    action_type,
    changed_fields,
    old_values,
    new_values,
    old_confidence,
    new_confidence,
    confidence_change,
    changed_by,
    algorithm_version
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.mtdata_trip_id, OLD.mtdata_trip_id),
    COALESCE(NEW.delivery_key, OLD.delivery_key),
    action_type,
    changed_fields,
    old_vals,
    new_vals,
    CASE WHEN TG_OP != 'INSERT' THEN OLD.confidence_score END,
    CASE WHEN TG_OP != 'DELETE' THEN NEW.confidence_score END,
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.confidence_score - OLD.confidence_score END,
    CASE WHEN TG_OP != 'DELETE' THEN NEW.verified_by END,
    COALESCE(NEW.matching_algorithm_version, OLD.matching_algorithm_version)
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create audit trigger
DROP TRIGGER IF EXISTS correlation_audit_trigger ON mtdata_captive_correlations;
CREATE TRIGGER correlation_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON mtdata_captive_correlations
  FOR EACH ROW EXECUTE FUNCTION log_correlation_change();

-- ============================================================================
-- QUALITY REPORT FUNCTIONS
-- ============================================================================

-- Function to generate comprehensive quality report
CREATE OR REPLACE FUNCTION generate_correlation_quality_report(
  report_period_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  report_section TEXT,
  metric_name TEXT,
  metric_value TEXT,
  metric_description TEXT,
  trend_indicator TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- Overall Quality Metrics
  SELECT 'Overall Quality' as section, 'Total Correlations' as metric, 
         total_correlations::TEXT as value,
         'Total correlations in analysis period' as description,
         CASE WHEN total_correlations > 1000 THEN '↑' ELSE '→' END as trend
  FROM correlation_quality_dashboard
  
  UNION ALL
  
  SELECT 'Overall Quality', 'High Quality Rate', 
         high_quality_percentage::TEXT || '%',
         'Percentage of excellent + good quality matches',
         CASE WHEN high_quality_percentage > 75 THEN '↑' ELSE '↓' END
  FROM correlation_quality_dashboard
  
  UNION ALL
  
  SELECT 'Overall Quality', 'Average Confidence',
         overall_avg_confidence::TEXT,
         'Average confidence score across all correlations',
         CASE WHEN overall_avg_confidence > 75 THEN '↑' ELSE '→' END
  FROM correlation_quality_dashboard
  
  UNION ALL
  
  -- Algorithm Performance
  SELECT 'Algorithm Performance', 'Hybrid Adoption',
         hybrid_adoption_percentage::TEXT || '%',
         'Percentage using hybrid matching algorithms',
         '↑'
  FROM correlation_quality_dashboard
  
  UNION ALL
  
  SELECT 'Algorithm Performance', 'Multi-Method Matches',
         multi_method_percentage::TEXT || '%',
         'Correlations using multiple matching methods',
         CASE WHEN multi_method_percentage > 30 THEN '↑' ELSE '→' END
  FROM correlation_quality_dashboard
  
  UNION ALL
  
  SELECT 'Algorithm Performance', 'Business Match Rate',
         business_match_rate::TEXT || '%',
         'Rate of successful business identifier matches',
         CASE WHEN business_match_rate > 40 THEN '↑' ELSE '→' END
  FROM correlation_quality_dashboard
  
  UNION ALL
  
  -- Quality Issues
  SELECT 'Quality Issues', 'Manual Review Needed',
         review_needed_rate::TEXT || '%',
         'Percentage requiring manual verification',
         CASE WHEN review_needed_rate < 25 THEN '↑' ELSE '↓' END
  FROM correlation_quality_dashboard
  
  UNION ALL
  
  SELECT 'Quality Issues', 'Total Quality Flags',
         total_quality_flags::TEXT,
         'Total number of quality concerns flagged',
         CASE WHEN total_quality_flags < 100 THEN '↑' ELSE '↓' END
  FROM correlation_quality_dashboard
  
  UNION ALL
  
  -- Verification Status
  SELECT 'Verification', 'Verification Rate',
         verification_rate::TEXT || '%',
         'Percentage of correlations verified by users',
         CASE WHEN verification_rate > 15 THEN '↑' ELSE '→' END
  FROM correlation_quality_dashboard;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS AND COMMENTS
-- ============================================================================

-- Grant permissions
GRANT SELECT ON correlation_quality_dashboard TO authenticated;
GRANT SELECT ON algorithm_performance_comparison TO authenticated;
GRANT SELECT ON terminal_matching_performance TO authenticated;
GRANT SELECT ON matching_quality_trends TO authenticated;
GRANT SELECT ON correlation_audit_log TO authenticated;

GRANT EXECUTE ON FUNCTION generate_correlation_quality_report(INTEGER) TO authenticated;

-- Add comments
COMMENT ON VIEW correlation_quality_dashboard IS 'Main quality dashboard with key correlation metrics';
COMMENT ON VIEW algorithm_performance_comparison IS 'Performance comparison across different matching algorithms';
COMMENT ON VIEW terminal_matching_performance IS 'Terminal-specific matching performance analysis';
COMMENT ON VIEW matching_quality_trends IS 'Quality trends over time for continuous improvement';
COMMENT ON TABLE correlation_audit_log IS 'Audit trail for all correlation changes and user actions';

SELECT 'Matching quality reports and audit trail created successfully' as result;