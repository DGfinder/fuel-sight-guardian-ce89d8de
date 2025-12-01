-- ============================================================================
-- FIX: Correct future timestamps in Agbot readings
-- These were caused by a timezone bug where Perth time was interpreted as UTC
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Preview: See which readings have future timestamps
SELECT
  r.id,
  r.reading_at,
  r.reading_at - INTERVAL '8 hours' as corrected_reading_at,
  a.name as asset_name,
  l.name as location_name
FROM ta_agbot_readings r
JOIN ta_agbot_assets a ON r.asset_id = a.id
JOIN ta_agbot_locations l ON a.location_id = l.id
WHERE r.reading_at > NOW()
ORDER BY r.reading_at DESC
LIMIT 50;

-- ============================================================================
-- STEP 1: Fix future readings in ta_agbot_readings
-- Subtract 8 hours from any reading_at that is in the future
-- ============================================================================

UPDATE ta_agbot_readings
SET reading_at = reading_at - INTERVAL '8 hours'
WHERE reading_at > NOW();

-- Verify the fix
SELECT COUNT(*) as remaining_future_readings
FROM ta_agbot_readings
WHERE reading_at > NOW();

-- ============================================================================
-- STEP 2: Fix future timestamps in ta_agbot_locations
-- ============================================================================

UPDATE ta_agbot_locations
SET last_telemetry_at = last_telemetry_at - INTERVAL '8 hours'
WHERE last_telemetry_at > NOW();

-- ============================================================================
-- STEP 3: Fix future timestamps in ta_agbot_assets
-- ============================================================================

UPDATE ta_agbot_assets
SET last_telemetry_at = last_telemetry_at - INTERVAL '8 hours'
WHERE last_telemetry_at > NOW();

-- ============================================================================
-- Verify all fixes
-- ============================================================================

SELECT 'ta_agbot_readings' as table_name, COUNT(*) as future_count
FROM ta_agbot_readings WHERE reading_at > NOW()
UNION ALL
SELECT 'ta_agbot_locations', COUNT(*)
FROM ta_agbot_locations WHERE last_telemetry_at > NOW()
UNION ALL
SELECT 'ta_agbot_assets', COUNT(*)
FROM ta_agbot_assets WHERE last_telemetry_at > NOW();
