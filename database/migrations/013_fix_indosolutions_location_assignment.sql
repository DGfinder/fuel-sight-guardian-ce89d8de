-- Migration: Fix Indosolutions Customer Portal Location Assignment
-- Description: Reassign Indosolutions customer account to location with live asset data
-- Author: Claude Code
-- Date: 2025-12-05
-- Phase: Wire Customer Portal to Live Data

-- =============================================================================
-- STEP 1: Identify Indosolutions locations and their asset data status
-- =============================================================================

DO $$
DECLARE
  indosolutions_account_id UUID;
  current_location_id UUID;
  correct_location_id UUID;
  location_count INTEGER;
  curr_name TEXT;
  curr_fill DECIMAL;
  curr_asset_count INTEGER;
  curr_assets_with_data INTEGER;
  corr_name TEXT;
  corr_fill DECIMAL;
  corr_asset_count INTEGER;
  corr_assets_with_data INTEGER;
  corr_avg_fill DECIMAL;
BEGIN
  -- Find Indosolutions customer account
  SELECT id INTO indosolutions_account_id
  FROM customer_accounts
  WHERE customer_name ILIKE '%indosolution%'
    AND account_type = 'customer'
  LIMIT 1;

  IF indosolutions_account_id IS NULL THEN
    RAISE NOTICE 'No Indosolutions customer account found';
    RETURN;
  END IF;

  RAISE NOTICE 'Found Indosolutions account: %', indosolutions_account_id;

  -- Find current assigned location
  SELECT agbot_location_id INTO current_location_id
  FROM customer_tank_access
  WHERE customer_account_id = indosolutions_account_id
  LIMIT 1;

  -- Find all Indosolutions locations with their asset data status
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'INDOSOLUTIONS LOCATIONS ANALYSIS';
  RAISE NOTICE '============================================';

  -- Show all locations for Indosolutions
  FOR location_count IN
    SELECT COUNT(*) FROM ta_agbot_locations
    WHERE customer_name ILIKE '%indosolution%'
  LOOP
    RAISE NOTICE 'Total Indosolutions locations: %', location_count;
  END LOOP;

  -- Find location with live asset data (has assets with current_level_percent)
  SELECT l.id INTO correct_location_id
  FROM ta_agbot_locations l
  WHERE l.customer_name ILIKE '%indosolution%'
    AND l.is_disabled = false
    AND EXISTS (
      SELECT 1
      FROM ta_agbot_assets a
      WHERE a.location_id = l.id
        AND a.is_disabled = false
        AND a.current_level_percent IS NOT NULL
        AND a.current_level_percent > 0
    )
  ORDER BY l.last_telemetry_at DESC NULLS LAST
  LIMIT 1;

  -- If no location with asset data, find any location with assets
  IF correct_location_id IS NULL THEN
    SELECT l.id INTO correct_location_id
    FROM ta_agbot_locations l
    WHERE l.customer_name ILIKE '%indosolution%'
      AND l.is_disabled = false
      AND EXISTS (
        SELECT 1
        FROM ta_agbot_assets a
        WHERE a.location_id = l.id
          AND a.is_disabled = false
      )
    ORDER BY l.last_telemetry_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- Show current vs correct location
  RAISE NOTICE '';
  RAISE NOTICE 'Current assigned location: %', current_location_id;
  RAISE NOTICE 'Correct location (with live data): %', correct_location_id;

  -- Show location details
  IF current_location_id IS NOT NULL THEN
    SELECT l.name, l.calibrated_fill_level,
      (SELECT COUNT(*) FROM ta_agbot_assets a WHERE a.location_id = l.id AND a.is_disabled = false),
      (SELECT COUNT(*) FROM ta_agbot_assets a WHERE a.location_id = l.id AND a.is_disabled = false AND a.current_level_percent IS NOT NULL)
    INTO curr_name, curr_fill, curr_asset_count, curr_assets_with_data
    FROM ta_agbot_locations l
    WHERE l.id = current_location_id;

    RAISE NOTICE '';
    RAISE NOTICE 'Current Location: %', curr_name;
    RAISE NOTICE '  Fill Level: %', curr_fill;
    RAISE NOTICE '  Assets: % (with data: %)', curr_asset_count, curr_assets_with_data;
  END IF;

  IF correct_location_id IS NOT NULL THEN
    SELECT l.name, l.calibrated_fill_level,
      (SELECT COUNT(*) FROM ta_agbot_assets a WHERE a.location_id = l.id AND a.is_disabled = false),
      (SELECT COUNT(*) FROM ta_agbot_assets a WHERE a.location_id = l.id AND a.is_disabled = false AND a.current_level_percent IS NOT NULL),
      (SELECT ROUND(AVG(a.current_level_percent)::numeric, 2) FROM ta_agbot_assets a WHERE a.location_id = l.id AND a.is_disabled = false AND a.current_level_percent IS NOT NULL)
    INTO corr_name, corr_fill, corr_asset_count, corr_assets_with_data, corr_avg_fill
    FROM ta_agbot_locations l
    WHERE l.id = correct_location_id;

    RAISE NOTICE '';
    RAISE NOTICE 'Correct Location: %', corr_name;
    RAISE NOTICE '  Fill Level: %', corr_fill;
    RAISE NOTICE '  Assets: % (with data: %)', corr_asset_count, corr_assets_with_data;
    RAISE NOTICE '  Avg Asset Fill: %', corr_avg_fill;
  END IF;

  -- Update assignment if needed
  IF correct_location_id IS NOT NULL AND correct_location_id != current_location_id THEN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'UPDATING LOCATION ASSIGNMENT';
    RAISE NOTICE '============================================';

    -- Delete old assignment
    DELETE FROM customer_tank_access
    WHERE customer_account_id = indosolutions_account_id;

    -- Create new assignment
    INSERT INTO customer_tank_access (
      customer_account_id,
      agbot_location_id,
      access_level,
      assigned_at
    ) VALUES (
      indosolutions_account_id,
      correct_location_id,
      'request_delivery',
      NOW()
    );

    RAISE NOTICE '✅ Updated assignment from % to %', current_location_id, correct_location_id;
  ELSIF correct_location_id IS NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  WARNING: No location found with live asset data';
    RAISE NOTICE '   Customer account will remain assigned to current location';
  ELSIF correct_location_id = current_location_id THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Assignment is already correct';
  END IF;

  RAISE NOTICE '============================================';
END $$;

-- =============================================================================
-- VERIFICATION: Show final assignment
-- =============================================================================

SELECT
  ca.customer_name,
  ca.id as account_id,
  cta.agbot_location_id,
  l.name as location_name,
  l.calibrated_fill_level as location_fill_level,
  (SELECT COUNT(*) FROM ta_agbot_assets a WHERE a.location_id = l.id AND a.is_disabled = false) as asset_count,
  (SELECT COUNT(*) FROM ta_agbot_assets a WHERE a.location_id = l.id AND a.is_disabled = false AND a.current_level_percent IS NOT NULL) as assets_with_data,
  (SELECT ROUND(AVG(a.current_level_percent)::numeric, 2) FROM ta_agbot_assets a WHERE a.location_id = l.id AND a.is_disabled = false AND a.current_level_percent IS NOT NULL) as avg_asset_fill_level
FROM customer_accounts ca
JOIN customer_tank_access cta ON cta.customer_account_id = ca.id
JOIN ta_agbot_locations l ON l.id = cta.agbot_location_id
WHERE ca.customer_name ILIKE '%indosolution%'
  AND ca.account_type = 'customer';

