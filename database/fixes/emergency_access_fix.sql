-- Emergency Access Fix - Nuclear Option
-- This script temporarily grants full access to bypass infinite recursion
-- WARNING: This removes all security temporarily - use only for emergency access

-- ============================================================================
-- STEP 1: Completely disable RLS on all tables
-- ============================================================================

-- Disable RLS on all tables to break the recursion
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_tanks DISABLE ROW LEVEL SECURITY;
ALTER TABLE dip_readings DISABLE ROW LEVEL SECURITY;
ALTER TABLE tank_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE tank_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_group_permissions DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Drop ALL existing policies
-- ============================================================================

-- Drop all policies on user_roles
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_roles;
DROP POLICY IF EXISTS "Admins and managers can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can insert their own role" ON user_roles;
DROP POLICY IF EXISTS "Users can update their own role" ON user_roles;

-- Drop all policies on fuel_tanks
DROP POLICY IF EXISTS "Users can view tanks in their assigned groups" ON fuel_tanks;

-- Drop all policies on dip_readings
DROP POLICY IF EXISTS "Users can manage dips for accessible tanks" ON dip_readings;

-- Drop all policies on tank_alerts
DROP POLICY IF EXISTS "Users can view alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can acknowledge alerts for accessible tanks" ON tank_alerts;

-- Drop all policies on tank_groups
DROP POLICY IF EXISTS "Users can view their accessible groups" ON tank_groups;

-- Drop all policies on user_group_permissions
DROP POLICY IF EXISTS "Users can view their own group permissions" ON user_group_permissions;

-- ============================================================================
-- STEP 3: Drop any existing helper functions
-- ============================================================================

DROP FUNCTION IF EXISTS is_admin_user();
DROP FUNCTION IF EXISTS is_admin_or_manager_user();

-- ============================================================================
-- STEP 4: Grant full access to all users temporarily
-- ============================================================================

-- Grant full access to authenticated users on all tables
GRANT ALL ON user_roles TO authenticated;
GRANT ALL ON fuel_tanks TO authenticated;
GRANT ALL ON dip_readings TO authenticated;
GRANT ALL ON tank_alerts TO authenticated;
GRANT ALL ON tank_groups TO authenticated;
GRANT ALL ON user_group_permissions TO authenticated;

-- ============================================================================
-- STEP 5: Test that everything works
-- ============================================================================

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
    COUNT(*) as total_tanks
FROM fuel_tanks;

SELECT 
    'Testing dip_readings query' as test_name,
    COUNT(*) as total_dips
FROM dip_readings;

-- ============================================================================
-- STEP 6: Status report
-- ============================================================================

SELECT 'Emergency access fix completed - all users have full access' as status;

-- Show current roles in the system
SELECT 
    role,
    COUNT(*) as user_count
FROM user_roles 
GROUP BY role 
ORDER BY role;

-- Show current groups
SELECT 
    name,
    COUNT(ft.id) as tank_count
FROM tank_groups tg
LEFT JOIN fuel_tanks ft ON tg.id = ft.group_id
GROUP BY tg.id, tg.name
ORDER BY tg.name;

-- ============================================================================
-- IMPORTANT: NEXT STEPS
-- ============================================================================

SELECT 
    'NEXT STEPS:' as instruction,
    '1. Test the application - it should work now' as step1,
    '2. Once working, run emergency_rls_fix.sql to restore proper security' as step2,
    '3. Monitor for any issues after restoring RLS' as step3; 