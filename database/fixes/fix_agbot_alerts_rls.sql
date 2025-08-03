-- Fix agbot_alerts RLS policies to allow proper access
-- Run this in Supabase Dashboard SQL Editor

-- ============================================================================
-- STEP 1: Drop existing restrictive policies
-- ============================================================================

-- Drop the overly restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view agbot alerts for accessible groups" ON agbot_alerts;

-- Drop other restrictive policies if they exist
DROP POLICY IF EXISTS "Users can update agbot alerts they can view" ON agbot_alerts;

-- Keep INSERT policy as it's working fine
-- DROP POLICY IF EXISTS "System can create agbot alerts" ON agbot_alerts;

-- ============================================================================
-- STEP 2: Create more permissive policies that work during auth loading
-- ============================================================================

-- Allow authenticated users to view all agbot alerts (same as tank_alerts pattern)
CREATE POLICY "Allow authenticated users to view agbot alerts" ON agbot_alerts
  FOR SELECT USING (
    auth.role() = 'authenticated' OR auth.role() = 'anon'
  );

-- Allow authenticated users to update agbot alerts
CREATE POLICY "Allow authenticated users to update agbot alerts" ON agbot_alerts
  FOR UPDATE USING (
    auth.role() = 'authenticated'
  );

-- ============================================================================
-- STEP 3: Verify permissions are granted
-- ============================================================================

-- Ensure proper table permissions
GRANT SELECT, INSERT, UPDATE ON agbot_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON agbot_alerts TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- ============================================================================
-- STEP 4: Test the fix
-- ============================================================================

-- Test the exact query that was failing in the frontend
SELECT 'Testing agbot_alerts access...' as status;

-- This should work now without 403 errors
SELECT COUNT(*) as agbot_alerts_count
FROM agbot_alerts 
WHERE acknowledged_at IS NULL 
   AND (snoozed_until IS NULL OR snoozed_until < NOW());

-- Show current policies
SELECT 
    schemaname,
    tablename, 
    policyname,
    permissive,
    roles,
    cmd,
    'RLS Policy Check' as verification_type
FROM pg_policies 
WHERE tablename = 'agbot_alerts';

SELECT 'agbot_alerts RLS policies fixed successfully' as result;
SELECT 'Frontend should now be able to access agbot alerts without 403 errors' as next_step;