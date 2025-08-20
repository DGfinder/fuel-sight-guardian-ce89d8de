-- Add Coordinates to Location Mapping
-- This script adds lat/long columns and populates them from MTdata trip history coordinates

-- Step 1: Add coordinate columns if they don't exist
ALTER TABLE location_mapping 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(12,8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(12,8);

-- Step 2: Create a simple index on coordinates for faster queries
CREATE INDEX IF NOT EXISTS idx_location_mapping_coordinates 
ON location_mapping (latitude, longitude);

-- Step 3: Populate coordinates from MTdata trip history start locations
UPDATE location_mapping 
SET 
  latitude = mth.start_latitude,
  longitude = mth.start_longitude
FROM mtdata_trip_history mth
WHERE location_mapping.location_name = mth.start_location
  AND mth.start_latitude IS NOT NULL 
  AND mth.start_longitude IS NOT NULL
  AND location_mapping.latitude IS NULL;

-- Step 4: Populate coordinates from MTdata trip history end locations
UPDATE location_mapping 
SET 
  latitude = mth.end_latitude,
  longitude = mth.end_longitude
FROM mtdata_trip_history mth
WHERE location_mapping.location_name = mth.end_location
  AND mth.end_latitude IS NOT NULL 
  AND mth.end_longitude IS NOT NULL
  AND location_mapping.latitude IS NULL;

-- Step 5: Show current coordinate coverage
SELECT 
  'Coordinate Coverage Status' as info,
  COUNT(*) as total_locations,
  COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) as with_coordinates,
  COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL) as missing_coordinates,
  ROUND(
    (COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::DECIMAL / COUNT(*)) * 100, 1
  ) as coordinate_coverage_percentage
FROM location_mapping;

-- Step 6: Show locations that need coordinates
SELECT 
  'Locations Needing Coordinates' as status,
  location_name,
  location_type
FROM location_mapping 
WHERE latitude IS NULL 
  OR longitude IS NULL
ORDER BY location_name;

-- Step 7: Show sample of locations with coordinates
SELECT 
  'Sample Locations with Coordinates' as info,
  location_name,
  location_type,
  latitude,
  longitude
FROM location_mapping 
WHERE latitude IS NOT NULL 
  AND longitude IS NOT NULL
ORDER BY location_name
LIMIT 10;

-- Step 8: Create a function to find nearby locations using simple distance calculation
CREATE OR REPLACE FUNCTION find_nearby_locations(
  p_latitude DECIMAL(12,8),
  p_longitude DECIMAL(12,8),
  p_max_distance_km INTEGER DEFAULT 10
)
RETURNS TABLE (
  location_name TEXT,
  distance_km DECIMAL(10,2),
  location_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lm.location_name,
    SQRT(
      POWER((lm.latitude - p_latitude) * 111.32, 2) + 
      POWER((lm.longitude - p_longitude) * 111.32 * COS(RADIANS(p_latitude)), 2)
    ) as distance_km,
    lm.location_type
  FROM location_mapping lm
  WHERE lm.latitude IS NOT NULL 
    AND lm.longitude IS NOT NULL
    AND SQRT(
      POWER((lm.latitude - p_latitude) * 111.32, 2) + 
      POWER((lm.longitude - p_longitude) * 111.32 * COS(RADIANS(p_latitude)), 2)
    ) <= p_max_distance_km
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Create a function to calculate distance between two locations
CREATE OR REPLACE FUNCTION calculate_distance_km(
  lat1 DECIMAL(12,8),
  lon1 DECIMAL(12,8),
  lat2 DECIMAL(12,8),
  lon2 DECIMAL(12,8)
)
RETURNS DECIMAL(10,2) AS $$
BEGIN
  -- Simple distance calculation using Haversine formula approximation
  -- 1 degree latitude ≈ 111.32 km
  -- 1 degree longitude ≈ 111.32 * cos(latitude) km
  RETURN SQRT(
    POWER((lat2 - lat1) * 111.32, 2) + 
    POWER((lon2 - lon1) * 111.32 * COS(RADIANS(lat1)), 2)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 10: Show what tables exist and their structure for reference
SELECT 
  'Available Tables' as info,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%trip%' 
  OR table_name LIKE '%payment%'
  OR table_name LIKE '%location%'
ORDER BY table_name;

-- Step 11: Test the nearby locations function (will return empty until coordinates are added)
-- Uncomment and run this to test (replace with actual coordinates)
/*
SELECT * FROM find_nearby_locations(-31.8324, 115.7649, 50);
*/
