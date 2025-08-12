-- Check SmartFill customers table for data issues
-- Run this in Supabase SQL Editor

-- 1. Basic customer table overview
SELECT 
    COUNT(*) as total_customers,
    COUNT(*) FILTER (WHERE active = true) as active_customers,
    COUNT(*) FILTER (WHERE active = false) as inactive_customers,
    COUNT(*) FILTER (WHERE api_reference IS NULL OR api_secret IS NULL) as missing_credentials
FROM smartfill_customers;

-- 2. Check for specific data quality issues
SELECT 
    'Duplicate API references' as issue_type,
    COUNT(*) as count
FROM (
    SELECT api_reference, COUNT(*) 
    FROM smartfill_customers 
    GROUP BY api_reference 
    HAVING COUNT(*) > 1
) dups

UNION ALL

SELECT 
    'Missing API secrets' as issue_type,
    COUNT(*) as count
FROM smartfill_customers 
WHERE api_secret IS NULL OR api_secret = ''

UNION ALL

SELECT 
    'Missing API references' as issue_type,
    COUNT(*) as count
FROM smartfill_customers 
WHERE api_reference IS NULL OR api_reference = ''

UNION ALL

SELECT 
    'Inactive customers' as issue_type,
    COUNT(*) as count
FROM smartfill_customers 
WHERE active = false;

-- 3. List all active customers
SELECT 
    id,
    api_reference,
    name,
    LENGTH(api_secret) as secret_length,
    active,
    created_at,
    updated_at
FROM smartfill_customers 
WHERE active = true
ORDER BY name;

-- 4. Check Altona Farms specifically
SELECT 
    id,
    api_reference,
    api_secret,
    name,
    active,
    created_at,
    updated_at
FROM smartfill_customers 
WHERE name ILIKE '%altona%' OR api_reference ILIKE '%altona%';

-- 5. Look for customers that might have API issues (recent sync failures)
SELECT DISTINCT
    c.id,
    c.api_reference,
    c.name,
    c.active,
    COUNT(sl.id) as recent_errors
FROM smartfill_customers c
LEFT JOIN smartfill_sync_logs sl ON (
    sl.error_message ILIKE '%' || c.name || '%' OR 
    sl.error_message ILIKE '%' || c.api_reference || '%'
)
AND sl.started_at >= NOW() - INTERVAL '24 hours'
WHERE c.active = true
GROUP BY c.id, c.api_reference, c.name, c.active
HAVING COUNT(sl.id) > 0
ORDER BY recent_errors DESC;