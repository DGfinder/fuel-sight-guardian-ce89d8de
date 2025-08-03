-- CLEAR LOGOUT LOOP
-- This script helps fix logout issues by checking auth state

-- ============================================================================
-- STEP 1: Check current auth session
-- ============================================================================

SELECT 'CHECKING AUTH SESSION' as step;

-- Show current user session info
SELECT 
    'Current Session Info' as check_type,
    auth.uid() as user_id,
    auth.jwt() ->> 'email' as email,
    auth.jwt() ->> 'role' as auth_role
WHERE auth.uid() IS NOT NULL

UNION ALL

SELECT 
    'No Active Session' as check_type,
    NULL as user_id,
    NULL as email,
    NULL as auth_role
WHERE auth.uid() IS NULL;

-- ============================================================================
-- STEP 2: Check user_roles table for current user
-- ============================================================================

SELECT 'CHECKING USER ROLE DATA' as step;

-- Get current user's role info
SELECT 
    'User Role Info' as check_type,
    user_id,
    role,
    created_at
FROM user_roles
WHERE user_id = auth.uid();

-- ============================================================================
-- FRONTEND ACTIONS TO FIX LOGOUT LOOP
-- ============================================================================

SELECT 'FRONTEND ACTIONS NEEDED' as step;
SELECT 'Run these in browser console to fix logout loop:' as instruction;
SELECT '' as blank1;
SELECT '1. Clear all storage:' as action1;
SELECT '   localStorage.clear()' as command1;
SELECT '   sessionStorage.clear()' as command2;
SELECT '' as blank2;
SELECT '2. Clear Supabase auth:' as action2;
SELECT '   await supabase.auth.signOut()' as command3;
SELECT '' as blank3;
SELECT '3. Clear React Query cache:' as action3;
SELECT '   queryClient.clear()' as command4;
SELECT '' as blank4;
SELECT '4. Reload page:' as action4;
SELECT '   window.location.reload()' as command5;
SELECT '' as blank5;
SELECT 'This should break the logout loop and allow clean login' as expected;