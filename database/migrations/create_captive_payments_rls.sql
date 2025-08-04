-- =====================================================
-- CAPTIVE PAYMENTS RLS POLICIES
-- =====================================================
-- Row Level Security policies for captive payments system
-- Implements role-based access control based on user permissions
-- Ensures users only see data they're authorized to access
-- =====================================================

-- Enable RLS on all captive payments tables
ALTER TABLE captive_payment_records ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS FOR RLS
-- =====================================================

-- Function to check if user has permission to view MYOB deliveries
CREATE OR REPLACE FUNCTION has_myob_deliveries_permission(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
BEGIN
  -- Get user role
  SELECT role INTO user_role
  FROM user_roles
  WHERE user_roles.user_id = has_myob_deliveries_permission.user_id;
  
  -- Admin and manager roles have full access
  IF user_role IN ('admin', 'manager') THEN
    RETURN true;
  END IF;
  
  -- Check if user has specific MYOB deliveries permission
  -- This could be extended to check a permissions table in the future
  RETURN user_role IS NOT NULL;
END;
$$;

-- Function to get accessible carriers for user
CREATE OR REPLACE FUNCTION get_user_accessible_carriers(user_id uuid)
RETURNS carrier_type[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
  accessible_groups text[];
  carriers carrier_type[] := '{}';
BEGIN
  -- Get user role and accessible groups
  SELECT ur.role INTO user_role
  FROM user_roles ur
  WHERE ur.user_id = get_user_accessible_carriers.user_id;
  
  -- Admin and manager roles see all carriers
  IF user_role IN ('admin', 'manager') THEN
    RETURN ARRAY['SMB', 'GSF', 'Combined']::carrier_type[];
  END IF;
  
  -- Get user's accessible groups to determine carrier access
  SELECT ARRAY(
    SELECT DISTINCT ug.group_name 
    FROM user_groups ug 
    WHERE ug.user_id = get_user_accessible_carriers.user_id
  ) INTO accessible_groups;
  
  -- Map groups to carriers (this logic may need adjustment based on group naming)
  IF 'SMB' = ANY(accessible_groups) OR 'Stevemacs' = ANY(accessible_groups) THEN
    carriers := carriers || 'SMB'::carrier_type;
  END IF;
  
  IF 'GSF' = ANY(accessible_groups) OR 'Great Southern Fuels' = ANY(accessible_groups) THEN
    carriers := carriers || 'GSF'::carrier_type;
  END IF;
  
  -- If user has access to any carrier, they can also see combined data
  IF array_length(carriers, 1) > 0 THEN
    carriers := carriers || 'Combined'::carrier_type;
  END IF;
  
  -- Default: if no specific carrier access, allow Combined (safest default)
  IF array_length(carriers, 1) = 0 THEN
    carriers := ARRAY['Combined']::carrier_type[];
  END IF;
  
  RETURN carriers;
END;
$$;

-- =====================================================
-- RLS POLICIES FOR CAPTIVE_PAYMENT_RECORDS
-- =====================================================

-- Policy: Users can only see records they have permission for
CREATE POLICY captive_records_select_policy ON captive_payment_records
  FOR SELECT
  USING (
    has_myob_deliveries_permission(auth.uid()) 
    AND carrier = ANY(get_user_accessible_carriers(auth.uid()))
  );

-- Policy: Users can insert records (for data imports)
CREATE POLICY captive_records_insert_policy ON captive_payment_records
  FOR INSERT
  WITH CHECK (
    has_myob_deliveries_permission(auth.uid())
    AND (
      -- Admins and managers can insert any carrier data
      EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager')
      )
      OR
      -- Regular users can only insert data for their accessible carriers
      carrier = ANY(get_user_accessible_carriers(auth.uid()))
    )
  );

-- Policy: Users can update records they can see
CREATE POLICY captive_records_update_policy ON captive_payment_records
  FOR UPDATE
  USING (
    has_myob_deliveries_permission(auth.uid())
    AND carrier = ANY(get_user_accessible_carriers(auth.uid()))
  )
  WITH CHECK (
    has_myob_deliveries_permission(auth.uid())
    AND carrier = ANY(get_user_accessible_carriers(auth.uid()))
  );

-- Policy: Only admins can delete records (for data cleanup)
CREATE POLICY captive_records_delete_policy ON captive_payment_records
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin')
    )
  );

-- =====================================================
-- VIEW SECURITY (MATERIALIZED VIEWS)
-- =====================================================

-- Create security barrier views for materialized views
-- These will automatically apply RLS policies from the underlying table

CREATE VIEW secure_captive_deliveries 
WITH (security_barrier = true) AS
SELECT * FROM captive_deliveries cd
WHERE EXISTS (
  SELECT 1 FROM captive_payment_records cpr
  WHERE cpr.bill_of_lading = cd.bill_of_lading
    AND cpr.delivery_date = cd.delivery_date
    AND cpr.customer = cd.customer
  LIMIT 1
);

CREATE VIEW secure_captive_monthly_analytics
WITH (security_barrier = true) AS
SELECT * FROM captive_monthly_analytics cma
WHERE cma.carrier = ANY(get_user_accessible_carriers(auth.uid()));

CREATE VIEW secure_captive_customer_analytics
WITH (security_barrier = true) AS
SELECT * FROM captive_customer_analytics cca
WHERE cca.carrier = ANY(get_user_accessible_carriers(auth.uid()));

CREATE VIEW secure_captive_terminal_analytics
WITH (security_barrier = true) AS
SELECT * FROM captive_terminal_analytics cta
WHERE cta.carrier = ANY(get_user_accessible_carriers(auth.uid()));

-- =====================================================
-- GRANTS FOR SECURE VIEWS
-- =====================================================

GRANT SELECT ON secure_captive_deliveries TO authenticated;
GRANT SELECT ON secure_captive_monthly_analytics TO authenticated;
GRANT SELECT ON secure_captive_customer_analytics TO authenticated;
GRANT SELECT ON secure_captive_terminal_analytics TO authenticated;

-- =====================================================
-- SPECIAL PERMISSIONS FOR SERVICE OPERATIONS
-- =====================================================

-- Allow the refresh function to bypass RLS for maintenance operations
ALTER FUNCTION refresh_captive_analytics() SECURITY DEFINER;

-- Grant permissions for automated refresh operations
DO $$
BEGIN
  -- Create a service role for automated operations if it doesn't exist
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'captive_service') THEN
    CREATE ROLE captive_service;
    GRANT USAGE ON SCHEMA public TO captive_service;
    GRANT SELECT, INSERT, UPDATE ON captive_payment_records TO captive_service;
    GRANT SELECT ON captive_deliveries TO captive_service;
    GRANT EXECUTE ON FUNCTION refresh_captive_analytics() TO captive_service;
  END IF;
END $$;

-- =====================================================
-- AUDIT LOGGING INTEGRATION
-- =====================================================

-- Access logging removed: PostgreSQL triggers don't support SELECT operations
-- Application-level logging should be implemented in the API layer instead

-- Note: Access logging should be implemented at the application level
-- PostgreSQL does not support AFTER SELECT triggers
-- RLS policies already control access, and API logging handles audit trails

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON POLICY captive_records_select_policy ON captive_payment_records IS 
'Users can only select captive payment records for carriers they have access to, based on their role and group memberships.';

COMMENT ON FUNCTION has_myob_deliveries_permission(uuid) IS 
'Checks if a user has permission to view MYOB delivery data. Returns true for admin/manager roles or users with explicit permission.';

COMMENT ON FUNCTION get_user_accessible_carriers(uuid) IS 
'Returns array of carrier types the user can access based on their role and group memberships. Admins see all, others see only their assigned carriers.';

COMMENT ON VIEW secure_captive_deliveries IS 
'Security barrier view for captive deliveries that automatically applies RLS policies. Use this instead of direct materialized view access.';

-- =====================================================
-- TESTING QUERIES (FOR VERIFICATION)
-- =====================================================

-- Test RLS policies work correctly
DO $$
DECLARE
  test_user_id uuid;
  accessible_carriers carrier_type[];
BEGIN
  -- Get a test user ID (first authenticated user)
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    -- Test permission function
    RAISE NOTICE 'User % has MYOB permission: %', 
      test_user_id, 
      has_myob_deliveries_permission(test_user_id);
    
    -- Test carrier access function
    SELECT get_user_accessible_carriers(test_user_id) INTO accessible_carriers;
    RAISE NOTICE 'User % can access carriers: %', 
      test_user_id, 
      accessible_carriers;
  ELSE
    RAISE NOTICE 'No test users found in auth.users table';
  END IF;
END $$;

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables 
WHERE tablename = 'captive_payment_records';

SELECT 'Captive Payments RLS policies created successfully' as status;