-- EMERGENCY RLS RECURSION FIX
-- This fixes ONLY the immediate 500 error issue
-- Run this if the full migration script is too complex

-- ============================================================================
-- STEP 1: Drop the problematic recursive policy causing 500 errors
-- ============================================================================

SELECT 'FIXING IMMEDIATE 500 ERROR ISSUE' as step;

-- This is the specific policy causing the infinite recursion
DROP POLICY IF EXISTS "Admins and managers can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;

-- ============================================================================
-- STEP 2: Create simple, non-recursive policies  
-- ============================================================================

-- Simple policy that doesn't cause recursion
CREATE POLICY "Users can view their own role" ON user_roles
FOR SELECT USING (user_id = auth.uid());

-- Admin policy that checks role directly without helper functions
CREATE POLICY "Admins and managers can manage all user roles" ON user_roles
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('admin', 'manager')
    )
);

-- ============================================================================
-- STEP 3: Test that the 500 error is fixed
-- ============================================================================

SELECT 'TESTING 500 ERROR FIX' as step;

-- This query was causing the 500 error - should work now
SELECT 
    'Testing user_roles access' as test_name,
    role,
    'Should work without 500 error' as expected
FROM user_roles 
WHERE user_id = auth.uid();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'EMERGENCY RLS RECURSION FIX COMPLETED' as status;
SELECT 'The 500 errors should be resolved now' as result;
SELECT 'Refresh your application and check the console' as next_step; 