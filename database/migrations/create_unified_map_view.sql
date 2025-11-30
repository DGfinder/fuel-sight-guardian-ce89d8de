-- ============================================================================
-- CREATE UNIFIED MAP VIEW
-- Single query returns all map markers from multiple data sources
-- Run this in Supabase SQL Editor
-- ============================================================================

DROP VIEW IF EXISTS ta_unified_map_locations;

CREATE OR REPLACE VIEW ta_unified_map_locations AS

-- Manual tanks - join ta_tank_full_status with ta_locations for coordinates
SELECT
    'manual'::text as source,
    fs.id::text,
    fs.name as location,
    loc.latitude,
    loc.longitude,
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
LEFT JOIN ta_locations loc ON t.location_id = loc.id
LEFT JOIN ta_products p ON t.product_id = p.id
WHERE loc.latitude IS NOT NULL
  AND loc.longitude IS NOT NULL

UNION ALL

-- AgBot assets with location coordinates (asset-level detail)
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

-- Grant access
GRANT SELECT ON ta_unified_map_locations TO authenticated;
GRANT SELECT ON ta_unified_map_locations TO anon;

-- Verify
SELECT
    source,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE latitude IS NOT NULL) as with_coords
FROM ta_unified_map_locations
GROUP BY source;
