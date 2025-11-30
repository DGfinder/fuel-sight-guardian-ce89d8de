-- ============================================================================
-- Data Migration: agbot_* → ta_agbot_*
-- Migrates existing AgBot data to the new ta_agbot_* schema
-- Run this AFTER create_ta_unified_schema.sql
-- ============================================================================

-- ============================================================================
-- STEP 1: Migrate agbot_locations → ta_agbot_locations
-- ============================================================================

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

SELECT 'Migrated ' || COUNT(*) || ' locations' as result FROM ta_agbot_locations;

-- ============================================================================
-- STEP 2: Migrate agbot_assets → ta_agbot_assets
-- ============================================================================

INSERT INTO ta_agbot_assets (
  id,
  location_id,
  external_guid,
  name,
  serial_number,
  profile_name,
  profile_guid,
  commodity,
  capacity_liters,
  max_depth_m,
  max_pressure_bar,
  max_display_percent,
  current_level_liters,
  current_level_percent,
  current_raw_percent,
  current_depth_m,
  current_pressure_bar,
  ullage_liters,
  daily_consumption_liters,
  days_remaining,
  device_guid,
  device_serial,
  device_model,
  device_model_name,
  device_sku,
  device_network_id,
  helmet_serial,
  is_online,
  is_disabled,
  device_state,
  battery_voltage,
  temperature_c,
  device_activated_at,
  device_activation_epoch,
  last_telemetry_at,
  last_telemetry_epoch,
  last_raw_telemetry_at,
  last_calibrated_telemetry_at,
  asset_updated_at,
  asset_updated_epoch,
  created_at,
  updated_at,
  raw_data
)
SELECT
  a.id,
  -- Find the new location ID from ta_agbot_locations
  (SELECT tal.id FROM ta_agbot_locations tal
   JOIN agbot_locations al ON tal.external_guid = al.location_guid
   WHERE al.id = a.location_id),
  a.asset_guid,
  COALESCE(a.asset_serial_number, a.asset_profile_name, 'Unknown Asset'),
  a.asset_serial_number,
  a.asset_profile_name,
  a.asset_profile_guid,
  a.asset_profile_commodity,
  a.asset_profile_water_capacity,
  a.asset_profile_max_depth,
  a.asset_profile_max_pressure_bar,
  a.asset_profile_max_display_percentage_fill,
  a.asset_reported_litres,
  a.latest_calibrated_fill_percentage,
  a.asset_raw_fill_level,
  a.asset_depth,
  a.asset_pressure_bar,
  a.asset_refill_capacity_litres,
  a.asset_daily_consumption,
  a.asset_days_remaining,
  a.device_guid,
  a.device_serial_number,
  a.device_model,
  a.device_model_label,
  a.device_sku,
  a.device_network_id,
  a.helmet_serial_number,
  COALESCE(a.device_online, false),
  COALESCE(a.asset_disabled, false),
  a.device_state,
  a.device_battery_voltage,
  a.device_temperature,
  a.device_activation_date,
  a.device_activation_epoch,
  a.latest_telemetry_event_timestamp,
  a.latest_telemetry_event_epoch,
  a.asset_last_raw_telemetry_timestamp,
  a.asset_last_calibrated_telemetry_timestamp,
  a.asset_updated_timestamp,
  a.asset_updated_epoch,
  a.created_at,
  a.updated_at,
  a.raw_data
FROM agbot_assets a
WHERE a.location_id IS NOT NULL
ON CONFLICT (external_guid) DO UPDATE SET
  name = EXCLUDED.name,
  current_level_liters = EXCLUDED.current_level_liters,
  current_level_percent = EXCLUDED.current_level_percent,
  current_raw_percent = EXCLUDED.current_raw_percent,
  ullage_liters = EXCLUDED.ullage_liters,
  daily_consumption_liters = EXCLUDED.daily_consumption_liters,
  days_remaining = EXCLUDED.days_remaining,
  is_online = EXCLUDED.is_online,
  device_state = EXCLUDED.device_state,
  battery_voltage = EXCLUDED.battery_voltage,
  temperature_c = EXCLUDED.temperature_c,
  last_telemetry_at = EXCLUDED.last_telemetry_at,
  raw_data = EXCLUDED.raw_data,
  updated_at = NOW();

SELECT 'Migrated ' || COUNT(*) || ' assets' as result FROM ta_agbot_assets;

-- ============================================================================
-- STEP 3: Migrate agbot_readings_history → ta_agbot_readings
-- ============================================================================

INSERT INTO ta_agbot_readings (
  asset_id,
  level_liters,
  level_percent,
  raw_percent,
  depth_m,
  pressure_bar,
  is_online,
  battery_voltage,
  temperature_c,
  device_state,
  daily_consumption,
  days_remaining,
  reading_at,
  telemetry_epoch,
  created_at
)
SELECT
  -- Find the new asset ID from ta_agbot_assets
  (SELECT taa.id FROM ta_agbot_assets taa
   JOIN agbot_assets aa ON taa.external_guid = aa.asset_guid
   WHERE aa.id = r.asset_id),
  r.asset_reported_litres,
  r.calibrated_fill_percentage,
  r.raw_fill_percentage,
  r.asset_depth,
  r.asset_pressure_bar,
  r.device_online,
  r.device_battery_voltage,
  r.device_temperature,
  r.device_state,
  r.daily_consumption,
  r.days_remaining,
  r.reading_timestamp,
  r.telemetry_epoch,
  r.created_at
FROM agbot_readings_history r
WHERE r.reading_timestamp IS NOT NULL
  AND r.asset_id IS NOT NULL
ON CONFLICT DO NOTHING;

SELECT 'Migrated ' || COUNT(*) || ' readings' as result FROM ta_agbot_readings;

-- ============================================================================
-- STEP 4: Create ta_tank_sources mappings
-- Auto-map ta_tanks to ta_agbot_assets by matching names/serials
-- ============================================================================

-- First, try exact name matches
INSERT INTO ta_tank_sources (ta_tank_id, agbot_asset_id, primary_source)
SELECT DISTINCT ON (t.id)
  t.id,
  a.id,
  'agbot'
FROM ta_tanks t
JOIN ta_agbot_assets a ON (
  -- Exact name match
  LOWER(t.name) = LOWER(a.name)
  OR LOWER(t.name) = LOWER(a.serial_number)
  OR LOWER(t.name) = LOWER(a.profile_name)
)
WHERE t.archived_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM ta_tank_sources WHERE ta_tank_id = t.id)
ON CONFLICT (ta_tank_id) DO NOTHING;

-- Second pass: partial name matches
INSERT INTO ta_tank_sources (ta_tank_id, agbot_asset_id, primary_source)
SELECT DISTINCT ON (t.id)
  t.id,
  a.id,
  'agbot'
FROM ta_tanks t
JOIN ta_agbot_assets a ON (
  LOWER(t.name) LIKE '%' || LOWER(a.name) || '%'
  OR LOWER(a.name) LIKE '%' || LOWER(t.name) || '%'
  OR LOWER(t.name) LIKE '%' || LOWER(a.serial_number) || '%'
)
WHERE t.archived_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM ta_tank_sources WHERE ta_tank_id = t.id)
ON CONFLICT (ta_tank_id) DO NOTHING;

SELECT 'Created ' || COUNT(*) || ' tank source mappings' as result FROM ta_tank_sources;

-- ============================================================================
-- STEP 5: Update ta_tanks.current_level from AgBot sources
-- ============================================================================

UPDATE ta_tanks t
SET
  current_level_liters = a.current_level_liters,
  current_level_datetime = a.last_telemetry_at,
  current_level_source = 'agbot',
  updated_at = NOW()
FROM ta_tank_sources ts
JOIN ta_agbot_assets a ON ts.agbot_asset_id = a.id
WHERE ts.ta_tank_id = t.id
  AND ts.primary_source = 'agbot'
  AND a.current_level_liters IS NOT NULL
  AND (
    t.current_level_datetime IS NULL
    OR a.last_telemetry_at > t.current_level_datetime
  );

SELECT 'Updated ' || COUNT(*) || ' tanks with AgBot levels' as result
FROM ta_tanks WHERE current_level_source = 'agbot';

-- ============================================================================
-- STEP 6: Update location aggregated metrics
-- ============================================================================

UPDATE ta_agbot_locations l
SET
  total_assets = sub.total_assets,
  assets_online = sub.assets_online,
  avg_fill_percent = sub.avg_fill_percent,
  updated_at = NOW()
FROM (
  SELECT
    location_id,
    COUNT(*) as total_assets,
    COUNT(*) FILTER (WHERE is_online = true) as assets_online,
    ROUND(AVG(current_level_percent)::numeric, 1) as avg_fill_percent
  FROM ta_agbot_assets
  WHERE is_disabled = false
  GROUP BY location_id
) sub
WHERE l.id = sub.location_id;

SELECT 'Updated location aggregates' as result;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT
  'Migration Complete' as status,
  (SELECT COUNT(*) FROM ta_agbot_locations) as locations,
  (SELECT COUNT(*) FROM ta_agbot_assets) as assets,
  (SELECT COUNT(*) FROM ta_agbot_readings) as readings,
  (SELECT COUNT(*) FROM ta_tank_sources) as mappings,
  (SELECT COUNT(*) FROM ta_tanks WHERE current_level_source = 'agbot') as tanks_with_agbot_level;
