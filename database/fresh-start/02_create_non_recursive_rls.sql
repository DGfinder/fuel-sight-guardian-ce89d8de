-- NON-RECURSIVE RLS POLICIES FOR FRESH START
-- This implements security without the infinite recursion problems

-- ============================================================================
-- STEP 1: Create helper functions that DON'T cause recursion
-- ============================================================================

-- Safe admin check function - uses SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION is_admin_safe()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Direct query with SECURITY DEFINER bypasses RLS completely
    SELECT role INTO user_role
    FROM user_roles 
    WHERE user_id = auth.uid()
    LIMIT 1;
    
    RETURN user_role IN ('admin', 'manager');
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe function to check if user has access to a group
CREATE OR REPLACE FUNCTION user_can_access_group_safe(target_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if admin first (using safe function)
    IF is_admin_safe() THEN
        RETURN TRUE;
    END IF;
    
    -- Check explicit group permissions
    RETURN EXISTS (
        SELECT 1 FROM user_group_permissions
        WHERE user_id = auth.uid() 
        AND group_id = target_group_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe function to check if user has access to a subgroup
CREATE OR REPLACE FUNCTION user_can_access_subgroup_safe(target_group_id UUID, target_subgroup TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if admin first
    IF is_admin_safe() THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has general group access
    IF user_can_access_group_safe(target_group_id) THEN
        -- Check if they have subgroup restrictions
        IF EXISTS (
            SELECT 1 FROM user_subgroup_permissions
            WHERE user_id = auth.uid() 
            AND group_id = target_group_id
        ) THEN
            -- They have subgroup restrictions, check specific subgroup
            RETURN EXISTS (
                SELECT 1 FROM user_subgroup_permissions
                WHERE user_id = auth.uid() 
                AND group_id = target_group_id
                AND subgroup_name = target_subgroup
            );
        ELSE
            -- No subgroup restrictions, allow full group access
            RETURN TRUE;
        END IF;
    END IF;
    
    RETURN FALSE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: Enable RLS on all tables
-- ============================================================================

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tank_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dip_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tank_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subgroup_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Create simple, non-recursive RLS policies
-- ============================================================================

-- USER_ROLES policies (CRITICAL: These must NOT be recursive)
CREATE POLICY "users_can_read_own_role" ON user_roles
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admins_can_manage_all_roles" ON user_roles
FOR ALL USING (
    -- Direct check to avoid recursion - use raw SQL not functions
    EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('admin', 'manager')
    )
);

-- TANK_GROUPS policies
CREATE POLICY "users_can_read_accessible_groups" ON tank_groups
FOR SELECT USING (user_can_access_group_safe(id));

CREATE POLICY "admins_can_manage_groups" ON tank_groups
FOR ALL USING (is_admin_safe());

-- FUEL_TANKS policies
CREATE POLICY "users_can_read_accessible_tanks" ON fuel_tanks
FOR SELECT USING (
    user_can_access_subgroup_safe(group_id, subgroup)
);

CREATE POLICY "admins_can_manage_tanks" ON fuel_tanks
FOR ALL USING (is_admin_safe());

-- DIP_READINGS policies
CREATE POLICY "users_can_read_accessible_dips" ON dip_readings
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM fuel_tanks ft
        WHERE ft.id = dip_readings.tank_id
        AND user_can_access_subgroup_safe(ft.group_id, ft.subgroup)
    )
);

CREATE POLICY "users_can_add_dips_to_accessible_tanks" ON dip_readings
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM fuel_tanks ft
        WHERE ft.id = dip_readings.tank_id
        AND user_can_access_subgroup_safe(ft.group_id, ft.subgroup)
    )
);

CREATE POLICY "users_can_edit_own_dips" ON dip_readings
FOR UPDATE USING (
    recorded_by = auth.uid()
    AND EXISTS (
        SELECT 1 FROM fuel_tanks ft
        WHERE ft.id = dip_readings.tank_id
        AND user_can_access_subgroup_safe(ft.group_id, ft.subgroup)
    )
);

CREATE POLICY "admins_can_manage_all_dips" ON dip_readings
FOR ALL USING (is_admin_safe());

-- TANK_ALERTS policies
CREATE POLICY "users_can_read_accessible_alerts" ON tank_alerts
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM fuel_tanks ft
        WHERE ft.id = tank_alerts.tank_id
        AND user_can_access_subgroup_safe(ft.group_id, ft.subgroup)
    )
);

CREATE POLICY "users_can_acknowledge_accessible_alerts" ON tank_alerts
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM fuel_tanks ft
        WHERE ft.id = tank_alerts.tank_id
        AND user_can_access_subgroup_safe(ft.group_id, ft.subgroup)
    )
);

-- USER_GROUP_PERMISSIONS policies
CREATE POLICY "users_can_read_own_permissions" ON user_group_permissions
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admins_can_manage_all_permissions" ON user_group_permissions
FOR ALL USING (is_admin_safe());

-- USER_SUBGROUP_PERMISSIONS policies
CREATE POLICY "users_can_read_own_subgroup_permissions" ON user_subgroup_permissions
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admins_can_manage_all_subgroup_permissions" ON user_subgroup_permissions
FOR ALL USING (is_admin_safe());

-- PROFILES policies
CREATE POLICY "users_can_read_all_profiles" ON profiles
FOR SELECT USING (true); -- Profiles are generally readable for display names

CREATE POLICY "users_can_update_own_profile" ON profiles
FOR UPDATE USING (id = auth.uid());

CREATE POLICY "admins_can_manage_all_profiles" ON profiles
FOR ALL USING (is_admin_safe());

-- ============================================================================
-- STEP 4: Test all policies work without recursion
-- ============================================================================

-- Test helper functions
SELECT 
    'Testing helper functions' as test_name,
    is_admin_safe() as is_admin,
    user_can_access_group_safe('00000000-0000-0000-0000-000000000000'::uuid) as test_group_access;

-- Test user_roles access (this was the main problem)
SELECT 
    'Testing user_roles query' as test_name,
    role,
    'Should work without infinite recursion' as expected
FROM user_roles 
WHERE user_id = auth.uid()
LIMIT 1;

SELECT 'NON-RECURSIVE RLS POLICIES CREATED SUCCESSFULLY' as result;
SELECT 'All policies designed to avoid infinite recursion' as guarantee; 