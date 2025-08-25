-- Fix RLS Policy for Drivers Table
-- This allows anonymous users to SELECT from drivers table
-- Required for the frontend driver modal to work

-- Drop existing overly restrictive policy
DROP POLICY IF EXISTS drivers_select ON drivers;

-- Create new policy that allows anonymous SELECT access
-- This is safe because driver information is not sensitive
CREATE POLICY drivers_select_policy ON drivers
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Verify the policy was created
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'drivers';

-- Grant necessary permissions to anon role
GRANT SELECT ON drivers TO anon;

-- Also ensure authenticated role has full access
GRANT SELECT, INSERT, UPDATE, DELETE ON drivers TO authenticated;

COMMENT ON POLICY drivers_select_policy ON drivers 
IS 'Allows anonymous and authenticated users to read driver records for frontend functionality';

-- Test the policy by running a sample query
-- This should now work for anonymous users
SELECT COUNT(*) as driver_count FROM drivers;
SELECT first_name, last_name, fleet, depot FROM drivers LIMIT 5;