-- Emergency RLS Fix - Complete Reset
-- This script completely disables RLS and rebuilds it from scratch

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
-- STEP 4: Test that we can query user_roles without recursion
-- ============================================================================

-- This should work now that RLS is disabled
SELECT 
    'Testing user_roles query with RLS disabled' as test_name,
    COUNT(*) as total_users,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
    COUNT(CASE WHEN role = 'manager' THEN 1 END) as manager_count
FROM user_roles;

-- ============================================================================
-- STEP 5: Create completely isolated helper functions
-- ============================================================================

-- Create a function to check if user is admin (completely isolated from RLS)
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Use SECURITY DEFINER to run as the function owner (bypasses RLS)
    -- Direct query to user_roles table without any RLS interference
    SELECT role INTO user_role
    FROM user_roles 
    WHERE user_id = auth.uid();
    
    RETURN user_role = 'admin';
EXCEPTION
    WHEN OTHERS THEN
        -- If anything goes wrong, return false
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user is admin or manager (completely isolated from RLS)
CREATE OR REPLACE FUNCTION is_admin_or_manager_user()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Use SECURITY DEFINER to run as the function owner (bypasses RLS)
    -- Direct query to user_roles table without any RLS interference
    SELECT role INTO user_role
    FROM user_roles 
    WHERE user_id = auth.uid();
    
    RETURN user_role IN ('admin', 'manager');
EXCEPTION
    WHEN OTHERS THEN
        -- If anything goes wrong, return false
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: Test the helper functions work before enabling RLS
-- ============================================================================

-- Test the helper functions (should work with RLS disabled)
SELECT 
    'Testing helper functions with RLS disabled' as test_name,
    is_admin_user() as is_admin,
    is_admin_or_manager_user() as is_admin_or_manager;

-- ============================================================================
-- STEP 7: Re-enable RLS on user_roles with simple policies
-- ============================================================================

-- Re-enable RLS on user_roles with simple policies
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Simple policy: users can read their own role
CREATE POLICY "Users can view their own role" ON user_roles
FOR SELECT USING (
    user_id = auth.uid()
);

-- Simple policy: users can insert their own role
CREATE POLICY "Users can insert their own role" ON user_roles
FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

-- Simple policy: users can update their own role
CREATE POLICY "Users can update their own role" ON user_roles
FOR UPDATE USING (
    user_id = auth.uid()
);

-- Admin policy using the helper function (this should not cause recursion)
CREATE POLICY "Admins can manage all user roles" ON user_roles
FOR ALL USING (
    is_admin_or_manager_user()
);

-- ============================================================================
-- STEP 8: Test the user_roles policies work
-- ============================================================================

-- Test the helper functions again (should still work with RLS enabled)
SELECT 
    'Testing helper functions with RLS enabled' as test_name,
    is_admin_user() as is_admin,
    is_admin_or_manager_user() as is_admin_or_manager;

-- Test querying user_roles (should work now)
SELECT 
    'Testing user_roles query with new policies' as test_name,
    COUNT(*) as total_users,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
    COUNT(CASE WHEN role = 'manager' THEN 1 END) as manager_count
FROM user_roles;

-- ============================================================================
-- STEP 9: Re-enable RLS on other tables with simple policies
-- ============================================================================

-- Re-enable RLS on fuel_tanks
ALTER TABLE fuel_tanks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tanks in their assigned groups" ON fuel_tanks
FOR SELECT USING (
    is_admin_or_manager_user()
    OR
    EXISTS (
        SELECT 1 FROM user_group_permissions
        WHERE user_group_permissions.user_id = auth.uid()
        AND user_group_permissions.group_id = fuel_tanks.group_id
    )
);

-- Re-enable RLS on dip_readings
ALTER TABLE dip_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage dips for accessible tanks" ON dip_readings
FOR ALL USING (
    is_admin_or_manager_user()
    OR
    EXISTS (
        SELECT 1
        FROM fuel_tanks ft
        JOIN user_group_permissions ugp ON ft.group_id = ugp.group_id
        WHERE ugp.user_id = auth.uid() AND ft.id = dip_readings.tank_id
    )
);

-- Re-enable RLS on tank_alerts
ALTER TABLE tank_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alerts for accessible tanks" ON tank_alerts
FOR SELECT USING (
    is_admin_or_manager_user()
    OR
    EXISTS (
        SELECT 1
        FROM fuel_tanks ft
        JOIN user_group_permissions ugp ON ft.group_id = ugp.group_id
        WHERE ugp.user_id = auth.uid() AND ft.id = tank_alerts.tank_id
    )
);

CREATE POLICY "Users can acknowledge alerts for accessible tanks" ON tank_alerts
FOR UPDATE USING (
    is_admin_or_manager_user()
    OR
    EXISTS (
        SELECT 1
        FROM fuel_tanks ft
        JOIN user_group_permissions ugp ON ft.group_id = ugp.group_id
        WHERE ugp.user_id = auth.uid() AND ft.id = tank_alerts.tank_id
    )
);

-- Re-enable RLS on tank_groups
ALTER TABLE tank_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their accessible groups" ON tank_groups
FOR SELECT USING (
    is_admin_or_manager_user()
    OR
    EXISTS (
        SELECT 1 FROM user_group_permissions
        WHERE user_group_permissions.user_id = auth.uid()
        AND user_group_permissions.group_id = tank_groups.id
    )
);

-- Re-enable RLS on user_group_permissions
ALTER TABLE user_group_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own group permissions" ON user_group_permissions
FOR SELECT USING (
    user_id = auth.uid()
);

-- ============================================================================
-- STEP 10: Final verification
-- ============================================================================

-- Show all policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('fuel_tanks', 'dip_readings', 'tank_alerts', 'tank_groups', 'user_roles', 'user_group_permissions')
ORDER BY tablename, policyname;

-- Test current user's permissions
SELECT 
    'Current user permissions test' as test_name,
    ur.role,
    COUNT(ugp.group_id) as group_count,
    STRING_AGG(tg.name, ', ') as accessible_groups
FROM user_roles ur
LEFT JOIN user_group_permissions ugp ON ur.user_id = ugp.user_id
LEFT JOIN tank_groups tg ON ugp.group_id = tg.id
WHERE ur.user_id = auth.uid()
GROUP BY ur.role;

-- ============================================================================
-- STEP 11: Status report
-- ============================================================================

SELECT 'Emergency RLS fix completed successfully' as status;

-- Show current roles in the system
SELECT 
    role,
    COUNT(*) as user_count
FROM user_roles 
GROUP BY role 
ORDER BY role; 