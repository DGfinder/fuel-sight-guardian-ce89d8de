-- Device-Based Deduplication - Use Device Serial as Primary Unique Key
-- This ensures exactly one record per physical tank device
-- Run this in Supabase Dashboard SQL Editor

-- ============================================================================
-- STEP 1: Analyze current duplicates by device serial number
-- ============================================================================

-- Show duplicates by device serial (the real issue)
SELECT 
    aa.device_serial_number,
    COUNT(DISTINCT al.id) as location_records,
    COUNT(DISTINCT aa.id) as asset_records,
    STRING_AGG(DISTINCT al.location_id, ' | ') as location_variations,
    STRING_AGG(DISTINCT al.id::text, ', ') as location_ids
FROM agbot_assets aa
JOIN agbot_locations al ON aa.location_id = al.id
GROUP BY aa.device_serial_number
HAVING COUNT(DISTINCT al.id) > 1 OR COUNT(DISTINCT aa.id) > 1
ORDER BY location_records DESC;

-- Show current totals
SELECT 
    'Before device deduplication' as status,
    COUNT(DISTINCT aa.device_serial_number) as unique_devices,
    COUNT(DISTINCT al.location_id) as unique_locations,
    COUNT(al.id) as total_location_records,
    COUNT(aa.id) as total_asset_records
FROM agbot_locations al
JOIN agbot_assets aa ON al.id = aa.location_id;

-- ============================================================================
-- STEP 2: Create temporary table with device-based canonical data
-- ============================================================================

-- Create temp table with one record per device (keeping best data)
CREATE TEMP TABLE canonical_devices AS
WITH device_data AS (
    SELECT 
        aa.device_serial_number,
        aa.asset_serial_number,
        al.location_id,
        al.customer_name,
        al.latest_calibrated_fill_percentage,
        al.latest_telemetry,
        al.location_status,
        al.disabled,
        aa.device_online,
        aa.device_sku_name,
        aa.subscription_id,
        aa.latest_telemetry_event_timestamp,
        
        -- Extract the best location info (prefer non-empty addresses, most recent data)
        COALESCE(NULLIF(al.address1, ''), 'No address') as address1,
        COALESCE(NULLIF(al.address2, ''), '') as address2,
        COALESCE(NULLIF(al.state, ''), '') as state,
        
        -- Use most recent telemetry timestamp to pick best record
        ROW_NUMBER() OVER (
            PARTITION BY aa.device_serial_number 
            ORDER BY 
                COALESCE(aa.latest_telemetry_event_timestamp, al.latest_telemetry, al.updated_at) DESC,
                CASE WHEN al.latest_calibrated_fill_percentage != 50 THEN 1 ELSE 2 END, -- Prefer non-default fill levels
                LENGTH(al.address1) DESC -- Prefer records with addresses
        ) as rn
    FROM agbot_assets aa
    JOIN agbot_locations al ON aa.location_id = al.id
    WHERE aa.device_serial_number IS NOT NULL 
      AND aa.device_serial_number != ''
)
SELECT * FROM device_data WHERE rn = 1;

-- Show what canonical data looks like
SELECT 
    'Canonical device data' as status,
    device_serial_number,
    location_id,
    latest_calibrated_fill_percentage as fill_level,
    address1,
    device_online
FROM canonical_devices
ORDER BY device_serial_number;

-- ============================================================================
-- STEP 3: Delete all current location and asset records
-- ============================================================================

-- First, backup readings by updating them to reference device serial directly
UPDATE agbot_readings_history 
SET asset_id = aa.device_serial_number
FROM agbot_assets aa
WHERE agbot_readings_history.asset_id = aa.id;

-- Now safe to delete assets and locations (readings preserved with device serial)
DELETE FROM agbot_assets;
DELETE FROM agbot_locations;

-- ============================================================================
-- STEP 4: Create new device-centric records
-- ============================================================================

-- Insert one location record per unique device
INSERT INTO agbot_locations (
    location_guid,
    customer_name,
    customer_guid,
    location_id,
    address1,
    address2,
    state,
    postcode,
    country,
    latest_calibrated_fill_percentage,
    installation_status,
    installation_status_label,
    location_status,
    location_status_label,
    latest_telemetry_epoch,
    latest_telemetry,
    lat,
    lng,
    disabled,
    raw_data
)
SELECT 
    'device-' || device_serial_number as location_guid, -- Use device serial as unique identifier
    customer_name,
    'customer-' || LOWER(REPLACE(customer_name, ' ', '-')) as customer_guid,
    location_id, -- Keep location name for context
    address1,
    address2,
    state,
    '',
    'Australia',
    latest_calibrated_fill_percentage,
    CASE WHEN device_online THEN 1 ELSE 0 END,
    CASE WHEN device_online THEN 'Active' ELSE 'Offline' END,
    CASE WHEN device_online THEN 1 ELSE 0 END,
    CASE WHEN device_online THEN 'Online' ELSE 'Offline' END,
    EXTRACT(epoch FROM COALESCE(latest_telemetry_event_timestamp::timestamp, NOW())) * 1000,
    COALESCE(latest_telemetry_event_timestamp, NOW()::text),
    null,
    null,
    NOT device_online,
    jsonb_build_object('device_serial_number', device_serial_number, 'deduplication_method', 'device_based')
FROM canonical_devices;

-- Insert one asset record per unique device
INSERT INTO agbot_assets (
    location_id,
    asset_guid,
    asset_serial_number,
    asset_disabled,
    asset_profile_guid,
    asset_profile_name,
    device_guid,
    device_serial_number,
    device_id,
    device_sku_guid,
    device_sku_model,
    device_sku_name,
    device_model_label,
    device_model,
    device_online,
    device_activation_date,
    device_activation_epoch,
    latest_calibrated_fill_percentage,
    latest_raw_fill_percentage,
    latest_telemetry_event_timestamp,
    latest_telemetry_event_epoch,
    latest_reported_lat,
    latest_reported_lng,
    subscription_id,
    raw_data
)
SELECT 
    al.id, -- Link to the location record we just created
    'device-' || cd.device_serial_number as asset_guid, -- Use device serial as unique identifier
    cd.asset_serial_number,
    NOT cd.device_online,
    'profile-device-' || cd.device_serial_number,
    cd.location_id, -- Asset profile name = location name for context
    'device-guid-' || cd.device_serial_number,
    cd.device_serial_number, -- The real unique identifier
    cd.device_serial_number, -- Use serial as device ID too
    'sku-agbot',
    43111,
    cd.device_sku_name,
    cd.device_sku_name,
    43111,
    cd.device_online,
    null,
    null,
    cd.latest_calibrated_fill_percentage,
    cd.latest_calibrated_fill_percentage,
    cd.latest_telemetry_event_timestamp,
    EXTRACT(epoch FROM COALESCE(cd.latest_telemetry_event_timestamp::timestamp, NOW())) * 1000,
    null,
    null,
    cd.subscription_id,
    jsonb_build_object('device_serial_number', cd.device_serial_number, 'location_context', cd.location_id)
FROM canonical_devices cd
JOIN agbot_locations al ON al.location_guid = 'device-' || cd.device_serial_number;

-- ============================================================================
-- STEP 5: Restore readings history with proper asset IDs
-- ============================================================================

-- Update readings to point to new asset IDs
UPDATE agbot_readings_history 
SET asset_id = aa.id
FROM agbot_assets aa
WHERE agbot_readings_history.asset_id = aa.device_serial_number;

-- Clean up any readings that couldn't be matched
DELETE FROM agbot_readings_history 
WHERE asset_id NOT IN (SELECT id FROM agbot_assets);

-- ============================================================================
-- STEP 6: Add device serial uniqueness constraint
-- ============================================================================

-- Add unique constraint on device serial number in assets table
ALTER TABLE agbot_assets 
ADD CONSTRAINT unique_device_serial_number UNIQUE (device_serial_number);

-- ============================================================================
-- STEP 7: Verification - Show final device-based data
-- ============================================================================

-- Show final unique devices (should match physical tank count)
SELECT 
    'Final device-based records' as status,
    aa.device_serial_number,
    al.location_id as tank_location,
    al.latest_calibrated_fill_percentage as fill_level,
    CASE WHEN al.address1 != 'No address' THEN al.address1 ELSE 'No address' END as address,
    aa.device_online,
    al.created_at
FROM agbot_assets aa
JOIN agbot_locations al ON aa.location_id = al.id
ORDER BY aa.device_serial_number;

-- Show final counts (should be exactly one record per device)
SELECT 
    'After device deduplication' as status,
    COUNT(DISTINCT aa.device_serial_number) as unique_devices,
    COUNT(al.id) as location_records,
    COUNT(aa.id) as asset_records,
    COUNT(arh.id) as reading_records
FROM agbot_locations al
JOIN agbot_assets aa ON al.id = aa.location_id
LEFT JOIN agbot_readings_history arh ON aa.id = arh.asset_id;

-- ============================================================================
-- STEP 8: Log the device-based deduplication
-- ============================================================================

INSERT INTO agbot_sync_logs (
    sync_type,
    sync_status,
    locations_processed,
    assets_processed,
    readings_processed,
    sync_duration_ms,
    started_at,
    completed_at,
    error_message
) VALUES (
    'device_based_deduplication',
    'success',
    (SELECT COUNT(*) FROM agbot_locations),
    (SELECT COUNT(*) FROM agbot_assets),
    (SELECT COUNT(*) FROM agbot_readings_history),
    0,
    NOW(),
    NOW(),
    'Restructured data model to use device serial as primary unique key'
);

-- Success message
SELECT 'Device-based deduplication completed successfully!' as result;
SELECT 'Each device serial number now has exactly one record' as explanation;
SELECT 'Location information preserved as context on device records' as note;