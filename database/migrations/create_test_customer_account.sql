-- Migration: Create Test Customer Account for Portal Testing
-- Email: admin@greatsouthernfuels.com.au
-- This creates a test customer account with tank access for testing the customer portal
--
-- NOTE: The Supabase Auth user must be created separately via the Supabase dashboard
-- or using the Admin API. This migration only creates the customer_accounts record
-- and assigns tank access once the auth user exists.

-- =============================================
-- STEP 1: Create customer account (after auth user is created)
-- =============================================
-- Run this AFTER creating the auth user in Supabase dashboard

-- First, let's create a function to set up the test customer
-- This can be called after the auth user is created

CREATE OR REPLACE FUNCTION setup_test_customer_account(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_customer_account_id UUID;
  v_tank_count INTEGER;
BEGIN
  -- Check if customer account already exists
  SELECT id INTO v_customer_account_id
  FROM customer_accounts
  WHERE user_id = p_user_id;

  IF v_customer_account_id IS NOT NULL THEN
    RETURN 'Customer account already exists: ' || v_customer_account_id::TEXT;
  END IF;

  -- Create the customer account
  INSERT INTO customer_accounts (
    user_id,
    customer_name,
    contact_name,
    company_name,
    account_type,
    is_active,
    email_notifications
  ) VALUES (
    p_user_id,
    'Great Southern Fuels - Test Account',
    'Test Admin',
    'Great Southern Fuels',
    'customer',
    true,
    true
  )
  RETURNING id INTO v_customer_account_id;

  -- Assign ALL ta_agbot_locations to this test customer for full testing
  INSERT INTO customer_tank_access (
    customer_account_id,
    agbot_location_id,
    access_level,
    notes
  )
  SELECT
    v_customer_account_id,
    id,
    'request_delivery',  -- Full access including delivery requests
    'Test customer - assigned all tanks for testing'
  FROM ta_agbot_locations
  WHERE NOT is_disabled
  ON CONFLICT (customer_account_id, agbot_location_id) DO NOTHING;

  GET DIAGNOSTICS v_tank_count = ROW_COUNT;

  RETURN 'Created customer account ' || v_customer_account_id::TEXT || ' with ' || v_tank_count || ' tanks assigned';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION setup_test_customer_account(UUID) TO authenticated;

-- =============================================
-- STEP 2: Helper function to find user by email
-- =============================================

CREATE OR REPLACE FUNCTION get_user_id_by_email(p_email TEXT)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_id_by_email(TEXT) TO authenticated;

-- =============================================
-- STEP 3: Combined setup function (call with email)
-- =============================================

CREATE OR REPLACE FUNCTION setup_test_customer_by_email(p_email TEXT)
RETURNS TEXT AS $$
DECLARE
  v_user_id UUID;
  v_result TEXT;
BEGIN
  -- Get user ID from email
  v_user_id := get_user_id_by_email(p_email);

  IF v_user_id IS NULL THEN
    RETURN 'ERROR: No auth user found with email: ' || p_email || '. Create the user in Supabase Auth first.';
  END IF;

  -- Set up the customer account
  v_result := setup_test_customer_account(v_user_id);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION setup_test_customer_by_email(TEXT) TO authenticated;

-- =============================================
-- INSTRUCTIONS FOR MANUAL SETUP
-- =============================================

/*
To set up the test customer account:

1. Go to Supabase Dashboard > Authentication > Users
2. Click "Add User" > "Create New User"
3. Enter:
   - Email: admin@greatsouthernfuels.com.au
   - Password: (see TEST_CREDENTIALS.md)
   - Auto Confirm User: YES
4. After user is created, run this SQL in Supabase SQL Editor:

   SELECT setup_test_customer_by_email('admin@greatsouthernfuels.com.au');

5. This will:
   - Create a customer_accounts record
   - Assign ALL active tanks to this test customer
   - Enable delivery request access

6. Test login at: https://your-app-url.vercel.app/login
*/

COMMENT ON FUNCTION setup_test_customer_account IS 'Creates a customer portal account and assigns all tanks for testing';
COMMENT ON FUNCTION setup_test_customer_by_email IS 'Convenience function to set up test customer by email address';

SELECT 'Test customer setup functions created. Run setup_test_customer_by_email(''admin@greatsouthernfuels.com.au'') after creating the auth user.' as result;
