-- ============================================================================
-- MIGRATE COORDINATES FROM fuel_tanks TO ta_locations
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Diagnostic - Check current state
SELECT 'Current ta_tanks state:' as info;
SELECT
    COUNT(*) as total_tanks,
    COUNT(location_id) as with_location_id,
    COUNT(*) - COUNT(location_id) as without_location_id
FROM ta_tanks WHERE archived_at IS NULL;

SELECT 'Current ta_locations state:' as info;
SELECT
    COUNT(*) as total_locations,
    COUNT(*) FILTER (WHERE latitude IS NOT NULL) as with_coords,
    COUNT(*) FILTER (WHERE latitude IS NULL) as without_coords
FROM ta_locations;

SELECT 'fuel_tanks with coordinates:' as info;
SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) as with_coords
FROM fuel_tanks WHERE status = 'active';

-- Step 2: Create ta_locations for tanks that have coordinates in fuel_tanks
-- but don't have a matching ta_locations entry yet
INSERT INTO ta_locations (name, address, latitude, longitude, business_id, created_at, updated_at)
SELECT DISTINCT ON (ft.location)
    ft.location as name,
    ft.address,
    ft.latitude,
    ft.longitude,
    t.business_id,
    NOW() as created_at,
    NOW() as updated_at
FROM fuel_tanks ft
JOIN ta_tanks t ON t.name = ft.location
WHERE ft.latitude IS NOT NULL
  AND ft.longitude IS NOT NULL
  AND ft.status = 'active'
  AND t.location_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM ta_locations loc WHERE loc.name = ft.location
  )
ORDER BY ft.location, ft.created_at DESC
ON CONFLICT DO NOTHING;

SELECT 'Created new ta_locations entries:' as info;
SELECT COUNT(*) as new_locations_created
FROM ta_locations
WHERE created_at > NOW() - INTERVAL '1 minute';

-- Step 3: Update ta_tanks.location_id to link to matching ta_locations
UPDATE ta_tanks t
SET location_id = loc.id,
    updated_at = NOW()
FROM ta_locations loc
WHERE t.name = loc.name
  AND t.location_id IS NULL
  AND loc.latitude IS NOT NULL
  AND t.archived_at IS NULL;

SELECT 'Updated ta_tanks with location_id:' as info;
SELECT
    COUNT(*) as total_tanks,
    COUNT(location_id) as with_location_id,
    COUNT(*) - COUNT(location_id) as still_without_location_id
FROM ta_tanks WHERE archived_at IS NULL;

-- Step 4: Update existing ta_locations with coordinates from fuel_tanks
-- (for locations that exist but don't have coordinates)
UPDATE ta_locations loc
SET
    latitude = ft.latitude,
    longitude = ft.longitude,
    address = COALESCE(loc.address, ft.address),
    updated_at = NOW()
FROM fuel_tanks ft
WHERE loc.name = ft.location
  AND loc.latitude IS NULL
  AND ft.latitude IS NOT NULL
  AND ft.longitude IS NOT NULL
  AND ft.status = 'active';

SELECT 'Updated existing ta_locations with coordinates:' as info;
SELECT
    COUNT(*) as total_locations,
    COUNT(*) FILTER (WHERE latitude IS NOT NULL) as with_coords_after,
    COUNT(*) FILTER (WHERE latitude IS NULL) as without_coords_after
FROM ta_locations;

-- Step 5: Verify unified map view now works
SELECT 'Testing unified map view:' as info;
SELECT
    source,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE latitude IS NOT NULL) as with_coords
FROM ta_unified_map_locations
GROUP BY source
ORDER BY source;

-- Step 6: Show sample data from unified view
SELECT 'Sample data from unified view:' as info;
SELECT source, location, latitude, longitude, current_level_percent, urgency_status
FROM ta_unified_map_locations
ORDER BY source, location
LIMIT 10;
