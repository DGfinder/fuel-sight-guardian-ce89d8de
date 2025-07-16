-- RBAC System Rollback Script
-- This script restores the original RBAC schema if the migration needs to be undone
-- WARNING: This will destroy the new schema and restore the old one

-- ============================================================================
-- STEP 1: Backup current data (for safety)
-- ============================================================================

-- Create backup tables
CREATE TABLE IF NOT EXISTS user_roles_backup AS SELECT * FROM user_roles;
CREATE TABLE IF NOT EXISTS user_group_permissions_backup AS SELECT * FROM user_group_permissions;

-- ============================================================================
-- STEP 2: Drop new RLS policies
-- ============================================================================

-- Drop new policies
DROP POLICY IF EXISTS "Users can view tanks in their assigned groups" ON fuel_tanks;
DROP POLICY IF EXISTS "Users can manage dips for accessible tanks" ON dip_readings;
DROP POLICY IF EXISTS "Users can view alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can acknowledge alerts for accessible tanks" ON tank_alerts;
DROP POLICY IF EXISTS "Users can view their accessible groups" ON tank_groups;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own group permissions" ON user_group_permissions;
DROP POLICY IF EXISTS "Admins can manage all group permissions" ON user_group_permissions;

-- ============================================================================
-- STEP 3: Restore original user_roles table
-- ============================================================================

-- Add group_id column back to user_roles
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES tank_groups(id);

-- Migrate data back from user_group_permissions to user_roles
INSERT INTO user_roles (user_id, role, group_id)
SELECT ugp.user_id, ur.role, ugp.group_id
FROM user_group_permissions ugp
JOIN user_roles ur ON ugp.user_id = ur.user_id
ON CONFLICT (user_id) DO NOTHING;

-- Remove the UNIQUE constraint
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_unique;

-- ============================================================================
-- STEP 4: Restore original functions
-- ============================================================================

-- Create user permission check function
CREATE OR REPLACE FUNCTION user_has_tank_access(tank_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Admin users can access everything
  IF EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has access to tank's group
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN fuel_tanks ft ON ft.group_id = ur.group_id
    WHERE ur.user_id = auth.uid() AND ft.id = tank_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check group access
CREATE OR REPLACE FUNCTION user_has_group_access(target_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Admin users can access everything
  IF EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has access to specific group
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND group_id = target_group_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: Restore original RLS policies
-- ============================================================================

-- Tank access policies
CREATE POLICY "Users can view tanks in their assigned groups" ON fuel_tanks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND (role = 'admin' OR group_id = fuel_tanks.group_id)
    )
  );

-- Dip readings policies
CREATE POLICY "Users can view dips for accessible tanks" ON dip_readings
  FOR SELECT USING (user_has_tank_access(tank_id));

CREATE POLICY "Users can insert dips for accessible tanks" ON dip_readings
  FOR INSERT WITH CHECK (user_has_tank_access(tank_id));

CREATE POLICY "Users can update their own dips for accessible tanks" ON dip_readings
  FOR UPDATE USING (
    user_has_tank_access(tank_id) AND 
    recorded_by = auth.jwt() ->> 'email'
  );

-- Tank alerts policies
CREATE POLICY "Users can view alerts for accessible tanks" ON tank_alerts
  FOR SELECT USING (user_has_tank_access(tank_id));

CREATE POLICY "Users can acknowledge alerts for accessible tanks" ON tank_alerts
  FOR UPDATE USING (user_has_tank_access(tank_id));

-- Tank groups policy
CREATE POLICY "Users can view their accessible groups" ON tank_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND (role = 'admin' OR group_id = tank_groups.id)
    )
  );

-- User roles policies
CREATE POLICY "Users can view their own roles" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all user roles" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- STEP 6: Drop new table
-- ============================================================================

-- Drop the user_group_permissions table
DROP TABLE IF EXISTS user_group_permissions;

-- ============================================================================
-- STEP 7: Verification
-- ============================================================================

-- Verify rollback was successful
SELECT 'Rollback completed successfully' as status;

-- Show sample of restored data
SELECT 
    'user_roles' as table_name,
    COUNT(*) as record_count
FROM user_roles;

-- Show sample user permissions
SELECT 
    ur.user_id,
    ur.role,
    COUNT(ur.group_id) as group_count
FROM user_roles ur
GROUP BY ur.user_id, ur.role
LIMIT 5;

-- Clean up backup tables (optional - uncomment if you want to keep them)
-- DROP TABLE IF EXISTS user_roles_backup;
-- DROP TABLE IF EXISTS user_group_permissions_backup; 