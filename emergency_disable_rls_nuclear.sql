-- Emergency Access Fix - Nuclear Option
-- This script temporarily grants full access to bypass infinite recursion
-- WARNING: This removes all security temporarily - use only for emergency access

-- ============================================================================
-- STEP 1: Completely disable RLS on all tables
-- ============================================================================

SELECT 'DISABLING RLS ON ALL TABLES' as step;

-- Disable RLS on all tables to break the recursion
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_tanks DISABLE ROW LEVEL SECURITY;
ALTER TABLE dip_readings DISABLE ROW LEVEL SECURITY;
ALTER TABLE tank_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE tank_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_group_permissions DISABLE ROW LEVEL SECURITY;

-- Also disable on subgroup permissions if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subgroup_permissions') THEN
        ALTER TABLE user_subgroup_permissions DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Drop ALL existing policies
-- ============================================================================

SELECT 'DROPPING ALL EXISTING POLICIES' as step;

-- Drop all policies on user_roles
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_roles;
DROP POLICY IF EXISTS "Admins and managers can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can insert their own role" ON user_roles;
DROP POLICY IF EXISTS "Users can update their own role" ON user_roles;

-- Drop all policies on fuel_tanks
DROP POLICY IF EXISTS "Users can view tanks in their assigned groups" ON fuel_tanks;
DROP POLICY IF EXISTS "Users can view tanks in their assigned groups or subgroups" ON fuel_tanks;

-- Drop all policies on dip_readings
DROP POLICY IF EXISTS "Users can manage dips for accessible tanks" ON dip_readings;

-- Drop all policies on tank_alerts
DROP POLICY IF EXISTS "Users can view alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can acknowledge alerts for accessible tanks" ON tank_alerts;

-- Drop all policies on tank_groups
DROP POLICY IF EXISTS "Users can view their accessible groups" ON tank_groups;

-- Drop all policies on user_group_permissions
DROP POLICY IF EXISTS "Users can view their own group permissions" ON user_group_permissions;
DROP POLICY IF EXISTS "Admins and managers can manage all group permissions" ON user_group_permissions;

-- Drop policies on user_subgroup_permissions if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subgroup_permissions') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can view their own subgroup permissions" ON user_subgroup_permissions';
        EXECUTE 'DROP POLICY IF EXISTS "Admins and managers can manage all subgroup permissions" ON user_subgroup_permissions';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Drop any existing helper functions that cause recursion
-- ============================================================================

SELECT 'DROPPING PROBLEMATIC HELPER FUNCTIONS' as step;

DROP FUNCTION IF EXISTS is_admin_user();
DROP FUNCTION IF EXISTS is_admin_or_manager_user();
DROP FUNCTION IF EXISTS user_has_tank_access_with_subgroups(UUID);
DROP FUNCTION IF EXISTS user_has_group_access_with_subgroups(UUID);

-- ============================================================================
-- STEP 4: Grant full access to all users temporarily
-- ============================================================================

SELECT 'GRANTING FULL ACCESS TO AUTHENTICATED USERS' as step;

-- Grant full access to authenticated users on all tables
GRANT ALL ON user_roles TO authenticated;
GRANT ALL ON fuel_tanks TO authenticated;
GRANT ALL ON dip_readings TO authenticated;
GRANT ALL ON tank_alerts TO authenticated;
GRANT ALL ON tank_groups TO authenticated;
GRANT ALL ON user_group_permissions TO authenticated;

-- Grant on subgroup permissions if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subgroup_permissions') THEN
        GRANT ALL ON user_subgroup_permissions TO authenticated;
    END IF;
END $$;

-- Also grant on the view
GRANT SELECT ON tanks_with_rolling_avg TO authenticated;

-- ============================================================================
-- STEP 5: Test that everything works
-- ============================================================================

SELECT 'TESTING DATABASE ACCESS' as step;

-- Test that we can query all tables
SELECT 
    'Testing user_roles query' as test_name,
    COUNT(*) as total_users,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
    COUNT(CASE WHEN role = 'manager' THEN 1 END) as manager_count
FROM user_roles;

SELECT 
    'Testing tank_groups query' as test_name,
    COUNT(*) as total_groups
FROM tank_groups;

SELECT 
    'Testing fuel_tanks query' as test_name,
    COUNT(*) as total_tanks,
    COUNT(CASE WHEN subgroup = 'GSFS Narrogin' THEN 1 END) as narrogin_tanks
FROM fuel_tanks;

SELECT 
    'Testing dip_readings query' as test_name,
    COUNT(*) as total_dips
FROM dip_readings;

-- CRITICAL TEST: Check if the view now returns data
SELECT 
    'Testing tanks_with_rolling_avg view' as test_name,
    COUNT(*) as total_tanks_in_view,
    COUNT(CASE WHEN subgroup = 'GSFS Narrogin' THEN 1 END) as narrogin_tanks_in_view,
    COUNT(CASE WHEN current_level_percent > 0 THEN 1 END) as tanks_with_percentage
FROM tanks_with_rolling_avg;

-- Test GSFS Narrogin specifically
SELECT 
    'GSFS Narrogin Tank Test' as test_name,
    location,
    current_level,
    safe_level,
    current_level_percent,
    CASE 
        WHEN current_level_percent > 0 THEN '✅ WORKING'
        ELSE '❌ STILL BROKEN'
    END as status
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin'
ORDER BY location;

-- ============================================================================
-- STEP 6: Status report
-- ============================================================================

SELECT 'EMERGENCY ACCESS FIX COMPLETED' as status;
SELECT 'All users now have full access to bypass RLS issues' as result;

-- Show current roles in the system
SELECT 
    'Current User Roles' as report_type,
    role,
    COUNT(*) as user_count
FROM user_roles 
GROUP BY role 
ORDER BY role;

-- Show current groups
SELECT 
    'Current Tank Groups' as report_type,
    name,
    COUNT(ft.id) as tank_count
FROM tank_groups tg
LEFT JOIN fuel_tanks ft ON tg.id = ft.group_id
GROUP BY tg.id, tg.name
ORDER BY tg.name;

-- ============================================================================
-- IMPORTANT: NEXT STEPS
-- ============================================================================

SELECT 'NEXT STEPS:' as instruction;
SELECT '1. Test the application - tanks should show percentages now' as step1;
SELECT '2. Refresh frontend and check GSFS Narrogin tanks show 61%, 14%, 77%' as step2;
SELECT '3. Once confirmed working, plan to restore proper security later' as step3;
SELECT '4. Consider creating new RLS policies without recursion issues' as step4;

SELECT 'WARNING: Security is currently disabled - restore RLS when app is stable' as security_warning;