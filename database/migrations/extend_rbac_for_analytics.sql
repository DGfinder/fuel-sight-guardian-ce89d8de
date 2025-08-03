-- Extend existing RBAC system for analytics platform
-- Add compliance_manager role and analytics-specific permissions

-- Add compliance_manager role to existing user_role enum
DO $$ 
BEGIN
    -- Check if compliance_manager already exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'compliance_manager' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'compliance_manager';
    END IF;
END $$;

-- Analytics-specific permissions table
CREATE TABLE IF NOT EXISTS analytics_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  permission_name TEXT NOT NULL,
  granted BOOLEAN DEFAULT true,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, permission_name)
);

-- Define analytics permissions
INSERT INTO analytics_permissions (user_id, permission_name, granted) 
SELECT ur.user_id, perm.permission_name, true
FROM user_roles ur
CROSS JOIN (
  VALUES 
    ('view_guardian_events'),
    ('manage_guardian_verification'),
    ('view_myob_deliveries'),
    ('upload_myob_data'),
    ('view_lytx_events'),
    ('assign_lytx_drivers'),
    ('generate_compliance_reports'),
    ('view_driver_performance'),
    ('manage_data_sources'),
    ('view_analytics_dashboard')
) AS perm(permission_name)
WHERE ur.role IN ('admin', 'manager')
ON CONFLICT (user_id, permission_name) DO NOTHING;

-- Compliance manager specific permissions
INSERT INTO analytics_permissions (user_id, permission_name, granted)
SELECT ur.user_id, perm.permission_name, true
FROM user_roles ur
CROSS JOIN (
  VALUES
    ('view_guardian_events'),
    ('manage_guardian_verification'),
    ('view_lytx_events'),
    ('generate_compliance_reports'),
    ('view_driver_performance'),
    ('view_analytics_dashboard')
) AS perm(permission_name)
WHERE ur.role = 'compliance_manager'
ON CONFLICT (user_id, permission_name) DO NOTHING;

-- Enhanced RLS policies for analytics tables based on existing permission patterns
-- Guardian events access control
DROP POLICY IF EXISTS "Guardian events are accessible to authenticated users" ON guardian_events;
CREATE POLICY "Guardian events access control" ON guardian_events
  FOR ALL TO authenticated 
  USING (
    -- Admin and managers can access all
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager', 'compliance_manager')
    )
    OR
    -- Users with specific analytics permissions
    EXISTS (
      SELECT 1 FROM analytics_permissions ap
      WHERE ap.user_id = auth.uid()
      AND ap.permission_name = 'view_guardian_events'
      AND ap.granted = true
    )
  );

-- MYOB deliveries access control
DROP POLICY IF EXISTS "Carrier deliveries are accessible to authenticated users" ON carrier_deliveries;
CREATE POLICY "Carrier deliveries access control" ON carrier_deliveries
  FOR ALL TO authenticated
  USING (
    -- Admin and managers can access all
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
    OR
    -- Users with specific analytics permissions
    EXISTS (
      SELECT 1 FROM analytics_permissions ap
      WHERE ap.user_id = auth.uid()
      AND ap.permission_name = 'view_myob_deliveries'
      AND ap.granted = true
    )
  );

-- LYTX events access control
DROP POLICY IF EXISTS "LYTX events are accessible to authenticated users" ON lytx_safety_events;
CREATE POLICY "LYTX events access control" ON lytx_safety_events
  FOR ALL TO authenticated
  USING (
    -- Admin and managers can access all
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager', 'compliance_manager')
    )
    OR
    -- Users with specific analytics permissions
    EXISTS (
      SELECT 1 FROM analytics_permissions ap
      WHERE ap.user_id = auth.uid()
      AND ap.permission_name = 'view_lytx_events'
      AND ap.granted = true
    )
  );

-- Driver performance access control
DROP POLICY IF EXISTS "Driver performance is accessible to authenticated users" ON driver_performance_monthly;
CREATE POLICY "Driver performance access control" ON driver_performance_monthly
  FOR ALL TO authenticated
  USING (
    -- Admin and managers can access all
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager', 'compliance_manager')
    )
    OR
    -- Users with specific analytics permissions
    EXISTS (
      SELECT 1 FROM analytics_permissions ap
      WHERE ap.user_id = auth.uid()
      AND ap.permission_name = 'view_driver_performance'
      AND ap.granted = true
    )
  );

-- Compliance reports access control
DROP POLICY IF EXISTS "Compliance reports are accessible to authenticated users" ON guardian_compliance_reports;
CREATE POLICY "Compliance reports access control" ON guardian_compliance_reports
  FOR ALL TO authenticated
  USING (
    -- Admin, managers, and compliance managers can access
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager', 'compliance_manager')
    )
    OR
    -- Users with specific permission
    EXISTS (
      SELECT 1 FROM analytics_permissions ap
      WHERE ap.user_id = auth.uid()
      AND ap.permission_name = 'generate_compliance_reports'
      AND ap.granted = true
    )
  );

-- Upload batches access - restrict to users who can upload data
DROP POLICY IF EXISTS "Upload batches are accessible to authenticated users" ON upload_batches;
CREATE POLICY "Upload batches access control" ON upload_batches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
    OR
    EXISTS (
      SELECT 1 FROM analytics_permissions ap
      WHERE ap.user_id = auth.uid()
      AND ap.permission_name IN ('upload_myob_data', 'manage_data_sources')
      AND ap.granted = true
    )
  );

CREATE POLICY "Upload batches insert control" ON upload_batches
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND
    (
      EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('admin', 'manager')
      )
      OR
      EXISTS (
        SELECT 1 FROM analytics_permissions ap
        WHERE ap.user_id = auth.uid()
        AND ap.permission_name = 'upload_myob_data'
        AND ap.granted = true
      )
    )
  );

-- Data sources access - restrict to admins and data managers
DROP POLICY IF EXISTS "Analytics data is accessible to authenticated users" ON data_sources;
CREATE POLICY "Data sources access control" ON data_sources
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
    OR
    EXISTS (
      SELECT 1 FROM analytics_permissions ap
      WHERE ap.user_id = auth.uid()
      AND ap.permission_name = 'manage_data_sources'
      AND ap.granted = true
    )
  );

-- Analytics permissions table access
ALTER TABLE analytics_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analytics permissions access control" ON analytics_permissions
  FOR ALL TO authenticated
  USING (
    -- Users can see their own permissions
    user_id = auth.uid()
    OR
    -- Admins can see all permissions
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Function to check analytics permissions
CREATE OR REPLACE FUNCTION check_analytics_permission(permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user has admin role
  IF EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'
  ) THEN
    RETURN true;
  END IF;
  
  -- Check specific permission
  RETURN EXISTS (
    SELECT 1 FROM analytics_permissions ap
    WHERE ap.user_id = auth.uid()
    AND ap.permission_name = check_analytics_permission.permission_name
    AND ap.granted = true
  );
END;
$$;

-- Function to get user analytics permissions
CREATE OR REPLACE FUNCTION get_user_analytics_permissions(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
  permission_name TEXT,
  granted BOOLEAN,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.permission_name,
    ap.granted,
    ur.role::TEXT
  FROM analytics_permissions ap
  LEFT JOIN user_roles ur ON ur.user_id = user_uuid
  WHERE ap.user_id = user_uuid
  ORDER BY ap.permission_name;
END;
$$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_permissions_user_id ON analytics_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_permissions_permission_name ON analytics_permissions(permission_name);
CREATE INDEX IF NOT EXISTS idx_analytics_permissions_granted ON analytics_permissions(granted);

-- Comments
COMMENT ON TABLE analytics_permissions IS 'Granular permissions for analytics platform features';
COMMENT ON FUNCTION check_analytics_permission IS 'Check if current user has specific analytics permission';
COMMENT ON FUNCTION get_user_analytics_permissions IS 'Get all analytics permissions for a user';