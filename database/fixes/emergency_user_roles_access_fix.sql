-- Emergency Fix for user_roles 500 Error
-- This script fixes the RLS policies on user_roles table that are causing 500 errors

-- ============================================================================
-- STEP 1: Check current policies on user_roles table
-- ============================================================================

-- Show current policies
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
WHERE tablename = 'user_roles';

-- ============================================================================
-- STEP 2: Drop problematic policies
-- ============================================================================

-- Drop all existing policies on user_roles table
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_roles;

-- ============================================================================
-- STEP 3: Create simple, working policies
-- ============================================================================

-- Allow users to read their own role (this is what the frontend needs)
CREATE POLICY "Users can view their own role" ON user_roles
FOR SELECT USING (
    user_id = auth.uid()
);

-- Allow admins and managers to manage all user roles
CREATE POLICY "Admins and managers can manage all user roles" ON user_roles
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager')
    )
);

-- ============================================================================
-- STEP 4: Verify the fix
-- ============================================================================

-- Test query to verify the policy works
-- This should return the current user's role without error
SELECT 
    'Current user role test' as test_name,
    (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1) as current_user_role;

-- Show updated policies
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
WHERE tablename = 'user_roles'
ORDER BY policyname;

-- ============================================================================
-- STEP 5: Status report
-- ============================================================================

SELECT 'user_roles RLS policies fixed' as status;

-- Show current roles in the system
SELECT 
    role,
    COUNT(*) as user_count
FROM user_roles 
GROUP BY role 
ORDER BY role; 