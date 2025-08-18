-- ============================================================================
-- ENHANCED TEXT MATCHING FUNCTIONS
-- Advanced text normalization and matching for MTdata trips and captive payments
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- ============================================================================
-- TERMINAL NAME NORMALIZATION FUNCTION
-- ============================================================================

-- Function to normalize and standardize terminal/location names
CREATE OR REPLACE FUNCTION normalize_location_name(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized_text TEXT;
BEGIN
  -- Return empty for null/empty input
  IF input_text IS NULL OR TRIM(input_text) = '' THEN
    RETURN '';
  END IF;
  
  -- Convert to uppercase and clean basic formatting
  normalized_text := UPPER(TRIM(input_text));
  
  -- Remove common prefixes/suffixes that don't affect matching
  normalized_text := REGEXP_REPLACE(normalized_text, '^(AU |AUSTRALIA )', '', 'g');
  normalized_text := REGEXP_REPLACE(normalized_text, '(TERM |TERMINAL |THDPTY )', 'TERMINAL ', 'g');
  normalized_text := REGEXP_REPLACE(normalized_text, '(PTY LTD|PTY|LTD|CORPORATION|CORP|INC)$', '', 'g');
  normalized_text := REGEXP_REPLACE(normalized_text, '(GARAGE|SERVICE STATION)$', '', 'g');
  
  -- Standardize terminal location names
  CASE 
    WHEN normalized_text LIKE '%KEWDALE%' THEN normalized_text := 'TERMINAL KEWDALE';
    WHEN normalized_text LIKE '%GERALDTON%' THEN normalized_text := 'TERMINAL GERALDTON';
    WHEN normalized_text LIKE '%KALGOORLIE%' THEN normalized_text := 'TERMINAL KALGOORLIE';
    WHEN normalized_text LIKE '%COOGEE%' OR normalized_text LIKE '%ROCKINGHAM%' THEN normalized_text := 'TERMINAL COOGEE ROCKINGHAM';
    WHEN normalized_text LIKE '%ESPERANCE%' THEN normalized_text := 'TERMINAL ESPERANCE';
    WHEN normalized_text LIKE '%FREMANTLE%' THEN normalized_text := 'TERMINAL FREMANTLE';
    WHEN normalized_text LIKE '%BUNBURY%' THEN normalized_text := 'TERMINAL BUNBURY';
    WHEN normalized_text LIKE '%PORT HEDLAND%' THEN normalized_text := 'TERMINAL PORT HEDLAND';
    WHEN normalized_text LIKE '%NEWMAN%' THEN normalized_text := 'TERMINAL NEWMAN';
    WHEN normalized_text LIKE '%BROOME%' THEN normalized_text := 'TERMINAL BROOME';
    WHEN normalized_text LIKE '%ALBANY%' THEN normalized_text := 'TERMINAL ALBANY';
    WHEN normalized_text LIKE '%MERREDIN%' THEN normalized_text := 'TERMINAL MERREDIN';
    WHEN normalized_text LIKE '%WONGAN HILLS%' THEN normalized_text := 'TERMINAL WONGAN HILLS';
    WHEN normalized_text LIKE '%KARRATHA%' THEN normalized_text := 'TERMINAL KARRATHA';
    ELSE normalized_text := normalized_text;
  END CASE;
  
  -- Clean up extra spaces
  normalized_text := REGEXP_REPLACE(normalized_text, '\s+', ' ', 'g');
  normalized_text := TRIM(normalized_text);
  
  RETURN normalized_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- BUSINESS NAME EXTRACTION FUNCTION
-- ============================================================================

-- Function to extract standardized business identifiers
CREATE OR REPLACE FUNCTION extract_business_identifier(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  business_id TEXT;
  normalized_text TEXT;
BEGIN
  IF input_text IS NULL OR TRIM(input_text) = '' THEN
    RETURN NULL;
  END IF;
  
  normalized_text := UPPER(TRIM(input_text));
  
  -- Extract known business identifiers with variations
  CASE 
    WHEN normalized_text LIKE '%KCGM%' OR normalized_text LIKE '%KALGOORLIE CONSOLIDATED GOLD%' THEN
      business_id := 'KCGM';
    WHEN normalized_text LIKE '%BGC%' THEN
      business_id := 'BGC';
    WHEN normalized_text LIKE '%SOUTH32%' OR normalized_text LIKE '%WORSLEY%' THEN
      business_id := 'SOUTH32_WORSLEY';
    WHEN normalized_text LIKE '%WESTERN POWER%' THEN
      business_id := 'WESTERN_POWER';
    WHEN normalized_text LIKE '%AIRPORT%' OR normalized_text LIKE '%AIRPT%' THEN
      business_id := 'AIRPORT';
    WHEN normalized_text LIKE '%PRECAST%' THEN
      business_id := 'BGC_PRECAST';
    WHEN normalized_text LIKE '%CONCRETE%' AND normalized_text LIKE '%BGC%' THEN
      business_id := 'BGC_CONCRETE';
    WHEN normalized_text LIKE '%NAVAL BASE%' THEN
      business_id := 'BGC_NAVAL_BASE';
    WHEN normalized_text LIKE '%KWINANA BEACH%' THEN
      business_id := 'BGC_KWINANA';
    WHEN normalized_text LIKE '%JUNDEE%' AND normalized_text LIKE '%MINE%' THEN
      business_id := 'JUNDEE_MINE';
    WHEN normalized_text LIKE '%FORRESTFIELD%' AND normalized_text LIKE '%AWR%' THEN
      business_id := 'AWR_FORRESTFIELD';
    ELSE
      business_id := NULL;
  END CASE;
  
  RETURN business_id;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- LOCATION REFERENCE EXTRACTION FUNCTION
-- ============================================================================

-- Function to extract geographic location references
CREATE OR REPLACE FUNCTION extract_location_reference(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  location_ref TEXT;
  normalized_text TEXT;
BEGIN
  IF input_text IS NULL OR TRIM(input_text) = '' THEN
    RETURN NULL;
  END IF;
  
  normalized_text := UPPER(TRIM(input_text));
  
  -- Extract location references with priority (more specific first)
  CASE 
    WHEN normalized_text LIKE '%KALGOORLIE%' THEN location_ref := 'KALGOORLIE';
    WHEN normalized_text LIKE '%GERALDTON%' THEN location_ref := 'GERALDTON';
    WHEN normalized_text LIKE '%KWINANA%' THEN location_ref := 'KWINANA';
    WHEN normalized_text LIKE '%FORRESTFIELD%' THEN location_ref := 'FORRESTFIELD';
    WHEN normalized_text LIKE '%NAVAL BASE%' THEN location_ref := 'NAVAL_BASE';
    WHEN normalized_text LIKE '%COOGEE%' OR normalized_text LIKE '%ROCKINGHAM%' THEN location_ref := 'COOGEE_ROCKINGHAM';
    WHEN normalized_text LIKE '%FREMANTLE%' THEN location_ref := 'FREMANTLE';
    WHEN normalized_text LIKE '%BUNBURY%' THEN location_ref := 'BUNBURY';
    WHEN normalized_text LIKE '%ESPERANCE%' THEN location_ref := 'ESPERANCE';
    WHEN normalized_text LIKE '%ALBANY%' THEN location_ref := 'ALBANY';
    WHEN normalized_text LIKE '%PORT HEDLAND%' THEN location_ref := 'PORT_HEDLAND';
    WHEN normalized_text LIKE '%NEWMAN%' THEN location_ref := 'NEWMAN';
    WHEN normalized_text LIKE '%BROOME%' THEN location_ref := 'BROOME';
    WHEN normalized_text LIKE '%KARRATHA%' THEN location_ref := 'KARRATHA';
    WHEN normalized_text LIKE '%MERREDIN%' THEN location_ref := 'MERREDIN';
    WHEN normalized_text LIKE '%WONGAN HILLS%' THEN location_ref := 'WONGAN_HILLS';
    WHEN normalized_text LIKE '%PERTH%' THEN location_ref := 'PERTH';
    WHEN normalized_text LIKE '%KEWDALE%' THEN location_ref := 'KEWDALE';
    WHEN normalized_text LIKE '%PILBARA%' THEN location_ref := 'PILBARA';
    ELSE location_ref := NULL;
  END CASE;
  
  RETURN location_ref;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- ENHANCED FUZZY MATCHING FUNCTION
-- ============================================================================

-- Function for intelligent fuzzy matching with business-aware scoring
CREATE OR REPLACE FUNCTION smart_text_match(
  text1 TEXT,
  text2 TEXT,
  match_type TEXT DEFAULT 'general' -- 'terminal', 'business', 'location', 'general'
)
RETURNS TABLE (
  similarity_score REAL,
  match_confidence INTEGER,
  match_method TEXT,
  normalized_text1 TEXT,
  normalized_text2 TEXT,
  business_match BOOLEAN,
  location_match BOOLEAN
) AS $$
DECLARE
  norm1 TEXT;
  norm2 TEXT;
  biz1 TEXT;
  biz2 TEXT;
  loc1 TEXT;
  loc2 TEXT;
  sim_score REAL;
  confidence INT;
  method TEXT;
  biz_match BOOLEAN := FALSE;
  loc_match BOOLEAN := FALSE;
BEGIN
  -- Handle null/empty inputs
  IF text1 IS NULL OR text2 IS NULL OR TRIM(text1) = '' OR TRIM(text2) = '' THEN
    RETURN QUERY SELECT 0.0::REAL, 0, 'null_input'::TEXT, ''::TEXT, ''::TEXT, FALSE, FALSE;
    RETURN;
  END IF;
  
  -- Normalize both texts
  norm1 := normalize_location_name(text1);
  norm2 := normalize_location_name(text2);
  
  -- Extract business identifiers
  biz1 := extract_business_identifier(text1);
  biz2 := extract_business_identifier(text2);
  
  -- Extract location references
  loc1 := extract_location_reference(text1);
  loc2 := extract_location_reference(text2);
  
  -- Check for business identifier matches (highest priority)
  IF biz1 IS NOT NULL AND biz2 IS NOT NULL AND biz1 = biz2 THEN
    sim_score := 0.95;
    confidence := 95;
    method := 'business_identifier_exact';
    biz_match := TRUE;
  
  -- Check for location reference matches
  ELSIF loc1 IS NOT NULL AND loc2 IS NOT NULL AND loc1 = loc2 THEN
    sim_score := 0.85;
    confidence := 85;
    method := 'location_reference_exact';
    loc_match := TRUE;
  
  -- Check for exact normalized matches
  ELSIF norm1 = norm2 THEN
    sim_score := 0.90;
    confidence := 90;
    method := 'normalized_exact';
  
  -- Use trigram similarity on normalized text
  ELSE
    sim_score := similarity(norm1, norm2);
    
    -- Adjust confidence based on match type and context
    CASE 
      WHEN sim_score >= 0.8 THEN 
        confidence := 80;
        method := 'trigram_high';
      WHEN sim_score >= 0.6 THEN 
        confidence := 60;
        method := 'trigram_medium';
      WHEN sim_score >= 0.4 THEN 
        confidence := 40;
        method := 'trigram_low';
      ELSE 
        confidence := 0;
        method := 'no_match';
    END CASE;
    
    -- Boost confidence for partial business/location matches
    IF biz1 IS NOT NULL AND biz2 IS NOT NULL THEN
      confidence := confidence + 10;
      biz_match := TRUE;
    END IF;
    
    IF loc1 IS NOT NULL AND loc2 IS NOT NULL THEN
      confidence := confidence + 10;
      loc_match := TRUE;
    END IF;
  END IF;
  
  -- Cap confidence at 100
  confidence := LEAST(confidence, 100);
  
  RETURN QUERY SELECT sim_score, confidence, method, norm1, norm2, biz_match, loc_match;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIP-CUSTOMER DIRECT MATCHING FUNCTION
-- ============================================================================

-- Function to match MTdata trip locations directly with captive customer names
CREATE OR REPLACE FUNCTION match_trip_with_customers(
  trip_start_location TEXT,
  trip_end_location TEXT,
  min_confidence INTEGER DEFAULT 60
)
RETURNS TABLE (
  customer_name TEXT,
  terminal_name TEXT,
  carrier TEXT,
  match_location TEXT, -- 'start', 'end', or 'both'
  confidence_score INTEGER,
  match_method TEXT,
  business_identifier TEXT,
  location_reference TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH customer_matches AS (
    -- Match against start location
    SELECT 
      cd.customer,
      cd.terminal,
      cd.carrier,
      'start' as match_loc,
      stm.match_confidence,
      stm.match_method,
      extract_business_identifier(cd.customer) as biz_id,
      extract_location_reference(cd.customer) as loc_ref
    FROM captive_deliveries cd
    CROSS JOIN LATERAL smart_text_match(
      trip_start_location, 
      cd.customer, 
      'business'
    ) stm
    WHERE trip_start_location IS NOT NULL 
      AND trip_start_location != ''
      AND stm.match_confidence >= min_confidence
    
    UNION ALL
    
    -- Match against end location  
    SELECT 
      cd.customer,
      cd.terminal,
      cd.carrier,
      'end' as match_loc,
      stm.match_confidence,
      stm.match_method,
      extract_business_identifier(cd.customer) as biz_id,
      extract_location_reference(cd.customer) as loc_ref
    FROM captive_deliveries cd
    CROSS JOIN LATERAL smart_text_match(
      trip_end_location, 
      cd.customer, 
      'business'
    ) stm
    WHERE trip_end_location IS NOT NULL 
      AND trip_end_location != ''
      AND stm.match_confidence >= min_confidence
      
    UNION ALL
    
    -- Match both locations with terminal names
    SELECT 
      cd.customer,
      cd.terminal,
      cd.carrier,
      'terminal' as match_loc,
      GREATEST(
        (SELECT match_confidence FROM smart_text_match(trip_start_location, cd.terminal, 'terminal')),
        (SELECT match_confidence FROM smart_text_match(trip_end_location, cd.terminal, 'terminal'))
      ) as match_confidence,
      'terminal_match' as match_method,
      extract_business_identifier(cd.customer) as biz_id,
      extract_location_reference(cd.terminal) as loc_ref
    FROM captive_deliveries cd
    WHERE (
      (SELECT match_confidence FROM smart_text_match(trip_start_location, cd.terminal, 'terminal')) >= min_confidence
      OR (SELECT match_confidence FROM smart_text_match(trip_end_location, cd.terminal, 'terminal')) >= min_confidence
    )
  )
  SELECT DISTINCT
    cm.customer,
    cm.terminal,
    cm.carrier,
    cm.match_loc,
    cm.match_confidence,
    cm.match_method,
    cm.biz_id,
    cm.loc_ref
  FROM customer_matches cm
  ORDER BY cm.match_confidence DESC, cm.customer;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS AND COMMENTS
-- ============================================================================

-- Grant permissions
GRANT EXECUTE ON FUNCTION normalize_location_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION extract_business_identifier(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION extract_location_reference(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION smart_text_match(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION match_trip_with_customers(TEXT, TEXT, INTEGER) TO authenticated;

-- Add comments
COMMENT ON FUNCTION normalize_location_name(TEXT) IS 'Normalize and standardize terminal/location names for consistent matching';
COMMENT ON FUNCTION extract_business_identifier(TEXT) IS 'Extract standardized business identifiers from location/customer text';
COMMENT ON FUNCTION extract_location_reference(TEXT) IS 'Extract geographic location references from text';
COMMENT ON FUNCTION smart_text_match(TEXT, TEXT, TEXT) IS 'Intelligent fuzzy matching with business and location awareness';
COMMENT ON FUNCTION match_trip_with_customers(TEXT, TEXT, INTEGER) IS 'Match MTdata trip locations directly with captive payment customers';

SELECT 'Enhanced text matching functions created successfully' as result;