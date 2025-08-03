-- QUICK FIX FOR FOREIGN KEY ERROR
-- Run this in your NEW Supabase project to get the real user IDs

-- ============================================================================
-- STEP 1: Check what users exist in your new project
-- ============================================================================

-- See all users in your new Auth system
SELECT 
    'Your Real User IDs' as info,
    id as user_id,
    email,
    created_at,
    'Use this ID in migration script' as instruction
FROM auth.users
ORDER BY created_at;

-- Count users
SELECT 
    'Total Users in New Project' as info,
    COUNT(*) as count,
    'You need to replace sample IDs with these real IDs' as next_step
FROM auth.users;

-- ============================================================================
-- STEP 2: Clean up any failed migration attempts
-- ============================================================================

-- If you already tried running the migration and got the error, clean up:

-- Remove any sample data that might have been inserted
DELETE FROM tank_alerts WHERE message = 'Sample alert';
DELETE FROM dip_readings WHERE notes = 'Sample reading';
DELETE FROM user_subgroup_permissions WHERE subgroup_name = 'Sample Subgroup';
DELETE FROM user_group_permissions WHERE group_id = 'sample-group-uuid-replace-me';
DELETE FROM user_roles WHERE user_id = 'REAL-USER-ID-HERE-REPLACE-ME';
DELETE FROM profiles WHERE id = 'REAL-USER-ID-HERE-REPLACE-ME';
DELETE FROM fuel_tanks WHERE location = 'Sample Tank';
DELETE FROM tank_groups WHERE name = 'Sample Group';

SELECT 'Sample data cleaned up - ready for fresh migration' as status;

-- ============================================================================
-- STEP 3: Template for your corrected migration
-- ============================================================================

-- Copy the user IDs from STEP 1 above and replace in this template:

/*
-- Example corrected inserts (replace with your real IDs):

-- Tank Groups (use your real data)
INSERT INTO tank_groups (id, name, description, created_at, updated_at) VALUES
('12345678-1234-1234-1234-123456789abc', 'GSF Depots', 'GSF Depot locations', NOW(), NOW()),
('87654321-4321-4321-4321-cba987654321', 'Swan Transit', 'Swan Transit locations', NOW(), NOW());

-- Profiles (use REAL user IDs from STEP 1)
INSERT INTO profiles (id, full_name, avatar_url, created_at, updated_at) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'John Doe', NULL, NOW(), NOW()),
('b2c3d4e5-f6g7-8901-bcde-f23456789012', 'Jane Smith', NULL, NOW(), NOW());

-- User Roles (use same REAL user IDs)
INSERT INTO user_roles (id, user_id, role, created_at, updated_at) VALUES
(gen_random_uuid(), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'admin', NOW(), NOW()),
(gen_random_uuid(), 'b2c3d4e5-f6g7-8901-bcde-f23456789012', 'manager', NOW(), NOW());

-- Continue with the rest of your data...
*/

-- ============================================================================
-- STEP 4: Verify your migration will work
-- ============================================================================

-- Run this AFTER you update your migration script with real IDs:

-- Check if your user IDs exist (should return rows)
SELECT 
    'User ID Verification' as test,
    id,
    email,
    'This ID can be used in migration' as status
FROM auth.users 
WHERE id IN (
    -- Replace these with the user IDs you plan to use:
    -- 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    -- 'b2c3d4e5-f6g7-8901-bcde-f23456789012'
    '00000000-0000-0000-0000-000000000000'  -- This will return no results - replace with real IDs
);

-- ============================================================================
-- STEP 5: Test a single profile insert (optional safety test)
-- ============================================================================

-- Test inserting ONE profile first to make sure it works:
-- Replace 'YOUR-REAL-USER-ID' with an actual user ID from STEP 1

/*
INSERT INTO profiles (id, full_name, avatar_url, created_at, updated_at) 
VALUES ('YOUR-REAL-USER-ID', 'Test User', NULL, NOW(), NOW());

-- If this works without error, you can proceed with the full migration
-- Remember to delete this test profile:
-- DELETE FROM profiles WHERE full_name = 'Test User';
*/

SELECT '✅ Run the steps above to fix the foreign key error' as instruction;
SELECT 'Replace all sample UUIDs with real user IDs from your new project' as reminder; 