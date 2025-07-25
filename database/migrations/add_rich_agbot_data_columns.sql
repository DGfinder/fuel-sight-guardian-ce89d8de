-- Add Rich Operational Data Columns to Agbot Tables
-- This migration adds columns for consumption rates, days remaining, addresses, tank metrics
-- Run this in Supabase Dashboard SQL Editor

-- ============================================================================
-- STEP 1: Add enhanced columns to agbot_locations table
-- ============================================================================

-- Add operational data columns
ALTER TABLE agbot_locations 
ADD COLUMN IF NOT EXISTS daily_consumption_rate DECIMAL(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS days_remaining INTEGER,
ADD COLUMN IF NOT EXISTS street_address TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS suburb TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS state_province TEXT DEFAULT '';

-- Add comments for documentation
COMMENT ON COLUMN agbot_locations.daily_consumption_rate IS 'Daily fuel consumption rate as percentage (e.g., 5.26 for 5.26%)';
COMMENT ON COLUMN agbot_locations.days_remaining IS 'Calculated days until tank is empty based on current consumption';
COMMENT ON COLUMN agbot_locations.street_address IS 'Physical street address of the tank location';
COMMENT ON COLUMN agbot_locations.suburb IS 'Suburb/city of the tank location';
COMMENT ON COLUMN agbot_locations.state_province IS 'State or province of the tank location';

-- ============================================================================
-- STEP 2: Add enhanced columns to agbot_assets table
-- ============================================================================

-- Add tank metrics columns
ALTER TABLE agbot_assets 
ADD COLUMN IF NOT EXISTS tank_depth DECIMAL(6,3),
ADD COLUMN IF NOT EXISTS tank_pressure DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS asset_profile_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN agbot_assets.tank_depth IS 'Physical tank depth measurement in meters';
COMMENT ON COLUMN agbot_assets.tank_pressure IS 'Tank pressure reading in appropriate units';
COMMENT ON COLUMN agbot_assets.asset_profile_name IS 'Descriptive name/profile of the tank asset';

-- ============================================================================
-- STEP 3: Add enhanced columns to agbot_readings_history table
-- ============================================================================

-- Add physical measurement columns to readings
ALTER TABLE agbot_readings_history 
ADD COLUMN IF NOT EXISTS tank_depth DECIMAL(6,3),
ADD COLUMN IF NOT EXISTS tank_pressure DECIMAL(8,3);

-- Add comments for documentation
COMMENT ON COLUMN agbot_readings_history.tank_depth IS 'Tank depth at time of reading (meters)';
COMMENT ON COLUMN agbot_readings_history.tank_pressure IS 'Tank pressure at time of reading';

-- ============================================================================
-- STEP 4: Create indexes for performance
-- ============================================================================

-- Index for days remaining filtering (critical alerts)
CREATE INDEX IF NOT EXISTS idx_agbot_locations_days_remaining 
ON agbot_locations(days_remaining) 
WHERE days_remaining IS NOT NULL AND days_remaining <= 30;

-- Index for consumption rate analysis
CREATE INDEX IF NOT EXISTS idx_agbot_locations_consumption_rate 
ON agbot_locations(daily_consumption_rate) 
WHERE daily_consumption_rate > 0;

-- Index for location-based queries
CREATE INDEX IF NOT EXISTS idx_agbot_locations_address 
ON agbot_locations(state_province, suburb, street_address);

-- Index for tank metrics analysis
CREATE INDEX IF NOT EXISTS idx_agbot_assets_tank_metrics 
ON agbot_assets(tank_depth, tank_pressure) 
WHERE tank_depth IS NOT NULL OR tank_pressure IS NOT NULL;

-- ============================================================================
-- STEP 5: Create views for enhanced dashboard data
-- ============================================================================

-- Create a comprehensive view combining location and asset data
CREATE OR REPLACE VIEW agbot_locations_enhanced AS
SELECT 
    al.id,
    al.location_guid,
    al.customer_name,
    al.location_id,
    al.latest_calibrated_fill_percentage,
    al.daily_consumption_rate,
    al.days_remaining,
    
    -- Address information
    CASE 
        WHEN al.street_address != '' THEN al.street_address
        ELSE 'No address'
    END as full_address,
    
    CASE 
        WHEN al.suburb != '' AND al.state_province != '' THEN 
            al.suburb || ', ' || al.state_province
        WHEN al.suburb != '' THEN al.suburb
        WHEN al.state_province != '' THEN al.state_province
        ELSE 'Unknown location'
    END as location_display,
    
    -- Status and health indicators
    al.location_status,
    al.location_status_label,
    al.latest_telemetry,
    al.disabled,
    
    -- Calculated alert levels
    CASE 
        WHEN al.days_remaining IS NULL THEN 'unknown'
        WHEN al.days_remaining <= 7 THEN 'critical'
        WHEN al.days_remaining <= 30 THEN 'warning'
        ELSE 'good'
    END as alert_level,
    
    CASE 
        WHEN al.latest_calibrated_fill_percentage <= 15 THEN 'critical'
        WHEN al.latest_calibrated_fill_percentage <= 30 THEN 'warning'
        ELSE 'good'
    END as fuel_level_status,
    
    -- Asset count and metrics
    COUNT(aa.id) as asset_count,
    AVG(aa.tank_depth) as avg_tank_depth,
    AVG(aa.tank_pressure) as avg_tank_pressure,
    
    al.created_at,
    al.updated_at
    
FROM agbot_locations al
LEFT JOIN agbot_assets aa ON al.id = aa.location_id
GROUP BY al.id;

-- Create view for assets with enhanced data
CREATE OR REPLACE VIEW agbot_assets_enhanced AS
SELECT 
    aa.*,
    al.location_id as location_name,
    al.daily_consumption_rate as location_consumption_rate,
    al.days_remaining as location_days_remaining,
    al.street_address,
    al.suburb,
    al.state_province,
    
    -- Asset-specific calculations
    CASE 
        WHEN aa.device_online THEN 'online'
        ELSE 'offline'
    END as device_status_simple,
    
    -- Tank capacity estimation (if depth is available)
    CASE 
        WHEN aa.tank_depth IS NOT NULL AND aa.tank_depth > 0 THEN
            ROUND((aa.latest_calibrated_fill_percentage / 100.0) * aa.tank_depth, 2)
        ELSE NULL
    END as estimated_fuel_height
    
FROM agbot_assets aa
JOIN agbot_locations al ON aa.location_id = al.id;

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

-- Ensure frontend can access new columns and views
GRANT SELECT ON agbot_locations_enhanced TO authenticated;
GRANT SELECT ON agbot_locations_enhanced TO anon;
GRANT SELECT ON agbot_assets_enhanced TO authenticated;
GRANT SELECT ON agbot_assets_enhanced TO anon;

-- ============================================================================
-- STEP 7: Verification queries
-- ============================================================================

-- Verify new columns exist
SELECT 
    'agbot_locations columns' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'agbot_locations' 
AND column_name IN ('daily_consumption_rate', 'days_remaining', 'street_address', 'suburb', 'state_province')
ORDER BY column_name;

SELECT 
    'agbot_assets columns' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'agbot_assets' 
AND column_name IN ('tank_depth', 'tank_pressure', 'asset_profile_name')
ORDER BY column_name;

-- Show enhanced view structure
SELECT 
    'Enhanced views created' as status,
    COUNT(*) as view_count
FROM information_schema.views 
WHERE table_name IN ('agbot_locations_enhanced', 'agbot_assets_enhanced');

-- ============================================================================
-- STEP 8: Sample data verification (after import)
-- ============================================================================

-- This query can be run after importing rich data to verify
/*
SELECT 
    location_id,
    latest_calibrated_fill_percentage as fill_level,
    daily_consumption_rate,
    days_remaining,
    full_address,
    alert_level,
    asset_count
FROM agbot_locations_enhanced 
ORDER BY days_remaining ASC NULLS LAST
LIMIT 10;
*/

-- Success message
SELECT 'Rich data columns added successfully!' as result;
SELECT 'Ready to import enhanced CSV data with operational metrics' as next_step;