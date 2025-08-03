-- Cleanup Duplicate Agbot Locations
-- This script identifies and removes duplicate location records created during CSV imports
-- Run this in Supabase Dashboard SQL Editor

-- ============================================================================
-- STEP 1: Analyze current duplicates
-- ============================================================================

-- Show current duplicate locations
SELECT 
    location_id,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as location_ids,
    STRING_AGG(created_at::text, ', ') as created_dates
FROM agbot_locations 
GROUP BY location_id 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Show total locations before cleanup
SELECT 
    'Before cleanup' as status,
    COUNT(*) as total_locations,
    COUNT(DISTINCT location_id) as unique_locations
FROM agbot_locations;

-- ============================================================================
-- STEP 2: Create temporary table with locations to keep (most recent)
-- ============================================================================

-- Create temporary table with the location to keep for each duplicate group
CREATE TEMP TABLE locations_to_keep AS
WITH location_groups AS (
    SELECT 
        location_id,
        id,
        created_at,
        -- Rank by creation date (most recent first)
        ROW_NUMBER() OVER (PARTITION BY location_id ORDER BY created_at DESC) as rn
    FROM agbot_locations
)
SELECT 
    location_id,
    id as keep_location_id,
    created_at
FROM location_groups 
WHERE rn = 1;

-- Show what we plan to keep
SELECT 
    'Locations to keep' as action,
    location_id,
    keep_location_id,
    created_at
FROM locations_to_keep
ORDER BY location_id;

-- ============================================================================
-- STEP 3: Update assets to point to the kept location records
-- ============================================================================

-- Update agbot_assets to reference the kept location
UPDATE agbot_assets 
SET location_id = ltk.keep_location_id
FROM locations_to_keep ltk,
     agbot_locations al
WHERE agbot_assets.location_id = al.id
  AND al.location_id = ltk.location_id
  AND al.id != ltk.keep_location_id;

-- Show updated assets count
SELECT 
    'Assets updated' as status,
    COUNT(*) as assets_updated
FROM agbot_assets aa
JOIN locations_to_keep ltk ON aa.location_id = ltk.keep_location_id;

-- ============================================================================
-- STEP 4: Update readings history to point to correct assets
-- ============================================================================

-- Update agbot_readings_history if needed
-- (This should already be correct if assets were properly linked)
WITH asset_updates AS (
    SELECT 
        aa.id as correct_asset_id,
        aa.asset_guid,
        al.location_id
    FROM agbot_assets aa
    JOIN agbot_locations al ON aa.location_id = al.id
    JOIN locations_to_keep ltk ON al.id = ltk.keep_location_id
)
UPDATE agbot_readings_history 
SET asset_id = au.correct_asset_id
FROM asset_updates au
WHERE agbot_readings_history.asset_id::text = au.asset_guid;

-- ============================================================================
-- STEP 5: Delete duplicate location records (keep only the newest)
-- ============================================================================

-- Delete duplicate locations (keeping only the ones in locations_to_keep)
DELETE FROM agbot_locations 
WHERE id NOT IN (
    SELECT keep_location_id 
    FROM locations_to_keep
);

-- Show results after cleanup
SELECT 
    'After cleanup' as status,
    COUNT(*) as total_locations,
    COUNT(DISTINCT location_id) as unique_locations
FROM agbot_locations;

-- ============================================================================
-- STEP 6: Clean up any orphaned assets
-- ============================================================================

-- Remove any assets that might be orphaned
DELETE FROM agbot_assets 
WHERE location_id NOT IN (
    SELECT id FROM agbot_locations
);

-- Remove any readings that might be orphaned
DELETE FROM agbot_readings_history 
WHERE asset_id NOT IN (
    SELECT id FROM agbot_assets
);

-- ============================================================================
-- STEP 7: Final verification
-- ============================================================================

-- Show final clean state
SELECT 
    'FINAL RESULT' as status,
    COUNT(DISTINCT al.location_id) as unique_locations,
    COUNT(aa.id) as total_assets,
    COUNT(arh.id) as total_readings
FROM agbot_locations al
LEFT JOIN agbot_assets aa ON al.id = aa.location_id
LEFT JOIN agbot_readings_history arh ON aa.id = arh.asset_id;

-- Show each location with its asset count
SELECT 
    al.location_id,
    al.customer_name,
    al.address1,
    COUNT(aa.id) as asset_count,
    al.created_at
FROM agbot_locations al
LEFT JOIN agbot_assets aa ON al.id = aa.location_id
GROUP BY al.id, al.location_id, al.customer_name, al.address1, al.created_at
ORDER BY al.location_id;

-- ============================================================================
-- STEP 8: Update sync log
-- ============================================================================

-- Log the cleanup operation
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
    'duplicate_cleanup',
    'success',
    (SELECT COUNT(*) FROM agbot_locations),
    (SELECT COUNT(*) FROM agbot_assets),
    (SELECT COUNT(*) FROM agbot_readings_history),
    0,
    NOW(),
    NOW(),
    'Removed duplicate location records, consolidated assets and readings'
);

-- Success message
SELECT 'Duplicate cleanup completed successfully!' as result;
SELECT 'Dashboard should now show unique locations without duplicates' as next_step;