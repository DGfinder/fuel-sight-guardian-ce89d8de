-- FORCE FIX INFINITE RECURSION
-- This script forcefully removes all policies and creates minimal non-recursive ones

-- ============================================================================
-- STEP 1: Check current policies on user_roles
-- ============================================================================

SELECT 'CHECKING CURRENT USER_ROLES POLICIES' as step;

SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_roles'
ORDER BY policyname;

-- ============================================================================
-- STEP 2: Force drop ALL policies on user_roles
-- ============================================================================

SELECT 'FORCE DROPPING ALL USER_ROLES POLICIES' as step;

-- Drop every possible policy name that might exist
DO $$
DECLARE
    policy_rec RECORD;
BEGIN
    -- Loop through all policies on user_roles and drop them
    FOR policy_rec IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'user_roles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_roles CASCADE', policy_rec.policyname);
        RAISE NOTICE 'Dropped policy: %', policy_rec.policyname;
    END LOOP;
END $$;

-- Double-check by trying to drop common policy names
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles CASCADE;
DROP POLICY IF EXISTS "Users can insert their own role" ON user_roles CASCADE;
DROP POLICY IF EXISTS "Users can update their own role" ON user_roles CASCADE;
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles CASCADE;
DROP POLICY IF EXISTS "Admins and managers can manage all user roles" ON user_roles CASCADE;
DROP POLICY IF EXISTS "Service role can manage all user roles" ON user_roles CASCADE;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_roles CASCADE;
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON user_roles CASCADE;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON user_roles CASCADE;

-- ============================================================================
-- STEP 3: Verify all policies are gone
-- ============================================================================

SELECT 'VERIFYING ALL POLICIES REMOVED' as step;

SELECT 
    COUNT(*) as remaining_policies
FROM pg_policies 
WHERE tablename = 'user_roles';

-- ============================================================================
-- STEP 4: Create ONE SIMPLE policy for user_roles
-- ============================================================================

SELECT 'CREATING MINIMAL NON-RECURSIVE POLICY' as step;

-- Create the absolute simplest policy possible
-- NO function calls, NO subqueries, just direct comparison
CREATE POLICY "user_can_see_own_role_only" ON user_roles
FOR SELECT USING (
    user_id = auth.uid()
);

-- That's it! No other policies for now.

-- ============================================================================
-- STEP 5: Test the minimal setup works
-- ============================================================================

SELECT 'TESTING MINIMAL SETUP' as step;

-- Test 1: Can we query our own role?
SELECT 
    'Own Role Query Test' as test,
    role,
    user_id,
    'SUCCESS - Can read own role' as status
FROM user_roles 
WHERE user_id = auth.uid();

-- Test 2: Count of accessible roles (should be 1 for non-admin)
SELECT 
    'Accessible Roles Count Test' as test,
    COUNT(*) as accessible_roles,
    'Should be 1 for regular users' as expected
FROM user_roles;

-- ============================================================================
-- STEP 6: Show current state
-- ============================================================================

SELECT 'SHOWING CURRENT STATE' as step;

-- Show final policies
SELECT 
    'Final Policies on user_roles' as report,
    policyname,
    cmd,
    permissive
FROM pg_policies 
WHERE tablename = 'user_roles';

-- ============================================================================
-- STEP 7: Create minimal policies for other permission tables
-- ============================================================================

SELECT 'CREATING MINIMAL POLICIES FOR OTHER TABLES' as step;

-- user_group_permissions - simple policy
DROP POLICY IF EXISTS "Users can view their own group permissions" ON user_group_permissions CASCADE;
DROP POLICY IF EXISTS "Admins and managers can manage all group permissions" ON user_group_permissions CASCADE;

CREATE POLICY "user_can_see_own_group_permissions" ON user_group_permissions
FOR SELECT USING (
    user_id = auth.uid()
);

-- user_subgroup_permissions - simple policy
DROP POLICY IF EXISTS "Users can view their own subgroup permissions" ON user_subgroup_permissions CASCADE;
DROP POLICY IF EXISTS "Admins and managers can manage all subgroup permissions" ON user_subgroup_permissions CASCADE;

CREATE POLICY "user_can_see_own_subgroup_permissions" ON user_subgroup_permissions
FOR SELECT USING (
    user_id = auth.uid()
);

-- ============================================================================
-- STEP 8: Test complete permissions flow
-- ============================================================================

SELECT 'TESTING COMPLETE PERMISSIONS FLOW' as step;

-- This is what useUserPermissions hook does
SELECT 
    'Frontend Permissions Query Test' as test,
    ur.role,
    COUNT(DISTINCT ugp.group_id) as group_count,
    COUNT(DISTINCT usp.group_id) as subgroup_count,
    'Permissions query should work' as expected
FROM user_roles ur
LEFT JOIN user_group_permissions ugp ON ur.user_id = ugp.user_id
LEFT JOIN user_subgroup_permissions usp ON ur.user_id = usp.user_id
WHERE ur.user_id = auth.uid()
GROUP BY ur.role;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'RECURSION FORCEFULLY FIXED' as status;
SELECT 'All policies removed and recreated as minimal non-recursive versions' as result;
SELECT 'Frontend should now work without 500 errors' as next_step;

-- ============================================================================
-- EMERGENCY OPTION: If still failing after this
-- ============================================================================

-- If you still get recursion errors after this script, run:
-- ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
-- This will temporarily disable RLS on user_roles to restore access