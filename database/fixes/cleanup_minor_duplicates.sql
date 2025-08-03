-- Final cleanup of minor duplicate name variations
-- This fixes the remaining Corrigin tank name inconsistencies
-- Run this in Supabase Dashboard SQL Editor

-- ============================================================================
-- STEP 1: Identify remaining duplicates with similar names
-- ============================================================================

-- Show current location names that might be duplicates
SELECT 
    location_id,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as location_ids
FROM agbot_locations 
WHERE location_id ILIKE '%corrigin%'
   OR location_id ILIKE '%meehan%'
   OR location_id ILIKE '%bruce%'
GROUP BY location_id 
ORDER BY location_id;

-- ============================================================================
-- STEP 2: Standardize Corrigin tank names
-- ============================================================================

-- Update "Corrigin Diesel Tank 3" to match "Corrigin Tank 3 Diesel 54,400ltrs"
UPDATE agbot_locations 
SET location_id = 'Corrigin Tank 3 Diesel 54,400ltrs',
    location_guid = 'location-corrigin-tank-3-diesel-54400ltrs'
WHERE location_id = 'Corrigin Diesel Tank 3 54,400ltrs'
   OR location_id ILIKE 'Corrigin Diesel Tank 3%';

-- Update any assets pointing to the old name
UPDATE agbot_assets 
SET asset_serial_number = 'Corrigin Tank 3 Diesel 54,400ltrs'
WHERE asset_serial_number = 'Corrigin Diesel Tank 3 54,400ltrs'
   OR asset_serial_number ILIKE 'Corrigin Diesel Tank 3%';

-- ============================================================================
-- STEP 3: Standardize O'Meehan tank names (if duplicates exist)
-- ============================================================================

-- Check for O'Meehan duplicates and standardize
UPDATE agbot_locations 
SET location_id = 'O''Meehan Farms Tank A 65,500ltrs',
    location_guid = 'location-omeehan-farms-tank-a-65500ltrs'
WHERE location_id ILIKE '%meehan%'
  AND location_id != 'O''Meehan Farms Tank A 65,500ltrs';

-- ============================================================================
-- STEP 4: Remove any remaining exact duplicates after name standardization
-- ============================================================================

-- Find and remove any locations that are now exact duplicates
WITH duplicate_locations AS (
    SELECT 
        location_id,
        id,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY location_id ORDER BY created_at DESC) as rn
    FROM agbot_locations
)
DELETE FROM agbot_locations 
WHERE id IN (
    SELECT id 
    FROM duplicate_locations 
    WHERE rn > 1
);

-- ============================================================================
-- STEP 5: Clean up any orphaned assets
-- ============================================================================

-- Remove any assets that might be orphaned after location cleanup
DELETE FROM agbot_assets 
WHERE location_id NOT IN (
    SELECT id FROM agbot_locations
);

-- Remove any readings that might be orphaned after asset cleanup
DELETE FROM agbot_readings_history 
WHERE asset_id NOT IN (
    SELECT id FROM agbot_assets
);

-- ============================================================================
-- STEP 6: Verification - Show final clean location list
-- ============================================================================

-- Show final unique locations
SELECT 
    'Final Clean Locations' as status,
    location_id,
    customer_name,
    latest_calibrated_fill_percentage as fill_level,
    COUNT(aa.id) as asset_count,
    al.created_at
FROM agbot_locations al
LEFT JOIN agbot_assets aa ON al.id = aa.location_id
GROUP BY al.id, al.location_id, al.customer_name, al.latest_calibrated_fill_percentage, al.created_at
ORDER BY al.location_id;

-- Show total count
SELECT 
    'Summary' as status,
    COUNT(DISTINCT location_id) as unique_locations,
    COUNT(*) as total_location_records
FROM agbot_locations;

-- ============================================================================
-- STEP 7: Log the cleanup
-- ============================================================================

-- Log the final cleanup operation
INSERT INTO agbot_sync_logs (
    sync_type,
    sync_status,
    locations_processed,
    assets_processed,
    readings_processed,
    sync_duration_ms,
    started_at,
    completed_at,
    error_message
) VALUES (
    'minor_duplicates_cleanup',
    'success',
    (SELECT COUNT(*) FROM agbot_locations),
    (SELECT COUNT(*) FROM agbot_assets),
    (SELECT COUNT(*) FROM agbot_readings_history),
    0,
    NOW(),
    NOW(),
    'Standardized location names and removed remaining duplicates'
);

-- Success message
SELECT 'Minor duplicates cleaned up successfully!' as result;
SELECT 'Ready to import rich CSV data with real operational metrics' as next_step;