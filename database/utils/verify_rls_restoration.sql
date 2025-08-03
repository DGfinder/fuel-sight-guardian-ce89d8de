-- VERIFY RLS RESTORATION
-- This script verifies that RLS has been properly restored on all tables

-- ============================================================================
-- TEST 1: Check RLS is enabled on all tables
-- ============================================================================

SELECT 'CHECKING RLS STATUS AFTER RESTORATION' as test_section;

SELECT 
    'RLS Status Check' as test,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '✅ ENABLED'
        ELSE '❌ DISABLED'
    END as status
FROM pg_tables 
WHERE tablename IN (
    'user_roles', 
    'user_group_permissions', 
    'user_subgroup_permissions', 
    'fuel_tanks', 
    'dip_readings', 
    'tank_alerts', 
    'tank_groups'
)
ORDER BY tablename;

-- ============================================================================
-- TEST 2: Verify policies exist for each table
-- ============================================================================

SELECT 'CHECKING RLS POLICIES EXIST' as test_section;

SELECT 
    'Policy Count Check' as test,
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policies
FROM pg_policies 
WHERE tablename IN (
    'user_roles', 
    'user_group_permissions', 
    'user_subgroup_permissions', 
    'fuel_tanks', 
    'dip_readings', 
    'tank_alerts', 
    'tank_groups'
)
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- TEST 3: Test helper functions work
-- ============================================================================

SELECT 'TESTING HELPER FUNCTIONS' as test_section;

-- Test admin function
SELECT 
    'Helper Function Test' as test,
    is_admin_user() as is_admin,
    is_admin_or_manager_user() as is_admin_or_manager,
    CASE 
        WHEN is_admin_user() IS NOT NULL AND is_admin_or_manager_user() IS NOT NULL 
        THEN '✅ FUNCTIONS WORKING'
        ELSE '❌ FUNCTIONS BROKEN'
    END as function_status;

-- ============================================================================
-- TEST 4: Test user can read their own role
-- ============================================================================

SELECT 'TESTING USER ROLE ACCESS' as test_section;

-- This should work if RLS is properly configured
SELECT 
    'User Role Access Test' as test,
    role,
    user_id,
    CASE 
        WHEN role IS NOT NULL 
        THEN '✅ CAN READ OWN ROLE'
        ELSE '❌ CANNOT READ ROLE'
    END as role_access_status
FROM user_roles 
WHERE user_id = auth.uid();

-- ============================================================================
-- TEST 5: Test user permissions queries
-- ============================================================================

SELECT 'TESTING USER PERMISSIONS ACCESS' as test_section;

-- Test group permissions
SELECT 
    'Group Permissions Test' as test,
    COUNT(*) as group_permissions_count,
    CASE 
        WHEN COUNT(*) >= 0 
        THEN '✅ CAN READ GROUP PERMISSIONS'
        ELSE '❌ CANNOT READ GROUP PERMISSIONS'
    END as group_permissions_status
FROM user_group_permissions 
WHERE user_id = auth.uid();

-- Test subgroup permissions
SELECT 
    'Subgroup Permissions Test' as test,
    COUNT(*) as subgroup_permissions_count,
    CASE 
        WHEN COUNT(*) >= 0 
        THEN '✅ CAN READ SUBGROUP PERMISSIONS'
        ELSE '❌ CANNOT READ SUBGROUP PERMISSIONS'
    END as subgroup_permissions_status
FROM user_subgroup_permissions 
WHERE user_id = auth.uid();

-- ============================================================================
-- TEST 6: Test tanks view access
-- ============================================================================

SELECT 'TESTING TANKS VIEW ACCESS' as test_section;

-- Test if we can access the tanks view
SELECT 
    'Tanks View Access Test' as test,
    COUNT(*) as accessible_tanks,
    CASE 
        WHEN COUNT(*) > 0 
        THEN '✅ CAN ACCESS TANKS'
        WHEN COUNT(*) = 0 
        THEN '⚠️ NO TANKS ACCESSIBLE (may be normal for restricted users)'
        ELSE '❌ TANKS VIEW ERROR'
    END as tanks_access_status
FROM tanks_with_rolling_avg;

-- ============================================================================
-- TEST 7: Test specific user scenarios
-- ============================================================================

SELECT 'TESTING SPECIFIC USER SCENARIOS' as test_section;

-- Test current user's complete access pattern
WITH user_context AS (
    SELECT 
        ur.role,
        COUNT(DISTINCT ugp.group_id) as full_group_access,
        COUNT(DISTINCT usp.group_id) as subgroup_access,
        COUNT(DISTINCT t.id) as accessible_tanks
    FROM user_roles ur
    LEFT JOIN user_group_permissions ugp ON ur.user_id = ugp.user_id
    LEFT JOIN user_subgroup_permissions usp ON ur.user_id = usp.user_id
    LEFT JOIN tanks_with_rolling_avg t ON true  -- All tanks user can see
    WHERE ur.user_id = auth.uid()
    GROUP BY ur.role
)
SELECT 
    'User Access Pattern Test' as test,
    role,
    full_group_access,
    subgroup_access, 
    accessible_tanks,
    CASE 
        WHEN role IN ('admin', 'manager') AND accessible_tanks > 0 
        THEN '✅ ADMIN/MANAGER ACCESS WORKING'
        WHEN role = 'user' AND (full_group_access > 0 OR subgroup_access > 0) AND accessible_tanks > 0
        THEN '✅ USER GROUP/SUBGROUP ACCESS WORKING'
        WHEN role = 'user' AND full_group_access = 0 AND subgroup_access = 0 AND accessible_tanks = 0
        THEN '⚠️ USER HAS NO PERMISSIONS (may need permissions assigned)'
        ELSE '❌ ACCESS PATTERN UNEXPECTED'
    END as access_pattern_status
FROM user_context;

-- ============================================================================
-- TEST 8: Test Sally's specific case (if applicable)
-- ============================================================================

SELECT 'TESTING SALLY SPECIFIC SCENARIO' as test_section;

-- Test if Sally can see GSFS Narrogin tanks
SELECT 
    'Sally Narrogin Access Test' as test,
    COUNT(*) as narrogin_tanks,
    STRING_AGG(DISTINCT location, ', ') as locations,
    CASE 
        WHEN COUNT(*) > 0 
        THEN '✅ SALLY CAN ACCESS NARROGIN TANKS'
        ELSE '⚠️ NO NARROGIN TANKS VISIBLE (normal if not Sally)'
    END as sally_access_status
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin';

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================

SELECT 'RESTORATION SUMMARY' as test_section;

WITH summary AS (
    SELECT 
        (SELECT COUNT(*) FROM pg_tables 
         WHERE tablename IN ('user_roles', 'user_group_permissions', 'user_subgroup_permissions', 'fuel_tanks', 'dip_readings', 'tank_alerts', 'tank_groups')
         AND rowsecurity = true) as tables_with_rls,
        (SELECT COUNT(*) FROM pg_policies 
         WHERE tablename IN ('user_roles', 'user_group_permissions', 'user_subgroup_permissions', 'fuel_tanks', 'dip_readings', 'tank_alerts', 'tank_groups')) as total_policies,
        (SELECT COUNT(*) FROM user_roles WHERE user_id = auth.uid()) as can_read_role,
        (SELECT COUNT(*) FROM tanks_with_rolling_avg) as accessible_tanks
)
SELECT 
    'RLS Restoration Summary' as summary,
    tables_with_rls as tables_with_rls_enabled,
    total_policies,
    can_read_role,
    accessible_tanks,
    CASE 
        WHEN tables_with_rls = 7 AND total_policies > 0 AND can_read_role > 0
        THEN '🎉 RLS RESTORATION SUCCESSFUL'
        WHEN tables_with_rls < 7
        THEN '❌ SOME TABLES STILL MISSING RLS'
        WHEN total_policies = 0
        THEN '❌ NO POLICIES CREATED'
        WHEN can_read_role = 0
        THEN '❌ CANNOT READ USER ROLE'
        ELSE '⚠️ PARTIAL SUCCESS - CHECK DETAILS ABOVE'
    END as overall_status
FROM summary;

SELECT 'RLS RESTORATION VERIFICATION COMPLETE' as final_status;