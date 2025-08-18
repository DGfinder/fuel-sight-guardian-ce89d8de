-- ============================================================================
-- LOCATION MATCHING POTENTIAL AUDIT
-- Analyze MTdata trip locations vs captive payment customer names
-- to determine text-based matching opportunities
-- ============================================================================

-- Enable fuzzy string matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- MTDATA LOCATION PATTERNS ANALYSIS
-- ============================================================================

-- Analyze what's in MTdata trip start_location and end_location fields
CREATE OR REPLACE VIEW mtdata_location_patterns AS
WITH location_analysis AS (
  SELECT 
    start_location,
    end_location,
    COUNT(*) as trip_count,
    
    -- Categorize location types
    CASE 
      WHEN start_location ILIKE '%terminal%' OR start_location ILIKE '%term%' THEN 'terminal'
      WHEN start_location ILIKE '%depot%' OR start_location ILIKE '%yard%' THEN 'depot' 
      WHEN start_location ~* '^-?[0-9]+\.?[0-9]*,-?[0-9]+\.?[0-9]*$' THEN 'coordinates'
      WHEN start_location ILIKE '%pty%' OR start_location ILIKE '%ltd%' OR start_location ILIKE '%corp%' THEN 'business'
      WHEN start_location ILIKE '%mine%' OR start_location ILIKE '%mining%' THEN 'mining'
      WHEN start_location ILIKE '%airport%' OR start_location ILIKE '%airpt%' THEN 'airport'
      WHEN start_location IS NULL OR TRIM(start_location) = '' THEN 'empty'
      ELSE 'other'
    END as start_location_type,
    
    CASE 
      WHEN end_location ILIKE '%terminal%' OR end_location ILIKE '%term%' THEN 'terminal'
      WHEN end_location ILIKE '%depot%' OR end_location ILIKE '%yard%' THEN 'depot'
      WHEN end_location ~* '^-?[0-9]+\.?[0-9]*,-?[0-9]+\.?[0-9]*$' THEN 'coordinates'
      WHEN end_location ILIKE '%pty%' OR end_location ILIKE '%ltd%' OR end_location ILIKE '%corp%' THEN 'business'
      WHEN end_location ILIKE '%mine%' OR end_location ILIKE '%mining%' THEN 'mining'
      WHEN end_location ILIKE '%airport%' OR end_location ILIKE '%airpt%' THEN 'airport'
      WHEN end_location IS NULL OR TRIM(end_location) = '' THEN 'empty'
      ELSE 'other'
    END as end_location_type,
    
    -- Extract potential terminal names
    CASE 
      WHEN start_location ILIKE '%kewdale%' THEN 'Kewdale'
      WHEN start_location ILIKE '%geraldton%' THEN 'Geraldton' 
      WHEN start_location ILIKE '%kalgoorlie%' THEN 'Kalgoorlie'
      WHEN start_location ILIKE '%coogee%' OR start_location ILIKE '%rockingham%' THEN 'Coogee Rockingham'
      WHEN start_location ILIKE '%esperance%' THEN 'Esperance'
      WHEN start_location ILIKE '%fremantle%' THEN 'Fremantle'
      WHEN start_location ILIKE '%bunbury%' THEN 'Bunbury'
      WHEN start_location ILIKE '%port hedland%' THEN 'Port Hedland'
      WHEN start_location ILIKE '%newman%' THEN 'Newman'
      WHEN start_location ILIKE '%broome%' THEN 'Broome'
      WHEN start_location ILIKE '%albany%' THEN 'Albany'
      ELSE NULL
    END as start_terminal_extracted,
    
    CASE 
      WHEN end_location ILIKE '%kewdale%' THEN 'Kewdale'
      WHEN end_location ILIKE '%geraldton%' THEN 'Geraldton'
      WHEN end_location ILIKE '%kalgoorlie%' THEN 'Kalgoorlie'
      WHEN end_location ILIKE '%coogee%' OR end_location ILIKE '%rockingham%' THEN 'Coogee Rockingham'
      WHEN end_location ILIKE '%esperance%' THEN 'Esperance'
      WHEN end_location ILIKE '%fremantle%' THEN 'Fremantle'
      WHEN end_location ILIKE '%bunbury%' THEN 'Bunbury'
      WHEN end_location ILIKE '%port hedland%' THEN 'Port Hedland'
      WHEN end_location ILIKE '%newman%' THEN 'Newman'
      WHEN end_location ILIKE '%broome%' THEN 'Broome'
      WHEN end_location ILIKE '%albany%' THEN 'Albany'
      ELSE NULL
    END as end_terminal_extracted

  FROM mtdata_trip_history
  WHERE trip_date_computed >= CURRENT_DATE - INTERVAL '90 days' -- Recent data
  GROUP BY start_location, end_location
)
SELECT 
  start_location,
  end_location,
  trip_count,
  start_location_type,
  end_location_type,
  start_terminal_extracted,
  end_terminal_extracted,
  
  -- Flag potential matches
  CASE WHEN start_terminal_extracted IS NOT NULL OR end_terminal_extracted IS NOT NULL 
       THEN TRUE ELSE FALSE END as has_terminal_reference

FROM location_analysis
ORDER BY trip_count DESC;

-- ============================================================================
-- CAPTIVE PAYMENT CUSTOMER PATTERNS ANALYSIS  
-- ============================================================================

-- Analyze customer names and extract business identifiers
CREATE OR REPLACE VIEW captive_customer_patterns AS
WITH customer_analysis AS (
  SELECT 
    customer,
    terminal,
    COUNT(DISTINCT bill_of_lading || '-' || delivery_date) as delivery_count,
    SUM(volume_litres) as total_volume,
    
    -- Extract business identifiers
    CASE 
      WHEN customer ILIKE '%kcgm%' THEN 'KCGM'
      WHEN customer ILIKE '%bgc%' THEN 'BGC'
      WHEN customer ILIKE '%south32%' THEN 'South32'
      WHEN customer ILIKE '%worsley%' THEN 'Worsley'
      WHEN customer ILIKE '%western power%' THEN 'Western Power'
      WHEN customer ILIKE '%airport%' OR customer ILIKE '%airpt%' THEN 'Airport'
      WHEN customer ILIKE '%precast%' THEN 'Precast'
      WHEN customer ILIKE '%concrete%' THEN 'Concrete'
      WHEN customer ILIKE '%mining%' OR customer ILIKE '%mine%' THEN 'Mining'
      WHEN customer ILIKE '%refinery%' THEN 'Refinery'
      WHEN customer ILIKE '%garage%' THEN 'Garage'
      ELSE NULL
    END as business_identifier,
    
    -- Categorize customer types
    CASE 
      WHEN customer ILIKE '%mine%' OR customer ILIKE '%mining%' OR customer ILIKE '%kcgm%' THEN 'mining'
      WHEN customer ILIKE '%airport%' OR customer ILIKE '%airpt%' THEN 'aviation'
      WHEN customer ILIKE '%construction%' OR customer ILIKE '%concrete%' OR customer ILIKE '%precast%' THEN 'construction'
      WHEN customer ILIKE '%power%' OR customer ILIKE '%refinery%' OR customer ILIKE '%utility%' THEN 'utilities'
      WHEN customer ILIKE '%transport%' OR customer ILIKE '%logistics%' OR customer ILIKE '%carrier%' THEN 'transport'
      WHEN customer ILIKE '%garage%' OR customer ILIKE '%service%' THEN 'retail'
      ELSE 'other'
    END as customer_type,
    
    -- Extract location references from customer names
    CASE 
      WHEN customer ILIKE '%kalgoorlie%' THEN 'Kalgoorlie'
      WHEN customer ILIKE '%geraldton%' THEN 'Geraldton'
      WHEN customer ILIKE '%perth%' THEN 'Perth'
      WHEN customer ILIKE '%kwinana%' THEN 'Kwinana'
      WHEN customer ILIKE '%fremantle%' THEN 'Fremantle'
      WHEN customer ILIKE '%bunbury%' THEN 'Bunbury'
      WHEN customer ILIKE '%esperance%' THEN 'Esperance'
      WHEN customer ILIKE '%albany%' THEN 'Albany'
      WHEN customer ILIKE '%newman%' THEN 'Newman'
      WHEN customer ILIKE '%broome%' THEN 'Broome'
      WHEN customer ILIKE '%pilbara%' THEN 'Pilbara'
      WHEN customer ILIKE '%forrestfield%' THEN 'Forrestfield'
      WHEN customer ILIKE '%naval base%' THEN 'Naval Base'
      ELSE NULL
    END as location_reference
    
  FROM captive_payment_records
  GROUP BY customer, terminal
)
SELECT 
  customer,
  terminal,
  delivery_count,
  total_volume,
  business_identifier,
  customer_type,
  location_reference,
  
  -- Flag if customer name contains terminal reference
  CASE WHEN location_reference IS NOT NULL THEN TRUE ELSE FALSE END as has_location_reference

FROM customer_analysis
ORDER BY total_volume DESC;

-- ============================================================================
-- DIRECT MATCHING POTENTIAL ANALYSIS
-- ============================================================================

-- Find potential direct matches between MTdata locations and customer names
CREATE OR REPLACE VIEW potential_direct_matches AS
WITH mtdata_locations AS (
  SELECT DISTINCT 
    COALESCE(start_location, '') as location_text,
    'start' as location_type
  FROM mtdata_trip_history 
  WHERE start_location IS NOT NULL AND TRIM(start_location) != ''
  
  UNION
  
  SELECT DISTINCT 
    COALESCE(end_location, '') as location_text,
    'end' as location_type
  FROM mtdata_trip_history 
  WHERE end_location IS NOT NULL AND TRIM(end_location) != ''
),
captive_customers AS (
  SELECT DISTINCT customer
  FROM captive_payment_records
  WHERE customer IS NOT NULL AND TRIM(customer) != ''
)
SELECT 
  ml.location_text as mtdata_location,
  ml.location_type,
  cc.customer as captive_customer,
  
  -- Calculate similarity scores
  similarity(UPPER(ml.location_text), UPPER(cc.customer)) as direct_similarity,
  
  -- Check for substring matches
  CASE 
    WHEN UPPER(ml.location_text) LIKE '%' || UPPER(cc.customer) || '%' THEN TRUE
    WHEN UPPER(cc.customer) LIKE '%' || UPPER(ml.location_text) || '%' THEN TRUE
    ELSE FALSE
  END as substring_match,
  
  -- Extract common business names for comparison
  CASE 
    WHEN ml.location_text ILIKE '%kcgm%' AND cc.customer ILIKE '%kcgm%' THEN 'KCGM'
    WHEN ml.location_text ILIKE '%bgc%' AND cc.customer ILIKE '%bgc%' THEN 'BGC'
    WHEN ml.location_text ILIKE '%south32%' AND cc.customer ILIKE '%south32%' THEN 'South32'
    WHEN ml.location_text ILIKE '%worsley%' AND cc.customer ILIKE '%worsley%' THEN 'Worsley'
    WHEN ml.location_text ILIKE '%airport%' AND cc.customer ILIKE '%airport%' THEN 'Airport'
    WHEN ml.location_text ILIKE '%airpt%' AND cc.customer ILIKE '%airpt%' THEN 'Airport'
    WHEN ml.location_text ILIKE '%precast%' AND cc.customer ILIKE '%precast%' THEN 'Precast'
    WHEN ml.location_text ILIKE '%western power%' AND cc.customer ILIKE '%western power%' THEN 'Western Power'
    ELSE NULL
  END as common_business_name

FROM mtdata_locations ml
CROSS JOIN captive_customers cc
WHERE similarity(UPPER(ml.location_text), UPPER(cc.customer)) >= 0.3
   OR ml.location_text ILIKE '%kcgm%' AND cc.customer ILIKE '%kcgm%'
   OR ml.location_text ILIKE '%bgc%' AND cc.customer ILIKE '%bgc%' 
   OR ml.location_text ILIKE '%south32%' AND cc.customer ILIKE '%south32%'
   OR ml.location_text ILIKE '%worsley%' AND cc.customer ILIKE '%worsley%'
   OR ml.location_text ILIKE '%airport%' AND cc.customer ILIKE '%airport%'
   OR ml.location_text ILIKE '%airpt%' AND cc.customer ILIKE '%airpt%'
   OR ml.location_text ILIKE '%precast%' AND cc.customer ILIKE '%precast%'
   OR ml.location_text ILIKE '%western power%' AND cc.customer ILIKE '%western power%'
ORDER BY direct_similarity DESC, common_business_name;

-- ============================================================================
-- SUMMARY STATISTICS
-- ============================================================================

-- Overall matching potential summary
CREATE OR REPLACE VIEW location_matching_summary AS
SELECT 
  'MTdata Location Coverage' as metric,
  COUNT(DISTINCT COALESCE(start_location, end_location))::TEXT as value
FROM mtdata_trip_history
WHERE start_location IS NOT NULL OR end_location IS NOT NULL

UNION ALL

SELECT 
  'Trips with Terminal References' as metric,
  COUNT(*)::TEXT as value
FROM mtdata_location_patterns
WHERE has_terminal_reference = TRUE

UNION ALL

SELECT 
  'Unique Captive Customers' as metric,
  COUNT(DISTINCT customer)::TEXT as value
FROM captive_payment_records

UNION ALL

SELECT 
  'Customers with Location References' as metric,
  COUNT(*)::TEXT as value
FROM captive_customer_patterns
WHERE has_location_reference = TRUE

UNION ALL

SELECT 
  'High Similarity Matches (>70%)' as metric,
  COUNT(*)::TEXT as value
FROM potential_direct_matches
WHERE direct_similarity > 0.7

UNION ALL

SELECT 
  'Business Name Matches' as metric,
  COUNT(*)::TEXT as value
FROM potential_direct_matches
WHERE common_business_name IS NOT NULL

UNION ALL

SELECT 
  'Total Potential Matches' as metric,
  COUNT(*)::TEXT as value
FROM potential_direct_matches;

-- Grant permissions
GRANT SELECT ON mtdata_location_patterns TO authenticated;
GRANT SELECT ON captive_customer_patterns TO authenticated;
GRANT SELECT ON potential_direct_matches TO authenticated;
GRANT SELECT ON location_matching_summary TO authenticated;

-- Add comments
COMMENT ON VIEW mtdata_location_patterns IS 'Analysis of MTdata trip location fields and patterns';
COMMENT ON VIEW captive_customer_patterns IS 'Analysis of captive payment customer names and business identifiers';
COMMENT ON VIEW potential_direct_matches IS 'Direct text matching opportunities between MTdata locations and customer names';
COMMENT ON VIEW location_matching_summary IS 'Summary statistics for text-based matching potential';

SELECT 'Location matching potential audit views created successfully' as result;