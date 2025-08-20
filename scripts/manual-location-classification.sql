-- Manual Location Classification Helper
-- This script helps you manually classify locations based on your business knowledge
-- Run the queries below to see what needs classification, then update accordingly

-- Step 1: See all locations that need classification
SELECT 
  'Locations Needing Manual Classification' as status,
  location_name,
  location_type,
  is_bp_customer,
  logistics_provider,
  business_relationship,
  CASE 
    WHEN is_bp_customer IS NULL THEN '❌ Needs BP customer classification'
    WHEN logistics_provider IS NULL THEN '❌ Needs logistics provider'
    WHEN business_relationship IS NULL THEN '❌ Needs business relationship'
    ELSE '✅ Fully classified'
  END as classification_status
FROM location_mapping 
WHERE location_type = 'customer'
  AND (is_bp_customer IS NULL 
       OR logistics_provider IS NULL 
       OR business_relationship IS NULL)
ORDER BY location_name;

-- Step 2: Show current classifications for reference
SELECT 
  'Current Classifications' as info,
  location_name,
  location_type,
  is_bp_customer,
  logistics_provider,
  business_relationship,
  parent_company
FROM location_mapping 
WHERE business_relationship IS NOT NULL
ORDER BY business_relationship, location_name;

-- Step 3: Template for manual updates (copy and modify as needed)
/*
-- Example: Classify a Great Southern Fuels depot
UPDATE location_mapping SET 
  is_bp_customer = FALSE,
  logistics_provider = 'Great Southern Fuels',
  business_relationship = 'GSFS Depot'
WHERE location_name = 'LOCATION_NAME_HERE';

-- Example: Classify a BP customer
UPDATE location_mapping SET 
  is_bp_customer = TRUE,
  logistics_provider = 'Stevemacs',
  business_relationship = 'BP Customer via Stevemacs'
WHERE location_name = 'LOCATION_NAME_HERE';

-- Example: Classify a mixed fuel customer
UPDATE location_mapping SET 
  is_bp_customer = TRUE,
  logistics_provider = 'Stevemacs',
  business_relationship = 'Multi-Fuel Customer'
WHERE location_name = 'LOCATION_NAME_HERE';
*/

-- Step 4: Show summary after manual classification
SELECT 
  'Classification Summary' as info,
  business_relationship,
  COUNT(*) as location_count,
  STRING_AGG(location_name, ', ' ORDER BY location_name) as locations
FROM location_mapping 
WHERE business_relationship IS NOT NULL
GROUP BY business_relationship
ORDER BY location_count DESC;

-- Step 5: Show unclassified locations count
SELECT 
  'Unclassified Locations Count' as status,
  COUNT(*) as unclassified_count
FROM location_mapping 
WHERE location_type = 'customer'
  AND (is_bp_customer IS NULL 
       OR logistics_provider IS NULL 
       OR business_relationship IS NULL);
