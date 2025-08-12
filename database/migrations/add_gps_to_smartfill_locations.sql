-- Migration: Add GPS coordinates to SmartFill locations table
-- Enables SmartFill locations to appear on map view
-- Following same precision pattern as agbot_locations table

-- Add GPS coordinate fields to smartfill_locations table
ALTER TABLE smartfill_locations 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8);

-- Add comments for clarity
COMMENT ON COLUMN smartfill_locations.latitude IS 'Latitude coordinate for map display (decimal degrees)';
COMMENT ON COLUMN smartfill_locations.longitude IS 'Longitude coordinate for map display (decimal degrees)';

-- Create index for GPS queries (spatial operations)
CREATE INDEX IF NOT EXISTS idx_smartfill_locations_gps ON smartfill_locations(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Drop and recreate the smartfill_current_status view to include GPS coordinates
-- We need to drop first to avoid column position conflicts
DROP VIEW IF EXISTS smartfill_current_status;

CREATE VIEW smartfill_current_status AS
SELECT 
  l.customer_name,
  l.unit_number,
  l.description as unit_description,
  t.tank_number,
  t.description as tank_description,
  t.capacity,
  t.safe_fill_level,
  t.latest_volume,
  t.latest_volume_percent,
  t.latest_status,
  t.latest_update_time,
  (t.safe_fill_level - t.latest_volume) as ullage,
  CASE 
    WHEN t.latest_volume_percent < 25 THEN 'Low'
    WHEN t.latest_volume_percent < 50 THEN 'Medium'
    ELSE 'Good'
  END as fuel_level_status,
  t.created_at,
  t.updated_at,
  -- GPS coordinates added at the end to avoid column position conflicts
  l.latitude,
  l.longitude
FROM smartfill_locations l
JOIN smartfill_tanks t ON l.id = t.location_id
ORDER BY l.customer_name, l.unit_number, t.tank_number;

-- Drop and recreate system health view to include GPS coverage statistics
-- We need to drop first to avoid column position conflicts
DROP VIEW IF EXISTS smartfill_system_health;

CREATE VIEW smartfill_system_health AS
SELECT 
  COUNT(DISTINCT c.id) as total_customers,
  COUNT(DISTINCT c.id) FILTER (WHERE c.active = true) as active_customers,
  COUNT(DISTINCT l.id) as total_locations,
  COUNT(DISTINCT t.id) as total_tanks,
  COUNT(DISTINCT t.id) FILTER (WHERE t.latest_volume_percent < 25) as tanks_low_fuel,
  COUNT(DISTINCT t.id) FILTER (WHERE t.latest_update_time < NOW() - INTERVAL '24 hours') as tanks_stale_data,
  AVG(t.latest_volume_percent) as avg_fuel_level,
  MAX(sl.completed_at) as last_successful_sync,
  -- GPS coverage statistics added at the end to avoid column position conflicts
  COUNT(DISTINCT l.id) FILTER (WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL) as locations_with_gps
FROM smartfill_customers c
LEFT JOIN smartfill_locations l ON c.id = l.customer_id
LEFT JOIN smartfill_tanks t ON l.id = t.location_id
LEFT JOIN smartfill_sync_logs sl ON sl.sync_status = 'success';

SELECT 'GPS coordinates added to SmartFill locations table successfully' as result;