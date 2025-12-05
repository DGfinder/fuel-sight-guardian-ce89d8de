-- Data Reconciliation Analysis: AgBot Tables
-- Date: 2025-12-05
-- Purpose: Understand data differences between legacy agbot_* and new ta_* tables
-- Use: Run these queries manually to analyze before proceeding with Phase 2 migration

-- ==============================================================================
-- PART 1: ROW COUNT COMPARISON
-- ==============================================================================
SELECT
  'agbot_locations' as table_name,
  COUNT(*) as row_count
FROM agbot_locations
UNION ALL
SELECT
  'ta_agbot_locations',
  COUNT(*)
FROM ta_agbot_locations
UNION ALL
SELECT
  'agbot_assets',
  COUNT(*)
FROM agbot_assets
UNION ALL
SELECT
  'ta_agbot_assets',
  COUNT(*)
FROM ta_agbot_assets
UNION ALL
SELECT
  'agbot_readings_history',
  COUNT(*)
FROM agbot_readings_history
UNION ALL
SELECT
  'ta_agbot_readings',
  COUNT(*)
FROM ta_agbot_readings
UNION ALL
SELECT
  'agbot_sync_logs',
  COUNT(*)
FROM agbot_sync_logs
UNION ALL
SELECT
  'ta_agbot_sync_log',
  COUNT(*)
FROM ta_agbot_sync_log
ORDER BY table_name;

-- ==============================================================================
-- PART 2: LOCATION ANALYSIS - Find Missing/Extra Locations
-- ==============================================================================

-- Locations in OLD table but NOT in NEW table (should be 0 if ta_* is superset)
SELECT
  'Locations in agbot_locations but NOT in ta_agbot_locations' as analysis,
  COUNT(*) as count,
  STRING_AGG(location_guid, ', ') as location_guids
FROM agbot_locations al
WHERE NOT EXISTS (
  SELECT 1 FROM ta_agbot_locations tal
  WHERE tal.location_guid = al.location_guid
);

-- Locations in NEW table but NOT in OLD table (expected: ~19 rows)
SELECT
  'Locations in ta_agbot_locations but NOT in agbot_locations' as analysis,
  COUNT(*) as count,
  STRING_AGG(location_guid::text, ', ' ORDER BY customer_name) as sample_guids
FROM ta_agbot_locations tal
WHERE NOT EXISTS (
  SELECT 1 FROM agbot_locations al
  WHERE al.location_guid = tal.location_guid
);

-- Show details of extra locations in new table
SELECT
  tal.location_guid,
  tal.customer_name,
  tal.street_address,
  tal.suburb,
  tal.state_province,
  tal.latest_telemetry,
  tal.created_at
FROM ta_agbot_locations tal
WHERE NOT EXISTS (
  SELECT 1 FROM agbot_locations al
  WHERE al.location_guid = tal.location_guid
)
ORDER BY tal.customer_name, tal.street_address;

-- ==============================================================================
-- PART 3: ASSET ANALYSIS - Find Missing/Extra Assets
-- ==============================================================================

-- Assets in OLD table but NOT in NEW table (expected: 1 asset)
SELECT
  'Assets in agbot_assets but NOT in ta_agbot_assets' as analysis,
  COUNT(*) as count
FROM agbot_assets aa
WHERE NOT EXISTS (
  SELECT 1 FROM ta_agbot_assets taa
  WHERE taa.asset_guid = aa.asset_guid
);

-- Show details of missing asset
SELECT
  aa.asset_guid,
  aa.asset_serial_number,
  aa.device_serial_number,
  aa.latest_telemetry_event_timestamp,
  al.customer_name,
  al.location_id
FROM agbot_assets aa
LEFT JOIN agbot_locations al ON al.id = aa.location_id
WHERE NOT EXISTS (
  SELECT 1 FROM ta_agbot_assets taa
  WHERE taa.asset_guid = aa.asset_guid
);

-- Assets in NEW table but NOT in OLD table
SELECT
  'Assets in ta_agbot_assets but NOT in agbot_assets' as analysis,
  COUNT(*) as count
FROM ta_agbot_assets taa
WHERE NOT EXISTS (
  SELECT 1 FROM agbot_assets aa
  WHERE aa.asset_guid = taa.asset_guid
);

-- ==============================================================================
-- PART 4: CREATE MAPPING TABLES FOR MIGRATION
-- ==============================================================================

-- Create temporary mapping: agbot_locations.id → ta_agbot_locations.id
CREATE TEMP TABLE temp_location_id_mapping AS
SELECT
  al.id as old_location_id,
  tal.id as new_location_id,
  al.location_guid,
  al.customer_name as old_customer_name,
  tal.customer_name as new_customer_name
FROM agbot_locations al
INNER JOIN ta_agbot_locations tal ON tal.location_guid = al.location_guid;

-- Show mapping statistics
SELECT
  'Location ID Mapping Created' as status,
  COUNT(*) as mapped_count
FROM temp_location_id_mapping;

-- Show sample mappings
SELECT * FROM temp_location_id_mapping
LIMIT 10;

-- Create temporary mapping: agbot_assets.id → ta_agbot_assets.id
CREATE TEMP TABLE temp_asset_id_mapping AS
SELECT
  aa.id as old_asset_id,
  taa.id as new_asset_id,
  aa.asset_guid,
  aa.asset_serial_number
FROM agbot_assets aa
INNER JOIN ta_agbot_assets taa ON taa.asset_guid = aa.asset_guid;

-- Show mapping statistics
SELECT
  'Asset ID Mapping Created' as status,
  COUNT(*) as mapped_count
FROM temp_asset_id_mapping;

-- ==============================================================================
-- PART 5: VERIFY FOREIGN KEY IMPACT
-- ==============================================================================

-- Check customer_tank_access references
SELECT
  'customer_tank_access FK references' as analysis,
  COUNT(*) as total_references,
  COUNT(CASE WHEN m.new_location_id IS NULL THEN 1 END) as unmappable_references,
  COUNT(CASE WHEN m.new_location_id IS NOT NULL THEN 1 END) as mappable_references
FROM customer_tank_access cta
LEFT JOIN temp_location_id_mapping m ON m.old_location_id = cta.agbot_location_id;

-- Show unmappable customer_tank_access records (should be 0)
SELECT
  cta.*,
  al.location_guid,
  al.customer_name
FROM customer_tank_access cta
JOIN agbot_locations al ON al.id = cta.agbot_location_id
LEFT JOIN temp_location_id_mapping m ON m.old_location_id = cta.agbot_location_id
WHERE m.new_location_id IS NULL;

-- Check delivery_requests references
SELECT
  'delivery_requests FK references' as analysis,
  COUNT(*) as total_references,
  COUNT(CASE WHEN m.new_location_id IS NULL THEN 1 END) as unmappable_references,
  COUNT(CASE WHEN m.new_location_id IS NOT NULL THEN 1 END) as mappable_references
FROM delivery_requests dr
LEFT JOIN temp_location_id_mapping m ON m.old_location_id = dr.agbot_location_id;

-- ==============================================================================
-- PART 6: READINGS ANALYSIS
-- ==============================================================================

-- Compare readings by date range
SELECT
  'agbot_readings_history' as table_name,
  MIN(reading_timestamp) as earliest_reading,
  MAX(reading_timestamp) as latest_reading,
  COUNT(*) as total_readings,
  COUNT(DISTINCT asset_id) as unique_assets
FROM agbot_readings_history
UNION ALL
SELECT
  'ta_agbot_readings',
  MIN(reading_timestamp),
  MAX(reading_timestamp),
  COUNT(*),
  COUNT(DISTINCT asset_id)
FROM ta_agbot_readings;

-- Find readings in old table not in new table (by timestamp + asset)
SELECT
  'Readings in old table but not in new' as analysis,
  COUNT(*) as count
FROM agbot_readings_history arh
JOIN temp_asset_id_mapping m ON m.old_asset_id = arh.asset_id
WHERE NOT EXISTS (
  SELECT 1 FROM ta_agbot_readings tar
  WHERE tar.asset_id = m.new_asset_id
    AND tar.reading_timestamp = arh.reading_timestamp
);

-- ==============================================================================
-- PART 7: SYNC LOGS ANALYSIS
-- ==============================================================================

-- Compare sync logs by date range and type
SELECT
  'agbot_sync_logs' as table_name,
  sync_type,
  COUNT(*) as count,
  MIN(started_at) as earliest,
  MAX(started_at) as latest
FROM agbot_sync_logs
GROUP BY sync_type
UNION ALL
SELECT
  'ta_agbot_sync_log',
  sync_type,
  COUNT(*),
  MIN(started_at),
  MAX(started_at)
FROM ta_agbot_sync_log
GROUP BY sync_type
ORDER BY table_name, sync_type;

-- ==============================================================================
-- SUMMARY REPORT
-- ==============================================================================

SELECT
  '========== DATA RECONCILIATION SUMMARY ==========' as section
UNION ALL
SELECT 'Locations: agbot_locations has ' || (SELECT COUNT(*) FROM agbot_locations) || ' rows'
UNION ALL
SELECT 'Locations: ta_agbot_locations has ' || (SELECT COUNT(*) FROM ta_agbot_locations) || ' rows'
UNION ALL
SELECT 'Locations: ' || (SELECT COUNT(*) FROM temp_location_id_mapping) || ' can be mapped'
UNION ALL
SELECT ''
UNION ALL
SELECT 'Assets: agbot_assets has ' || (SELECT COUNT(*) FROM agbot_assets) || ' rows'
UNION ALL
SELECT 'Assets: ta_agbot_assets has ' || (SELECT COUNT(*) FROM ta_agbot_assets) || ' rows'
UNION ALL
SELECT 'Assets: ' || (SELECT COUNT(*) FROM temp_asset_id_mapping) || ' can be mapped'
UNION ALL
SELECT ''
UNION ALL
SELECT 'Readings: agbot_readings_history has ' || (SELECT COUNT(*) FROM agbot_readings_history) || ' rows'
UNION ALL
SELECT 'Readings: ta_agbot_readings has ' || (SELECT COUNT(*) FROM ta_agbot_readings) || ' rows'
UNION ALL
SELECT ''
UNION ALL
SELECT 'Sync Logs: agbot_sync_logs has ' || (SELECT COUNT(*) FROM agbot_sync_logs) || ' rows'
UNION ALL
SELECT 'Sync Logs: ta_agbot_sync_log has ' || (SELECT COUNT(*) FROM ta_agbot_sync_log) || ' rows';

-- Cleanup (optional - comment out if you want to keep temp tables for further analysis)
-- DROP TABLE IF EXISTS temp_location_id_mapping;
-- DROP TABLE IF EXISTS temp_asset_id_mapping;
