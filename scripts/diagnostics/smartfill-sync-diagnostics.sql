-- SmartFill Sync Logs Diagnostic Queries
-- Use these queries to investigate sync failures and get full error details

-- 1. Get recent sync logs with full error messages (no truncation)
SELECT 
    id,
    sync_type,
    sync_status,
    started_at,
    completed_at,
    locations_processed,
    tanks_processed,
    assets_processed,
    readings_processed,
    sync_duration_ms,
    LENGTH(error_message) as error_message_length,
    error_message as full_error_message
FROM smartfill_sync_logs 
WHERE error_message IS NOT NULL
ORDER BY started_at DESC 
LIMIT 20;

-- 2. Specifically look for Altona Farms errors
SELECT 
    id,
    sync_type,
    sync_status,
    started_at,
    completed_at,
    sync_duration_ms,
    error_message as full_error_details
FROM smartfill_sync_logs 
WHERE error_message ILIKE '%altona%' 
   OR error_message ILIKE '%4309%'
ORDER BY started_at DESC;

-- 3. Get all failed syncs in the last 7 days with complete error details
SELECT 
    id,
    sync_type,
    sync_status,
    started_at,
    completed_at,
    assets_processed,
    sync_duration_ms,
    CASE 
        WHEN LENGTH(error_message) > 100 
        THEN CONCAT(LEFT(error_message, 100), '... (', LENGTH(error_message), ' total chars)')
        ELSE error_message 
    END as error_summary,
    error_message as complete_error_message
FROM smartfill_sync_logs 
WHERE sync_status IN ('failed', 'partial')
  AND started_at >= NOW() - INTERVAL '7 days'
ORDER BY started_at DESC;

-- 4. Count errors by type/pattern
SELECT 
    CASE 
        WHEN error_message ILIKE '%timeout%' THEN 'Timeout Error'
        WHEN error_message ILIKE '%authentication%' OR error_message ILIKE '%401%' OR error_message ILIKE '%403%' THEN 'Authentication Error'
        WHEN error_message ILIKE '%network%' OR error_message ILIKE '%connection%' THEN 'Network Error'
        WHEN error_message ILIKE '%altona%' OR error_message ILIKE '%4309%' THEN 'Altona Farms Specific Error'
        WHEN error_message ILIKE '%api%' THEN 'API Error'
        WHEN error_message ILIKE '%database%' OR error_message ILIKE '%insert%' THEN 'Database Error'
        ELSE 'Other Error'
    END as error_category,
    COUNT(*) as error_count,
    MAX(started_at) as last_occurrence
FROM smartfill_sync_logs 
WHERE error_message IS NOT NULL
  AND started_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY error_count DESC;

-- 5. Get sync performance metrics
SELECT 
    sync_type,
    sync_status,
    COUNT(*) as total_syncs,
    AVG(sync_duration_ms) as avg_duration_ms,
    AVG(assets_processed) as avg_customers_processed,
    AVG(locations_processed) as avg_locations_processed,
    AVG(tanks_processed) as avg_tanks_processed,
    AVG(readings_processed) as avg_readings_processed,
    COUNT(*) FILTER (WHERE error_message IS NOT NULL) as error_count
FROM smartfill_sync_logs 
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY sync_type, sync_status
ORDER BY sync_type, sync_status;

-- 6. Find the specific customer that might be causing issues
SELECT 
    c.id,
    c.api_reference,
    c.name,
    c.active,
    COUNT(l.id) as location_count,
    COUNT(t.id) as tank_count,
    MAX(t.latest_update_time) as last_tank_update
FROM smartfill_customers c
LEFT JOIN smartfill_locations l ON c.id = l.customer_id
LEFT JOIN smartfill_tanks t ON l.id = t.location_id
WHERE c.name ILIKE '%altona%' OR c.api_reference ILIKE '%4309%'
GROUP BY c.id, c.api_reference, c.name, c.active;

-- 7. Check for any data anomalies in Altona Farms data
SELECT 
    l.customer_name,
    l.unit_number,
    l.description as location_description,
    t.tank_number,
    t.description as tank_description,
    t.capacity,
    t.safe_fill_level,
    t.latest_volume,
    t.latest_volume_percent,
    t.latest_status,
    t.latest_update_time,
    t.created_at,
    t.updated_at
FROM smartfill_locations l
JOIN smartfill_tanks t ON l.id = t.location_id
WHERE l.customer_name ILIKE '%altona%'
ORDER BY l.unit_number, t.tank_number;

-- 8. Get the most recent error message with full text (no truncation)
SELECT 
    'Most Recent SmartFill Sync Error:' as description,
    id,
    sync_type,
    sync_status,
    started_at,
    completed_at,
    sync_duration_ms,
    assets_processed,
    locations_processed,
    tanks_processed,
    readings_processed,
    error_message
FROM smartfill_sync_logs 
WHERE error_message IS NOT NULL
ORDER BY started_at DESC 
LIMIT 1;

-- 9. Compare successful vs failed syncs for pattern analysis
WITH sync_stats AS (
    SELECT 
        sync_status,
        COUNT(*) as count,
        AVG(sync_duration_ms) as avg_duration,
        AVG(assets_processed) as avg_assets,
        AVG(locations_processed) as avg_locations,
        AVG(tanks_processed) as avg_tanks
    FROM smartfill_sync_logs 
    WHERE started_at >= NOW() - INTERVAL '30 days'
    GROUP BY sync_status
)
SELECT 
    sync_status,
    count as total_syncs,
    ROUND(avg_duration::numeric, 2) as avg_duration_ms,
    ROUND(avg_assets::numeric, 2) as avg_customers,
    ROUND(avg_locations::numeric, 2) as avg_locations,
    ROUND(avg_tanks::numeric, 2) as avg_tanks,
    ROUND((count::numeric / SUM(count) OVER()) * 100, 2) as percentage
FROM sync_stats
ORDER BY count DESC;

-- 10. Search for specific error patterns that might indicate truncation
SELECT 
    id,
    started_at,
    sync_status,
    sync_duration_ms,
    CASE 
        WHEN error_message LIKE '%E...' THEN 'Possibly Truncated (starts with E...)'
        WHEN LENGTH(error_message) >= 250 THEN 'Long Error Message (may be truncated)'
        WHEN error_message LIKE '%...' THEN 'Ends with ellipsis (likely truncated)'
        ELSE 'Normal Error Message'
    END as truncation_analysis,
    LENGTH(error_message) as message_length,
    error_message
FROM smartfill_sync_logs 
WHERE error_message IS NOT NULL
  AND started_at >= NOW() - INTERVAL '14 days'
ORDER BY started_at DESC;