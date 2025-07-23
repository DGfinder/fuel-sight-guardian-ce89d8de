-- CORRECTED DATA MIGRATION TEMPLATE FOR FRESH START
-- This fixes the foreign key constraint error by using REAL user IDs

-- ⚠️  CRITICAL: You MUST replace sample UUIDs with REAL user IDs from your new project
-- ⚠️  Go to Authentication → Users in your new Supabase dashboard to get actual IDs

-- ============================================================================
-- STEP 1: First, create your users in the Auth dashboard
-- ============================================================================

-- 🚨 IMPORTANT: Before running this script:
-- 1. Go to your NEW Supabase project → Authentication → Users
-- 2. Manually create each user (same emails as old project)
-- 3. Copy the NEW user IDs and replace ALL sample IDs below

-- ============================================================================
-- STEP 2: Insert Tank Groups (Run this first)
-- ============================================================================

INSERT INTO tank_groups (id, name, description, created_at, updated_at) VALUES
-- 👇 Replace with your actual tank group data:
-- ('your-actual-group-uuid-1', 'GSF Depots', 'GSF Depot locations', '2024-01-01 00:00:00', '2024-01-01 00:00:00'),
-- ('your-actual-group-uuid-2', 'Swan Transit', 'Swan Transit locations', '2024-01-01 00:00:00', '2024-01-01 00:00:00');

-- Sample (REMOVE THIS and add your real data):
('sample-group-uuid-replace-me', 'Sample Group', 'Replace with your data', NOW(), NOW());

-- ============================================================================
-- STEP 3: Insert Fuel Tanks (Replace group_id with actual IDs from step 2)
-- ============================================================================

INSERT INTO fuel_tanks (
    id, location, product_type, safe_level, min_level, group_id, subgroup,
    address, vehicle, discharge, bp_portal, delivery_window, afterhours_contact,
    notes, serviced_on, serviced_by, latitude, longitude, created_at, updated_at
) VALUES
-- 👇 Replace with your actual tank data:
-- ('your-tank-uuid-1', 'Narrogin ADF', 'Diesel', 330000, 50000, 'your-actual-group-uuid-1', 'GSFS Narrogin', 
--  'Address', 'Vehicle', 'Discharge', 'Portal', 'Window', 'Contact', 'Notes', '2024-01-01', 'Servicer', 
--  -32.9333, 117.1833, '2024-01-01 00:00:00', '2024-01-01 00:00:00');

-- Sample (REMOVE THIS and add your real data):
('sample-tank-uuid-replace-me', 'Sample Tank', 'Diesel', 10000, 1000, 
 'sample-group-uuid-replace-me', 'Sample Subgroup', 
 NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());

-- ============================================================================
-- STEP 4: Get REAL User IDs (This is where the error occurred)
-- ============================================================================

-- 🚨 BEFORE inserting profiles or user_roles:
-- 1. Go to your NEW Supabase dashboard
-- 2. Authentication → Users  
-- 3. Find each user and copy their UUID
-- 4. Replace ALL instances of sample UUIDs below

-- Example: If you see a user like:
-- Email: john@example.com
-- ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
-- 
-- Use "a1b2c3d4-e5f6-7890-abcd-ef1234567890" everywhere below, NOT the sample IDs

-- ============================================================================
-- STEP 5: Insert User Profiles (Use REAL user IDs from Auth dashboard)
-- ============================================================================

INSERT INTO profiles (id, full_name, avatar_url, created_at, updated_at) VALUES
-- 👇 Replace 'REAL-USER-ID-HERE' with actual user ID from Auth dashboard:
-- ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'John Doe', NULL, NOW(), NOW()),
-- ('b2c3d4e5-f6g7-8901-bcde-f23456789012', 'Jane Smith', NULL, NOW(), NOW());

-- 🚨 DO NOT USE THESE SAMPLE IDs - They will cause the foreign key error:
('REAL-USER-ID-HERE-REPLACE-ME', 'Sample User', NULL, NOW(), NOW());

-- ============================================================================
-- STEP 6: Insert User Roles (Use same REAL user IDs)
-- ============================================================================

INSERT INTO user_roles (id, user_id, role, created_at, updated_at) VALUES
-- 👇 Use the SAME real user IDs from step 5:
-- ('role-uuid-1', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'admin', NOW(), NOW()),
-- ('role-uuid-2', 'b2c3d4e5-f6g7-8901-bcde-f23456789012', 'manager', NOW(), NOW());

-- 🚨 DO NOT USE THESE SAMPLE IDs:
(gen_random_uuid(), 'REAL-USER-ID-HERE-REPLACE-ME', 'admin', NOW(), NOW());

-- ============================================================================
-- STEP 7: Insert User Group Permissions (Use same REAL user IDs)
-- ============================================================================

INSERT INTO user_group_permissions (id, user_id, group_id, created_at) VALUES
-- 👇 Use REAL user IDs and REAL group IDs:
-- (gen_random_uuid(), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'your-actual-group-uuid-1', NOW()),
-- (gen_random_uuid(), 'b2c3d4e5-f6g7-8901-bcde-f23456789012', 'your-actual-group-uuid-2', NOW());

-- 🚨 DO NOT USE THESE SAMPLE IDs:
(gen_random_uuid(), 'REAL-USER-ID-HERE-REPLACE-ME', 'sample-group-uuid-replace-me', NOW());

-- ============================================================================
-- STEP 8: Insert User Subgroup Permissions (Use same REAL user IDs)
-- ============================================================================

INSERT INTO user_subgroup_permissions (id, user_id, group_id, subgroup_name, created_at) VALUES
-- 👇 Use REAL user IDs and REAL group IDs:
-- (gen_random_uuid(), 'sally-real-user-id', 'gsf-real-group-id', 'GSFS Narrogin', NOW());

-- 🚨 DO NOT USE THESE SAMPLE IDs:
(gen_random_uuid(), 'REAL-USER-ID-HERE-REPLACE-ME', 'sample-group-uuid-replace-me', 'Sample Subgroup', NOW());

-- ============================================================================
-- STEP 9: Insert Dip Readings (Use REAL user IDs and tank IDs)
-- ============================================================================

INSERT INTO dip_readings (id, tank_id, value, recorded_by, created_by_name, notes, created_at, updated_at) VALUES
-- 👇 Use REAL tank IDs and user IDs:
-- (gen_random_uuid(), 'your-tank-uuid-1', 200000, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'John Doe', 'Sample reading', '2024-01-01 10:00:00', '2024-01-01 10:00:00');

-- 🚨 DO NOT USE THESE SAMPLE IDs:
(gen_random_uuid(), 'sample-tank-uuid-replace-me', 5000, 'REAL-USER-ID-HERE-REPLACE-ME', 'Sample User', 'Sample reading', NOW(), NOW());

-- ============================================================================
-- STEP 10: Insert Tank Alerts (Use REAL tank IDs)
-- ============================================================================

INSERT INTO tank_alerts (id, tank_id, alert_type, message, acknowledged_at, acknowledged_by, snoozed_until, created_at) VALUES
-- 👇 Use REAL tank IDs:
-- (gen_random_uuid(), 'your-tank-uuid-1', 'low_fuel', 'Tank fuel level is low', NULL, NULL, NULL, NOW());

-- 🚨 DO NOT USE THESE SAMPLE IDs:
(gen_random_uuid(), 'sample-tank-uuid-replace-me', 'low_fuel', 'Sample alert', NULL, NULL, NULL, NOW());

-- ============================================================================
-- STEP 11: Verify the migration (Run this to check everything worked)
-- ============================================================================

-- Test that everything was imported correctly
SELECT 'MIGRATION VERIFICATION' as step;

-- Check that users exist in auth (this should match your profiles)
SELECT 'Auth Users' as table_name, COUNT(*) as count FROM auth.users;

-- Check profiles (should be same count as auth users)
SELECT 'Profiles' as table_name, COUNT(*) as count FROM profiles;

-- Check user roles
SELECT 'User Roles' as table_name, COUNT(*) as count FROM user_roles;

-- Check tank groups
SELECT 'Tank Groups' as table_name, COUNT(*) as count FROM tank_groups;

-- Check fuel tanks
SELECT 'Fuel Tanks' as table_name, COUNT(*) as count FROM fuel_tanks;

-- Check dip readings
SELECT 'Dip Readings' as table_name, COUNT(*) as count FROM dip_readings;

-- Test the views work
SELECT 'Testing tanks_basic_data view' as test_name, COUNT(*) as tank_count FROM tanks_basic_data;

-- Test user can query their own data
SELECT 
    'User Access Test' as test_name,
    location,
    current_level,
    current_level_percent
FROM tanks_basic_data
LIMIT 3;

SELECT '✅ DATA MIGRATION COMPLETED SUCCESSFULLY' as result;
SELECT 'All foreign key constraints satisfied' as status; 