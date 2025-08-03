-- Fix Infinite Recursion in RLS Policies
-- This script fixes the circular dependency in user_roles RLS policies

-- ============================================================================
-- STEP 1: Drop all existing policies on user_roles table
-- ============================================================================

-- Drop all existing policies that might cause recursion
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_roles;
DROP POLICY IF EXISTS "Admins and managers can manage all user roles" ON user_roles;

-- ============================================================================
-- STEP 2: Create simple, non-recursive policies
-- ============================================================================

-- Allow users to read their own role (simple, no recursion)
CREATE POLICY "Users can view their own role" ON user_roles
FOR SELECT USING (
    user_id = auth.uid()
);

-- Allow users to insert their own role (for new users)
CREATE POLICY "Users can insert their own role" ON user_roles
FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

-- Allow users to update their own role
CREATE POLICY "Users can update their own role" ON user_roles
FOR UPDATE USING (
    user_id = auth.uid()
);

-- ============================================================================
-- STEP 3: Create admin management policy using a different approach
-- ============================================================================

-- Create a function to check if user is admin (avoids recursion)
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user has admin role in user_roles table
    -- Use a direct query that bypasses RLS for this check
    RETURN EXISTS (
        SELECT 1 
        FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user is admin or manager
CREATE OR REPLACE FUNCTION is_admin_or_manager_user()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user has admin or manager role
    RETURN EXISTS (
        SELECT 1 
        FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow admins and managers to manage all user roles
CREATE POLICY "Admins and managers can manage all user roles" ON user_roles
FOR ALL USING (
    is_admin_or_manager_user()
);

-- ============================================================================
-- STEP 4: Update other RLS policies to use the new functions
-- ============================================================================

-- Drop existing policies that might have recursion issues
DROP POLICY IF EXISTS "Users can view tanks in their assigned groups" ON fuel_tanks;
DROP POLICY IF EXISTS "Users can manage dips for accessible tanks" ON dip_readings;
DROP POLICY IF EXISTS "Users can view alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can acknowledge alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can view their accessible groups" ON tank_groups;

-- Create updated policies using the new functions
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

-- ============================================================================
-- STEP 5: Verify the fix
-- ============================================================================

-- Test the functions
SELECT 
    'Testing admin check function' as test_name,
    is_admin_user() as is_admin,
    is_admin_or_manager_user() as is_admin_or_manager;

-- Show all policies for verification
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
WHERE tablename IN ('fuel_tanks', 'dip_readings', 'tank_alerts', 'tank_groups', 'user_roles')
ORDER BY tablename, policyname;

-- ============================================================================
-- STEP 6: Status report
-- ============================================================================

SELECT 'Infinite recursion fixed in RLS policies' as status;

-- Show current roles in the system
SELECT 
    role,
    COUNT(*) as user_count
FROM user_roles 
GROUP BY role 
ORDER BY role; 