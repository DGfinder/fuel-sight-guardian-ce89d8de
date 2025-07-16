-- EMERGENCY: DISABLE RLS ON USER_ROLES
-- Use this if force_fix_recursion.sql doesn't work

-- ============================================================================
-- NUCLEAR OPTION: Temporarily disable RLS on user_roles
-- ============================================================================

SELECT 'EMERGENCY: DISABLING RLS ON USER_ROLES' as action;

-- Disable RLS completely on user_roles to break any recursion
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Verify it's disabled
SELECT 
    'RLS Status After Disable' as check_type,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = false THEN '✅ RLS DISABLED - Frontend should work'
        ELSE '❌ RLS STILL ENABLED - Try again'
    END as status
FROM pg_tables 
WHERE tablename = 'user_roles';

-- Test query that was failing
SELECT 
    'Test User Role Query' as test,
    role,
    user_id,
    'Should work now without RLS' as expected
FROM user_roles 
WHERE user_id = auth.uid();

-- ============================================================================
-- IMPORTANT SECURITY NOTE
-- ============================================================================

SELECT 'SECURITY WARNING' as warning;
SELECT 'RLS is now DISABLED on user_roles table' as status;
SELECT 'This is TEMPORARY to restore frontend access' as purpose;
SELECT 'You should re-enable RLS with proper policies later' as next_action;

-- ============================================================================
-- TO RE-ENABLE RLS LATER
-- ============================================================================

-- When ready to re-enable with proper policies:
-- 1. ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
-- 2. Create simple non-recursive policies
-- 3. Test thoroughly before deployment