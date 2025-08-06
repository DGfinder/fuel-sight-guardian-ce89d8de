-- Migration: Enhance Agbot System with Comprehensive Gasbot Data
-- Adds support for all new fields from the comprehensive Gasbot API payload

-- Add new location fields
ALTER TABLE agbot_locations ADD COLUMN IF NOT EXISTS location_category TEXT;
ALTER TABLE agbot_locations ADD COLUMN IF NOT EXISTS location_calibrated_fill_level DECIMAL(5,2);
ALTER TABLE agbot_locations ADD COLUMN IF NOT EXISTS location_last_calibrated_telemetry_epoch BIGINT;
ALTER TABLE agbot_locations ADD COLUMN IF NOT EXISTS location_last_calibrated_telemetry_timestamp TIMESTAMPTZ;
ALTER TABLE agbot_locations ADD COLUMN IF NOT EXISTS location_disabled_status BOOLEAN DEFAULT false;
ALTER TABLE agbot_locations ADD COLUMN IF NOT EXISTS location_daily_consumption DECIMAL(10,2);
ALTER TABLE agbot_locations ADD COLUMN IF NOT EXISTS location_days_remaining INT;
ALTER TABLE agbot_locations ADD COLUMN IF NOT EXISTS location_installation_status_code INT;
ALTER TABLE agbot_locations ADD COLUMN IF NOT EXISTS location_guid_external TEXT; -- From API

-- Add new asset fields
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_raw_fill_level DECIMAL(5,2);
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_last_raw_telemetry_epoch BIGINT;
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_last_raw_telemetry_timestamp TIMESTAMPTZ;
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_last_calibrated_telemetry_epoch BIGINT;
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_last_calibrated_telemetry_timestamp TIMESTAMPTZ;
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_updated_epoch BIGINT;
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_updated_timestamp TIMESTAMPTZ;
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_daily_consumption DECIMAL(10,2);
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_days_remaining INT;
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_reported_litres DECIMAL(10,2);
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_depth DECIMAL(8,2);
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_pressure DECIMAL(8,2);
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_refill_capacity_litres DECIMAL(10,2);
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_pressure_bar DECIMAL(8,2);
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_profile_water_capacity DECIMAL(10,2);
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_profile_max_depth DECIMAL(8,2);
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_profile_max_pressure DECIMAL(8,2);
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_profile_max_pressure_bar DECIMAL(8,2);
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_profile_max_display_percentage_fill DECIMAL(5,2);
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS asset_profile_commodity TEXT;

-- Add new device fields
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS device_last_telemetry_timestamp TIMESTAMPTZ;
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS device_last_telemetry_epoch BIGINT;
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS device_sku TEXT;
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS device_battery_voltage DECIMAL(5,2);
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS device_temperature DECIMAL(5,2);
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS device_activation_timestamp TIMESTAMPTZ;
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS device_state TEXT;
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS device_network_id TEXT;

-- Add other fields
ALTER TABLE agbot_assets ADD COLUMN IF NOT EXISTS helmet_serial_number TEXT;
ALTER TABLE agbot_locations ADD COLUMN IF NOT EXISTS tenancy_name TEXT;

-- Update readings history table to capture more granular data
ALTER TABLE agbot_readings_history ADD COLUMN IF NOT EXISTS asset_raw_fill_level DECIMAL(5,2);
ALTER TABLE agbot_readings_history ADD COLUMN IF NOT EXISTS asset_reported_litres DECIMAL(10,2);
ALTER TABLE agbot_readings_history ADD COLUMN IF NOT EXISTS device_battery_voltage DECIMAL(5,2);
ALTER TABLE agbot_readings_history ADD COLUMN IF NOT EXISTS device_temperature DECIMAL(5,2);
ALTER TABLE agbot_readings_history ADD COLUMN IF NOT EXISTS device_state TEXT;
ALTER TABLE agbot_readings_history ADD COLUMN IF NOT EXISTS asset_depth DECIMAL(8,2);
ALTER TABLE agbot_readings_history ADD COLUMN IF NOT EXISTS asset_pressure DECIMAL(8,2);
ALTER TABLE agbot_readings_history ADD COLUMN IF NOT EXISTS asset_pressure_bar DECIMAL(8,2);
ALTER TABLE agbot_readings_history ADD COLUMN IF NOT EXISTS daily_consumption DECIMAL(10,2);
ALTER TABLE agbot_readings_history ADD COLUMN IF NOT EXISTS days_remaining INT;

-- Add indexes for new searchable fields
CREATE INDEX IF NOT EXISTS idx_agbot_locations_category ON agbot_locations(location_category);
CREATE INDEX IF NOT EXISTS idx_agbot_locations_guid_external ON agbot_locations(location_guid_external);
CREATE INDEX IF NOT EXISTS idx_agbot_assets_battery_voltage ON agbot_assets(device_battery_voltage);
CREATE INDEX IF NOT EXISTS idx_agbot_assets_device_state ON agbot_assets(device_state);
CREATE INDEX IF NOT EXISTS idx_agbot_assets_commodity ON agbot_assets(asset_profile_commodity);
CREATE INDEX IF NOT EXISTS idx_agbot_readings_reported_litres ON agbot_readings_history(asset_reported_litres);
CREATE INDEX IF NOT EXISTS idx_agbot_readings_device_state ON agbot_readings_history(device_state);

-- Add comments for documentation
COMMENT ON COLUMN agbot_locations.location_guid_external IS 'LocationGuid from Gasbot API';
COMMENT ON COLUMN agbot_assets.device_battery_voltage IS 'Device battery voltage for health monitoring';
COMMENT ON COLUMN agbot_assets.device_state IS 'Current device operational state';
COMMENT ON COLUMN agbot_assets.asset_reported_litres IS 'Volume in litres from tank sensor';
COMMENT ON COLUMN agbot_readings_history.asset_raw_fill_level IS 'Raw sensor reading before calibration';

SELECT 'Enhanced agbot system with comprehensive Gasbot data fields' as result;