-- RBAC Implementation for Fuel Sight Guardian
-- Secure access control for Swan Transit and other depot users

-- Enable RLS on core tables
ALTER TABLE fuel_tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dip_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tank_alerts ENABLE ROW LEVEL SECURITY;

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

-- Tank groups policy (users can only see groups they have access to)
ALTER TABLE tank_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their accessible groups" ON tank_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND (role = 'admin' OR group_id = tank_groups.id)
    )
  );

-- User roles policies (users can view their own roles)
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Admin policy for user management
CREATE POLICY "Admins can manage all user roles" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );