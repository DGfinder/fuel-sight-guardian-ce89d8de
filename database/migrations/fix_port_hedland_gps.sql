-- Fix Port Hedland GPS coordinates
-- Current coordinates (-20.3192, 118.5717) are in the water
-- Correct coordinates are Wilson Street terminal location

-- Update Port Hedland to correct GPS coordinates
UPDATE terminal_locations
SET
  latitude = -20.31337885914364,
  longitude = 118.58269286072687,
  updated_at = NOW()
WHERE terminal_name = 'Port Hedland'
  OR terminal_name ILIKE '%Port Hedland%'
  OR terminal_name ILIKE '%Wilson Street%';

-- Verify the update
SELECT
  terminal_name,
  latitude,
  longitude,
  terminal_type,
  carrier_primary,
  service_radius_km,
  active,
  updated_at
FROM terminal_locations
WHERE terminal_name ILIKE '%Port Hedland%'
   OR terminal_name ILIKE '%Wilson Street%';

-- The location_point and service_area geography fields will be automatically
-- updated by the trigger function update_terminal_location_geography()

COMMENT ON TABLE terminal_locations IS
'Terminal locations with GPS coordinates. Port Hedland updated 2025-11-12
to Wilson Street location (-20.31337885914364, 118.58269286072687).';
