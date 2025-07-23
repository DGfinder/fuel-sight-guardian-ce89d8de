-- DATA MIGRATION TEMPLATE FOR FRESH START
-- This script helps you migrate all existing data to your new clean Supabase project
-- 
-- INSTRUCTIONS:
-- 1. Export data from your old project using the provided queries
-- 2. Replace the INSERT statements below with your actual data
-- 3. Run this script in your NEW Supabase project

-- ============================================================================
-- STEP 1: Insert Tank Groups (Run this first)
-- ============================================================================

-- Export from old project:
-- SELECT id, name, description, created_at, updated_at FROM tank_groups;

INSERT INTO tank_groups (id, name, description, created_at, updated_at) VALUES
-- Replace these sample values with your actual data:
-- ('uuid-1', 'GSF Depots', 'GSF Depot locations', '2024-01-01 00:00:00', '2024-01-01 00:00:00'),
-- ('uuid-2', 'Swan Transit', 'Swan Transit locations', '2024-01-01 00:00:00', '2024-01-01 00:00:00'),
-- ('uuid-3', 'BGC', 'BGC locations', '2024-01-01 00:00:00', '2024-01-01 00:00:00');
('00000000-0000-0000-0000-000000000001', 'Sample Group', 'Replace with your data', NOW(), NOW());

-- ============================================================================
-- STEP 2: Insert Fuel Tanks (Run after tank groups)
-- ============================================================================

-- Export from old project:
-- SELECT id, location, product_type, safe_level, min_level, group_id, subgroup, 
--        address, vehicle, discharge, bp_portal, delivery_window, afterhours_contact, 
--        notes, serviced_on, serviced_by, latitude, longitude, created_at, updated_at 
-- FROM fuel_tanks;

INSERT INTO fuel_tanks (
    id, location, product_type, safe_level, min_level, group_id, subgroup,
    address, vehicle, discharge, bp_portal, delivery_window, afterhours_contact,
    notes, serviced_on, serviced_by, latitude, longitude, created_at, updated_at
) VALUES
-- Replace these sample values with your actual data:
-- ('tank-uuid-1', 'Narrogin ADF', 'Diesel', 330000, 50000, 'group-uuid-gsf', 'GSFS Narrogin', 
--  'Sample Address', 'Sample Vehicle', 'Sample Discharge', 'Sample Portal', 'Sample Window', 
--  'Sample Contact', 'Sample Notes', '2024-01-01', 'Sample Servicer', -32.9333, 117.1833, 
--  '2024-01-01 00:00:00', '2024-01-01 00:00:00'),
('00000000-0000-0000-0000-000000000002', 'Sample Tank', 'Diesel', 10000, 1000, 
 '00000000-0000-0000-0000-000000000001', 'Sample Subgroup', 
 NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());

-- ============================================================================
-- STEP 3: Create User Profiles (For display names)
-- ============================================================================

-- Export from old project:
-- SELECT u.id, u.email, p.full_name, p.avatar_url 
-- FROM auth.users u 
-- LEFT JOIN profiles p ON u.id = p.id;

-- Note: You'll need to manually create users in the new project's Auth section first
-- Then insert their profiles here:

INSERT INTO profiles (id, full_name, avatar_url, created_at, updated_at) VALUES
-- Replace with your actual user data:
-- ('user-uuid-1', 'Your Full Name', NULL, NOW(), NOW()),
-- ('user-uuid-2', 'Another User Name', NULL, NOW(), NOW());
('00000000-0000-0000-0000-000000000003', 'Sample User', NULL, NOW(), NOW());

-- ============================================================================
-- STEP 4: Insert User Roles (Critical for authentication)
-- ============================================================================

-- Export from old project:
-- SELECT id, user_id, role, created_at, updated_at FROM user_roles;

INSERT INTO user_roles (id, user_id, role, created_at, updated_at) VALUES
-- Replace with your actual user roles:
-- ('role-uuid-1', 'user-uuid-1', 'admin', NOW(), NOW()),
-- ('role-uuid-2', 'user-uuid-2', 'manager', NOW(), NOW());
('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'admin', NOW(), NOW());

-- ============================================================================
-- STEP 5: Insert User Group Permissions
-- ============================================================================

-- Export from old project:
-- SELECT id, user_id, group_id, created_at FROM user_group_permissions;

INSERT INTO user_group_permissions (id, user_id, group_id, created_at) VALUES
-- Replace with your actual group permissions:
-- ('perm-uuid-1', 'user-uuid-1', 'group-uuid-1', NOW()),
-- ('perm-uuid-2', 'user-uuid-2', 'group-uuid-2', NOW());
('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW());

-- ============================================================================
-- STEP 6: Insert User Subgroup Permissions (If you have subgroup restrictions)
-- ============================================================================

-- Export from old project:
-- SELECT id, user_id, group_id, subgroup_name, created_at FROM user_subgroup_permissions;

INSERT INTO user_subgroup_permissions (id, user_id, group_id, subgroup_name, created_at) VALUES
-- Replace with your actual subgroup permissions:
-- ('subperm-uuid-1', 'user-uuid-sally', 'group-uuid-gsf', 'GSFS Narrogin', NOW());
('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Sample Subgroup', NOW());

-- ============================================================================
-- STEP 7: Insert Dip Readings (Your fuel level data)
-- ============================================================================

-- Export from old project (get recent data only to avoid huge imports):
-- SELECT id, tank_id, value, recorded_by, created_by_name, notes, created_at, updated_at
-- FROM dip_readings 
-- WHERE created_at >= NOW() - INTERVAL '90 days'  -- Last 90 days only
-- AND archived_at IS NULL
-- ORDER BY created_at DESC;

INSERT INTO dip_readings (id, tank_id, value, recorded_by, created_by_name, notes, created_at, updated_at) VALUES
-- Replace with your actual dip readings:
-- ('dip-uuid-1', 'tank-uuid-1', 200000, 'user-uuid-1', 'Your Name', 'Sample reading', '2024-01-01 10:00:00', '2024-01-01 10:00:00'),
-- ('dip-uuid-2', 'tank-uuid-1', 195000, 'user-uuid-1', 'Your Name', 'Another reading', '2024-01-02 10:00:00', '2024-01-02 10:00:00');
('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 5000, '00000000-0000-0000-0000-000000000003', 'Sample User', 'Sample reading', NOW(), NOW());

-- ============================================================================
-- STEP 8: Insert Tank Alerts (If you have any)
-- ============================================================================

-- Export from old project:
-- SELECT id, tank_id, alert_type, message, acknowledged_at, acknowledged_by, snoozed_until, created_at
-- FROM tank_alerts 
-- WHERE created_at >= NOW() - INTERVAL '30 days';  -- Recent alerts only

INSERT INTO tank_alerts (id, tank_id, alert_type, message, acknowledged_at, acknowledged_by, snoozed_until, created_at) VALUES
-- Replace with your actual alerts:
-- ('alert-uuid-1', 'tank-uuid-1', 'low_fuel', 'Tank fuel level is low', NULL, NULL, NULL, NOW());
('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000002', 'low_fuel', 'Sample alert', NULL, NULL, NULL, NOW());

-- ============================================================================
-- STEP 9: Verify the migration
-- ============================================================================

-- Test that everything was imported correctly
SELECT 'MIGRATION VERIFICATION' as step;

-- Check tank groups
SELECT 'Tank Groups' as table_name, COUNT(*) as imported_count FROM tank_groups;

-- Check fuel tanks
SELECT 'Fuel Tanks' as table_name, COUNT(*) as imported_count FROM fuel_tanks;

-- Check user roles
SELECT 'User Roles' as table_name, COUNT(*) as imported_count FROM user_roles;

-- Check dip readings
SELECT 'Dip Readings' as table_name, COUNT(*) as imported_count FROM dip_readings;

-- Test the views work
SELECT 'Testing tanks_basic_data view' as test_name, COUNT(*) as tank_count FROM tanks_basic_data;

SELECT 'Testing tanks_with_rolling_avg view' as test_name, COUNT(*) as tank_count FROM tanks_with_rolling_avg;

-- Test a sample tank with percentage calculation
SELECT 
    'Sample Tank Test' as test_name,
    location,
    current_level,
    safe_level,
    current_level_percent,
    CASE 
        WHEN current_level_percent > 0 THEN '✅ WORKING'
        ELSE '⚠️ NEEDS ATTENTION'
    END as status
FROM tanks_basic_data
LIMIT 5;

SELECT 'DATA MIGRATION COMPLETED' as result;
SELECT 'Update your frontend to point to the new Supabase project' as next_step; 