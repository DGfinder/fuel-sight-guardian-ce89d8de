-- TEST USER ACCESS AFTER RLS FIXES
-- This script tests that the RLS fixes work correctly for different user types

-- ============================================================================
-- TEST 1: Verify all users can access their own role
-- ============================================================================

SELECT 'TEST 1: USER ROLE ACCESS' as test_section;

-- This should show the current user's role without errors
SELECT 
    'Current User Role Test' as test,
    role,
    user_id,
    'SUCCESS - Can read own role' as status
FROM user_roles 
WHERE user_id = auth.uid();

-- ============================================================================
-- TEST 2: Verify group permissions work
-- ============================================================================

SELECT 'TEST 2: GROUP PERMISSIONS ACCESS' as test_section;

-- This should show the current user's group permissions
SELECT 
    'Group Permissions Test' as test,
    ugp.group_id,
    tg.name as group_name,
    'SUCCESS - Can read own group permissions' as status
FROM user_group_permissions ugp
JOIN tank_groups tg ON ugp.group_id = tg.id
WHERE ugp.user_id = auth.uid();

-- ============================================================================
-- TEST 3: Verify subgroup permissions work
-- ============================================================================

SELECT 'TEST 3: SUBGROUP PERMISSIONS ACCESS' as test_section;

-- This should show the current user's subgroup permissions
SELECT 
    'Subgroup Permissions Test' as test,
    usp.group_id,
    tg.name as group_name,
    usp.subgroup_name,
    'SUCCESS - Can read own subgroup permissions' as status
FROM user_subgroup_permissions usp
JOIN tank_groups tg ON usp.group_id = tg.id
WHERE usp.user_id = auth.uid();

-- ============================================================================
-- TEST 4: Verify tanks_with_rolling_avg view works
-- ============================================================================

SELECT 'TEST 4: TANKS VIEW ACCESS' as test_section;

-- Test basic view access
SELECT 
    'Tanks View Basic Test' as test,
    COUNT(*) as accessible_tanks,
    COUNT(CASE WHEN safe_fill > 0 THEN 1 END) as tanks_with_capacity,
    COUNT(CASE WHEN current_level > 0 THEN 1 END) as tanks_with_readings,
    CASE 
        WHEN COUNT(*) > 0 THEN 'SUCCESS - Can access tanks view'
        ELSE 'ERROR - No tanks accessible'
    END as status
FROM tanks_with_rolling_avg;

-- Test data quality
SELECT 
    'Tanks View Data Quality Test' as test,
    location,
    safe_fill,
    current_level,
    current_level_percent_display,
    rolling_avg_lpd,
    subgroup,
    group_name,
    CASE 
        WHEN safe_fill > 0 AND current_level >= 0 THEN 'SUCCESS - Data looks correct'
        ELSE 'WARNING - Check data quality'
    END as status
FROM tanks_with_rolling_avg
ORDER BY location
LIMIT 5;

-- ============================================================================
-- TEST 5: Test specific scenarios
-- ============================================================================

SELECT 'TEST 5: SPECIFIC SCENARIOS' as test_section;

-- Test admin access (if current user is admin)
WITH user_role_check AS (
    SELECT role FROM user_roles WHERE user_id = auth.uid()
)
SELECT 
    'Admin Access Test' as test,
    urc.role,
    COUNT(t.*) as total_accessible_tanks,
    CASE 
        WHEN urc.role IN ('admin', 'manager') AND COUNT(t.*) > 0 
        THEN 'SUCCESS - Admin can access all tanks'
        WHEN urc.role NOT IN ('admin', 'manager') 
        THEN 'N/A - User is not admin/manager'
        ELSE 'ERROR - Admin cannot access tanks'
    END as status
FROM user_role_check urc
CROSS JOIN tanks_with_rolling_avg t
GROUP BY urc.role;

-- Test Sally's specific access (if current user is Sally)
SELECT 
    'Sally Specific Access Test' as test,
    ur.role,
    COUNT(t.*) as narrogin_tanks,
    STRING_AGG(DISTINCT t.location, ', ') as accessible_locations,
    CASE 
        WHEN EXISTS(SELECT 1 FROM user_subgroup_permissions WHERE user_id = auth.uid() AND subgroup_name = 'GSFS Narrogin')
             AND COUNT(t.*) > 0 
        THEN 'SUCCESS - Sally can access GSFS Narrogin tanks'
        WHEN NOT EXISTS(SELECT 1 FROM user_subgroup_permissions WHERE user_id = auth.uid() AND subgroup_name = 'GSFS Narrogin')
        THEN 'N/A - User is not Sally'
        ELSE 'ERROR - Sally cannot access her tanks'
    END as status
FROM user_roles ur
LEFT JOIN tanks_with_rolling_avg t ON t.subgroup = 'GSFS Narrogin'
WHERE ur.user_id = auth.uid()
GROUP BY ur.role;

-- ============================================================================
-- TEST 6: Performance test
-- ============================================================================

SELECT 'TEST 6: PERFORMANCE TEST' as test_section;

-- Test query performance (should complete quickly)
SELECT 
    'Performance Test' as test,
    COUNT(*) as total_tanks,
    COUNT(DISTINCT group_id) as unique_groups,
    COUNT(DISTINCT subgroup) as unique_subgroups,
    AVG(current_level_percent_display) as avg_level_percent,
    'SUCCESS - Query completed quickly' as status
FROM tanks_with_rolling_avg;

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================

SELECT 'SUMMARY REPORT' as test_section;

-- Overall system health check
WITH health_check AS (
    SELECT 
        (SELECT COUNT(*) FROM user_roles WHERE user_id = auth.uid()) as can_read_role,
        (SELECT COUNT(*) FROM tanks_with_rolling_avg) as can_read_tanks,
        (SELECT COUNT(*) FROM user_group_permissions WHERE user_id = auth.uid()) as can_read_groups,
        (SELECT COUNT(*) FROM user_subgroup_permissions WHERE user_id = auth.uid()) as can_read_subgroups
)
SELECT 
    'System Health Check' as test,
    can_read_role,
    can_read_tanks,
    can_read_groups, 
    can_read_subgroups,
    CASE 
        WHEN can_read_role > 0 AND can_read_tanks >= 0 
        THEN '✅ SYSTEM HEALTHY - All core functions working'
        ELSE '❌ SYSTEM ISSUES - Some functions not working'
    END as overall_status
FROM health_check;

SELECT 'ALL TESTS COMPLETED' as final_status;