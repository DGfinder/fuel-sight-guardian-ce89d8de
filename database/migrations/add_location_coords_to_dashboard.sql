-- Add latitude/longitude to ta_tank_dashboard view
-- This allows the Location tab in TankDetailsModal to show maps

-- Drop dependent views first
DROP VIEW IF EXISTS ta_unified_map_locations;
DROP VIEW IF EXISTS ta_tank_full_status;

-- Recreate ta_tank_dashboard with location coordinates
CREATE OR REPLACE VIEW ta_tank_dashboard AS
SELECT
    t.id,
    t.name,
    t.business_id,
    b.name as business_name,
    b.code as business_code,
    t.group_id,
    g.name as group_name,
    t.subgroup_id,
    s.name as subgroup_name,
    t.capacity_liters,
    t.current_level_liters,
    t.current_level_datetime,
    t.current_level_source,
    t.fill_percent,
    t.safe_level_liters,
    t.min_level_liters,
    t.critical_level_liters,
    t.rolling_avg_liters_per_day,
    t.days_to_min_level,
    t.unit,
    t.installation_type,
    t.has_sensor,
    t.status,
    t.notes,
    t.created_at,
    t.updated_at,
    -- NEW: Location coordinates
    loc.latitude,
    loc.longitude,
    loc.address as location_address
FROM ta_tanks t
LEFT JOIN ta_businesses b ON t.business_id = b.id
LEFT JOIN ta_groups g ON t.group_id = g.id
LEFT JOIN ta_subgroups s ON t.subgroup_id = s.id
LEFT JOIN ta_locations loc ON t.location_id = loc.id
WHERE t.archived_at IS NULL;

-- Recreate ta_tank_full_status (it will now include lat/lng from dashboard)
CREATE OR REPLACE VIEW ta_tank_full_status AS
SELECT
    d.*,
    COALESCE(a.avg_daily_consumption_liters, 0) as avg_daily_consumption_liters,
    COALESCE(a.estimated_days_until_empty, 999) as estimated_days_until_empty,
    a.estimated_empty_date,
    COALESCE(a.days_until_min_level, 999) as days_until_min_level,
    COALESCE(a.previous_day_use, 0) as previous_day_use,
    -- Enhanced analytics
    COALESCE(a.trend_direction, 'stable') as trend_direction,
    COALESCE(a.trend_percent_change, 0) as trend_percent_change,
    a.last_refill_date,
    a.last_refill_volume,
    a.avg_refill_interval_days,
    COALESCE(a.consumption_stddev, 0) as consumption_stddev,
    COALESCE(a.predictability, 'unknown') as predictability,
    COALESCE(a.days_since_last_dip, 999) as days_since_last_dip,
    COALESCE(a.data_quality, 'no_data') as data_quality,
    COALESCE(a.peak_daily_consumption, 0) as peak_daily_consumption,
    COALESCE(a.consumption_7_days, 0) as consumption_7_days,
    COALESCE(a.consumption_30_days, 0) as consumption_30_days,
    COALESCE(a.is_anomaly, FALSE) as is_anomaly,
    a.anomaly_type,
    a.optimal_order_date,
    COALESCE(a.order_urgency, 'ok') as order_urgency,
    a.consumption_vs_group_percent,
    COALESCE(a.efficiency_trend, 'stable') as efficiency_trend,
    COALESCE(a.readings_in_period, 0) as readings_in_period,
    a.calculated_at as analytics_updated_at,
    -- Urgency scoring
    CASE
        WHEN d.fill_percent <= 10 THEN 'critical'
        WHEN d.fill_percent <= 20 THEN 'urgent'
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 3 THEN 'urgent'
        WHEN d.fill_percent <= 30 THEN 'warning'
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 7 THEN 'warning'
        WHEN d.current_level_liters <= d.min_level_liters THEN 'warning'
        ELSE 'ok'
    END as urgency_status,
    CASE
        WHEN d.fill_percent <= 10 THEN 1
        WHEN d.fill_percent <= 20 THEN 2
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 3 THEN 2
        WHEN d.fill_percent <= 30 THEN 3
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 7 THEN 3
        ELSE 4
    END as priority_score
FROM ta_tank_dashboard d
LEFT JOIN ta_tank_analytics a ON d.id = a.tank_id;

-- Recreate ta_unified_map_locations
CREATE OR REPLACE VIEW ta_unified_map_locations AS
SELECT
    'manual'::text as source,
    fs.id::text,
    fs.name as location,
    fs.latitude,
    fs.longitude,
    fs.fill_percent as current_level_percent,
    fs.group_name,
    fs.subgroup_name,
    COALESCE(p.name, 'Unknown') as product_type,
    fs.current_level_datetime as latest_reading_at,
    fs.urgency_status,
    fs.avg_daily_consumption_liters as rolling_avg,
    fs.estimated_days_until_empty as days_to_min,
    fs.capacity_liters,
    fs.current_level_liters,
    NULL::boolean as device_online,
    NULL::text as customer_name,
    NULL::integer as total_assets,
    NULL::integer as assets_online
FROM ta_tank_full_status fs
JOIN ta_tanks t ON fs.id = t.id
LEFT JOIN ta_products p ON t.product_id = p.id
WHERE fs.latitude IS NOT NULL
  AND fs.longitude IS NOT NULL

UNION ALL

SELECT
    'agbot'::text as source,
    a.id::text,
    COALESCE(a.name, l.name, 'Unknown Asset') as location,
    l.latitude,
    l.longitude,
    a.current_level_percent as current_level_percent,
    l.customer_name as group_name,
    NULL::text as subgroup_name,
    a.commodity as product_type,
    a.last_telemetry_at as latest_reading_at,
    CASE
        WHEN a.current_level_percent <= 10 THEN 'critical'
        WHEN a.current_level_percent <= 20 THEN 'urgent'
        WHEN a.days_remaining <= 3 THEN 'urgent'
        WHEN a.current_level_percent <= 30 THEN 'warning'
        WHEN a.days_remaining <= 7 THEN 'warning'
        ELSE 'ok'
    END as urgency_status,
    a.daily_consumption_liters as rolling_avg,
    a.days_remaining as days_to_min,
    a.capacity_liters,
    a.current_level_liters,
    a.is_online as device_online,
    l.customer_name,
    l.total_assets,
    l.assets_online
FROM ta_agbot_assets a
JOIN ta_agbot_locations l ON a.location_id = l.id
WHERE l.latitude IS NOT NULL
  AND l.longitude IS NOT NULL
  AND a.is_disabled = false
  AND l.is_disabled = false;

GRANT SELECT ON ta_unified_map_locations TO authenticated;
GRANT SELECT ON ta_unified_map_locations TO anon;

-- Verify
SELECT 'Done! Checking latitude/longitude...' as status;
SELECT id, name, latitude, longitude FROM ta_tank_full_status WHERE latitude IS NOT NULL LIMIT 5;
