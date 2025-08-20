-- Simple Location List from MTdata Trips
-- Just the location names, one per line, for easy copying

-- Option 1: Simple list of all unique locations
SELECT DISTINCT start_location as location_name
FROM mtdata_trip_history 
WHERE start_location IS NOT NULL 
  AND start_location != ''
ORDER BY start_location;

-- Option 2: All unique locations (both start and end)
SELECT DISTINCT location_name
FROM (
  SELECT start_location as location_name FROM mtdata_trip_history WHERE start_location IS NOT NULL AND start_location != ''
  UNION
  SELECT end_location as location_name FROM mtdata_trip_history WHERE end_location IS NOT NULL AND end_location != ''
) all_locations
ORDER BY location_name;

-- Option 3: Locations with trip counts (most active first)
SELECT 
  location_name,
  COUNT(*) as trip_count
FROM (
  SELECT start_location as location_name FROM mtdata_trip_history WHERE start_location IS NOT NULL AND start_location != ''
  UNION ALL
  SELECT end_location as location_name FROM mtdata_trip_history WHERE end_location IS NOT NULL AND end_location != ''
) all_locations
GROUP BY location_name
ORDER BY trip_count DESC, location_name;

-- Option 4: Start vs End location analysis
SELECT 
  'Start Locations' as location_type,
  start_location as location_name,
  COUNT(*) as trip_count
FROM mtdata_trip_history 
WHERE start_location IS NOT NULL 
  AND start_location != ''
GROUP BY start_location
ORDER BY trip_count DESC, start_location;

SELECT 
  'End Locations' as location_type,
  end_location as location_name,
  COUNT(*) as trip_count
FROM mtdata_trip_history 
WHERE end_location IS NOT NULL 
  AND end_location != ''
GROUP BY end_location
ORDER BY trip_count DESC, end_location;
