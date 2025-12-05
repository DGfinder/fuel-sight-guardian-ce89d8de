-- Migration: Delete Test Subscription
-- Description: Remove the test Indosolutions subscription created for hayden@stevemacs.com.au
-- Author: Claude Code
-- Date: 2025-12-05
-- Phase: Email Subscription System - Phase 2

-- =============================================================================
-- DELETE TEST SUBSCRIPTION
-- =============================================================================
-- Delete test subscription (Hayden → Indosolutions tank)
-- Keep only the real subscription (Logistics → Indosolutions tank)

DELETE FROM customer_contact_tanks
WHERE id = '8a152e4c-88f4-4a41-8439-ac66797c095f';
-- This is the hayden@stevemacs.com.au → Indosolutions subscription created on 2025-12-05

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- Expected results after migration:
-- - Should have 3 subscriptions remaining (down from 4)
-- - Orders: 2 subscriptions (Wonder Gensets, Wonder Main Tank)
-- - Logistics: 1 subscription (Indosolutions)
-- - NO duplicate Indosolutions rows

DO $$
DECLARE
  total_count INTEGER;
  indosolutions_count INTEGER;
  subscriptions_with_cc INTEGER;
BEGIN
  -- Count total subscriptions
  SELECT COUNT(*) INTO total_count FROM customer_contact_tanks;

  -- Count Indosolutions subscriptions
  SELECT COUNT(*) INTO indosolutions_count
  FROM customer_contact_tanks cct
  JOIN customer_contacts cc ON cct.customer_contact_id = cc.id
  JOIN ta_agbot_locations tal ON cct.agbot_location_id = tal.id
  WHERE tal.name ILIKE '%indosolution%';

  -- Count subscriptions with CC emails
  SELECT COUNT(*) INTO subscriptions_with_cc
  FROM customer_contact_tanks
  WHERE cc_emails IS NOT NULL AND cc_emails != '';

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'TEST SUBSCRIPTION DELETED';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total subscriptions: %', total_count;
  RAISE NOTICE 'Indosolutions subscriptions: %', indosolutions_count;
  RAISE NOTICE 'Subscriptions with CC emails: %', subscriptions_with_cc;
  RAISE NOTICE '';
  RAISE NOTICE 'Expected:';
  RAISE NOTICE '  - Total: 3 subscriptions';
  RAISE NOTICE '  - Indosolutions: 1 subscription (logistics@)';
  RAISE NOTICE '  - With CC emails: 3 subscriptions';
  RAISE NOTICE '============================================';
END $$;

