-- Get complete SmartFill sync error details (not truncated)
-- Run this in Supabase SQL Editor to see full error messages

-- 1. Get the most recent Altona Farms error with complete details
SELECT 
    started_at,
    sync_type,
    sync_status,
    sync_duration_ms,
    locations_processed,
    tanks_processed,
    LENGTH(error_message) as error_message_length,
    error_message as complete_error_message
FROM smartfill_sync_logs 
WHERE error_message ILIKE '%altona%' OR error_message ILIKE '%4309%'
ORDER BY started_at DESC 
LIMIT 3;

-- 2. Get the most recent error from any customer (full text)
SELECT 
    started_at,
    sync_type,
    sync_status,
    sync_duration_ms,
    error_message as complete_error_message
FROM smartfill_sync_logs 
WHERE error_message IS NOT NULL
  AND sync_status IN ('failed', 'partial')
ORDER BY started_at DESC 
LIMIT 5;

-- 3. Get error pattern analysis
SELECT 
    DATE_TRUNC('hour', started_at) as error_hour,
    COUNT(*) as error_count,
    STRING_AGG(DISTINCT LEFT(error_message, 100), ' | ') as error_samples
FROM smartfill_sync_logs 
WHERE error_message IS NOT NULL
  AND started_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', started_at)
ORDER BY error_hour DESC;

-- 4. Check if specific customer names appear in errors
SELECT DISTINCT
    CASE 
        WHEN error_message ILIKE '%altona%' THEN 'Altona Farms'
        WHEN error_message ILIKE '%stevemac%' THEN 'Stevemac'
        WHEN error_message ILIKE '%ashburto%' THEN 'Ashburto'
        WHEN error_message ILIKE '%swan%' THEN 'Swan Towing'
        ELSE 'Other'
    END as customer_pattern,
    COUNT(*) as error_count,
    MAX(started_at) as last_error
FROM smartfill_sync_logs 
WHERE error_message IS NOT NULL
  AND started_at >= NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY error_count DESC;