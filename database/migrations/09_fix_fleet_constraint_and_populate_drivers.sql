-- ============================================================================
-- FIX FLEET CONSTRAINT AND POPULATE DRIVERS
-- Update fleet constraint to match CSV data and populate drivers table
-- ============================================================================

-- First, let's update the existing drivers to use the correct fleet names
UPDATE drivers 
SET fleet = 'Great Southern Fuels' 
WHERE fleet = 'Great Southern';

-- Now let's update the constraint to allow both formats
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_fleet_check;

ALTER TABLE drivers ADD CONSTRAINT drivers_fleet_check 
CHECK (fleet IN ('Stevemacs', 'Great Southern Fuels', 'Great Southern'));

-- Let's also check what drivers we currently have
SELECT 
  'Current drivers in database' as status,
  COUNT(*) as total_drivers,
  COUNT(DISTINCT fleet) as total_fleets
FROM drivers;

-- Show fleet breakdown
SELECT 
  fleet,
  COUNT(*) as driver_count
FROM drivers 
GROUP BY fleet 
ORDER BY fleet;

-- Show depot breakdown
SELECT 
  depot,
  COUNT(*) as driver_count
FROM drivers 
GROUP BY depot 
ORDER BY depot;

-- Show name mappings count
SELECT 
  'Name mappings summary' as status,
  COUNT(*) as total_mappings,
  COUNT(DISTINCT driver_id) as drivers_with_mappings,
  COUNT(DISTINCT system_name) as unique_systems
FROM driver_name_mappings;

-- Show system breakdown
SELECT 
  system_name,
  COUNT(*) as mapping_count
FROM driver_name_mappings 
GROUP BY system_name 
ORDER BY mapping_count DESC;

-- Verify the driver_profiles view works
SELECT 
  'Driver profiles view test' as status,
  COUNT(*) as total_profiles
FROM driver_profiles;

-- Show sample driver profiles
SELECT 
  first_name,
  last_name,
  fleet,
  depot,
  status,
  employee_id
FROM drivers 
ORDER BY fleet, last_name 
LIMIT 10;

-- Test the get_drivers_requiring_attention function
SELECT 
  'Testing attention function' as status,
  COUNT(*) as drivers_requiring_attention
FROM get_drivers_requiring_attention();

-- Show sample of drivers requiring attention (if any)
SELECT 
  first_name,
  last_name,
  fleet,
  depot,
  overall_safety_score,
  lytx_events,
  guardian_events,
  high_risk_events
FROM get_drivers_requiring_attention() 
LIMIT 5;

-- Update the constraint to be more restrictive (only allow the correct names)
UPDATE drivers 
SET fleet = 'Great Southern Fuels' 
WHERE fleet = 'Great Southern';

-- Now set the final constraint
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_fleet_check;
ALTER TABLE drivers ADD CONSTRAINT drivers_fleet_check 
CHECK (fleet IN ('Stevemacs', 'Great Southern Fuels'));

-- Final verification
SELECT 
  'Final verification' as status,
  COUNT(*) as total_drivers,
  COUNT(DISTINCT fleet) as total_fleets,
  COUNT(CASE WHEN fleet = 'Stevemacs' THEN 1 END) as steevemacs_count,
  COUNT(CASE WHEN fleet = 'Great Southern Fuels' THEN 1 END) as gsf_count
FROM drivers;

SELECT 'Fleet constraint fixed and drivers populated successfully' as result;
