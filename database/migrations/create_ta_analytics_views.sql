-- ============================================================================
-- TankAlert Analytics Views
-- Unified views across manual dips, AgBot, and SmartFill data sources
-- ============================================================================

-- ============================================================================
-- VIEW 1: tanks_basic_data
-- Basic tank information with current status
-- ============================================================================

CREATE OR REPLACE VIEW tanks_basic_data AS
SELECT
  t.id,
  t.name,
  t.business_id,
  t.group_id,
  t.subgroup_id,
  g.name as group_name,
  sg.name as subgroup_name,
  t.product_type,
  t.safe_level_liters,
  t.min_level_liters,
  t.current_level_liters,
  t.current_level_datetime,
  t.current_level_source,
  t.latitude,
  t.longitude,
  t.address,
  t.notes,
  CASE
    WHEN COALESCE(t.safe_level_liters, 0) > 0
    THEN ROUND((COALESCE(t.current_level_liters, 0) / t.safe_level_liters * 100)::numeric, 1)
    ELSE 0
  END as current_level_percent,
  (COALESCE(t.safe_level_liters, 0) - COALESCE(t.min_level_liters, 0)) as usable_capacity_liters,
  (COALESCE(t.safe_level_liters, 0) - COALESCE(t.current_level_liters, 0)) as ullage_liters,
  t.created_at,
  t.updated_at
FROM ta_tanks t
LEFT JOIN ta_groups g ON t.group_id = g.id
LEFT JOIN ta_subgroups sg ON t.subgroup_id = sg.id
WHERE t.archived_at IS NULL;

-- ============================================================================
-- VIEW 2: tanks_with_latest_dip
-- Tank data with most recent manual dip reading
-- ============================================================================

CREATE OR REPLACE VIEW tanks_with_latest_dip AS
SELECT
  t.*,
  dip.id as latest_dip_id,
  dip.level_liters as latest_dip_liters,
  dip.measured_at as latest_dip_datetime,
  dip.recorded_by as latest_dip_recorded_by,
  dip.notes as latest_dip_notes
FROM tanks_basic_data t
LEFT JOIN LATERAL (
  SELECT id, level_liters, measured_at, recorded_by, notes
  FROM ta_tank_dips
  WHERE tank_id = t.id AND archived_at IS NULL
  ORDER BY measured_at DESC
  LIMIT 1
) dip ON true;

-- ============================================================================
-- VIEW 3: tanks_with_latest_reading
-- Tank data with readings from ALL sources (dip, agbot, smartfill)
-- ============================================================================

CREATE OR REPLACE VIEW tanks_with_latest_reading AS
SELECT
  t.*,
  ts.primary_source,
  ts.agbot_asset_id,
  ts.smartfill_tank_id,

  -- Latest manual dip
  dip.level_liters as dip_level_liters,
  dip.measured_at as dip_datetime,

  -- Latest AgBot reading
  agbot.current_level_liters as agbot_level_liters,
  agbot.current_level_percent as agbot_level_percent,
  agbot.last_telemetry_at as agbot_datetime,
  agbot.is_online as agbot_online,
  agbot.battery_voltage as agbot_battery,
  agbot.temperature_c as agbot_temperature,
  agbot.daily_consumption_liters as agbot_daily_consumption,
  agbot.days_remaining as agbot_days_remaining,
  agbot.device_state as agbot_device_state,
  agbot.commodity as agbot_commodity,

  -- Latest SmartFill reading (when we add the foreign key)
  NULL::decimal as smartfill_level_liters,
  NULL::timestamptz as smartfill_datetime

FROM tanks_basic_data t
LEFT JOIN ta_tank_sources ts ON ts.ta_tank_id = t.id AND ts.is_active = true
LEFT JOIN LATERAL (
  SELECT level_liters, measured_at
  FROM ta_tank_dips
  WHERE tank_id = t.id AND archived_at IS NULL
  ORDER BY measured_at DESC
  LIMIT 1
) dip ON true
LEFT JOIN ta_agbot_assets agbot ON ts.agbot_asset_id = agbot.id;

-- ============================================================================
-- VIEW 4: tanks_with_rolling_avg
-- 7-day rolling average consumption from UNIFIED data sources
-- ============================================================================

CREATE OR REPLACE VIEW tanks_with_rolling_avg AS
WITH unified_readings AS (
  -- Manual dips
  SELECT
    d.tank_id,
    d.level_liters,
    d.measured_at,
    'dip' as source
  FROM ta_tank_dips d
  WHERE d.archived_at IS NULL
    AND d.measured_at > NOW() - INTERVAL '30 days'

  UNION ALL

  -- AgBot readings (via tank_sources mapping)
  SELECT
    ts.ta_tank_id as tank_id,
    r.level_liters,
    r.reading_at as measured_at,
    'agbot' as source
  FROM ta_agbot_readings r
  JOIN ta_agbot_assets a ON r.asset_id = a.id
  JOIN ta_tank_sources ts ON ts.agbot_asset_id = a.id AND ts.is_active = true
  WHERE r.reading_at > NOW() - INTERVAL '30 days'
    AND r.level_liters IS NOT NULL
),
consumption_calc AS (
  SELECT
    tank_id,
    level_liters,
    measured_at,
    LAG(level_liters) OVER (PARTITION BY tank_id ORDER BY measured_at) as prev_level,
    LAG(measured_at) OVER (PARTITION BY tank_id ORDER BY measured_at) as prev_datetime
  FROM unified_readings
),
daily_rates AS (
  SELECT
    tank_id,
    CASE
      -- Only count consumption (level decreased)
      WHEN prev_level IS NOT NULL
        AND level_liters < prev_level
        AND EXTRACT(EPOCH FROM (measured_at - prev_datetime)) > 0
      THEN (prev_level - level_liters) / GREATEST(EXTRACT(EPOCH FROM (measured_at - prev_datetime)) / 86400, 0.1)
      ELSE NULL
    END as daily_rate
  FROM consumption_calc
  WHERE prev_level IS NOT NULL
    AND measured_at > NOW() - INTERVAL '7 days'
),
rolling_stats AS (
  SELECT
    tank_id,
    ROUND(AVG(daily_rate) FILTER (WHERE daily_rate > 0 AND daily_rate < 10000)::numeric, 2) as avg_daily_consumption,
    COUNT(*) FILTER (WHERE daily_rate > 0 AND daily_rate < 10000) as data_points
  FROM daily_rates
  GROUP BY tank_id
)
SELECT
  t.*,
  COALESCE(rs.avg_daily_consumption, 0) as rolling_avg_daily_liters,
  COALESCE(rs.data_points, 0) as consumption_readings,

  -- Days to minimum calculation
  CASE
    WHEN COALESCE(rs.avg_daily_consumption, 0) > 0
    THEN ROUND(
      ((COALESCE(t.current_level_liters, 0) - COALESCE(t.min_level_liters, 0)) / rs.avg_daily_consumption)::numeric,
      1
    )
    ELSE NULL
  END as days_to_min_level,

  -- Estimated empty date
  CASE
    WHEN COALESCE(rs.avg_daily_consumption, 0) > 0
    THEN CURRENT_DATE + (
      (COALESCE(t.current_level_liters, 0) - COALESCE(t.min_level_liters, 0)) / rs.avg_daily_consumption
    )::int
    ELSE NULL
  END as estimated_empty_date,

  -- Urgency classification
  CASE
    WHEN COALESCE(t.current_level_percent, 0) <= 10 THEN 'critical'
    WHEN COALESCE(rs.avg_daily_consumption, 0) > 0
      AND ((COALESCE(t.current_level_liters, 0) - COALESCE(t.min_level_liters, 0)) / rs.avg_daily_consumption) <= 7
    THEN 'warning'
    WHEN COALESCE(t.current_level_percent, 0) <= 25 THEN 'low'
    ELSE 'normal'
  END as urgency_status

FROM tanks_with_latest_reading t
LEFT JOIN rolling_stats rs ON t.id = rs.tank_id;

-- ============================================================================
-- VIEW 5: agbot_fleet_overview
-- AgBot-specific fleet health dashboard
-- ============================================================================

CREATE OR REPLACE VIEW agbot_fleet_overview AS
SELECT
  l.id as location_id,
  l.name as location_name,
  l.customer_name,
  l.tenancy_name,
  l.address,
  l.latitude,
  l.longitude,
  l.installation_status,
  l.is_disabled as location_disabled,

  -- Asset counts
  COUNT(a.id) as total_assets,
  COUNT(a.id) FILTER (WHERE a.is_online = true) as assets_online,
  COUNT(a.id) FILTER (WHERE a.is_online = false) as assets_offline,
  COUNT(a.id) FILTER (WHERE a.is_disabled = true) as assets_disabled,

  -- Level metrics
  ROUND(AVG(a.current_level_percent)::numeric, 1) as avg_fill_percent,
  MIN(a.current_level_percent) as min_fill_percent,
  MAX(a.current_level_percent) as max_fill_percent,

  -- Consumption metrics
  SUM(a.daily_consumption_liters) as total_daily_consumption,
  ROUND(AVG(a.daily_consumption_liters)::numeric, 2) as avg_daily_consumption,
  MIN(a.days_remaining) as min_days_remaining,

  -- Health metrics
  ROUND(AVG(a.battery_voltage)::numeric, 2) as avg_battery_voltage,
  MIN(a.battery_voltage) as min_battery_voltage,
  ROUND(AVG(a.temperature_c)::numeric, 1) as avg_temperature,

  -- Alerts
  COUNT(a.id) FILTER (WHERE a.days_remaining IS NOT NULL AND a.days_remaining <= 7) as tanks_need_refill,
  COUNT(a.id) FILTER (WHERE a.battery_voltage IS NOT NULL AND a.battery_voltage < 3.3) as low_battery_devices,

  -- Timestamps
  MAX(a.last_telemetry_at) as latest_telemetry,
  l.updated_at as location_updated_at

FROM ta_agbot_locations l
LEFT JOIN ta_agbot_assets a ON a.location_id = l.id AND a.is_disabled = false
WHERE l.is_disabled = false
GROUP BY l.id, l.name, l.customer_name, l.tenancy_name, l.address,
         l.latitude, l.longitude, l.installation_status, l.is_disabled, l.updated_at;

-- ============================================================================
-- VIEW 6: agbot_device_health_summary
-- Device health trends for predictive maintenance
-- ============================================================================

CREATE OR REPLACE VIEW agbot_device_health_summary AS
SELECT
  a.id as asset_id,
  a.name as asset_name,
  a.serial_number,
  a.device_serial,
  a.commodity,
  a.is_online,
  a.device_state,
  a.battery_voltage as current_battery,
  a.temperature_c as current_temp,
  a.last_telemetry_at,

  -- Battery trend (last 7 days)
  (
    SELECT ROUND(AVG(battery_voltage)::numeric, 2)
    FROM ta_agbot_readings
    WHERE asset_id = a.id
      AND reading_at > NOW() - INTERVAL '7 days'
      AND battery_voltage IS NOT NULL
  ) as avg_battery_7d,

  -- Battery change
  (
    SELECT a.battery_voltage - COALESCE(
      (SELECT battery_voltage FROM ta_agbot_readings
       WHERE asset_id = a.id AND battery_voltage IS NOT NULL
       ORDER BY reading_at ASC LIMIT 1),
      a.battery_voltage
    )
  ) as battery_change_total,

  -- Offline events (last 7 days)
  (
    SELECT COUNT(*)
    FROM ta_agbot_readings r1
    WHERE r1.asset_id = a.id
      AND r1.reading_at > NOW() - INTERVAL '7 days'
      AND r1.is_online = false
      AND EXISTS (
        SELECT 1 FROM ta_agbot_readings r2
        WHERE r2.asset_id = a.id
          AND r2.reading_at < r1.reading_at
          AND r2.is_online = true
        ORDER BY r2.reading_at DESC
        LIMIT 1
      )
  ) as offline_events_7d,

  -- Sensor calibration drift
  (a.current_raw_percent - a.current_level_percent) as calibration_drift,

  -- Health status
  CASE
    WHEN a.battery_voltage IS NOT NULL AND a.battery_voltage < 3.2 THEN 'critical'
    WHEN a.battery_voltage IS NOT NULL AND a.battery_voltage < 3.4 THEN 'warning'
    WHEN a.is_online = false THEN 'offline'
    ELSE 'healthy'
  END as health_status,

  l.name as location_name,
  l.customer_name

FROM ta_agbot_assets a
JOIN ta_agbot_locations l ON a.location_id = l.id
WHERE a.is_disabled = false;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Analytics views created successfully' as result;
SELECT
  (SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'tanks_basic_data') +
  (SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'tanks_with_latest_dip') +
  (SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'tanks_with_latest_reading') +
  (SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'tanks_with_rolling_avg') +
  (SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'agbot_fleet_overview') +
  (SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'agbot_device_health_summary')
  as views_created;
