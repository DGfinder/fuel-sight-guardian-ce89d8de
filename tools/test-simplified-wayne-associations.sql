-- =====================================================
-- Simplified Wayne Bowron Association Test
-- =====================================================
-- Quick test to verify the simplified association works
-- without driver_assignments table dependency
--
-- Run this to test before executing the full migration
-- Author: Claude Code
-- Created: 2025-08-25

-- Test 1: Verify Wayne Bowron exists in drivers table
SELECT 
    'Wayne Bowron Driver Check' as test,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Wayne Bowron found'
        ELSE '❌ FAIL: Wayne Bowron not found'
    END as result,
    COUNT(*) as record_count,
    string_agg(id::text, ', ') as driver_uuids
FROM drivers 
WHERE id = '202f3cb3-adc6-4af9-bfbb-069b87505287'
   OR (first_name ILIKE '%wayne%' AND last_name ILIKE '%bowron%');

-- Test 2: Check Guardian events schema has driver_id column
SELECT 
    'Guardian Schema Check' as test,
    CASE 
        WHEN column_name = 'driver_id' THEN '✅ PASS: Guardian driver_id column exists'
        ELSE '❌ FAIL: Guardian driver_id column missing'
    END as result,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'guardian_events' 
  AND column_name = 'driver_id';

-- Test 3: Check for events that would be associated
SELECT 
    'Vehicle 1IDB419 Events Check' as test,
    event_source,
    COUNT(*) as event_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Events found for association'
        ELSE '⚠️  WARN: No events found'
    END as result
FROM (
    SELECT 'MTData' as event_source, COUNT(*) as count
    FROM mtdata_trip_history 
    WHERE vehicle_registration = '1IDB419'
    
    UNION ALL
    
    SELECT 'Guardian' as event_source, COUNT(*) as count
    FROM guardian_events 
    WHERE vehicle_registration = '1IDB419'
    
    UNION ALL
    
    SELECT 'LYTX' as event_source, COUNT(*) as count
    FROM lytx_safety_events 
    WHERE driver_name ILIKE '%wayne%bowron%'
       OR driver_name ILIKE '%bowron%wayne%'
) event_counts
WHERE count > 0
GROUP BY event_source, count;

-- Test 4: Check association method constraint
SELECT 
    'Association Method Check' as test,
    CASE 
        WHEN 'manual_assignment' = ANY(string_to_array(replace(replace(check_clause, 'driver_association_method IN (', ''), ')', ''), ', '))
        THEN '✅ PASS: manual_assignment method allowed'
        ELSE '❌ FAIL: manual_assignment method not in constraint'
    END as result,
    check_clause
FROM information_schema.check_constraints cc
JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
WHERE ccu.table_name = 'guardian_events' 
  AND ccu.column_name = 'driver_association_method';

-- Test 5: Summary - Ready to run migration?
SELECT 
    'Migration Readiness' as test,
    CASE 
        WHEN (SELECT COUNT(*) FROM drivers WHERE id = '202f3cb3-adc6-4af9-bfbb-069b87505287') > 0
         AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'guardian_events' AND column_name = 'driver_id') > 0
        THEN '🎯 READY: All prerequisites met - safe to run Wayne Bowron migration'
        ELSE '⚠️  NOT READY: Prerequisites missing - check above tests'
    END as result;