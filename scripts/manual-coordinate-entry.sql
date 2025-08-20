-- Manual Coordinate Entry Helper
-- Use this to manually add coordinates for locations that don't have them

-- Step 1: Check which locations need coordinates
SELECT 
  'Locations Needing Coordinates' as status,
  location_name,
  location_type,
  business_relationship,
  CASE 
    WHEN latitude IS NULL OR longitude IS NULL THEN '❌ Missing coordinates'
    ELSE '✅ Has coordinates'
  END as coordinate_status
FROM location_mapping 
WHERE latitude IS NULL 
  OR longitude IS NULL
ORDER BY location_name;

-- Step 2: Template for manual coordinate updates
-- Copy and modify these UPDATE statements with actual coordinates

/*
-- Example: Add coordinates for a location
UPDATE location_mapping SET 
  latitude = -31.8324,
  longitude = 115.7649
WHERE location_name = 'LOCATION_NAME_HERE';

-- Example: Add coordinates for multiple locations
UPDATE location_mapping SET 
  latitude = -31.8324,
  longitude = 115.7649
WHERE location_name IN (
  'LOCATION_1',
  'LOCATION_2',
  'LOCATION_3'
);
*/

-- Step 3: Common coordinate patterns (copy and modify as needed)
/*
-- Perth area coordinates (approximate)
UPDATE location_mapping SET 
  latitude = -31.9505,
  longitude = 115.8605
WHERE location_name IN (
  'Perth',
  'Perth Airport',
  'Perth International',
  'Jandakot Airport'
);

-- Kalgoorlie area coordinates (approximate)
UPDATE location_mapping SET 
  latitude = -30.7461,
  longitude = 121.4742
WHERE location_name IN (
  'KCGM Fimiston Fuel Farm',
  'Kalgoorlie'
);

-- Albany area coordinates (approximate)
UPDATE location_mapping SET 
  latitude = -35.0228,
  longitude = 117.8814
WHERE location_name IN (
  'GSFS Albany',
  'Albany'
);

-- Geraldton area coordinates (approximate)
UPDATE location_mapping SET 
  latitude = -28.7786,
  longitude = 114.6146
WHERE location_name IN (
  'BP Terminal Geraldton',
  'Geraldton'
);
*/

-- Step 4: Verify coordinate updates
SELECT 
  'Coordinate Update Verification' as info,
  location_name,
  location_type,
  business_relationship,
  latitude,
  longitude,
  CASE 
    WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN '✅ Updated'
    ELSE '❌ Still missing'
  END as update_status
FROM location_mapping 
ORDER BY location_name;

-- Step 5: Test geospatial matching with sample coordinates
-- Uncomment and run this to test your coordinate matching
/*
-- Test finding nearby locations
SELECT * FROM find_nearby_locations(-31.9505, 115.8605, 50);

-- Test coordinate-based location matching
SELECT 
  'Coordinate-Based Matching Test' as test_type,
  lm1.location_name as location_1,
  lm2.location_name as location_2,
  calculate_distance_km(
    lm1.latitude, lm1.longitude,
    lm2.latitude, lm2.longitude
  ) as distance_km
FROM location_mapping lm1
JOIN location_mapping lm2 ON lm1.location_name < lm2.location_name
WHERE lm1.latitude IS NOT NULL 
  AND lm1.longitude IS NOT NULL
  AND lm2.latitude IS NOT NULL 
  AND lm2.longitude IS NOT NULL
  AND calculate_distance_km(
    lm1.latitude, lm1.longitude,
    lm2.latitude, lm2.longitude
  ) < 1.0  -- Within 1km
ORDER BY distance_km;
*/
