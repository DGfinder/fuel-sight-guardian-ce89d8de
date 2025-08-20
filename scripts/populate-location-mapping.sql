-- Comprehensive Location Mapping Population Script
-- This script populates the location_mapping table with all locations
-- from both MTdata trips and captive payments, properly categorized

-- Step 1: Insert all customers from captive payments
INSERT INTO location_mapping (location_name, location_type, related_names)
SELECT DISTINCT 
  customer,
  'customer',
  ARRAY[customer]
FROM captive_payment_records 
WHERE customer IS NOT NULL 
  AND customer != ''
  AND customer NOT IN (SELECT location_name FROM location_mapping)
ON CONFLICT (location_name) DO NOTHING;

-- Step 2: Insert all MTdata locations (start and end locations)
INSERT INTO location_mapping (location_name, location_type, related_names)
SELECT DISTINCT 
  location_name,
  'other', -- We'll update these to proper types later
  ARRAY[location_name]
FROM (
  SELECT start_location as location_name FROM mtdata_trip_history WHERE start_location IS NOT NULL AND start_location != ''
  UNION
  SELECT end_location as location_name FROM mtdata_trip_history WHERE end_location IS NOT NULL AND end_location != ''
) all_locations
WHERE location_name NOT IN (SELECT location_name FROM location_mapping)
ON CONFLICT (location_name) DO NOTHING;

-- Step 3: Update known terminals
UPDATE location_mapping SET 
  location_type = 'terminal',
  parent_company = 'ATOM'
WHERE location_name LIKE '%ATOM%' OR location_name LIKE '%AU TERM%';

UPDATE location_mapping SET 
  location_type = 'terminal',
  parent_company = 'BP'
WHERE location_name LIKE '%BP%' AND location_name NOT LIKE '%BP The Lakes%';

UPDATE location_mapping SET 
  location_type = 'terminal',
  parent_company = 'GSFS'
WHERE location_name LIKE 'GSFS%';

UPDATE location_mapping SET 
  location_type = 'terminal',
  parent_company = 'AU THDPTY'
WHERE location_name LIKE 'AU THDPTY%';

-- Step 4: Update known depots
UPDATE location_mapping SET 
  location_type = 'depot',
  parent_company = 'Stevemacs'
WHERE location_name IN (
  'Berkshire Road Yard',
  'Narrogin- Depot',
  'Katanning',
  'Merredin',
  'Forrestfield'
);

-- Step 5: Update specific location types based on business logic
UPDATE location_mapping SET 
  location_type = 'terminal',
  parent_company = 'BP'
WHERE location_name = 'BP The Lakes';

UPDATE location_mapping SET 
  location_type = 'terminal',
  parent_company = 'Castrol'
WHERE location_name LIKE '%Castrol%';

UPDATE location_mapping SET 
  location_type = 'terminal',
  parent_company = 'Coogee'
WHERE location_name LIKE '%Coogee%';

-- Step 6: Add related names for better fuzzy matching
UPDATE location_mapping SET 
  related_names = ARRAY['AU TERM KEWDALE', 'Kewdale Terminal', 'ATOM Kewdale', 'ATOM Terminal']
WHERE location_name = 'ATOM Terminal Kewdale';

UPDATE location_mapping SET 
  related_names = ARRAY['BERKSHIRE ROAD DEPOT', 'Stevemacs Depot', 'Berkshire Yard', 'Stevemacs Yard']
WHERE location_name = 'Berkshire Road Yard';

UPDATE location_mapping SET 
  related_names = ARRAY['BP TERM KEWDALE', 'Kewdale BP', 'BP Terminal']
WHERE location_name = 'BP Kewdale';

UPDATE location_mapping SET 
  related_names = ARRAY['GSFS CARNAMAH', 'Carnamah Terminal', 'GSFS Terminal']
WHERE location_name = 'GSFS Carnamah';

UPDATE location_mapping SET 
  related_names = ARRAY['GSFS NARROGIN', 'Narrogin Terminal', 'GSFS Terminal']
WHERE location_name = 'GSFS Narrogin';

UPDATE location_mapping SET 
  related_names = ARRAY['GSFS MERREDIN', 'Merredin Terminal', 'GSFS Terminal']
WHERE location_name = 'GSFS Merredin';

-- Step 7: Add coordinates for key locations (if available)
-- Note: You can add coordinates manually for important locations
-- UPDATE location_mapping SET coordinates = point(-31.98112000, 115.97242000) WHERE location_name = 'ATOM Terminal Kewdale';
-- UPDATE location_mapping SET coordinates = point(-31.96485000, 115.99910000) WHERE location_name = 'Berkshire Road Yard';

-- Step 8: Set service areas for terminals and depots
UPDATE location_mapping SET 
  service_area_km = 150
WHERE location_type IN ('terminal', 'depot');

-- Step 9: Show summary of what was created
SELECT 
  location_type,
  COUNT(*) as location_count,
  STRING_AGG(location_name, ', ' ORDER BY location_name) as sample_locations
FROM location_mapping 
GROUP BY location_type
ORDER BY location_type;

-- Step 10: Show locations that still need categorization
SELECT 
  'Locations needing categorization' as status,
  location_name,
  location_type,
  parent_company
FROM location_mapping 
WHERE location_type = 'other'
ORDER BY location_name;
