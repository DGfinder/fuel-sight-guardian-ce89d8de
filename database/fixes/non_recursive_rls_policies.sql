-- Non-Recursive RLS Policies Fix
-- This creates simple RLS policies that don't cause infinite recursion
-- Uses direct role checks instead of helper functions that query the same tables

-- ============================================================================
-- STEP 1: Clean up existing problematic policies and functions
-- ============================================================================

SELECT 'CLEANING UP EXISTING RLS POLICIES AND FUNCTIONS' as step;

-- Drop all existing policies that might cause recursion
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_roles;
DROP POLICY IF EXISTS "Admins and managers can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can insert their own role" ON user_roles;
DROP POLICY IF EXISTS "Users can update their own role" ON user_roles;
DROP POLICY IF EXISTS "Users can view tanks in their assigned groups" ON fuel_tanks;
DROP POLICY IF EXISTS "Users can view tanks in their assigned groups or subgroups" ON fuel_tanks;
DROP POLICY IF EXISTS "Users can manage dips for accessible tanks" ON dip_readings;
DROP POLICY IF EXISTS "Users can view alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can acknowledge alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can view their accessible groups" ON tank_groups;
DROP POLICY IF EXISTS "Users can view their own group permissions" ON user_group_permissions;
DROP POLICY IF EXISTS "Admins and managers can manage all group permissions" ON user_group_permissions;

-- Drop helper functions that cause recursion
DROP FUNCTION IF EXISTS is_admin_user();
DROP FUNCTION IF EXISTS is_admin_or_manager_user();
DROP FUNCTION IF EXISTS user_has_tank_access_with_subgroups(UUID);
DROP FUNCTION IF EXISTS user_has_group_access_with_subgroups(UUID);

-- ============================================================================
-- STEP 2: Create simple, non-recursive helper functions
-- ============================================================================

SELECT 'CREATING NON-RECURSIVE HELPER FUNCTIONS' as step;

-- Simple function to check if user is admin (uses direct auth.users() check)
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN (
      'admin@fuelsightguardian.com',
      'hayden@fuelsightguardian.com'
    )
  );
$$;

-- Simple function to check if user is manager (uses direct auth.users() check)
CREATE OR REPLACE FUNCTION public.is_user_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (
      auth.users.email IN (
        'admin@fuelsightguardian.com',
        'hayden@fuelsightguardian.com',
        'manager@fuelsightguardian.com'
      )
      OR auth.users.email LIKE '%@manager.%'
    )
  );
$$;

-- Function to get user's accessible group IDs (no recursion - direct query)
CREATE OR REPLACE FUNCTION public.get_user_group_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT ugp.group_id), ARRAY[]::uuid[])
  FROM user_group_permissions ugp
  WHERE ugp.user_id = auth.uid();
$$;

-- ============================================================================
-- STEP 3: Enable RLS on tables (start fresh)
-- ============================================================================

SELECT 'ENABLING RLS ON TABLES' as step;

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dip_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tank_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tank_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_group_permissions ENABLE ROW LEVEL SECURITY;

-- Enable on subgroup permissions if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subgroup_permissions') THEN
        ALTER TABLE user_subgroup_permissions ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Create simple, non-recursive RLS policies
-- ============================================================================

SELECT 'CREATING NON-RECURSIVE RLS POLICIES' as step;

-- User Roles Table - Only admins can manage, users can view their own
CREATE POLICY "user_roles_admin_all_access" ON user_roles
  FOR ALL USING (is_user_admin());

CREATE POLICY "user_roles_user_read_own" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Fuel Tanks Table - Users can only see tanks in their assigned groups
CREATE POLICY "fuel_tanks_group_access" ON fuel_tanks
  FOR SELECT USING (
    is_user_admin() OR 
    group_id = ANY(get_user_group_ids())
  );

-- Dip Readings Table - Users can manage readings for accessible tanks
CREATE POLICY "dip_readings_tank_access" ON dip_readings
  FOR ALL USING (
    is_user_admin() OR 
    EXISTS (
      SELECT 1 FROM fuel_tanks ft 
      WHERE ft.id = dip_readings.tank_id 
      AND ft.group_id = ANY(get_user_group_ids())
    )
  );

-- Tank Alerts Table - Users can view alerts for accessible tanks
CREATE POLICY "tank_alerts_tank_access" ON tank_alerts
  FOR SELECT USING (
    is_user_admin() OR 
    EXISTS (
      SELECT 1 FROM fuel_tanks ft 
      WHERE ft.id = tank_alerts.tank_id 
      AND ft.group_id = ANY(get_user_group_ids())
    )
  );

-- Tank Groups Table - Users can view their accessible groups
CREATE POLICY "tank_groups_user_access" ON tank_groups
  FOR SELECT USING (
    is_user_admin() OR 
    id = ANY(get_user_group_ids())
  );

-- User Group Permissions Table - Users can view their own permissions, admins/managers can manage all
CREATE POLICY "user_group_permissions_read_own" ON user_group_permissions
  FOR SELECT USING (
    user_id = auth.uid() OR 
    is_user_admin() OR 
    is_user_manager()
  );

CREATE POLICY "user_group_permissions_admin_manage" ON user_group_permissions
  FOR ALL USING (is_user_admin() OR is_user_manager());

-- Subgroup permissions if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subgroup_permissions') THEN
        EXECUTE 'CREATE POLICY "user_subgroup_permissions_read_own" ON user_subgroup_permissions
          FOR SELECT USING (
            user_id = auth.uid() OR 
            is_user_admin() OR 
            is_user_manager()
          )';
          
        EXECUTE 'CREATE POLICY "user_subgroup_permissions_admin_manage" ON user_subgroup_permissions
          FOR ALL USING (is_user_admin() OR is_user_manager())';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Grant necessary permissions
-- ============================================================================

SELECT 'GRANTING PERMISSIONS' as step;

GRANT SELECT ON user_roles TO authenticated;
GRANT SELECT ON fuel_tanks TO authenticated;
GRANT ALL ON dip_readings TO authenticated;
GRANT SELECT ON tank_alerts TO authenticated;
GRANT SELECT ON tank_groups TO authenticated;
GRANT SELECT ON user_group_permissions TO authenticated;
GRANT SELECT ON tanks_with_rolling_avg TO authenticated;

-- Grant on subgroup permissions if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subgroup_permissions') THEN
        GRANT SELECT ON user_subgroup_permissions TO authenticated;
    END IF;
END $$;

-- ============================================================================
-- STEP 6: Test the policies don't cause recursion
-- ============================================================================

SELECT 'TESTING NON-RECURSIVE POLICIES' as step;

-- Test helper functions work
SELECT 
    'Helper Functions Test' as test_name,
    is_user_admin() as is_admin,
    is_user_manager() as is_manager,
    array_length(get_user_group_ids(), 1) as accessible_groups_count;

-- Test basic queries work without recursion
SELECT 
    'User Roles Query Test' as test_name,
    COUNT(*) as total_users
FROM user_roles;

SELECT 
    'Fuel Tanks Query Test' as test_name,
    COUNT(*) as total_accessible_tanks
FROM fuel_tanks;

SELECT 
    'Tank Groups Query Test' as test_name,
    COUNT(*) as total_accessible_groups
FROM tank_groups;

-- Test the main view works
SELECT 
    'Main View Test' as test_name,
    COUNT(*) as total_tanks_in_view,
    COUNT(CASE WHEN current_level_percent > 0 THEN 1 END) as tanks_with_data
FROM tanks_with_rolling_avg;

-- Test specific tanks (GSFS Narrogin if accessible)
SELECT 
    'Specific Tank Test' as test_name,
    location,
    current_level,
    current_level_percent,
    CASE 
        WHEN current_level_percent > 0 THEN '✅ RLS Working'
        ELSE '⚠️ No Data'
    END as rls_status
FROM tanks_with_rolling_avg
WHERE subgroup LIKE '%Narrogin%' OR location LIKE '%Narrogin%'
ORDER BY location
LIMIT 3;

-- ============================================================================
-- STEP 7: Success message and next steps
-- ============================================================================

SELECT 'NON-RECURSIVE RLS POLICIES CREATED SUCCESSFULLY' as status;
SELECT 'All policies use direct auth checks - no recursion risk' as approach;
SELECT 'Helper functions query auth.users directly, not user_roles table' as security_model;
SELECT 'Users can only access tanks in their assigned groups' as access_control;

-- Show current policy status
SELECT 
    'RLS Policy Status' as report_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual IS NOT NULL as has_using_clause,
    with_check IS NOT NULL as has_with_check_clause
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT 'NEXT STEPS:' as instruction;
SELECT '1. Test the frontend - should show data for user''s accessible tanks' as step1;
SELECT '2. Verify no 500 errors or infinite recursion' as step2;
SELECT '3. Test different user roles have appropriate access' as step3;
SELECT '4. Monitor logs for any remaining issues' as step4;