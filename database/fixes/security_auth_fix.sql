-- ============================================================================
-- SECURITY FIX: Replace email-based authentication with user ID
-- ============================================================================
-- This migration fixes a security vulnerability where email addresses were
-- used for user authentication in RLS policies instead of user IDs.
-- Email-based authentication is vulnerable to spoofing attacks.
--
-- Date: 2024-01-XX
-- Issue: Critical security vulnerability in RLS policies
-- ============================================================================

-- STEP 1: Drop the problematic policies that use email authentication
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can update their own dips for accessible tanks" ON dip_readings;

-- STEP 2: Recreate the policy with proper UUID-based authentication
-- ----------------------------------------------------------------------------

-- This policy allows users to update only their own dip readings for tanks they have access to
-- Uses auth.uid() which returns the authenticated user's UUID from the JWT token
-- This is much more secure than email-based authentication
CREATE POLICY "Users can update their own dips for accessible tanks" ON dip_readings
  FOR UPDATE USING (
    user_has_tank_access(tank_id) AND 
    recorded_by = auth.uid()::text
  );

-- STEP 3: Verify the policy is working correctly
-- ----------------------------------------------------------------------------

-- Check that the policy was created successfully
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'dip_readings' 
  AND policyname = 'Users can update their own dips for accessible tanks';

-- STEP 4: Data migration considerations
-- ----------------------------------------------------------------------------

-- NOTE: If there is existing data where recorded_by contains email addresses,
-- you would need to migrate that data to use user IDs instead.
-- This script assumes that the application code has been updated to use user IDs.

-- Example migration query (commented out - only run if needed):
-- UPDATE dip_readings 
-- SET recorded_by = (
--     SELECT id::text 
--     FROM auth.users 
--     WHERE email = dip_readings.recorded_by
-- )
-- WHERE recorded_by ~ '^[^@]+@[^@]+\.[^@]+$'; -- regex to match email format

-- STEP 5: Security verification
-- ----------------------------------------------------------------------------

-- Verify that no policies are using email-based authentication
SELECT 
    tablename,
    policyname,
    qual,
    with_check
FROM pg_policies 
WHERE (qual LIKE '%email%' OR with_check LIKE '%email%')
  AND tablename IN ('dip_readings', 'tank_alerts', 'fuel_tanks', 'user_roles');

COMMENT ON POLICY "Users can update their own dips for accessible tanks" ON dip_readings IS 
'Security fix: Uses auth.uid() instead of email for user identification to prevent spoofing attacks';

-- ============================================================================
-- SECURITY AUDIT LOG
-- ============================================================================
-- Migration completed: Email-based authentication replaced with UUID-based
-- Security improvement: Eliminates email spoofing vulnerability
-- Impact: Users can only update their own fuel dip readings
-- Verification: Policy uses auth.uid()::text instead of auth.jwt() ->> ''email''
-- ============================================================================