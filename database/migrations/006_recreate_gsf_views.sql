-- Migration: Recreate Views in Great Southern Fuels Schema
-- Description: Create all ta_ views in tenant schema with proper table references
-- Author: Claude Code
-- Date: 2025-01-02
-- Phase: 3.3 - View Creation

-- =============================================================================
-- MATERIALIZED VIEW: ta_tank_analytics
-- =============================================================================
-- Drop if exists (for re-run safety)
DROP MATERIALIZED VIEW IF EXISTS great_southern_fuels.ta_tank_analytics CASCADE;

CREATE MATERIALIZED VIEW great_southern_fuels.ta_tank_analytics AS
WITH recent_dips AS (
    -- Get last 14 days of readings per tank
    SELECT
        tank_id,
        level_liters,
        measured_at,
        LAG(level_liters) OVER (PARTITION BY tank_id ORDER BY measured_at) as prev_level,
        LAG(measured_at) OVER (PARTITION BY tank_id ORDER BY measured_at) as prev_measured_at
    FROM great_southern_fuels.ta_tank_dips
    WHERE archived_at IS NULL
      AND measured_at >= NOW() - INTERVAL '14 days'
),
consumption_calc AS (
    -- Calculate daily consumption between readings
    -- Only count when level goes DOWN (consumption, not deliveries)
    SELECT
        tank_id,
        measured_at,
        CASE
            WHEN prev_level > level_liters THEN
                (prev_level - level_liters) /
                NULLIF(EXTRACT(EPOCH FROM (measured_at - prev_measured_at)) / 86400.0, 0)
            ELSE 0
        END as daily_consumption
    FROM recent_dips
    WHERE prev_level IS NOT NULL
      AND prev_level > level_liters
),
latest_two_dips AS (
    -- Get the two most recent dips per tank for previous_day_use calculation
    SELECT
        tank_id,
        level_liters,
        ROW_NUMBER() OVER (PARTITION BY tank_id ORDER BY measured_at DESC) as rn
    FROM great_southern_fuels.ta_tank_dips
    WHERE archived_at IS NULL
),
prev_day_calc AS (
    -- Calculate previous day use (previous dip level - current dip level)
    -- Only positive values (consumption), 0 for deliveries/increases
    SELECT
        l1.tank_id,
        CASE
            WHEN l2.level_liters IS NOT NULL AND l2.level_liters > l1.level_liters
            THEN (l2.level_liters - l1.level_liters)::integer
            ELSE 0
        END as previous_day_use
    FROM latest_two_dips l1
    LEFT JOIN latest_two_dips l2 ON l1.tank_id = l2.tank_id AND l2.rn = 2
    WHERE l1.rn = 1
)
SELECT
    t.id as tank_id,
    COALESCE(AVG(c.daily_consumption), 0)::integer as avg_daily_consumption_liters,
    CASE
        WHEN COALESCE(AVG(c.daily_consumption), 0) > 0
        THEN ROUND(t.current_level_liters / AVG(c.daily_consumption))::integer
        ELSE 999
    END as estimated_days_until_empty,
    CASE
        WHEN COALESCE(AVG(c.daily_consumption), 0) > 0
        THEN (NOW() + (t.current_level_liters / AVG(c.daily_consumption)) * INTERVAL '1 day')::date
        ELSE NULL
    END as estimated_empty_date,
    CASE
        WHEN COALESCE(AVG(c.daily_consumption), 0) > 0 AND t.min_level_liters > 0
        THEN ROUND((t.current_level_liters - t.min_level_liters) / AVG(c.daily_consumption))::integer
        ELSE 999
    END as days_until_min_level,
    COALESCE(p.previous_day_use, 0) as previous_day_use,
    COUNT(c.daily_consumption)::integer as readings_in_period,
    NOW() as calculated_at
FROM great_southern_fuels.ta_tanks t
LEFT JOIN consumption_calc c ON t.id = c.tank_id
LEFT JOIN prev_day_calc p ON t.id = p.tank_id
WHERE t.archived_at IS NULL
GROUP BY t.id, t.current_level_liters, t.min_level_liters, p.previous_day_use;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_gsf_ta_tank_analytics_pk
  ON great_southern_fuels.ta_tank_analytics(tank_id);

-- =============================================================================
-- VIEW: ta_tank_dashboard
-- =============================================================================

CREATE OR REPLACE VIEW great_southern_fuels.ta_tank_dashboard AS
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
    -- Location coordinates
    loc.latitude,
    loc.longitude,
    loc.address as location_address
FROM great_southern_fuels.ta_tanks t
LEFT JOIN great_southern_fuels.ta_businesses b ON t.business_id = b.id
LEFT JOIN great_southern_fuels.ta_groups g ON t.group_id = g.id
LEFT JOIN great_southern_fuels.ta_subgroups s ON t.subgroup_id = s.id
LEFT JOIN great_southern_fuels.ta_locations loc ON t.location_id = loc.id
WHERE t.archived_at IS NULL;

-- =============================================================================
-- VIEW: ta_tank_full_status
-- =============================================================================

CREATE OR REPLACE VIEW great_southern_fuels.ta_tank_full_status AS
SELECT
    d.*,
    COALESCE(a.avg_daily_consumption_liters, 0) as avg_daily_consumption_liters,
    COALESCE(a.estimated_days_until_empty, 999) as estimated_days_until_empty,
    a.estimated_empty_date,
    COALESCE(a.days_until_min_level, 999) as days_until_min_level,
    COALESCE(a.previous_day_use, 0) as previous_day_use,
    -- Enhanced analytics
    COALESCE(readings_in_period, 0) as readings_in_period,
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
FROM great_southern_fuels.ta_tank_dashboard d
LEFT JOIN great_southern_fuels.ta_tank_analytics a ON d.id = a.tank_id;

-- =============================================================================
-- VIEW: ta_unified_map_locations
-- =============================================================================

CREATE OR REPLACE VIEW great_southern_fuels.ta_unified_map_locations AS
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
FROM great_southern_fuels.ta_tank_full_status fs
JOIN great_southern_fuels.ta_tanks t ON fs.id = t.id
LEFT JOIN great_southern_fuels.ta_products p ON t.product_id = p.id
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
FROM great_southern_fuels.ta_agbot_assets a
JOIN great_southern_fuels.ta_agbot_locations l ON a.location_id = l.id
WHERE l.latitude IS NOT NULL
  AND l.longitude IS NOT NULL
  AND a.is_disabled = false
  AND l.is_disabled = false;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT ON great_southern_fuels.ta_tank_analytics TO authenticated;
GRANT SELECT ON great_southern_fuels.ta_tank_dashboard TO authenticated;
GRANT SELECT ON great_southern_fuels.ta_tank_full_status TO authenticated;
GRANT SELECT ON great_southern_fuels.ta_unified_map_locations TO authenticated;

-- =============================================================================
-- REFRESH MATERIALIZED VIEW
-- =============================================================================

REFRESH MATERIALIZED VIEW great_southern_fuels.ta_tank_analytics;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  view_count INTEGER;
  mat_view_count INTEGER;
BEGIN
  -- Count views
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = 'great_southern_fuels';

  -- Count materialized views
  SELECT COUNT(*) INTO mat_view_count
  FROM pg_matviews
  WHERE schemaname = 'great_southern_fuels';

  RAISE NOTICE '============================================';
  RAISE NOTICE 'VIEWS CREATION COMPLETE';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Schema: great_southern_fuels';
  RAISE NOTICE 'Standard views: %', view_count;
  RAISE NOTICE 'Materialized views: %', mat_view_count;
  RAISE NOTICE 'Expected: 3+ standard views, 1 materialized view';
  RAISE NOTICE '';
  RAISE NOTICE 'Views created:';
  RAISE NOTICE '  - ta_tank_analytics (materialized)';
  RAISE NOTICE '  - ta_tank_dashboard';
  RAISE NOTICE '  - ta_tank_full_status';
  RAISE NOTICE '  - ta_unified_map_locations';
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Run 007_verify_gsf_data_integrity.sql';
  RAISE NOTICE '============================================';
END $$;
