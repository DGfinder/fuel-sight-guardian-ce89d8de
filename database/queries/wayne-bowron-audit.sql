-- Wayne Bowron LYTX Data Audit Queries
-- =====================================
-- 
-- This file contains SQL queries to audit LYTX safety events data
-- for Wayne Bowron to identify data discrepancies and verify 
-- driver correlations over the last 180 days.
--
-- Usage: Run these queries in your Supabase SQL editor or psql client

-- ========================================
-- 1. CHECK DRIVER RECORDS FOR WAYNE BOWRON
-- ========================================

-- Search for Wayne Bowron in drivers table with name variations
SELECT 
    id,
    first_name,
    last_name,
    employee_id,
    fleet,
    depot,
    status,
    created_at,
    updated_at
FROM drivers 
WHERE 
    (first_name ILIKE '%wayne%' AND last_name ILIKE '%bowron%')
    OR (first_name ILIKE '%bowron%' AND last_name ILIKE '%wayne%')
    OR (first_name || ' ' || last_name) ILIKE '%wayne%bowron%'
ORDER BY created_at DESC;

-- ===============================================
-- 2. SEARCH LYTX EVENTS FOR WAYNE BOWRON (180 DAYS)
-- ===============================================

-- Define 180 days ago date (adjust as needed)
-- Replace with actual date: WHERE event_datetime >= '2025-02-25'

-- Search with comprehensive name variations
SELECT 
    event_id,
    driver_name,
    employee_id,
    driver_id,
    event_datetime,
    event_type,
    trigger,
    score,
    carrier,
    depot,
    driver_association_confidence,
    driver_association_method,
    driver_association_updated_at
FROM lytx_safety_events 
WHERE 
    event_datetime >= CURRENT_DATE - INTERVAL '180 days'
    AND (
        driver_name ILIKE '%wayne%bowron%'
        OR driver_name ILIKE '%bowron%wayne%' 
        OR driver_name ILIKE 'wayne bowron'
        OR driver_name ILIKE 'bowron wayne'
        OR driver_name ILIKE 'w%bowron'
        OR driver_name ILIKE 'wayne b%'
    )
ORDER BY event_datetime DESC;

-- ==============================================
-- 3. CHECK DRIVER NAME VARIATIONS IN LYTX DATA
-- ==============================================

-- Find all unique driver names containing "wayne" or "bowron"
SELECT DISTINCT 
    driver_name,
    COUNT(*) as event_count,
    MIN(event_datetime) as earliest_event,
    MAX(event_datetime) as latest_event
FROM lytx_safety_events 
WHERE 
    event_datetime >= CURRENT_DATE - INTERVAL '180 days'
    AND (
        driver_name ILIKE '%wayne%' 
        OR driver_name ILIKE '%bowron%'
    )
GROUP BY driver_name
ORDER BY event_count DESC, driver_name;

-- =======================================
-- 4. CHECK DRIVER ASSOCIATION STATUS
-- =======================================

-- Count associated vs unassociated events for Wayne Bowron
WITH wayne_events AS (
    SELECT 
        event_id,
        driver_name,
        driver_id,
        event_datetime,
        trigger,
        score
    FROM lytx_safety_events 
    WHERE 
        event_datetime >= CURRENT_DATE - INTERVAL '180 days'
        AND (
            driver_name ILIKE '%wayne%bowron%'
            OR driver_name ILIKE '%bowron%wayne%' 
            OR driver_name ILIKE 'wayne bowron'
            OR driver_name ILIKE 'bowron wayne'
            OR driver_name ILIKE 'w%bowron'
            OR driver_name ILIKE 'wayne b%'
        )
)
SELECT 
    'Associated with driver' as status,
    COUNT(*) as count
FROM wayne_events 
WHERE driver_id IS NOT NULL
UNION ALL
SELECT 
    'Not associated' as status,
    COUNT(*) as count
FROM wayne_events 
WHERE driver_id IS NULL;

-- ===========================================
-- 5. DETAILED VIEW OF UNASSOCIATED EVENTS
-- ===========================================

-- Show all unassociated Wayne Bowron events
SELECT 
    event_id,
    driver_name,
    employee_id,
    event_datetime,
    event_type,
    trigger,
    score,
    carrier,
    depot,
    created_at
FROM lytx_safety_events 
WHERE 
    driver_id IS NULL
    AND event_datetime >= CURRENT_DATE - INTERVAL '180 days'
    AND (
        driver_name ILIKE '%wayne%bowron%'
        OR driver_name ILIKE '%bowron%wayne%' 
        OR driver_name ILIKE 'wayne bowron'
        OR driver_name ILIKE 'bowron wayne'
        OR driver_name ILIKE 'w%bowron'
        OR driver_name ILIKE 'wayne b%'
    )
ORDER BY event_datetime DESC;

-- ===============================================
-- 6. CROSS-REFERENCE WITH EXISTING DRIVER RECORDS
-- ===============================================

-- Join Wayne Bowron LYTX events with driver records
SELECT 
    lse.event_id,
    lse.driver_name as lytx_driver_name,
    lse.employee_id as lytx_employee_id,
    lse.event_datetime,
    lse.trigger,
    lse.score,
    d.id as driver_id,
    d.first_name || ' ' || d.last_name as db_driver_name,
    d.employee_id as db_employee_id,
    d.fleet,
    d.depot,
    lse.driver_association_confidence,
    lse.driver_association_method
FROM lytx_safety_events lse
LEFT JOIN drivers d ON lse.driver_id = d.id
WHERE 
    lse.event_datetime >= CURRENT_DATE - INTERVAL '180 days'
    AND (
        lse.driver_name ILIKE '%wayne%bowron%'
        OR lse.driver_name ILIKE '%bowron%wayne%' 
        OR lse.driver_name ILIKE 'wayne bowron'
        OR lse.driver_name ILIKE 'bowron wayne'
        OR lse.driver_name ILIKE 'w%bowron'
        OR lse.driver_name ILIKE 'wayne b%'
    )
ORDER BY lse.event_datetime DESC;

-- ===================================
-- 7. IDENTIFY POTENTIAL MATCHING ISSUES
-- ===================================

-- Look for similar names that might be the same person
SELECT 
    driver_name,
    COUNT(*) as event_count,
    STRING_AGG(DISTINCT employee_id::text, ', ') as employee_ids,
    STRING_AGG(DISTINCT carrier, ', ') as carriers
FROM lytx_safety_events 
WHERE 
    driver_id IS NULL
    AND event_datetime >= CURRENT_DATE - INTERVAL '180 days'
    AND (
        driver_name ILIKE '%wayne%' 
        OR driver_name ILIKE '%bowron%'
        OR driver_name ILIKE '%w bowron%'
        OR driver_name ILIKE '%bowron w%'
    )
GROUP BY driver_name
ORDER BY event_count DESC;

-- =====================================
-- 8. RECENT EVENTS SUMMARY BY TIMEFRAME
-- =====================================

-- Group Wayne Bowron events by month
SELECT 
    DATE_TRUNC('month', event_datetime) as month,
    COUNT(*) as event_count,
    COUNT(CASE WHEN driver_id IS NOT NULL THEN 1 END) as associated_count,
    COUNT(CASE WHEN driver_id IS NULL THEN 1 END) as unassociated_count,
    STRING_AGG(DISTINCT driver_name, ', ') as name_variations
FROM lytx_safety_events 
WHERE 
    event_datetime >= CURRENT_DATE - INTERVAL '180 days'
    AND (
        driver_name ILIKE '%wayne%bowron%'
        OR driver_name ILIKE '%bowron%wayne%' 
        OR driver_name ILIKE 'wayne bowron'
        OR driver_name ILIKE 'bowron wayne'
        OR driver_name ILIKE 'w%bowron'
        OR driver_name ILIKE 'wayne b%'
    )
GROUP BY DATE_TRUNC('month', event_datetime)
ORDER BY month DESC;

-- ======================================
-- 9. MANUAL ASSOCIATION QUERY TEMPLATE
-- ======================================

-- Template for manually associating events with a driver
-- Replace 'TARGET_DRIVER_ID' with the actual driver ID
-- Uncomment and modify as needed:

/*
UPDATE lytx_safety_events 
SET 
    driver_id = 'TARGET_DRIVER_ID',
    driver_association_method = 'manual_audit',
    driver_association_confidence = 1.0,
    driver_association_updated_at = NOW()
WHERE 
    driver_id IS NULL
    AND event_datetime >= CURRENT_DATE - INTERVAL '180 days'
    AND (
        driver_name ILIKE '%wayne%bowron%'
        OR driver_name ILIKE '%bowron%wayne%' 
        OR driver_name ILIKE 'wayne bowron'
        OR driver_name ILIKE 'bowron wayne'
    );
*/

-- =======================================
-- 10. VERIFICATION QUERIES POST-UPDATE
-- =======================================

-- After manual association, verify the results
SELECT 
    'Total Wayne Bowron events (180 days)' as metric,
    COUNT(*) as value
FROM lytx_safety_events 
WHERE 
    event_datetime >= CURRENT_DATE - INTERVAL '180 days'
    AND (
        driver_name ILIKE '%wayne%bowron%'
        OR driver_name ILIKE '%bowron%wayne%' 
        OR driver_name ILIKE 'wayne bowron'
        OR driver_name ILIKE 'bowron wayne'
        OR driver_name ILIKE 'w%bowron'
        OR driver_name ILIKE 'wayne b%'
    )
UNION ALL
SELECT 
    'Events associated with driver' as metric,
    COUNT(*) as value
FROM lytx_safety_events 
WHERE 
    driver_id IS NOT NULL
    AND event_datetime >= CURRENT_DATE - INTERVAL '180 days'
    AND (
        driver_name ILIKE '%wayne%bowron%'
        OR driver_name ILIKE '%bowron%wayne%' 
        OR driver_name ILIKE 'wayne bowron'
        OR driver_name ILIKE 'bowron wayne'
        OR driver_name ILIKE 'w%bowron'
        OR driver_name ILIKE 'wayne b%'
    )
UNION ALL
SELECT 
    'Events still unassociated' as metric,
    COUNT(*) as value
FROM lytx_safety_events 
WHERE 
    driver_id IS NULL
    AND event_datetime >= CURRENT_DATE - INTERVAL '180 days'
    AND (
        driver_name ILIKE '%wayne%bowron%'
        OR driver_name ILIKE '%bowron%wayne%' 
        OR driver_name ILIKE 'wayne bowron'
        OR driver_name ILIKE 'bowron wayne'
        OR driver_name ILIKE 'w%bowron'
        OR driver_name ILIKE 'wayne b%'
    );

-- =====================================
-- 11. DRIVER PROFILE SUMMARY CHECK
-- =====================================

-- If Wayne Bowron is associated, test the profile summary function
-- Replace 'TARGET_DRIVER_ID' with actual driver ID
/*
SELECT * FROM get_driver_profile_summary(
    'TARGET_DRIVER_ID'::uuid,
    (CURRENT_DATE - INTERVAL '180 days')::timestamp,
    '180d'
);
*/

-- ===========================
-- END OF AUDIT QUERIES
-- ===========================