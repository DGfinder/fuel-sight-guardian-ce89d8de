-- ============================================================================
-- BUSINESS NAME VARIATIONS LOOKUP TABLES
-- Stores known business name variations and aliases for improved matching
-- ============================================================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS business_name_aliases CASCADE;
DROP TABLE IF EXISTS location_name_aliases CASCADE;
DROP TABLE IF EXISTS terminal_name_aliases CASCADE;

-- ============================================================================
-- BUSINESS NAME ALIASES TABLE
-- ============================================================================

-- Table to store business name variations and aliases
CREATE TABLE business_name_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Canonical business identifier
  canonical_name TEXT NOT NULL,
  business_type TEXT, -- 'mining', 'construction', 'aviation', 'utilities', etc.
  
  -- Alias/variation
  alias_name TEXT NOT NULL,
  alias_type TEXT, -- 'abbreviation', 'full_name', 'trading_name', 'division', etc.
  
  -- Matching metadata
  confidence_boost INTEGER DEFAULT 10, -- Points to add to match confidence
  exact_match BOOLEAN DEFAULT FALSE, -- If true, requires exact match
  case_sensitive BOOLEAN DEFAULT FALSE,
  
  -- Context
  source_system TEXT, -- 'mtdata', 'captive_payments', 'both'
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(canonical_name, alias_name)
);

-- ============================================================================
-- LOCATION NAME ALIASES TABLE
-- ============================================================================

-- Table to store location name variations
CREATE TABLE location_name_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Canonical location name
  canonical_location TEXT NOT NULL,
  location_type TEXT, -- 'terminal', 'suburb', 'industrial_area', 'mine_site', etc.
  
  -- Alias/variation
  alias_name TEXT NOT NULL,
  alias_type TEXT, -- 'abbreviation', 'full_name', 'local_name', 'postal_address', etc.
  
  -- Geographic context
  state TEXT DEFAULT 'WA',
  region TEXT, -- 'perth_metro', 'goldfields', 'pilbara', etc.
  
  -- Matching metadata
  confidence_boost INTEGER DEFAULT 10,
  exact_match BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(canonical_location, alias_name)
);

-- ============================================================================
-- TERMINAL NAME ALIASES TABLE
-- ============================================================================

-- Table to store terminal name variations
CREATE TABLE terminal_name_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links to terminal_locations table
  terminal_location_id UUID REFERENCES terminal_locations(id) ON DELETE CASCADE,
  canonical_terminal_name TEXT NOT NULL,
  
  -- Alias/variation
  alias_name TEXT NOT NULL,
  alias_type TEXT, -- 'code', 'full_name', 'system_name', 'colloquial', etc.
  
  -- System context
  source_system TEXT, -- 'mtdata', 'captive_payments', 'manual', etc.
  
  -- Matching metadata
  confidence_boost INTEGER DEFAULT 15, -- Terminals get higher boost
  exact_match BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(canonical_terminal_name, alias_name)
);

-- ============================================================================
-- POPULATE BUSINESS NAME ALIASES
-- ============================================================================

-- Insert known business variations
INSERT INTO business_name_aliases (canonical_name, business_type, alias_name, alias_type, confidence_boost, source_system, notes) VALUES
-- KCGM variations
('KCGM', 'mining', 'KCGM FIMISTON EX KALGOORLIE', 'full_name', 20, 'captive_payments', 'Common captive payments format'),
('KCGM', 'mining', 'KALGOORLIE CONSOLIDATED GOLD MINES', 'full_name', 25, 'both', 'Official company name'),
('KCGM', 'mining', 'KCGM FIMISTON', 'division', 15, 'captive_payments', 'Mine division'),
('KCGM', 'mining', 'FIMISTON', 'site_name', 10, 'both', 'Mine site name'),

-- BGC variations
('BGC', 'construction', 'BGC PRECAST KWINANA BEACH', 'full_name', 20, 'captive_payments', 'Specific BGC division'),
('BGC', 'construction', 'BGC NAVAL BASE', 'full_name', 20, 'captive_payments', 'BGC Naval Base facility'),
('BGC', 'construction', 'BGC PRECAST', 'division', 15, 'both', 'BGC Precast division'),
('BGC', 'construction', 'BGC CONCRETE', 'division', 15, 'both', 'BGC Concrete division'),
('BGC', 'construction', 'BGC (AUSTRALIA) PTY LTD', 'legal_name', 25, 'both', 'Legal entity name'),

-- South32/Worsley variations
('SOUTH32_WORSLEY', 'utilities', 'SOUTH32 WORSLEY REFINERY GARAGE', 'full_name', 25, 'captive_payments', 'Full facility name'),
('SOUTH32_WORSLEY', 'utilities', 'WORSLEY REFINERY', 'facility', 20, 'both', 'Facility name'),
('SOUTH32_WORSLEY', 'utilities', 'SOUTH32 WORSLEY', 'company_facility', 20, 'both', 'Company and facility'),
('SOUTH32_WORSLEY', 'utilities', 'SOUTH32', 'company', 10, 'both', 'Parent company'),
('SOUTH32_WORSLEY', 'utilities', 'WORSLEY', 'facility_short', 15, 'both', 'Short facility name'),

-- Western Power variations
('WESTERN_POWER', 'utilities', 'WESTERN POWER CORPORATION', 'full_name', 25, 'captive_payments', 'Full corporate name'),
('WESTERN_POWER', 'utilities', 'WESTERN POWER', 'common_name', 20, 'both', 'Common trading name'),
('WESTERN_POWER', 'utilities', 'WPC', 'abbreviation', 15, 'both', 'Corporate abbreviation'),

-- Airport variations
('AIRPORT', 'aviation', 'AU AIRPT PERTH', 'code_format', 25, 'captive_payments', 'Captive payments airport code'),
('AIRPORT', 'aviation', 'PERTH AIRPORT', 'full_name', 20, 'both', 'Full airport name'),
('AIRPORT', 'aviation', 'PERTH INTERNATIONAL AIRPORT', 'official_name', 25, 'both', 'Official airport name'),
('AIRPORT', 'aviation', 'AU AIRPORT PERTH', 'system_format', 20, 'mtdata', 'MTdata airport format'),

-- AWR Forrestfield variations
('AWR_FORRESTFIELD', 'transport', 'AWR FORRESTFIELD T70 CARRIER', 'full_name', 25, 'captive_payments', 'Full AWR Forrestfield name'),
('AWR_FORRESTFIELD', 'transport', 'AWR FORRESTFIELD', 'facility', 20, 'both', 'AWR Forrestfield facility'),
('AWR_FORRESTFIELD', 'transport', 'AWR', 'company', 10, 'both', 'AWR company'),

-- Jundee Mine variations
('JUNDEE_MINE', 'mining', 'JUNDEE MINE – NJE BULK', 'full_name', 25, 'captive_payments', 'Full Jundee mine name'),
('JUNDEE_MINE', 'mining', 'JUNDEE MINE', 'facility', 20, 'both', 'Jundee mine facility'),
('JUNDEE_MINE', 'mining', 'JUNDEE', 'site_name', 15, 'both', 'Mine site name'),
('JUNDEE_MINE', 'mining', 'NJE BULK', 'operator', 10, 'both', 'Mine operator');

-- ============================================================================
-- POPULATE LOCATION NAME ALIASES
-- ============================================================================

-- Insert known location variations
INSERT INTO location_name_aliases (canonical_location, location_type, alias_name, alias_type, region, confidence_boost, notes) VALUES
-- Perth Metro locations
('KWINANA', 'industrial_area', 'KWINANA BEACH', 'area_detail', 'perth_metro', 15, 'Specific beach area in Kwinana'),
('KWINANA', 'industrial_area', 'KWINANA INDUSTRIAL AREA', 'full_name', 'perth_metro', 20, 'Full industrial area name'),
('NAVAL_BASE', 'suburb', 'NAVAL BASE', 'suburb_name', 'perth_metro', 20, 'Perth suburb'),
('FORRESTFIELD', 'suburb', 'FORRESTFIELD', 'suburb_name', 'perth_metro', 20, 'Perth suburb'),

-- Mining regions
('KALGOORLIE', 'city', 'KALGOORLIE-BOULDER', 'official_name', 'goldfields', 20, 'Official city name'),
('KALGOORLIE', 'city', 'KALGOORLIE', 'common_name', 'goldfields', 20, 'Common city name'),
('FIMISTON', 'mine_site', 'FIMISTON', 'mine_site', 'goldfields', 15, 'KCGM mine site'),

-- Regional centers
('GERALDTON', 'city', 'GERALDTON', 'city_name', 'mid_west', 20, 'Mid West regional center'),
('PORT_HEDLAND', 'city', 'PORT HEDLAND', 'city_name', 'pilbara', 20, 'Pilbara port city'),
('NEWMAN', 'town', 'NEWMAN', 'town_name', 'pilbara', 20, 'Pilbara mining town'),
('BROOME', 'city', 'BROOME', 'city_name', 'kimberley', 20, 'Kimberley regional center'),

-- Southern regions
('BUNBURY', 'city', 'BUNBURY', 'city_name', 'south_west', 20, 'South West regional center'),
('ALBANY', 'city', 'ALBANY', 'city_name', 'great_southern', 20, 'Great Southern regional center'),
('ESPERANCE', 'city', 'ESPERANCE', 'city_name', 'goldfields_esperance', 20, 'Goldfields-Esperance port city');

-- ============================================================================
-- POPULATE TERMINAL NAME ALIASES
-- ============================================================================

-- Insert terminal aliases (link to existing terminal_locations)
INSERT INTO terminal_name_aliases (canonical_terminal_name, alias_name, alias_type, confidence_boost, source_system, notes)
SELECT 
  tl.terminal_name,
  'AU TERM ' || UPPER(tl.terminal_name),
  'captive_format',
  25,
  'captive_payments',
  'Captive payments terminal format'
FROM terminal_locations tl
WHERE tl.terminal_name IN ('Kewdale', 'Geraldton', 'Kalgoorlie', 'Esperance', 'Albany', 'Bunbury', 'Fremantle')

UNION ALL

SELECT 
  tl.terminal_name,
  'AU THDPTY ' || UPPER(tl.terminal_name),
  'captive_format_alt',
  25,
  'captive_payments', 
  'Alternative captive payments terminal format'
FROM terminal_locations tl
WHERE tl.terminal_name IN ('Coogee Rockingham')

UNION ALL

-- MTdata format variations
SELECT 
  tl.terminal_name,
  'TERMINAL ' || UPPER(tl.terminal_name),
  'mtdata_format',
  20,
  'mtdata',
  'MTdata terminal format'
FROM terminal_locations tl

UNION ALL

-- Shortened versions
SELECT 
  tl.terminal_name,
  UPPER(tl.terminal_name),
  'short_name',
  15,
  'both',
  'Short terminal name'
FROM terminal_locations tl;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Business aliases indexes
CREATE INDEX idx_business_aliases_canonical ON business_name_aliases(canonical_name);
CREATE INDEX idx_business_aliases_alias ON business_name_aliases(alias_name);
CREATE INDEX idx_business_aliases_type ON business_name_aliases(business_type);

-- Location aliases indexes  
CREATE INDEX idx_location_aliases_canonical ON location_name_aliases(canonical_location);
CREATE INDEX idx_location_aliases_alias ON location_name_aliases(alias_name);
CREATE INDEX idx_location_aliases_region ON location_name_aliases(region);

-- Terminal aliases indexes
CREATE INDEX idx_terminal_aliases_canonical ON terminal_name_aliases(canonical_terminal_name);
CREATE INDEX idx_terminal_aliases_alias ON terminal_name_aliases(alias_name);
CREATE INDEX idx_terminal_aliases_source ON terminal_name_aliases(source_system);

-- ============================================================================
-- LOOKUP FUNCTIONS
-- ============================================================================

-- Function to resolve business name to canonical form
CREATE OR REPLACE FUNCTION resolve_business_name(input_name TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  -- Try exact match first
  SELECT canonical_name INTO result
  FROM business_name_aliases
  WHERE UPPER(alias_name) = UPPER(input_name)
  ORDER BY confidence_boost DESC
  LIMIT 1;
  
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;
  
  -- Try fuzzy match
  SELECT canonical_name INTO result
  FROM business_name_aliases
  WHERE similarity(UPPER(alias_name), UPPER(input_name)) > 0.7
  ORDER BY similarity(UPPER(alias_name), UPPER(input_name)) DESC, confidence_boost DESC
  LIMIT 1;
  
  RETURN COALESCE(result, input_name);
END;
$$ LANGUAGE plpgsql;

-- Function to resolve location name to canonical form
CREATE OR REPLACE FUNCTION resolve_location_name(input_name TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  -- Try exact match first
  SELECT canonical_location INTO result
  FROM location_name_aliases
  WHERE UPPER(alias_name) = UPPER(input_name)
  ORDER BY confidence_boost DESC
  LIMIT 1;
  
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;
  
  -- Try fuzzy match
  SELECT canonical_location INTO result
  FROM location_name_aliases
  WHERE similarity(UPPER(alias_name), UPPER(input_name)) > 0.7
  ORDER BY similarity(UPPER(alias_name), UPPER(input_name)) DESC, confidence_boost DESC
  LIMIT 1;
  
  RETURN COALESCE(result, input_name);
END;
$$ LANGUAGE plpgsql;

-- Function to resolve terminal name to canonical form
CREATE OR REPLACE FUNCTION resolve_terminal_name(input_name TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  -- Try exact match first
  SELECT canonical_terminal_name INTO result
  FROM terminal_name_aliases
  WHERE UPPER(alias_name) = UPPER(input_name)
  ORDER BY confidence_boost DESC
  LIMIT 1;
  
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;
  
  -- Try fuzzy match
  SELECT canonical_terminal_name INTO result
  FROM terminal_name_aliases
  WHERE similarity(UPPER(alias_name), UPPER(input_name)) > 0.7
  ORDER BY similarity(UPPER(alias_name), UPPER(input_name)) DESC, confidence_boost DESC
  LIMIT 1;
  
  RETURN COALESCE(result, input_name);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS AND COMMENTS
-- ============================================================================

-- Grant permissions
GRANT SELECT ON business_name_aliases TO authenticated;
GRANT SELECT ON location_name_aliases TO authenticated;
GRANT SELECT ON terminal_name_aliases TO authenticated;

GRANT EXECUTE ON FUNCTION resolve_business_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_location_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_terminal_name(TEXT) TO authenticated;

-- Add comments
COMMENT ON TABLE business_name_aliases IS 'Lookup table for business name variations and aliases';
COMMENT ON TABLE location_name_aliases IS 'Lookup table for location name variations and aliases';
COMMENT ON TABLE terminal_name_aliases IS 'Lookup table for terminal name variations and aliases';

COMMENT ON FUNCTION resolve_business_name(TEXT) IS 'Resolve business name variant to canonical form';
COMMENT ON FUNCTION resolve_location_name(TEXT) IS 'Resolve location name variant to canonical form';
COMMENT ON FUNCTION resolve_terminal_name(TEXT) IS 'Resolve terminal name variant to canonical form';

SELECT 'Business name variations lookup tables created successfully' as result;