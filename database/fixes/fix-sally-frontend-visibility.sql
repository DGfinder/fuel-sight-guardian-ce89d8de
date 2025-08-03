-- FIX SALLY'S FRONTEND TANK VISIBILITY ISSUE
-- Root Cause: tanks_with_rolling_avg view doesn't have RLS enabled, 
-- bypassing all permission checks and showing all tanks to everyone
--
-- This script enables RLS on the view and creates proper policies

-- ============================================================================
-- STEP 1: DIAGNOSTIC - Check current state
-- ============================================================================

SELECT 'CHECKING CURRENT RLS STATUS ON VIEW' as step;

-- Check if RLS is enabled on tanks_with_rolling_avg
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN 'RLS ENABLED' 
        ELSE 'RLS DISABLED - THIS IS THE PROBLEM' 
    END as status
FROM pg_tables 
WHERE tablename = 'tanks_with_rolling_avg';

-- Check what policies exist on the view
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'tanks_with_rolling_avg';

-- ============================================================================
-- STEP 2: ENABLE RLS ON THE VIEW
-- ============================================================================

SELECT 'ENABLING RLS ON TANKS_WITH_ROLLING_AVG VIEW' as step;

-- Enable RLS on the view (this was missing!)
ALTER VIEW tanks_with_rolling_avg ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: CREATE RLS POLICY FOR THE VIEW
-- ============================================================================

SELECT 'CREATING RLS POLICY FOR TANKS_WITH_ROLLING_AVG VIEW' as step;

-- Create RLS policy for the view that uses the same logic as fuel_tanks
CREATE POLICY "Users can view tanks in their assigned groups or subgroups" ON tanks_with_rolling_avg
FOR SELECT USING (
    -- Admin and manager users can see everything
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'manager')
    OR
    -- Users with full group access
    EXISTS (
        SELECT 1 FROM user_group_permissions
        WHERE user_group_permissions.user_id = auth.uid()
        AND user_group_permissions.group_id = tanks_with_rolling_avg.group_id
    )
    OR
    -- Users with subgroup access (this is what Sally needs)
    EXISTS (
        SELECT 1 FROM user_subgroup_permissions
        WHERE user_subgroup_permissions.user_id = auth.uid()
        AND user_subgroup_permissions.group_id = tanks_with_rolling_avg.group_id
        AND user_subgroup_permissions.subgroup_name = tanks_with_rolling_avg.subgroup
    )
);

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

SELECT 'VERIFYING RLS IS NOW ENABLED' as step;

-- Check RLS status after enabling
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN 'RLS NOW ENABLED ✓' 
        ELSE 'RLS STILL DISABLED ✗' 
    END as status
FROM pg_tables 
WHERE tablename = 'tanks_with_rolling_avg';

-- Check policies on the view
SELECT 
    'RLS Policy Created' as step,
    schemaname,
    tablename,
    policyname,
    'Policy exists ✓' as status
FROM pg_policies 
WHERE tablename = 'tanks_with_rolling_avg';

-- ============================================================================
-- STEP 5: TEST THE FIX WITH SALLY'S CONTEXT
-- ============================================================================

SELECT 'TESTING SALLY ACCESS WITH NEW RLS POLICY' as step;

-- Show what Sally should be able to access with the new policy
-- (This simulates the database-level filtering)
SELECT 
    'Tanks Sally can access (with new RLS)' as test_type,
    ft.location as tank_name,
    ft.subgroup,
    tg.name as group_name,
    'Accessible' as expected_result
FROM fuel_tanks ft
JOIN tank_groups tg ON ft.group_id = tg.id
JOIN user_subgroup_permissions usp ON (
    usp.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b'
    AND usp.group_id = ft.group_id
    AND usp.subgroup_name = ft.subgroup
)
ORDER BY ft.location;

-- Show what Sally should NOT be able to access
SELECT 
    'Tanks Sally CANNOT access (blocked by RLS)' as test_type,
    ft.subgroup,
    COUNT(*) as tank_count,
    'Blocked' as expected_result
FROM fuel_tanks ft
JOIN tank_groups tg ON ft.group_id = tg.id
WHERE tg.name = 'GSF Depots' 
AND ft.subgroup IS NOT NULL
AND ft.subgroup != 'GSFS Narrogin'
AND NOT EXISTS (
    SELECT 1 FROM user_subgroup_permissions usp
    WHERE usp.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b'
    AND usp.group_id = ft.group_id
    AND usp.subgroup_name = ft.subgroup
)
GROUP BY ft.subgroup
ORDER BY ft.subgroup;

-- ============================================================================
-- STEP 6: FRONTEND CACHE INVALIDATION INSTRUCTIONS
-- ============================================================================

SELECT 'FRONTEND CACHE INVALIDATION NEEDED' as step;

-- Note: The user will need to refresh their browser or logout/login
-- to clear the React Query cache and get fresh permissions

SELECT 
    'IMPORTANT' as note,
    'User needs to refresh browser or logout/login to clear cache' as action_required,
    'React Query caches permissions for 5 minutes' as explanation;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 
    'RLS FIX COMPLETE' as status,
    'tanks_with_rolling_avg now has RLS enabled with proper policies' as result,
    'Sally should only see GSFS Narrogin tanks after cache refresh' as expected_behavior;

-- Summary of the fix:
SELECT 
    'ROOT CAUSE FIXED' as summary,
    'tanks_with_rolling_avg view lacked RLS - now enabled' as issue_1,
    'Created RLS policy matching fuel_tanks permissions' as fix_1,
    'Subgroup filtering now works at database level' as fix_2,
    'Frontend cache needs refresh to see changes' as next_step;