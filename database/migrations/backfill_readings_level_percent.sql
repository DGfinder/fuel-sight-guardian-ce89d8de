-- ============================================================================
-- BACKFILL: Fix level_percent in ta_agbot_readings
-- Updates readings where level_percent = 0 but level_liters has a value
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Preview what will be updated
SELECT
  r.id,
  a.name as asset_name,
  r.level_percent as old_percent,
  r.level_liters,
  a.capacity_liters,
  ROUND((r.level_liters / a.capacity_liters * 100)::numeric, 2) as calculated_percent,
  r.reading_at
FROM ta_agbot_readings r
JOIN ta_agbot_assets a ON r.asset_id = a.id
WHERE r.level_percent = 0
  AND r.level_liters IS NOT NULL
  AND r.level_liters > 0
  AND a.capacity_liters IS NOT NULL
  AND a.capacity_liters > 0
ORDER BY r.reading_at DESC
LIMIT 20;

-- Step 2: Perform the update
UPDATE ta_agbot_readings r
SET level_percent = ROUND((r.level_liters / a.capacity_liters * 100)::numeric, 2)
FROM ta_agbot_assets a
WHERE r.asset_id = a.id
  AND r.level_percent = 0
  AND r.level_liters IS NOT NULL
  AND r.level_liters > 0
  AND a.capacity_liters IS NOT NULL
  AND a.capacity_liters > 0;

-- Step 3: Verify the update
SELECT
  'Backfill complete' as status,
  COUNT(*) FILTER (WHERE level_percent > 0) as readings_with_percent,
  COUNT(*) FILTER (WHERE level_percent = 0 AND level_liters IS NOT NULL) as remaining_zero_percent
FROM ta_agbot_readings;

-- Step 4: Show sample of updated readings
SELECT
  r.id,
  a.name as asset_name,
  r.level_percent,
  r.level_liters,
  a.capacity_liters,
  r.reading_at
FROM ta_agbot_readings r
JOIN ta_agbot_assets a ON r.asset_id = a.id
WHERE r.level_percent > 0
ORDER BY r.reading_at DESC
LIMIT 10;
