-- Location Classification Template
-- Copy and modify these UPDATE statements based on your business knowledge
-- Then run them to classify your locations

-- ========================================
-- GREAT SOUTHERN FUELS (GSFS) DEPOTS
-- ========================================
/*
UPDATE location_mapping SET 
  is_bp_customer = FALSE,
  logistics_provider = 'Great Southern Fuels',
  business_relationship = 'GSFS Depot'
WHERE location_name IN (
  'GSFS Albany',
  'GSFS Katanning', 
  'GSFS Lake Grace',
  'GSFS Carnamah',
  'GSFS Merredin',
  'GSFS Narrogin'
  -- Add more GSFS depots here
);
*/

-- ========================================
-- TERMINALS (Fuel Sources)
-- ========================================
/*
-- Coogee Terminal (was incorrectly classified as customer)
UPDATE location_mapping SET 
  location_type = 'terminal',
  is_bp_customer = FALSE,
  logistics_provider = 'Coogee',
  business_relationship = 'Fuel Terminal',
  parent_company = 'Coogee'
WHERE location_name = 'Coogee Chemicals';

-- Other terminals that might need reclassification
UPDATE location_mapping SET 
  location_type = 'terminal',
  is_bp_customer = FALSE,
  logistics_provider = 'Castrol',
  business_relationship = 'Fuel Terminal',
  parent_company = 'Castrol'
WHERE location_name = 'Castrol North Fremantle (Lubes)';
*/

-- ========================================
-- BP CUSTOMERS (via Stevemacs)
-- ========================================
/*
UPDATE location_mapping SET 
  is_bp_customer = TRUE,
  logistics_provider = 'Stevemacs',
  business_relationship = 'BP Customer via Stevemacs'
WHERE location_name IN (
  'TALISON LITHIUM MSA TSF LV',
  'KCGM Fimiston Fuel Farm',
  'RAAF Pearce',
  'Jandakot Airport',
  'Perth International',
  'Perth Airport',
  'Outback Travelstop Carnarvon',
  'North West Coastal Hwy,Alma',
  'BP The Lakes',
  'AWR Forrestfield Main Tank',
  'Stevemacs Glassford Rd'
  -- Add more BP customers here
);
*/

-- ========================================
-- ATOM CUSTOMERS (via Stevemacs)
-- ========================================
/*
UPDATE location_mapping SET 
  is_bp_customer = FALSE,
  logistics_provider = 'Stevemacs',
  business_relationship = 'ATOM Customer via Stevemacs'
WHERE location_name IN (
  'SYNERGY PINJAR (STEVEMACS)',
  'EMR GOLDEN GROVE',
  '286 Stirling Cres,Hazelmere',
  '961-963 Abernethy Rd,High Wycombe',
  'Greenmount Safety Stop',
  'Rakichs',
  'Welshpool'
  -- Add more ATOM customers here
);
*/

-- ========================================
-- MIXED FUEL CUSTOMERS (Multiple terminals)
-- ========================================
/*
UPDATE location_mapping SET 
  is_bp_customer = TRUE,
  logistics_provider = 'Stevemacs',
  business_relationship = 'Multi-Fuel Customer'
WHERE location_name IN (
  'Forrestfield',
  'Latham',
  'Rothsay',
  'Forrest Hwy,Myalup',
  'Great Northern Hwy,Walebing',
  '12 Park Dr,Dalwallinu',
  'Karara Rd,Rothsay',
  'Midlands Rd,Carnamah',
  '157 Gardiner St,Moora',
  '160 Wongan Rd,Wongan Hills'
  -- Add more mixed fuel customers here
);
*/

-- ========================================
-- OTHER CATEGORIES (Add as needed)
-- ========================================
/*
-- Example: Independent customers
UPDATE location_mapping SET 
  is_bp_customer = FALSE,
  logistics_provider = 'Independent',
  business_relationship = 'Independent Customer'
WHERE location_name IN (
  -- Add independent customers here
);

-- Example: Government/Defense customers
UPDATE location_mapping SET 
  is_bp_customer = TRUE,
  logistics_provider = 'Stevemacs',
  business_relationship = 'Government/Defense Customer'
WHERE location_name IN (
  -- Add government/defense customers here
);
*/

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check classification progress
SELECT 
  'Classification Progress' as status,
  COUNT(*) as total_customers,
  COUNT(*) FILTER (WHERE business_relationship IS NOT NULL) as classified,
  COUNT(*) FILTER (WHERE business_relationship IS NULL) as unclassified,
  ROUND(
    (COUNT(*) FILTER (WHERE business_relationship IS NOT NULL)::DECIMAL / COUNT(*)) * 100, 1
  ) as completion_percentage
FROM location_mapping 
WHERE location_type = 'customer';

-- Show unclassified locations
SELECT 
  'Still Need Classification' as status,
  location_name
FROM location_mapping 
WHERE location_type = 'customer'
  AND business_relationship IS NULL
ORDER BY location_name;

-- Show terminals for verification
SELECT 
  'Terminal Classifications' as info,
  location_name,
  location_type,
  is_bp_customer,
  logistics_provider,
  business_relationship,
  parent_company
FROM location_mapping 
WHERE location_type = 'terminal'
ORDER BY location_name;
