-- Subgroup Permissions Migration
-- This script adds subgroup-level permissions to the existing RBAC system
-- while maintaining backward compatibility with group-level permissions

-- ============================================================================
-- STEP 1: Create user_subgroup_permissions table
-- ============================================================================

-- Create the new table for managing user-subgroup relationships
CREATE TABLE IF NOT EXISTS user_subgroup_permissions (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES tank_groups(id) ON DELETE CASCADE,
    subgroup_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, group_id, subgroup_name)
);

-- Enable RLS on the new table
ALTER TABLE user_subgroup_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_subgroup_permissions
CREATE POLICY "Users can view their own subgroup permissions" ON user_subgroup_permissions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins and managers can manage all subgroup permissions" ON user_subgroup_permissions
    FOR ALL USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'manager')
    );

-- ============================================================================
-- STEP 2: Create helper functions for permission checks
-- ============================================================================

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
-- STEP 3: Update RLS policies to support subgroup permissions
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view tanks in their assigned groups" ON fuel_tanks;
DROP POLICY IF EXISTS "Users can manage dips for accessible tanks" ON dip_readings;
DROP POLICY IF EXISTS "Users can view alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can acknowledge alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can view their accessible groups" ON tank_groups;

-- Fuel tanks policy - now supports subgroup access
CREATE POLICY "Users can view tanks in their assigned groups or subgroups" ON fuel_tanks
FOR SELECT USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'manager')
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

-- Dip readings policies - now supports subgroup access
CREATE POLICY "Users can manage dips for accessible tanks" ON dip_readings
FOR ALL USING (user_has_tank_access_with_subgroups(tank_id));

-- Tank alerts policies - now supports subgroup access
CREATE POLICY "Users can view alerts for accessible tanks" ON tank_alerts
FOR SELECT USING (user_has_tank_access_with_subgroups(tank_id));

CREATE POLICY "Users can acknowledge alerts for accessible tanks" ON tank_alerts
FOR UPDATE USING (user_has_tank_access_with_subgroups(tank_id));

-- Tank groups policy - now supports subgroup access
CREATE POLICY "Users can view their accessible groups" ON tank_groups
FOR SELECT USING (user_has_group_access_with_subgroups(id));

-- ============================================================================
-- STEP 4: Create helper functions for frontend
-- ============================================================================

-- Function to get user's accessible subgroups for a specific group
CREATE OR REPLACE FUNCTION get_user_accessible_subgroups(target_group_id UUID)
RETURNS TABLE(subgroup_name TEXT) AS $$
BEGIN
    -- Admin and manager users can access all subgroups
    IF EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager')
    ) THEN
        RETURN QUERY
        SELECT DISTINCT ft.subgroup
        FROM fuel_tanks ft
        WHERE ft.group_id = target_group_id AND ft.subgroup IS NOT NULL;
    END IF;
    
    -- Check if user has full group access (return all subgroups)
    IF EXISTS (
        SELECT 1 FROM user_group_permissions
        WHERE user_id = auth.uid() AND group_id = target_group_id
    ) THEN
        RETURN QUERY
        SELECT DISTINCT ft.subgroup
        FROM fuel_tanks ft
        WHERE ft.group_id = target_group_id AND ft.subgroup IS NOT NULL;
    END IF;
    
    -- Return only specific subgroups the user has access to
    RETURN QUERY
    SELECT usp.subgroup_name
    FROM user_subgroup_permissions usp
    WHERE usp.user_id = auth.uid() AND usp.group_id = target_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: Create view for easier querying
-- ============================================================================

-- Create a view that combines group and subgroup permissions
CREATE OR REPLACE VIEW user_all_permissions AS
SELECT 
    ugp.user_id,
    ugp.group_id,
    tg.name as group_name,
    NULL as subgroup_name,
    'group' as permission_type,
    ugp.created_at
FROM user_group_permissions ugp
JOIN tank_groups tg ON ugp.group_id = tg.id

UNION ALL

SELECT 
    usp.user_id,
    usp.group_id,
    tg.name as group_name,
    usp.subgroup_name,
    'subgroup' as permission_type,
    usp.created_at
FROM user_subgroup_permissions usp
JOIN tank_groups tg ON usp.group_id = tg.id;

-- ============================================================================
-- STEP 6: Verification queries
-- ============================================================================

-- Show current permissions structure
SELECT 
    'Current Group Permissions' as info,
    COUNT(*) as count
FROM user_group_permissions;

SELECT 
    'Current Subgroup Permissions' as info,
    COUNT(*) as count
FROM user_subgroup_permissions;

-- Example: Show all permissions for a user
-- SELECT * FROM user_all_permissions WHERE user_id = 'USER_ID_HERE';

-- Example: Show accessible subgroups for a user in GSF Depots
-- SELECT * FROM get_user_accessible_subgroups('GSF_DEPOTS_GROUP_ID_HERE');

COMMENT ON TABLE user_subgroup_permissions IS 'Stores subgroup-level permissions for users. When a user has an entry here, they can only access the specified subgroups within the group, not the entire group.';
COMMENT ON FUNCTION user_has_tank_access_with_subgroups IS 'Checks if a user has access to a specific tank, considering both group and subgroup permissions.';
COMMENT ON FUNCTION get_user_accessible_subgroups IS 'Returns the subgroups a user can access within a specific group.';
COMMENT ON VIEW user_all_permissions IS 'Unified view of all user permissions (both group and subgroup level).'; 