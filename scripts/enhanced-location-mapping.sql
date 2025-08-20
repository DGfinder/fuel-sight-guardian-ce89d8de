-- Enhanced Location Mapping with BP Customer Classification
-- This script handles the complex business relationships in third-party logistics

-- Step 1: Add BP customer classification column if it doesn't exist
ALTER TABLE location_mapping 
ADD COLUMN IF NOT EXISTS is_bp_customer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS logistics_provider TEXT,
ADD COLUMN IF NOT EXISTS business_relationship TEXT;

-- Step 2: Update existing customer locations with BP customer status
-- Based on captive payment patterns and business knowledge
UPDATE location_mapping SET 
  is_bp_customer = TRUE,
  logistics_provider = 'Stevemacs',
  business_relationship = 'BP Customer'
WHERE location_name IN (
  -- Known BP customers from previous analysis
  'SYNERGY PINJAR (STEVEMACS)',
  'TALISON LITHIUM MSA TSF LV',
  'EMR GOLDEN GROVE',
  'RAAF Pearce',
  'KCGM Fimiston Fuel Farm',
  'Karara Mining BIS Tank',
  'Karara Mining Tanks 1, 2 & 3',
  'AWR Forrestfield Main Tank',
  'Castrol North Fremantle (Lubes)',
  'Coogee Chemicals',
  'Rakichs',
  '286 Stirling Cres,Hazelmere',
  '961-963 Abernethy Rd,High Wycombe',
  'Greenmount Safety Stop',
  'BP The Lakes',
  'Outback Travelstop Carnarvon',
  'North West Coastal Hwy,Alma',
  '78 Wallering Rd,Granville',
  '1014 North West Coastal Hwy,Brown Range',
  'Sea Harvest Exmouth',
  'Jandakot Airport',
  'Perth International',
  'Perth Airport',
  'Mount Barker',
  'Marradong',
  'Clackline',
  'Brookdale',
  'Narrogin',
  'Yornaning',
  'Yorlok',
  'Moora',
  'Quairading-York Rd,Quairading',
  '9 West Kalgoorlie Rd,West Kalgoorlie',
  'Emu Point',
  'GSFS Albany',
  'GSFS Katanning',
  'GSFS Lake Grace',
  'GSFS Carnamah',
  'GSFS Merredin',
  'GSFS Narrogin',
  'BP Terminal Geraldton',
  'Rothsay Mine Site',
  'Latham',
  'Rothsay',
  'Forrest Hwy,Myalup',
  'Welshpool',
  'Forrestfield',
  'Illawong',
  'Great Northern Hwy,Walebing',
  '12 Park Dr,Dalwallinu',
  'Karara Rd,Rothsay',
  'Stevemacs Glassford Rd',
  'Midlands Rd,Carnamah',
  '157 Gardiner St,Moora',
  '160 Wongan Rd,Wongan Hills'
);

-- Step 3: Update logistics provider information for terminals
UPDATE location_mapping SET 
  logistics_provider = 'Stevemacs',
  business_relationship = 'Fuel Terminal'
WHERE location_type = 'terminal';

-- Step 4: Update depot information
UPDATE location_mapping SET 
  logistics_provider = 'Stevemacs',
  business_relationship = 'Stevemacs Depot'
WHERE location_type = 'depot';

-- Step 5: Add more specific BP customer classifications
-- These are customers that specifically use BP fuel through Stevemacs
UPDATE location_mapping SET 
  is_bp_customer = TRUE,
  logistics_provider = 'Stevemacs',
  business_relationship = 'BP Customer via Stevemacs'
WHERE location_name IN (
  -- Mining and industrial customers
  'TALISON LITHIUM MSA TSF LV',
  'KCGM Fimiston Fuel Farm',
  'Karara Mining BIS Tank',
  'Karara Mining Tanks 1, 2 & 3',
  'Rothsay Mine Site',
  
  -- Government and defense
  'RAAF Pearce',
  'Jandakot Airport',
  'Perth International',
  'Perth Airport',
  
  -- Commercial and retail
  'Outback Travelstop Carnarvon',
  'North West Coastal Hwy,Alma',
  'BP The Lakes',
  'Castrol North Fremantle (Lubes)',
  
  -- Industrial and manufacturing
  'Coogee Chemicals',
  'AWR Forrestfield Main Tank',
  'Stevemacs Glassford Rd'
);

-- Step 6: Add ATOM-specific customer classifications
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
);

-- Step 7: Add GSFS-specific customer classifications
UPDATE location_mapping SET 
  is_bp_customer = FALSE,
  logistics_provider = 'Stevemacs',
  business_relationship = 'GSFS Customer via Stevemacs'
WHERE location_name IN (
  'Mount Barker',
  'Marradong',
  'Clackline',
  'Brookdale',
  'Narrogin',
  'Yornaning',
  'Yorlok',
  'Moora',
  'Quairading-York Rd,Quairading',
  '9 West Kalgoorlie Rd,West Kalgoorlie',
  'Emu Point',
  'GSFS Albany',
  'GSFS Katanning',
  'GSFS Lake Grace',
  'GSFS Carnamah',
  'GSFS Merredin',
  'GSFS Narrogin'
);

-- Step 8: Add mixed fuel source customers (those using multiple terminals)
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
);

-- Step 9: Add related names for better fuzzy matching with business context
UPDATE location_mapping SET 
  related_names = ARRAY['SYNERGY PINJAR', 'PINJAR POWER STATION', 'SYNERGY', 'BP Customer']
WHERE location_name = 'SYNERGY PINJAR (STEVEMACS)';

UPDATE location_mapping SET 
  related_names = ARRAY['TALISON LITHIUM', 'MSA TSF LV', 'TALISON', 'BP Customer']
WHERE location_name = 'TALISON LITHIUM MSA TSF LV';

UPDATE location_mapping SET 
  related_names = ARRAY['EMR GOLDEN GROVE', 'GOLDEN GROVE', 'EMR', 'BP Customer']
WHERE location_name = 'EMR GOLDEN GROVE';

UPDATE location_mapping SET 
  related_names = ARRAY['RAAF PEARCE', 'PEARCE AIR BASE', 'RAAF', 'Defense', 'BP Customer']
WHERE location_name = 'RAAF Pearce';

UPDATE location_mapping SET 
  related_names = ARRAY['KCGM FIMISTON', 'FIMISTON', 'KCGM', 'Mining', 'BP Customer']
WHERE location_name = 'KCGM Fimiston Fuel Farm';

-- Step 10: Show enhanced mapping summary
SELECT 
  'Enhanced Location Mapping Summary' as info,
  location_type,
  COUNT(*) as total_locations,
  COUNT(*) FILTER (WHERE is_bp_customer = TRUE) as bp_customers,
  COUNT(*) FILTER (WHERE logistics_provider = 'Stevemacs') as stevemacs_managed,
  STRING_AGG(
    CASE WHEN is_bp_customer = TRUE THEN location_name || ' (BP)' ELSE location_name END, 
    ', ' ORDER BY location_name
  ) as sample_locations
FROM location_mapping 
GROUP BY location_type
ORDER BY location_type;

-- Step 11: Show BP customer breakdown
SELECT 
  'BP Customer Analysis' as info,
  business_relationship,
  COUNT(*) as customer_count,
  STRING_AGG(location_name, ', ' ORDER BY location_name) as customers
FROM location_mapping 
WHERE is_bp_customer = TRUE
GROUP BY business_relationship
ORDER BY customer_count DESC;

-- Step 12: Show locations still needing classification
SELECT 
  'Locations Needing Classification' as status,
  location_name,
  location_type,
  is_bp_customer,
  logistics_provider,
  business_relationship
FROM location_mapping 
WHERE location_type = 'other' 
   OR business_relationship IS NULL
   OR logistics_provider IS NULL
ORDER BY location_name;
