-- EMERGENCY RECURSION FIX
-- This script fixes the infinite recursion in RLS policies that's causing 500 errors

-- ============================================================================
-- STEP 1: Drop all policies that depend on helper functions FIRST
-- ============================================================================

SELECT 'DROPPING DEPENDENT POLICIES' as step;

-- Drop policies on user_roles
DROP POLICY IF EXISTS "Admins and managers can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Users can insert their own role" ON user_roles;
DROP POLICY IF EXISTS "Users can update their own role" ON user_roles;
DROP POLICY IF EXISTS "Service role can manage all user roles" ON user_roles;

-- Drop policies on user_group_permissions
DROP POLICY IF EXISTS "Admins and managers can manage all group permissions" ON user_group_permissions;
DROP POLICY IF EXISTS "Users can view their own group permissions" ON user_group_permissions;

-- Drop policies on user_subgroup_permissions  
DROP POLICY IF EXISTS "Admins and managers can manage all subgroup permissions" ON user_subgroup_permissions;
DROP POLICY IF EXISTS "Users can view their own subgroup permissions" ON user_subgroup_permissions;

-- Drop policies on fuel_tanks
DROP POLICY IF EXISTS "Users can view tanks in their assigned groups or subgroups" ON fuel_tanks;
DROP POLICY IF EXISTS "Users can view tanks in their assigned groups" ON fuel_tanks;

-- Drop policies on tank_groups
DROP POLICY IF EXISTS "Users can view their accessible groups" ON tank_groups;

-- Drop policies on dip_readings
DROP POLICY IF EXISTS "Users can manage dips for accessible tanks" ON dip_readings;

-- Drop policies on tank_alerts
DROP POLICY IF EXISTS "Users can view alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can acknowledge alerts for accessible tanks" ON tank_alerts;

-- ============================================================================
-- STEP 2: NOW we can safely drop and recreate helper functions
-- ============================================================================

SELECT 'FIXING HELPER FUNCTIONS' as step;

-- Drop existing functions that may be causing recursion
DROP FUNCTION IF EXISTS is_admin_user();
DROP FUNCTION IF EXISTS is_admin_or_manager_user();
DROP FUNCTION IF EXISTS user_has_tank_access_with_subgroups(UUID);
DROP FUNCTION IF EXISTS user_has_group_access_with_subgroups(UUID);

-- Create NON-RECURSIVE helper functions with proper RLS bypass
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
    -- Use a direct query with NO RLS dependency
    -- This function will be called by RLS policies, so it must NOT trigger RLS itself
    RETURN (
        SELECT role = 'admin'
        FROM public.user_roles 
        WHERE user_id = auth.uid()
        LIMIT 1
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

-- Create admin or manager function with proper RLS bypass
CREATE OR REPLACE FUNCTION is_admin_or_manager_user()
RETURNS BOOLEAN AS $$
BEGIN
    -- Use a direct query with NO RLS dependency
    -- This function will be called by RLS policies, so it must NOT trigger RLS itself
    RETURN (
        SELECT role IN ('admin', 'manager')
        FROM public.user_roles 
        WHERE user_id = auth.uid()
        LIMIT 1
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_or_manager_user() TO authenticated;

-- Create the subgroup access helper functions too
CREATE OR REPLACE FUNCTION user_has_tank_access_with_subgroups(tank_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Admin and manager users can access everything
    IF EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager')
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has full group access
    IF EXISTS (
        SELECT 1 FROM fuel_tanks ft
        JOIN user_group_permissions ugp ON ft.group_id = ugp.group_id
        WHERE ugp.user_id = auth.uid() AND ft.id = tank_id
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has subgroup access
    RETURN EXISTS (
        SELECT 1 FROM fuel_tanks ft
        JOIN user_subgroup_permissions usp ON ft.group_id = usp.group_id
        WHERE usp.user_id = auth.uid() 
        AND ft.id = tank_id
        AND ft.subgroup = usp.subgroup_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

CREATE OR REPLACE FUNCTION user_has_group_access_with_subgroups(target_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Admin and manager users can access everything
    IF EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager')
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has full group access
    IF EXISTS (
        SELECT 1 FROM user_group_permissions
        WHERE user_id = auth.uid() AND group_id = target_group_id
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has any subgroup access within this group
    RETURN EXISTS (
        SELECT 1 FROM user_subgroup_permissions
        WHERE user_id = auth.uid() AND group_id = target_group_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION user_has_tank_access_with_subgroups(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_group_access_with_subgroups(UUID) TO authenticated;

-- ============================================================================
-- STEP 3: Create NON-RECURSIVE policies for user_roles
-- ============================================================================

SELECT 'CREATING NON-RECURSIVE USER_ROLES POLICIES' as step;

-- Create SIMPLE, NON-RECURSIVE policies for user_roles
-- CRITICAL: These policies CANNOT call helper functions that query user_roles

-- Policy 1: Users can read their own role (simple, no function calls)
CREATE POLICY "Users can view their own role" ON user_roles
FOR SELECT USING (
    user_id = auth.uid()
);

-- Policy 2: Users can insert their own role (for new user creation)
CREATE POLICY "Users can insert their own role" ON user_roles
FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

-- Policy 3: Users can update their own role (basic self-management)
CREATE POLICY "Users can update their own role" ON user_roles
FOR UPDATE USING (
    user_id = auth.uid()
) WITH CHECK (
    user_id = auth.uid()
);

-- Policy 4: Bypass RLS for service role (admin operations)
-- This allows backend/admin operations to manage all roles
CREATE POLICY "Service role can manage all user roles" ON user_roles
FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role'
);

-- ============================================================================
-- STEP 4: Create policies for other tables using the fixed helper functions
-- ============================================================================

SELECT 'CREATING POLICIES FOR OTHER TABLES' as step;

-- Create policies for user_group_permissions
CREATE POLICY "Users can view their own group permissions" ON user_group_permissions
FOR SELECT USING (
    user_id = auth.uid()
);

CREATE POLICY "Admins and managers can manage all group permissions" ON user_group_permissions
FOR ALL USING (
    is_admin_or_manager_user()
);

-- Create policies for user_subgroup_permissions
CREATE POLICY "Users can view their own subgroup permissions" ON user_subgroup_permissions
FOR SELECT USING (
    user_id = auth.uid()
);

CREATE POLICY "Admins and managers can manage all subgroup permissions" ON user_subgroup_permissions
FOR ALL USING (
    is_admin_or_manager_user()
);

-- Create policies for fuel_tanks
CREATE POLICY "Users can view tanks in their assigned groups or subgroups" ON fuel_tanks
FOR SELECT USING (
    is_admin_or_manager_user()
    OR
    EXISTS (
        SELECT 1 FROM user_group_permissions
        WHERE user_group_permissions.user_id = auth.uid()
        AND user_group_permissions.group_id = fuel_tanks.group_id
    )
    OR
    EXISTS (
        SELECT 1 FROM user_subgroup_permissions
        WHERE user_subgroup_permissions.user_id = auth.uid()
        AND user_subgroup_permissions.group_id = fuel_tanks.group_id
        AND user_subgroup_permissions.subgroup_name = fuel_tanks.subgroup
    )
);

-- Create policies for tank_groups
CREATE POLICY "Users can view their accessible groups" ON tank_groups
FOR SELECT USING (
    user_has_group_access_with_subgroups(id)
);

-- Create policies for dip_readings
CREATE POLICY "Users can manage dips for accessible tanks" ON dip_readings
FOR ALL USING (
    user_has_tank_access_with_subgroups(tank_id)
);

-- Create policies for tank_alerts
CREATE POLICY "Users can view alerts for accessible tanks" ON tank_alerts
FOR SELECT USING (
    user_has_tank_access_with_subgroups(tank_id)
);

CREATE POLICY "Users can acknowledge alerts for accessible tanks" ON tank_alerts
FOR UPDATE USING (
    user_has_tank_access_with_subgroups(tank_id)
);

-- ============================================================================
-- STEP 5: Test the helper functions work without recursion
-- ============================================================================

SELECT 'TESTING HELPER FUNCTIONS' as step;

-- Test that we can call the helper functions without errors
SELECT 
    'Helper Function Test' as test,
    is_admin_user() as is_admin_result,
    is_admin_or_manager_user() as is_admin_or_manager_result,
    'Functions executed successfully' as status;

-- ============================================================================
-- STEP 6: Test user_roles access works
-- ============================================================================

SELECT 'TESTING USER_ROLES ACCESS' as step;

-- Test that we can query user_roles without infinite recursion
SELECT 
    'User Roles Query Test' as test,
    COUNT(*) as total_users,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
    COUNT(CASE WHEN role = 'manager' THEN 1 END) as manager_count,
    COUNT(CASE WHEN role = 'user' THEN 1 END) as user_count,
    'Query completed successfully' as status
FROM user_roles;

-- Test that current user can read their own role
SELECT 
    'Current User Role Test' as test,
    role,
    user_id,
    'Can read own role successfully' as status
FROM user_roles 
WHERE user_id = auth.uid();

-- ============================================================================
-- STEP 7: Test complete permissions flow
-- ============================================================================

SELECT 'TESTING COMPLETE PERMISSIONS FLOW' as step;

-- Test that useUserPermissions queries will now work
SELECT 
    'User Permissions Flow Test' as test,
    ur.role,
    COUNT(DISTINCT ugp.group_id) as group_permissions,
    COUNT(DISTINCT usp.group_id) as subgroup_permissions,
    'Permissions query successful' as status
FROM user_roles ur
LEFT JOIN user_group_permissions ugp ON ur.user_id = ugp.user_id
LEFT JOIN user_subgroup_permissions usp ON ur.user_id = usp.user_id
WHERE ur.user_id = auth.uid()
GROUP BY ur.role;

-- ============================================================================
-- STEP 8: Final verification
-- ============================================================================

SELECT 'FINAL VERIFICATION' as step;

-- Show all policies are working
SELECT 
    'RLS Policy Status' as report,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename IN ('user_roles', 'user_group_permissions', 'user_subgroup_permissions', 'fuel_tanks')
GROUP BY tablename
ORDER BY tablename;

-- Test function permissions
SELECT 
    'Function Permissions Test' as test,
    has_function_privilege('is_admin_user()', 'execute') as can_execute_admin_check,
    has_function_privilege('is_admin_or_manager_user()', 'execute') as can_execute_manager_check,
    'Function permissions verified' as status;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'RECURSION FIX COMPLETED' as status;
SELECT 'user_roles table now has simple, non-recursive policies' as fix_1;
SELECT 'Helper functions properly bypass RLS using SECURITY DEFINER' as fix_2;
SELECT 'Other table policies can safely use helper functions' as fix_3;
SELECT 'Frontend useUserPermissions hook should now work without 500 errors' as result;