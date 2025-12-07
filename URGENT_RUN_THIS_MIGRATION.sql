-- ============================================================================
-- URGENT: Data Migration Fix for Email System
-- Run this in Supabase SQL Editor IMMEDIATELY
--
-- Problem: Email system queries ta_agbot_locations but data is in agbot_locations
-- Solution: Copy data from agbot_locations → ta_agbot_locations
-- ============================================================================

BEGIN;

-- Step 1: Migrate locations
INSERT INTO ta_agbot_locations (
  id,
  external_guid,
  name,
  customer_name,
  customer_guid,
  tenancy_name,
  address,
  state,
  postcode,
  country,
  latitude,
  longitude,
  installation_status,
  installation_status_label,
  is_disabled,
  daily_consumption_liters,
  days_remaining,
  calibrated_fill_level,
  last_telemetry_at,
  last_telemetry_epoch,
  created_at,
  updated_at
)
SELECT
  id,
  location_guid,
  COALESCE(location_id, 'Unknown Location'),
  customer_name,
  customer_guid,
  tenancy_name,
  address1,
  state,
  postcode,
  COALESCE(country, 'Australia'),
  lat,
  lng,
  COALESCE(installation_status, 0),
  installation_status_label,
  COALESCE(disabled, false),
  location_daily_consumption,
  location_days_remaining,
  location_calibrated_fill_level,
  latest_telemetry,
  latest_telemetry_epoch,
  created_at,
  updated_at
FROM agbot_locations
ON CONFLICT (external_guid) DO UPDATE SET
  name = EXCLUDED.name,
  customer_name = EXCLUDED.customer_name,
  daily_consumption_liters = EXCLUDED.daily_consumption_liters,
  days_remaining = EXCLUDED.days_remaining,
  calibrated_fill_level = EXCLUDED.calibrated_fill_level,
  last_telemetry_at = EXCLUDED.last_telemetry_at,
  updated_at = NOW();

-- Verification query
SELECT
  'Migration Complete!' as status,
  (SELECT COUNT(*) FROM agbot_locations) as old_table_count,
  (SELECT COUNT(*) FROM ta_agbot_locations) as new_table_count,
  CASE
    WHEN (SELECT COUNT(*) FROM ta_agbot_locations) > 0
    THEN '✅ SUCCESS: Data migrated'
    ELSE '❌ FAILED: No data in new table'
  END as result;

COMMIT;

-- ============================================================================
-- After running this, verify Wonder Mine Site tank exists:
-- ============================================================================

-- Check if the Wonder Main Tank is now in ta_agbot_locations
SELECT
  id,
  name,
  customer_name,
  address,
  is_disabled
FROM ta_agbot_locations
WHERE name ILIKE '%wonder%' OR address ILIKE '%wonder%';

-- Expected result: Should see "Wonder Main Tank" with ID ed940866-8341-4a37-9dc9-ffbe077e881e
