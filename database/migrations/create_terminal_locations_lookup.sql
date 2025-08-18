-- ============================================================================
-- TERMINAL LOCATIONS LOOKUP TABLE
-- For MTdata trip to captive payments correlation matching
-- ============================================================================

-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Drop existing table if it exists
DROP TABLE IF EXISTS terminal_locations CASCADE;

-- Create terminal locations lookup table
CREATE TABLE terminal_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Terminal identification
  terminal_name TEXT NOT NULL UNIQUE,
  terminal_code TEXT, -- Optional short code
  
  -- Geographic data
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  location_point GEOGRAPHY(POINT, 4326), -- PostGIS point for spatial queries
  
  -- Terminal details
  carrier_primary TEXT, -- Primary carrier (SMB/GSF)
  terminal_type TEXT DEFAULT 'Fuel Loading Terminal',
  active BOOLEAN DEFAULT TRUE,
  
  -- Service area (for proximity matching)
  service_radius_km INTEGER DEFAULT 50, -- Default 50km service radius
  service_area GEOGRAPHY(POLYGON, 4326), -- Circular service area polygon
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Insert known terminal coordinates from existing codebase
INSERT INTO terminal_locations (
  terminal_name,
  latitude,
  longitude,
  carrier_primary,
  terminal_type,
  service_radius_km
) VALUES
  -- Primary SMB/GSF Terminals
  ('Kewdale', -31.981076196850736, 115.9723248550286, 'SMB', 'Primary Fuel Terminal', 75),
  ('Geraldton', -28.78226543395978, 114.59626791553842, 'GSF', 'Regional Fuel Terminal', 100),
  ('Kalgoorlie', -30.778741698920648, 121.42510090094386, 'Combined', 'Mining Region Terminal', 150),
  ('Coogee Rockingham', -32.2233144927088, 115.75948393680929, 'SMB', 'Industrial Terminal', 50),
  
  -- Secondary Terminals
  ('Merredin', -31.483243328052218, 118.2526964695131, 'GSF', 'Regional Terminal', 80),
  ('Albany', -34.954554508791155, 117.88980579777935, 'GSF', 'Southern Terminal', 120),
  ('Wongan Hills', -30.89780974646496, 116.71992488536, 'GSF', 'Regional Terminal', 60),
  
  -- Extended GSF Network
  ('Esperance', -33.8614, 121.8910, 'GSF', 'Coastal Terminal', 100),
  ('Port Hedland', -20.3192, 118.5717, 'GSF', 'Port Terminal', 200),
  ('Karratha', -20.7364, 116.8460, 'GSF', 'Industrial Terminal', 150),
  ('Newman', -23.3586, 119.7372, 'GSF', 'Mining Terminal', 100),
  ('Broome', -17.9644, 122.2304, 'GSF', 'Remote Terminal', 250);

-- Create function to populate geography fields
CREATE OR REPLACE FUNCTION update_terminal_geography()
RETURNS TRIGGER AS $$
BEGIN
  -- Create PostGIS point from coordinates
  NEW.location_point = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  
  -- Create circular service area polygon
  NEW.service_area = ST_Buffer(NEW.location_point, NEW.service_radius_km * 1000); -- Convert km to meters
  
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update geography fields
CREATE TRIGGER trigger_update_terminal_geography
  BEFORE INSERT OR UPDATE ON terminal_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_terminal_geography();

-- Update existing records to populate geography fields
UPDATE terminal_locations SET updated_at = NOW();

-- Create indexes for performance
CREATE INDEX idx_terminal_locations_name ON terminal_locations(terminal_name);
CREATE INDEX idx_terminal_locations_carrier ON terminal_locations(carrier_primary);
CREATE INDEX idx_terminal_locations_active ON terminal_locations(active);

-- Spatial indexes for geographic queries
CREATE INDEX idx_terminal_locations_point ON terminal_locations USING GIST(location_point);
CREATE INDEX idx_terminal_locations_service_area ON terminal_locations USING GIST(service_area);

-- ============================================================================
-- UTILITY FUNCTIONS FOR TERMINAL MATCHING
-- ============================================================================

-- Function to find terminals within distance of a point
CREATE OR REPLACE FUNCTION find_terminals_near_point(
  input_latitude DECIMAL(10, 8),
  input_longitude DECIMAL(11, 8),
  max_distance_km INTEGER DEFAULT 50
)
RETURNS TABLE (
  terminal_name TEXT,
  distance_km DECIMAL(8,2),
  carrier_primary TEXT,
  within_service_area BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tl.terminal_name,
    (ST_Distance(
      tl.location_point,
      ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography
    ) / 1000)::DECIMAL(8,2) AS distance_km,
    tl.carrier_primary,
    ST_Within(
      ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography,
      tl.service_area
    ) AS within_service_area
  FROM terminal_locations tl
  WHERE tl.active = TRUE
    AND ST_DWithin(
      tl.location_point,
      ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography,
      max_distance_km * 1000 -- Convert km to meters
    )
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to find nearest terminal to a point
CREATE OR REPLACE FUNCTION find_nearest_terminal(
  input_latitude DECIMAL(10, 8),
  input_longitude DECIMAL(11, 8)
)
RETURNS TABLE (
  terminal_name TEXT,
  distance_km DECIMAL(8,2),
  carrier_primary TEXT,
  within_service_area BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tl.terminal_name,
    (ST_Distance(
      tl.location_point,
      ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography
    ) / 1000)::DECIMAL(8,2) AS distance_km,
    tl.carrier_primary,
    ST_Within(
      ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography,
      tl.service_area
    ) AS within_service_area
  FROM terminal_locations tl
  WHERE tl.active = TRUE
  ORDER BY tl.location_point <-> ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to match terminal by fuzzy name
CREATE OR REPLACE FUNCTION match_terminal_by_name(
  input_name TEXT
)
RETURNS TABLE (
  terminal_name TEXT,
  similarity_score REAL,
  exact_match BOOLEAN
) AS $$
BEGIN
  -- Enable fuzzy string matching
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  
  RETURN QUERY
  WITH terminal_matches AS (
    SELECT 
      tl.terminal_name,
      similarity(LOWER(tl.terminal_name), LOWER(input_name)) as sim_score,
      LOWER(tl.terminal_name) = LOWER(input_name) as is_exact
    FROM terminal_locations tl
    WHERE tl.active = TRUE
  )
  SELECT 
    tm.terminal_name,
    tm.sim_score,
    tm.is_exact
  FROM terminal_matches tm
  WHERE tm.sim_score > 0.3 OR tm.is_exact
  ORDER BY tm.is_exact DESC, tm.sim_score DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON terminal_locations TO authenticated;
GRANT EXECUTE ON FUNCTION find_terminals_near_point(DECIMAL, DECIMAL, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION find_nearest_terminal(DECIMAL, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION match_terminal_by_name(TEXT) TO authenticated;

-- Add comments
COMMENT ON TABLE terminal_locations IS 'Lookup table for terminal GPS coordinates used in MTdata trip to captive payments correlation';
COMMENT ON FUNCTION find_terminals_near_point(DECIMAL, DECIMAL, INTEGER) IS 'Find all terminals within specified distance of coordinates';
COMMENT ON FUNCTION find_nearest_terminal(DECIMAL, DECIMAL) IS 'Find the single nearest terminal to coordinates';
COMMENT ON FUNCTION match_terminal_by_name(TEXT) IS 'Fuzzy match terminal names for correlation analysis';

SELECT 'Terminal locations lookup table created successfully' as result;