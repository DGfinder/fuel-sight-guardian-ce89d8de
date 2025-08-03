-- Update RLS Policies for Manager Role
-- This script updates all RLS policies to recognize 'manager' as a privileged role
-- alongside 'admin', giving managers the same access level as admins

-- ============================================================================
-- STEP 1: Drop existing policies
-- ============================================================================

-- Drop existing policies that need to be updated
DROP POLICY IF EXISTS "Users can view tanks in their assigned groups" ON fuel_tanks;
DROP POLICY IF EXISTS "Users can manage dips for accessible tanks" ON dip_readings;
DROP POLICY IF EXISTS "Users can view alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can acknowledge alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can view their accessible groups" ON tank_groups;
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;

-- ============================================================================
-- STEP 2: Create updated policies that include 'manager' role
-- ============================================================================

-- Fuel tanks policy - managers can view all tanks
CREATE POLICY "Users can view tanks in their assigned groups" ON fuel_tanks
FOR SELECT USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'manager')
    OR
    EXISTS (
        SELECT 1 FROM user_group_permissions
        WHERE user_group_permissions.user_id = auth.uid()
        AND user_group_permissions.group_id = fuel_tanks.group_id
    )
);

-- Dip readings policies - managers can manage all dips
CREATE POLICY "Users can manage dips for accessible tanks" ON dip_readings
FOR ALL USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'manager')
    OR
    EXISTS (
        SELECT 1
        FROM fuel_tanks ft
        JOIN user_group_permissions ugp ON ft.group_id = ugp.group_id
        WHERE ugp.user_id = auth.uid() AND ft.id = dip_readings.tank_id
    )
);

-- Tank alerts policies - managers can view and acknowledge all alerts
CREATE POLICY "Users can view alerts for accessible tanks" ON tank_alerts
FOR SELECT USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'manager')
    OR
    EXISTS (
        SELECT 1
        FROM fuel_tanks ft
        JOIN user_group_permissions ugp ON ft.group_id = ugp.group_id
        WHERE ugp.user_id = auth.uid() AND ft.id = tank_alerts.tank_id
    )
);

CREATE POLICY "Users can acknowledge alerts for accessible tanks" ON tank_alerts
FOR UPDATE USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'manager')
    OR
    EXISTS (
        SELECT 1
        FROM fuel_tanks ft
        JOIN user_group_permissions ugp ON ft.group_id = ugp.group_id
        WHERE ugp.user_id = auth.uid() AND ft.id = tank_alerts.tank_id
    )
);

-- Tank groups policy - managers can view all groups
CREATE POLICY "Users can view their accessible groups" ON tank_groups
FOR SELECT USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'manager')
    OR
    EXISTS (
        SELECT 1 FROM user_group_permissions
        WHERE user_group_permissions.user_id = auth.uid()
        AND user_group_permissions.group_id = tank_groups.id
    )
);

-- User roles policies - managers can manage all user roles (same as admins)
CREATE POLICY "Admins can manage all user roles" ON user_roles
FOR ALL USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'manager')
);

-- ============================================================================
-- STEP 3: Verify the changes
-- ============================================================================

-- Show all policies for verification
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('fuel_tanks', 'dip_readings', 'tank_alerts', 'tank_groups', 'user_roles')
ORDER BY tablename, policyname;

-- Test query to verify manager access (replace with actual manager user_id)
-- SELECT 
--     (SELECT role FROM public.user_roles WHERE user_id = 'manager-user-id-here' LIMIT 1) as manager_role,
--     CASE 
--         WHEN (SELECT role FROM public.user_roles WHERE user_id = 'manager-user-id-here' LIMIT 1) IN ('admin', 'manager') 
--         THEN 'Has admin/manager privileges' 
--         ELSE 'No admin/manager privileges' 
--     END as privilege_status;

-- ============================================================================
-- STEP 4: Status report
-- ============================================================================

SELECT 'RLS policies updated to include manager role' as status;

-- Show current roles in the system
SELECT 
    role,
    COUNT(*) as user_count
FROM user_roles 
GROUP BY role 
ORDER BY role; 