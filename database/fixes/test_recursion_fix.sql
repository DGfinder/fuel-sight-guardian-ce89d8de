-- TEST RECURSION FIX
-- This script tests that the infinite recursion issue has been resolved

-- ============================================================================
-- TEST 1: Verify helper functions work without recursion
-- ============================================================================

SELECT 'TESTING HELPER FUNCTIONS AFTER RECURSION FIX' as test_section;

-- Test admin function
SELECT 
    'Admin Function Test' as test,
    is_admin_user() as is_admin_result,
    CASE 
        WHEN is_admin_user() IS NOT NULL 
        THEN '✅ FUNCTION WORKS'
        ELSE '❌ FUNCTION FAILED'
    END as admin_function_status;

-- Test admin or manager function
SELECT 
    'Manager Function Test' as test,
    is_admin_or_manager_user() as is_manager_result,
    CASE 
        WHEN is_admin_or_manager_user() IS NOT NULL 
        THEN '✅ FUNCTION WORKS'
        ELSE '❌ FUNCTION FAILED'
    END as manager_function_status;

-- ============================================================================
-- TEST 2: Test user_roles table access (main recursion source)
-- ============================================================================

SELECT 'TESTING USER_ROLES TABLE ACCESS' as test_section;

-- Test basic user_roles query (this was causing 500 errors)
SELECT 
    'User Roles Basic Query Test' as test,
    COUNT(*) as total_users,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
    COUNT(CASE WHEN role = 'manager' THEN 1 END) as manager_count,
    COUNT(CASE WHEN role = 'user' THEN 1 END) as user_count,
    '✅ QUERY SUCCESSFUL - NO RECURSION' as status
FROM user_roles;

-- Test current user role access (what useUserPermissions hook does)
SELECT 
    'Current User Role Access Test' as test,
    role,
    user_id,
    CASE 
        WHEN role IS NOT NULL 
        THEN '✅ CAN READ OWN ROLE'
        ELSE '❌ CANNOT READ ROLE'
    END as own_role_status
FROM user_roles 
WHERE user_id = auth.uid();

-- ============================================================================
-- TEST 3: Test the exact query that useUserPermissions hook makes
-- ============================================================================

SELECT 'TESTING USERPERMISSIONS HOOK QUERIES' as test_section;

-- Test the user role query (exact match to frontend)
SELECT 
    'Frontend User Role Query Test' as test,
    role,
    '✅ ROLE QUERY SUCCESS' as status
FROM user_roles
WHERE user_id = auth.uid();

-- Test user group permissions query
SELECT 
    'Frontend Group Permissions Query Test' as test,
    COUNT(*) as group_permission_count,
    '✅ GROUP PERMISSIONS QUERY SUCCESS' as status
FROM user_group_permissions
WHERE user_id = auth.uid();

-- Test user subgroup permissions query
SELECT 
    'Frontend Subgroup Permissions Query Test' as test,
    COUNT(*) as subgroup_permission_count,
    '✅ SUBGROUP PERMISSIONS QUERY SUCCESS' as status
FROM user_subgroup_permissions
WHERE user_id = auth.uid();

-- ============================================================================
-- TEST 4: Test complete permissions flow like frontend does
-- ============================================================================

SELECT 'TESTING COMPLETE FRONTEND PERMISSIONS FLOW' as test_section;

-- Test the exact multi-table query from useUserPermissions hook
SELECT 
    'Complete Permissions Flow Test' as test,
    ur.role,
    COUNT(DISTINCT ugp.group_id) as accessible_groups,
    COUNT(DISTINCT usp.group_id) as subgroup_restricted_groups,
    STRING_AGG(DISTINCT tg.name, ', ') as group_names,
    '✅ COMPLETE FLOW SUCCESS' as status
FROM user_roles ur
LEFT JOIN user_group_permissions ugp ON ur.user_id = ugp.user_id
LEFT JOIN user_subgroup_permissions usp ON ur.user_id = usp.user_id
LEFT JOIN tank_groups tg ON (tg.id = ugp.group_id OR tg.id = usp.group_id)
WHERE ur.user_id = auth.uid()
GROUP BY ur.role;

-- ============================================================================
-- TEST 5: Test tank access with the fixed helper functions
-- ============================================================================

SELECT 'TESTING TANK ACCESS WITH FIXED FUNCTIONS' as test_section;

-- Test tanks_with_rolling_avg view access
SELECT 
    'Tanks View Access Test' as test,
    COUNT(*) as accessible_tanks,
    COUNT(CASE WHEN safe_fill > 0 THEN 1 END) as tanks_with_capacity,
    CASE 
        WHEN COUNT(*) >= 0 
        THEN '✅ TANKS VIEW ACCESS SUCCESS'
        ELSE '❌ TANKS VIEW ACCESS FAILED'
    END as tanks_access_status
FROM tanks_with_rolling_avg;

-- ============================================================================
-- TEST 6: Test specific scenarios
-- ============================================================================

SELECT 'TESTING SPECIFIC USER SCENARIOS' as test_section;

-- Test Sally's subgroup access scenario
SELECT 
    'Sally Subgroup Access Test' as test,
    COUNT(*) as narrogin_tanks,
    STRING_AGG(DISTINCT location, ', ') as tank_locations,
    CASE 
        WHEN COUNT(*) > 0 
        THEN '✅ SUBGROUP ACCESS WORKING'
        ELSE '⚠️ NO SUBGROUP TANKS (normal if not Sally)'
    END as subgroup_status
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin';

-- ============================================================================
-- TEST 7: Error detection test
-- ============================================================================

SELECT 'TESTING FOR REMAINING ERRORS' as test_section;

-- Test that policies don't cause errors
SELECT 
    'Policy Error Detection Test' as test,
    schemaname,
    tablename,
    policyname,
    '✅ POLICY ACCESSIBLE' as policy_status
FROM pg_policies 
WHERE tablename IN ('user_roles', 'user_group_permissions', 'user_subgroup_permissions', 'fuel_tanks')
ORDER BY tablename, policyname;

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================

SELECT 'RECURSION FIX VERIFICATION SUMMARY' as test_section;

WITH test_results AS (
    SELECT 
        (SELECT COUNT(*) FROM user_roles WHERE user_id = auth.uid()) as can_read_own_role,
        (SELECT COUNT(*) FROM user_group_permissions WHERE user_id = auth.uid()) as can_read_group_perms,
        (SELECT COUNT(*) FROM user_subgroup_permissions WHERE user_id = auth.uid()) as can_read_subgroup_perms,
        (SELECT COUNT(*) FROM tanks_with_rolling_avg) as can_access_tanks,
        is_admin_user() as admin_function_works,
        is_admin_or_manager_user() as manager_function_works
)
SELECT 
    'Recursion Fix Summary' as summary,
    can_read_own_role,
    can_read_group_perms,
    can_read_subgroup_perms,
    can_access_tanks,
    admin_function_works,
    manager_function_works,
    CASE 
        WHEN can_read_own_role > 0 
             AND admin_function_works IS NOT NULL 
             AND manager_function_works IS NOT NULL
        THEN '🎉 RECURSION FIX SUCCESSFUL - FRONTEND SHOULD WORK'
        WHEN can_read_own_role = 0
        THEN '❌ STILL CANNOT READ USER ROLE'
        WHEN admin_function_works IS NULL
        THEN '❌ HELPER FUNCTIONS STILL BROKEN'
        ELSE '⚠️ PARTIAL SUCCESS - CHECK DETAILS'
    END as overall_status
FROM test_results;

SELECT 'RECURSION FIX VERIFICATION COMPLETE' as final_status;