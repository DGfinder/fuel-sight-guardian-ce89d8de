-- CHECK DIP READINGS SCHEMA
-- This script checks the structure of dip_readings table to understand data types

-- ============================================================================
-- STEP 1: Check dip_readings table structure
-- ============================================================================

SELECT 'CHECKING DIP_READINGS TABLE STRUCTURE' as step;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'dip_readings'
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 2: Check for foreign key constraints
-- ============================================================================

SELECT 'CHECKING FOREIGN KEY CONSTRAINTS' as step;

SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name = 'dip_readings';

-- ============================================================================
-- STEP 3: Check existing dip readings for GSFS Narrogin tanks
-- ============================================================================

SELECT 'CHECKING EXISTING DIP READINGS' as step;

SELECT 
    ft.location,
    COUNT(dr.id) as existing_readings,
    MAX(dr.created_at) as latest_reading
FROM fuel_tanks ft
LEFT JOIN dip_readings dr ON ft.id = dr.tank_id
WHERE ft.subgroup = 'GSFS Narrogin'
GROUP BY ft.id, ft.location
ORDER BY ft.location;

-- ============================================================================
-- STEP 4: Check current user ID for reference
-- ============================================================================

SELECT 'CHECKING CURRENT USER ID' as step;

SELECT 
    'Current User Info' as info_type,
    auth.uid() as user_id,
    auth.jwt() ->> 'email' as email
WHERE auth.uid() IS NOT NULL

UNION ALL

SELECT 
    'No Active User' as info_type,
    NULL as user_id,
    NULL as email
WHERE auth.uid() IS NULL;

-- ============================================================================
-- STEP 5: Get sample of any existing dip readings to see format
-- ============================================================================

SELECT 'SAMPLE EXISTING DIP READINGS' as step;

SELECT 
    tank_id,
    value,
    recorded_by,
    created_at,
    'Sample existing record' as record_type
FROM dip_readings
ORDER BY created_at DESC
LIMIT 5;