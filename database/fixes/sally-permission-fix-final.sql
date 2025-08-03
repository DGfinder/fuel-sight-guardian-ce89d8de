-- FINAL SALLY PERMISSION FIX
-- Root Cause: Sally has 'depot_manager' role instead of 'manager', and the RLS policies 
-- treat any role containing 'manager' as having full access
-- 
-- User ID: c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b
-- Email: sally.moore@gsfs.com.au

-- ============================================================================
-- STEP 1: DIAGNOSTIC - Current State Analysis
-- ============================================================================

SELECT 'CURRENT SALLY PERMISSIONS DIAGNOSTIC' as step;

-- Check Sally's current role
SELECT 
    'Sally Current Role' as check_type,
    ur.role,
    ur.user_id
FROM user_roles ur
WHERE ur.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Check Sally's group permissions
SELECT 
    'Sally Group Permissions' as check_type,
    ugp.user_id,
    ugp.group_id,
    tg.name as group_name
FROM user_group_permissions ugp
JOIN tank_groups tg ON ugp.group_id = tg.id
WHERE ugp.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Check Sally's subgroup permissions
SELECT 
    'Sally Subgroup Permissions' as check_type,
    usp.user_id,
    usp.group_id,
    tg.name as group_name,
    usp.subgroup_name
FROM user_subgroup_permissions usp
JOIN tank_groups tg ON usp.group_id = tg.id
WHERE usp.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Show what tanks Sally can currently see
SELECT 
    'Sally Current Tank Access' as check_type,
    ft.tank_name,
    ft.subgroup,
    tg.name as group_name,
    'Should NOT see unless Narrogin' as expected_access
FROM fuel_tanks ft
JOIN tank_groups tg ON ft.group_id = tg.id
WHERE tg.name = 'GSF Depots'
ORDER BY ft.subgroup, ft.tank_name;

-- ============================================================================
-- STEP 2: FIX IMPLEMENTATION
-- ============================================================================

SELECT 'IMPLEMENTING SALLY PERMISSION FIX' as step;

-- Remove any existing group permissions (she shouldn't have full GSF Depots access)
DELETE FROM user_group_permissions 
WHERE user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Remove any existing subgroup permissions (clean slate)
DELETE FROM user_subgroup_permissions 
WHERE user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- CRITICAL: Change role from 'depot_manager' to 'user' to prevent RLS bypass
-- The frontend and RLS policies grant special privileges to 'manager' roles
UPDATE user_roles 
SET 
    role = 'user',
    updated_at = NOW()
WHERE user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Grant ONLY Narrogin subgroup access
INSERT INTO user_subgroup_permissions (user_id, group_id, subgroup_name, created_at)
SELECT 
    'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b' as user_id,
    tg.id as group_id,
    'GSFS Narrogin' as subgroup_name,
    NOW() as created_at
FROM tank_groups tg 
WHERE tg.name = 'GSF Depots';

-- ============================================================================
-- STEP 3: VERIFICATION
-- ============================================================================

SELECT 'VERIFYING SALLY PERMISSION FIX' as step;

-- Check Sally's updated role
SELECT 
    'Sally Updated Role' as check_type,
    ur.role,
    'Should be: user' as expected_value
FROM user_roles ur
WHERE ur.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Check Sally's new subgroup permissions
SELECT 
    'Sally New Subgroup Permissions' as check_type,
    usp.user_id,
    tg.name as group_name,
    usp.subgroup_name,
    'Should be: GSFS Narrogin only' as expected_value
FROM user_subgroup_permissions usp
JOIN tank_groups tg ON usp.group_id = tg.id
WHERE usp.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Verify Sally should NOT have any group permissions
SELECT 
    'Sally Group Permissions After Fix' as check_type,
    COALESCE(COUNT(*), 0) as permission_count,
    'Should be: 0' as expected_value
FROM user_group_permissions ugp
WHERE ugp.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Show tanks Sally should now be able to access (ONLY Narrogin)
SELECT 
    'Tanks Sally CAN Access' as check_type,
    ft.tank_name,
    ft.subgroup,
    tg.name as group_name,
    'Accessible' as access_status
FROM fuel_tanks ft
JOIN tank_groups tg ON ft.group_id = tg.id
WHERE tg.name = 'GSF Depots' 
AND ft.subgroup = 'GSFS Narrogin'
ORDER BY ft.tank_name;

-- Show tanks Sally should NOT be able to access
SELECT 
    'Tanks Sally CANNOT Access' as check_type,
    ft.subgroup,
    COUNT(*) as tank_count,
    'Blocked' as access_status
FROM fuel_tanks ft
JOIN tank_groups tg ON ft.group_id = tg.id
WHERE tg.name = 'GSF Depots' 
AND ft.subgroup IS NOT NULL
AND ft.subgroup != 'GSFS Narrogin'
GROUP BY ft.subgroup
ORDER BY ft.subgroup;

-- ============================================================================
-- STEP 4: FRONTEND VERIFICATION QUERIES
-- ============================================================================

SELECT 'FRONTEND PERMISSION VERIFICATION' as step;

-- Simulate what useUserPermissions hook will return for Sally
SELECT 
    'Sally Frontend Permissions Simulation' as check_type,
    ur.role as role,
    CASE 
        WHEN ur.role = 'admin' THEN true 
        ELSE false 
    END as isAdmin,
    CASE 
        WHEN ur.role = 'manager' THEN true 
        ELSE false 
    END as isManager,
    CASE 
        WHEN ur.role IN ('admin', 'manager') THEN true 
        ELSE false 
    END as canViewAllTanks,
    'Should all be false except role=user' as expected_result
FROM user_roles ur
WHERE ur.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Show Sally's accessible groups from frontend perspective
SELECT 
    'Sally Accessible Groups (Frontend)' as check_type,
    tg.id as group_id,
    tg.name as group_name,
    ARRAY_AGG(usp.subgroup_name) as accessible_subgroups,
    'Should only be GSF Depots with [GSFS Narrogin]' as expected_result
FROM user_subgroup_permissions usp
JOIN tank_groups tg ON usp.group_id = tg.id
WHERE usp.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b'
GROUP BY tg.id, tg.name;

-- ============================================================================
-- STEP 5: RLS POLICY TEST
-- ============================================================================

SELECT 'RLS POLICY VERIFICATION' as step;

-- Test the RLS policy function for Sally's tank access
-- This simulates the database-level filtering
DO $$
DECLARE
    sally_user_id UUID := 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';
    test_tank_id UUID;
    can_access BOOLEAN;
BEGIN
    -- Test with a Narrogin tank (should return TRUE)
    SELECT ft.id INTO test_tank_id 
    FROM fuel_tanks ft 
    JOIN tank_groups tg ON ft.group_id = tg.id
    WHERE tg.name = 'GSF Depots' AND ft.subgroup = 'GSFS Narrogin' 
    LIMIT 1;
    
    IF test_tank_id IS NOT NULL THEN
        -- Note: This test won't work perfectly without setting auth.uid() 
        -- but shows the structure that should grant access
        SELECT COUNT(*) > 0 INTO can_access
        FROM fuel_tanks ft
        JOIN user_subgroup_permissions usp ON ft.group_id = usp.group_id
        WHERE usp.user_id = sally_user_id
        AND ft.id = test_tank_id
        AND ft.subgroup = usp.subgroup_name;
        
        RAISE NOTICE 'Sally access to Narrogin tank %: %', test_tank_id, can_access;
    END IF;
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 
    'SALLY PERMISSION FIX COMPLETE' as status,
    'Sally now has user role with GSFS Narrogin subgroup access only' as result,
    'She should only see 3 Narrogin tanks: ADF, ULP, ULP98' as expected_behavior;

-- Summary of changes made:
SELECT 
    'CHANGES SUMMARY' as summary,
    'Role changed from depot_manager to user' as change_1,
    'Removed all group permissions' as change_2,
    'Added subgroup permission for GSFS Narrogin only' as change_3,
    'This prevents RLS bypass and limits access correctly' as explanation;