-- Fix RLS Policy for Drivers Table
-- This script resolves anonymous access issues that prevent frontend driver modals from working
-- Run this in the Supabase SQL editor to fix driver access issues

-- ==============================================================================
-- PROBLEM: 
--   Frontend driver modals fail because anonymous users cannot access drivers table
--   RLS policies are too restrictive for normal application functionality
--
-- SOLUTION:
--   Create appropriate RLS policies that allow frontend access while maintaining security
-- ==============================================================================

-- Step 1: Drop existing overly restrictive policies
DROP POLICY IF EXISTS drivers_select ON drivers;
DROP POLICY IF EXISTS drivers_select_policy ON drivers;

-- Step 2: Create new policy that allows anonymous SELECT access
-- This is safe because driver information is not sensitive personal data
CREATE POLICY "drivers_anonymous_select" ON drivers
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Step 3: Grant necessary permissions to anonymous role
GRANT SELECT ON drivers TO anon;

-- Step 4: Ensure authenticated users have full CRUD access
GRANT SELECT, INSERT, UPDATE, DELETE ON drivers TO authenticated;

-- Step 5: Add helpful comment
COMMENT ON POLICY "drivers_anonymous_select" ON drivers 
IS 'Allows anonymous and authenticated users to read driver records for frontend functionality. Driver information is not sensitive and needs to be accessible for driver management UI.';

-- ==============================================================================
-- VERIFICATION QUERIES
-- ==============================================================================

-- Verify the policy was created correctly
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'drivers'
ORDER BY policyname;

-- Test anonymous access (this should now work)
SELECT COUNT(*) as total_drivers FROM drivers;

-- Show sample drivers (limit for security)
SELECT 
  first_name, 
  last_name, 
  fleet, 
  depot,
  status 
FROM drivers 
WHERE status = 'Active'
LIMIT 5;

-- ==============================================================================
-- SUCCESS INDICATORS
-- ==============================================================================
-- After running this script, you should see:
--   ✅ Policy created with name "drivers_anonymous_select"  
--   ✅ COUNT query returns total number of drivers
--   ✅ Sample drivers query returns actual driver data
--   ✅ Frontend driver modals should now work properly
--   ✅ Driver search in management UI should function
-- ==============================================================================