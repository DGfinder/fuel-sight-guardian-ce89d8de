-- Guardian Data Cleanup Script
-- This script completely removes all Guardian events data for a clean re-import
-- Run this before importing Guardian data to ensure data integrity

-- Display current Guardian data status before cleanup
SELECT 
    'Before Cleanup' as status,
    COUNT(*) as total_events,
    MIN(detection_time) as earliest_event,
    MAX(detection_time) as latest_event,
    COUNT(DISTINCT fleet) as fleets,
    COUNT(DISTINCT vehicle_registration) as vehicles
FROM guardian_events;

-- Display events by month to show current distribution
SELECT 
    DATE_TRUNC('month', detection_time) as month,
    COUNT(*) as events,
    COUNT(DISTINCT vehicle_registration) as vehicles,
    string_agg(DISTINCT fleet, ', ') as fleets
FROM guardian_events
GROUP BY DATE_TRUNC('month', detection_time)
ORDER BY month DESC
LIMIT 12;

-- Begin transaction for safe cleanup
BEGIN;

-- 1. Clear all Guardian events data
TRUNCATE TABLE guardian_events CASCADE;

-- 2. Clear related import batch records for Guardian data
DELETE FROM data_import_batches 
WHERE source_type = 'guardian_events' 
   OR source_subtype = 'guardian_csv'
   OR file_name ILIKE '%guardian%'
   OR batch_reference LIKE 'guardian_%';

-- 3. Reset any sequences if they exist (PostgreSQL auto-creates these for UUID columns)
-- Note: UUID primary keys don't use sequences, but keeping this for completeness
-- ALTER SEQUENCE IF EXISTS guardian_events_id_seq RESTART WITH 1;

-- 4. Verify cleanup was successful
SELECT 
    'After Cleanup' as status,
    COUNT(*) as total_events,
    MIN(detection_time) as earliest_event,
    MAX(detection_time) as latest_event
FROM guardian_events;

-- 5. Verify import batches were cleared
SELECT 
    COUNT(*) as remaining_guardian_batches
FROM data_import_batches 
WHERE source_type = 'guardian_events' 
   OR batch_reference LIKE 'guardian_%';

-- If everything looks good, commit the transaction
COMMIT;

-- Display final confirmation
SELECT 
    'Cleanup Complete' as message,
    'Guardian events table is now empty and ready for fresh import' as details;

-- Show table structure is intact
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'guardian_events' 
ORDER BY ordinal_position
LIMIT 10;