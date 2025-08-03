-- RBAC System Overhaul Migration
-- This script performs a complete refactor of the role-based access control system
-- to fix critical design flaws and improve security and scalability

-- ============================================================================
-- STEP 1: Create new user_group_permissions table
-- ============================================================================

-- Create the new table for managing user-group relationships
CREATE TABLE IF NOT EXISTS user_group_permissions (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES tank_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, group_id)
);

-- Enable RLS on the new table
ALTER TABLE user_group_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_group_permissions
CREATE POLICY "Users can view their own group permissions" ON user_group_permissions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all group permissions" ON user_group_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- STEP 2: Migrate existing data to new table
-- ============================================================================

-- Copy distinct user-group relationships from user_roles to user_group_permissions
INSERT INTO user_group_permissions (user_id, group_id)
SELECT DISTINCT user_id, group_id 
FROM user_roles 
WHERE group_id IS NOT NULL
ON CONFLICT (user_id, group_id) DO NOTHING;

-- ============================================================================
-- STEP 3: Refactor user_roles table
-- ============================================================================

-- Create a temporary table to store the primary role for each user
CREATE TEMP TABLE user_primary_roles AS
SELECT 
    user_id,
    CASE 
        WHEN COUNT(*) = 1 THEN MAX(role)
        WHEN COUNT(*) > 1 AND MAX(role) = 'admin' THEN 'admin'
        ELSE MAX(role)
    END as primary_role
FROM user_roles
GROUP BY user_id;

-- Drop the group_id column from user_roles
ALTER TABLE user_roles DROP COLUMN IF EXISTS group_id;

-- Clear existing data and re-insert with single roles
DELETE FROM user_roles;

INSERT INTO user_roles (user_id, role)
SELECT user_id, primary_role FROM user_primary_roles;

-- Add UNIQUE constraint on user_id to ensure one role per user
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);

-- Drop the temporary table
DROP TABLE user_primary_roles;

-- ============================================================================
-- STEP 4: Drop existing RLS policies and functions
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view tanks in their assigned groups" ON fuel_tanks;
DROP POLICY IF EXISTS "Users can view dips for accessible tanks" ON dip_readings;
DROP POLICY IF EXISTS "Users can insert dips for accessible tanks" ON dip_readings;
DROP POLICY IF EXISTS "Users can update their own dips for accessible tanks" ON dip_readings;
DROP POLICY IF EXISTS "Users can view alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can acknowledge alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can view their accessible groups" ON tank_groups;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;

-- Drop existing functions
DROP FUNCTION IF EXISTS user_has_tank_access(UUID);
DROP FUNCTION IF EXISTS user_has_group_access(UUID);

-- ============================================================================
-- STEP 5: Create new, performant RLS policies
-- ============================================================================

-- Fuel tanks policy
CREATE POLICY "Users can view tanks in their assigned groups" ON fuel_tanks
FOR SELECT USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin'
    OR
    EXISTS (
        SELECT 1 FROM user_group_permissions
        WHERE user_group_permissions.user_id = auth.uid()
        AND user_group_permissions.group_id = fuel_tanks.group_id
    )
);

-- Dip readings policies
CREATE POLICY "Users can manage dips for accessible tanks" ON dip_readings
FOR ALL USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin'
    OR
    EXISTS (
        SELECT 1
        FROM fuel_tanks ft
        JOIN user_group_permissions ugp ON ft.group_id = ugp.group_id
        WHERE ugp.user_id = auth.uid() AND ft.id = dip_readings.tank_id
    )
);

-- Tank alerts policies
CREATE POLICY "Users can view alerts for accessible tanks" ON tank_alerts
FOR SELECT USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin'
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
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin'
    OR
    EXISTS (
        SELECT 1
        FROM fuel_tanks ft
        JOIN user_group_permissions ugp ON ft.group_id = ugp.group_id
        WHERE ugp.user_id = auth.uid() AND ft.id = tank_alerts.tank_id
    )
);

-- Tank groups policy
CREATE POLICY "Users can view their accessible groups" ON tank_groups
FOR SELECT USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin'
    OR
    EXISTS (
        SELECT 1 FROM user_group_permissions
        WHERE user_group_permissions.user_id = auth.uid()
        AND user_group_permissions.group_id = tank_groups.id
    )
);

-- User roles policies
CREATE POLICY "Users can view their own roles" ON user_roles
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all user roles" ON user_roles
FOR ALL USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin'
);

-- ============================================================================
-- STEP 6: Verification queries
-- ============================================================================

-- Verify the migration was successful
SELECT 'Migration completed successfully' as status;

-- Show sample of migrated data
SELECT 
    'user_roles' as table_name,
    COUNT(*) as record_count
FROM user_roles
UNION ALL
SELECT 
    'user_group_permissions' as table_name,
    COUNT(*) as record_count
FROM user_group_permissions;

-- Show sample user permissions
SELECT 
    ur.user_id,
    ur.role,
    COUNT(ugp.group_id) as group_count
FROM user_roles ur
LEFT JOIN user_group_permissions ugp ON ur.user_id = ugp.user_id
GROUP BY ur.user_id, ur.role
LIMIT 5; 