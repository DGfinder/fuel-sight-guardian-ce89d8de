-- Step-by-Step Implementation Script for Subgroup Permissions
-- Execute this script to safely implement subgroup permissions in your system

-- ============================================================================
-- STEP 1: Backup existing data (recommended)
-- ============================================================================

-- Create backup tables
CREATE TABLE IF NOT EXISTS user_roles_backup_$(date +%Y%m%d) AS SELECT * FROM user_roles;
CREATE TABLE IF NOT EXISTS user_group_permissions_backup_$(date +%Y%m%d) AS SELECT * FROM user_group_permissions;

-- ============================================================================
-- STEP 2: Execute the main migration
-- ============================================================================

-- Run the subgroup_permissions_migration.sql script
-- This creates the new table, functions, and updates RLS policies
\i subgroup_permissions_migration.sql

-- ============================================================================
-- STEP 3: Verify the migration was successful
-- ============================================================================

-- Check that the new table exists and is accessible
SELECT 
    'user_subgroup_permissions table created' as status,
    COUNT(*) as initial_count
FROM user_subgroup_permissions;

-- Check that the new functions were created
SELECT 
    routine_name,
    routine_type,
    'Function created successfully' as status
FROM information_schema.routines 
WHERE routine_name IN (
    'user_has_tank_access_with_subgroups',
    'user_has_group_access_with_subgroups',
    'get_user_accessible_subgroups'
) AND routine_schema = 'public';

-- Check that the new view was created
SELECT 
    table_name,
    table_type,
    'View created successfully' as status
FROM information_schema.tables 
WHERE table_name = 'user_all_permissions' AND table_schema = 'public';

-- ============================================================================
-- STEP 4: Test the new permissions system
-- ============================================================================

-- Test 1: Check existing permissions still work
DO $$
DECLARE
    test_user_id UUID;
    test_group_id UUID;
    has_access BOOLEAN;
BEGIN
    -- Get a test user with existing permissions
    SELECT user_id INTO test_user_id FROM user_group_permissions LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Get a group they have access to
        SELECT group_id INTO test_group_id FROM user_group_permissions WHERE user_id = test_user_id LIMIT 1;
        
        -- Test the new function
        SELECT user_has_group_access_with_subgroups(test_group_id) INTO has_access;
        
        IF has_access THEN
            RAISE NOTICE 'SUCCESS: Existing permissions still work';
        ELSE
            RAISE EXCEPTION 'FAILED: Existing permissions not working';
        END IF;
    ELSE
        RAISE NOTICE 'No existing permissions to test';
    END IF;
END $$;

-- Test 2: Verify subgroup structure exists
SELECT 
    tg.name as group_name,
    COUNT(DISTINCT ft.subgroup) as subgroup_count,
    array_agg(DISTINCT ft.subgroup) as subgroups
FROM tank_groups tg
JOIN fuel_tanks ft ON tg.id = ft.group_id
WHERE ft.subgroup IS NOT NULL
GROUP BY tg.name
ORDER BY tg.name;

-- ============================================================================
-- STEP 5: Example implementation for your specific use case
-- ============================================================================

-- This is a template for granting Narrogin-only access to a specific user
-- Replace 'user@example.com' with the actual user email
-- Replace 'GSF Depots' with the exact group name in your system

/*
-- Find user ID (replace email)
SELECT id as user_id FROM auth.users WHERE email = 'user@example.com';

-- Find GSF Depots group ID
SELECT id as group_id FROM tank_groups WHERE name = 'GSF Depots';

-- Grant subgroup permission (replace USER_ID and GROUP_ID with actual values)
INSERT INTO user_subgroup_permissions (user_id, group_id, subgroup_name)
VALUES ('USER_ID', 'GROUP_ID', 'Narrogin');

-- Remove any existing full group permission for this user/group
DELETE FROM user_group_permissions 
WHERE user_id = 'USER_ID' AND group_id = 'GROUP_ID';

-- Verify the change
SELECT * FROM user_all_permissions WHERE user_id = 'USER_ID';
*/

-- ============================================================================
-- STEP 6: Performance check
-- ============================================================================

-- Check RLS policies are working
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies 
WHERE tablename IN ('fuel_tanks', 'dip_readings', 'tank_alerts', 'tank_groups', 'user_subgroup_permissions')
ORDER BY tablename, policyname;

-- ============================================================================
-- STEP 7: Grant necessary permissions to application role
-- ============================================================================

-- Grant permissions to the application role (usually 'authenticated')
GRANT SELECT, INSERT, UPDATE, DELETE ON user_subgroup_permissions TO authenticated;

-- ============================================================================
-- STEP 8: Final verification
-- ============================================================================

-- Show summary of permission system
SELECT 
    'Current Permission Summary' as info,
    (SELECT COUNT(*) FROM user_roles) as total_users,
    (SELECT COUNT(*) FROM user_group_permissions) as group_permissions,
    (SELECT COUNT(*) FROM user_subgroup_permissions) as subgroup_permissions;

-- Show available subgroups for each group
SELECT 
    tg.name as group_name,
    string_agg(DISTINCT ft.subgroup, ', ') as available_subgroups
FROM tank_groups tg
JOIN fuel_tanks ft ON tg.id = ft.group_id
WHERE ft.subgroup IS NOT NULL
GROUP BY tg.name
ORDER BY tg.name;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 
    'IMPLEMENTATION COMPLETE' as status,
    'Subgroup permissions system has been successfully implemented' as message,
    'Next steps: Use the frontend functions to manage user permissions' as next_steps;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================

/*
If you need to rollback this implementation:

1. Drop the new table:
   DROP TABLE IF EXISTS user_subgroup_permissions CASCADE;

2. Drop the new functions:
   DROP FUNCTION IF EXISTS user_has_tank_access_with_subgroups CASCADE;
   DROP FUNCTION IF EXISTS user_has_group_access_with_subgroups CASCADE;
   DROP FUNCTION IF EXISTS get_user_accessible_subgroups CASCADE;

3. Drop the new view:
   DROP VIEW IF EXISTS user_all_permissions CASCADE;

4. Restore original RLS policies:
   \i rbac_migration.sql  -- or your original RLS policies

5. Restore data from backup:
   DELETE FROM user_roles;
   INSERT INTO user_roles SELECT * FROM user_roles_backup_YYYYMMDD;
   
   DELETE FROM user_group_permissions;
   INSERT INTO user_group_permissions SELECT * FROM user_group_permissions_backup_YYYYMMDD;
*/ 