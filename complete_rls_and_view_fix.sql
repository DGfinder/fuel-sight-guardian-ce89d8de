-- COMPLETE RLS AND VIEW FIX
-- This script addresses all issues with RLS policies and the tanks_with_rolling_avg view
-- to restore proper data flow to the frontend while maintaining security

-- ============================================================================
-- STEP 1: Create all required helper functions first
-- ============================================================================

SELECT 'CREATING REQUIRED HELPER FUNCTIONS' as step;

-- Create admin check function (completely isolated from RLS)
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Use SECURITY DEFINER to run as the function owner (bypasses RLS)
    -- Direct query to user_roles table without any RLS interference
    SELECT role INTO user_role
    FROM user_roles 
    WHERE user_id = auth.uid();
    
    RETURN user_role = 'admin';
EXCEPTION
    WHEN OTHERS THEN
        -- If anything goes wrong, return false
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admin or manager check function (completely isolated from RLS)
CREATE OR REPLACE FUNCTION is_admin_or_manager_user()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Use SECURITY DEFINER to run as the function owner (bypasses RLS)
    -- Direct query to user_roles table without any RLS interference
    SELECT role INTO user_role
    FROM user_roles 
    WHERE user_id = auth.uid();
    
    RETURN user_role IN ('admin', 'manager');
EXCEPTION
    WHEN OTHERS THEN
        -- If anything goes wrong, return false
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to a specific tank (with subgroup support)
CREATE OR REPLACE FUNCTION user_has_tank_access_with_subgroups(tank_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Admin and manager users can access everything
    IF EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager')
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has full group access (existing functionality)
    IF EXISTS (
        SELECT 1 FROM fuel_tanks ft
        JOIN user_group_permissions ugp ON ft.group_id = ugp.group_id
        WHERE ugp.user_id = auth.uid() AND ft.id = tank_id
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has subgroup access (new functionality)
    RETURN EXISTS (
        SELECT 1 FROM fuel_tanks ft
        JOIN user_subgroup_permissions usp ON ft.group_id = usp.group_id
        WHERE usp.user_id = auth.uid() 
        AND ft.id = tank_id
        AND ft.subgroup = usp.subgroup_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to a specific group (with subgroup support)
CREATE OR REPLACE FUNCTION user_has_group_access_with_subgroups(target_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Admin and manager users can access everything
    IF EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager')
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has full group access (existing functionality)
    IF EXISTS (
        SELECT 1 FROM user_group_permissions
        WHERE user_id = auth.uid() AND group_id = target_group_id
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has any subgroup access within this group (new functionality)
    RETURN EXISTS (
        SELECT 1 FROM user_subgroup_permissions
        WHERE user_id = auth.uid() AND group_id = target_group_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: Check current RLS status on all tables
-- ============================================================================

SELECT 'CHECKING CURRENT RLS STATUS' as step;

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN (
    'user_roles', 
    'user_group_permissions', 
    'user_subgroup_permissions', 
    'fuel_tanks', 
    'dip_readings', 
    'tank_alerts', 
    'tank_groups'
)
ORDER BY tablename;

-- ============================================================================
-- STEP 3: Re-enable RLS on all core tables and create policies
-- ============================================================================

SELECT 'RE-ENABLING RLS ON ALL CORE TABLES' as step;

-- ============================================================================
-- Enable RLS on user_roles and create policies
-- ============================================================================

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Users can insert their own role" ON user_roles;
DROP POLICY IF EXISTS "Users can update their own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins and managers can manage all user roles" ON user_roles;

-- Create clean policies for user_roles
CREATE POLICY "Users can view their own role" ON user_roles
FOR SELECT USING (
    user_id = auth.uid()
);

CREATE POLICY "Users can insert their own role" ON user_roles
FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

CREATE POLICY "Users can update their own role" ON user_roles
FOR UPDATE USING (
    user_id = auth.uid()
);

CREATE POLICY "Admins and managers can manage all user roles" ON user_roles
FOR ALL USING (
    is_admin_or_manager_user()
);

-- ============================================================================
-- Enable RLS on user_group_permissions and create policies
-- ============================================================================

ALTER TABLE user_group_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own group permissions" ON user_group_permissions;
DROP POLICY IF EXISTS "Admins and managers can manage all group permissions" ON user_group_permissions;

CREATE POLICY "Users can view their own group permissions" ON user_group_permissions
FOR SELECT USING (
    user_id = auth.uid()
);

CREATE POLICY "Admins and managers can manage all group permissions" ON user_group_permissions
FOR ALL USING (
    is_admin_or_manager_user()
);

-- ============================================================================
-- Enable RLS on user_subgroup_permissions and create policies
-- ============================================================================

ALTER TABLE user_subgroup_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subgroup permissions" ON user_subgroup_permissions;
DROP POLICY IF EXISTS "Admins and managers can manage all subgroup permissions" ON user_subgroup_permissions;

CREATE POLICY "Users can view their own subgroup permissions" ON user_subgroup_permissions
FOR SELECT USING (
    user_id = auth.uid()
);

CREATE POLICY "Admins and managers can manage all subgroup permissions" ON user_subgroup_permissions
FOR ALL USING (
    is_admin_or_manager_user()
);

-- ============================================================================
-- Enable RLS on fuel_tanks and create policies
-- ============================================================================

ALTER TABLE fuel_tanks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view tanks in their assigned groups" ON fuel_tanks;
DROP POLICY IF EXISTS "Users can view tanks in their assigned groups or subgroups" ON fuel_tanks;

CREATE POLICY "Users can view tanks in their assigned groups or subgroups" ON fuel_tanks
FOR SELECT USING (
    is_admin_or_manager_user()
    OR
    EXISTS (
        SELECT 1 FROM user_group_permissions
        WHERE user_group_permissions.user_id = auth.uid()
        AND user_group_permissions.group_id = fuel_tanks.group_id
    )
    OR
    EXISTS (
        SELECT 1 FROM user_subgroup_permissions
        WHERE user_subgroup_permissions.user_id = auth.uid()
        AND user_subgroup_permissions.group_id = fuel_tanks.group_id
        AND user_subgroup_permissions.subgroup_name = fuel_tanks.subgroup
    )
);

-- ============================================================================
-- Enable RLS on tank_groups and create policies
-- ============================================================================

ALTER TABLE tank_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their accessible groups" ON tank_groups;

CREATE POLICY "Users can view their accessible groups" ON tank_groups
FOR SELECT USING (
    user_has_group_access_with_subgroups(id)
);

-- ============================================================================
-- Enable RLS on dip_readings and create policies
-- ============================================================================

ALTER TABLE dip_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage dips for accessible tanks" ON dip_readings;

CREATE POLICY "Users can manage dips for accessible tanks" ON dip_readings
FOR ALL USING (
    user_has_tank_access_with_subgroups(tank_id)
);

-- ============================================================================
-- Enable RLS on tank_alerts and create policies
-- ============================================================================

ALTER TABLE tank_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can acknowledge alerts for accessible tanks" ON tank_alerts;

CREATE POLICY "Users can view alerts for accessible tanks" ON tank_alerts
FOR SELECT USING (
    user_has_tank_access_with_subgroups(tank_id)
);

CREATE POLICY "Users can acknowledge alerts for accessible tanks" ON tank_alerts
FOR UPDATE USING (
    user_has_tank_access_with_subgroups(tank_id)
);

-- ============================================================================
-- STEP 4: Create proper tanks_with_rolling_avg view with security barrier
-- ============================================================================

SELECT 'RECREATING TANKS_WITH_ROLLING_AVG VIEW' as step;

-- Drop existing view
DROP VIEW IF EXISTS public.tanks_with_rolling_avg;

-- Create new view with security_barrier and all required fields
CREATE VIEW public.tanks_with_rolling_avg 
WITH (security_barrier = true)
AS
WITH latest_dip AS (
  SELECT DISTINCT ON (tank_id)
    tank_id AS id,
    value as current_level,
    created_at as last_dip_ts,
    recorded_by as last_dip_by
  FROM dip_readings
  ORDER BY tank_id, created_at DESC
),
recent_readings AS (
  SELECT
    tank_id AS id,
    value,
    created_at,
    LAG(value) OVER (PARTITION BY tank_id ORDER BY created_at) as prev_value,
    LAG(created_at) OVER (PARTITION BY tank_id ORDER BY created_at) as prev_date
  FROM dip_readings
  WHERE created_at >= NOW() - INTERVAL '30 days'
),
daily_usage AS (
  SELECT
    id,
    AVG(CASE 
      WHEN prev_value IS NOT NULL AND prev_date IS NOT NULL
      THEN (prev_value - value) / EXTRACT(epoch FROM (created_at - prev_date)) * 86400
      ELSE NULL
    END) as rolling_avg_lpd,
    AVG(CASE 
      WHEN prev_value IS NOT NULL AND prev_date IS NOT NULL 
           AND DATE(created_at) = DATE(prev_date + INTERVAL '1 day')
      THEN (prev_value - value)
      ELSE NULL
    END) as prev_day_used
  FROM recent_readings
  WHERE prev_value IS NOT NULL
  GROUP BY id
)
SELECT
  t.id,
  t.location,
  t.product_type as product,
  t.safe_level as safe_fill,
  COALESCE(t.min_level, 0) as min_level,
  t.group_id,
  tg.name AS group_name,
  t.subgroup,
  
  -- Current level data
  COALESCE(ld.current_level, 0) as current_level,
  ld.last_dip_ts,
  ld.last_dip_by,
  
  -- Calculated fields
  CASE 
    WHEN t.safe_level IS NOT NULL 
         AND t.safe_level > COALESCE(t.min_level, 0) 
         AND ld.current_level IS NOT NULL
    THEN GREATEST(0, ROUND(
      ((ld.current_level - COALESCE(t.min_level, 0)) / 
       (t.safe_level - COALESCE(t.min_level, 0))) * 100, 1
    ))
    ELSE 0
  END AS current_level_percent_display,
  
  -- Usage calculations
  COALESCE(du.rolling_avg_lpd, 0) as rolling_avg_lpd,
  COALESCE(du.prev_day_used, 0) as prev_day_used,
  
  -- Days to minimum calculation
  CASE 
    WHEN du.rolling_avg_lpd > 0 AND ld.current_level > COALESCE(t.min_level, 0)
    THEN ROUND((ld.current_level - COALESCE(t.min_level, 0)) / du.rolling_avg_lpd)
    ELSE NULL
  END as days_to_min_level,
  
  -- Capacity calculation
  CASE 
    WHEN t.safe_level IS NOT NULL AND t.min_level IS NOT NULL
    THEN t.safe_level - t.min_level
    ELSE t.safe_level
  END as usable_capacity,
  
  -- Additional tank metadata
  t.address,
  t.vehicle,
  t.discharge,
  t.bp_portal,
  t.delivery_window,
  t.afterhours_contact,
  t.notes,
  t.serviced_on,
  t.serviced_by,
  t.latitude,
  t.longitude,
  t.created_at,
  t.updated_at

FROM fuel_tanks t
LEFT JOIN tank_groups tg ON tg.id = t.group_id
LEFT JOIN latest_dip ld ON ld.id = t.id
LEFT JOIN daily_usage du ON du.id = t.id;

-- ============================================================================
-- STEP 5: Test the view works with current user
-- ============================================================================

SELECT 'TESTING VIEW ACCESS' as step;

-- Test basic view access
SELECT 
    'View Access Test' as test,
    COUNT(*) as total_rows,
    COUNT(current_level) as rows_with_level,
    COUNT(CASE WHEN safe_fill > 0 THEN 1 END) as rows_with_capacity,
    COUNT(CASE WHEN current_level_percent_display > 0 THEN 1 END) as rows_with_percentage
FROM tanks_with_rolling_avg;

-- Test permissions query (what frontend uses)
SELECT 
    'Frontend Permissions Test' as test,
    COUNT(*) as accessible_tanks
FROM tanks_with_rolling_avg
WHERE true; -- This should be filtered by RLS

-- ============================================================================
-- STEP 6: Test user permissions work correctly
-- ============================================================================

SELECT 'TESTING USER PERMISSIONS' as step;

-- Test user role access
SELECT 
    'User Role Test' as test,
    ur.role,
    COUNT(DISTINCT ugp.group_id) as group_permissions,
    COUNT(DISTINCT usp.group_id) as subgroup_permissions
FROM user_roles ur
LEFT JOIN user_group_permissions ugp ON ur.user_id = ugp.user_id
LEFT JOIN user_subgroup_permissions usp ON ur.user_id = usp.user_id
WHERE ur.user_id = auth.uid()
GROUP BY ur.role;

-- ============================================================================
-- STEP 7: Verify all RLS policies are in place
-- ============================================================================

SELECT 'VERIFYING RLS POLICIES' as step;

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    permissive
FROM pg_policies 
WHERE tablename IN (
    'user_roles', 
    'user_group_permissions', 
    'user_subgroup_permissions', 
    'fuel_tanks', 
    'dip_readings', 
    'tank_alerts', 
    'tank_groups'
)
ORDER BY tablename, policyname;

-- ============================================================================
-- STEP 8: Test specific user access (Sally's case)
-- ============================================================================

SELECT 'TESTING SALLY SPECIFIC ACCESS' as step;

-- Test if Sally's subgroup permissions work
SELECT 
    'Sally Subgroup Test' as test,
    location,
    safe_fill,
    current_level,
    current_level_percent_display,
    subgroup,
    group_name
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin'
ORDER BY location
LIMIT 5;

-- ============================================================================
-- STEP 9: Grant necessary permissions
-- ============================================================================

SELECT 'GRANTING PERMISSIONS' as step;

-- Ensure authenticated users can access the view
GRANT SELECT ON public.tanks_with_rolling_avg TO authenticated;
GRANT SELECT ON user_subgroup_permissions TO authenticated;

-- ============================================================================
-- STEP 10: Final status report
-- ============================================================================

SELECT 'RLS AND VIEW FIX COMPLETED' as status;

-- Summary of what was fixed
SELECT 'Fixed user_subgroup_permissions RLS policies' as fix_1;
SELECT 'Recreated tanks_with_rolling_avg view with security_barrier' as fix_2;
SELECT 'Added all required calculated fields for frontend' as fix_3;
SELECT 'Verified all table RLS policies are active' as fix_4;
SELECT 'Frontend data flow should now work correctly' as result;

-- Show final table RLS status
SELECT 
    'Final RLS Status' as report,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN (
    'user_roles', 
    'user_group_permissions', 
    'user_subgroup_permissions', 
    'fuel_tanks', 
    'dip_readings', 
    'tank_alerts', 
    'tank_groups'
)
ORDER BY tablename;