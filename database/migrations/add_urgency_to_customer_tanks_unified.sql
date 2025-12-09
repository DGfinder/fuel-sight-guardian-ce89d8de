-- ============================================================================
-- Migration: Add urgency_status to customer_tanks_unified view
-- Aligns customer portal urgency with admin panel (ta_tank_full_status)
--
-- Thresholds (matching admin):
-- - critical: fill ≤ 10%
-- - urgent: fill ≤ 20% OR days_remaining ≤ 3
-- - warning: fill ≤ 30% OR days_remaining ≤ 7
-- - ok: fill > 30% AND days_remaining > 7
-- ============================================================================

-- Drop and recreate the view with urgency_status
CREATE OR REPLACE VIEW customer_tanks_unified AS
SELECT
  cta.id as access_id,
  cta.customer_account_id,
  cta.access_level,
  cta.tank_type,
  cta.assigned_at,
  cta.notes as access_notes,

  -- Tank identification (prefer tank_id, fall back to agbot location)
  COALESCE(cta.tank_id, ts.ta_tank_id) as tank_id,
  COALESCE(t.name, al.name, sf.name, sf.unit_number) as tank_name,

  -- Source type
  COALESCE(
    cta.tank_type,
    CASE
      WHEN cta.agbot_location_id IS NOT NULL THEN 'agbot'
      WHEN cta.smartfill_tank_id IS NOT NULL THEN 'smartfill'
      WHEN cta.tank_id IS NOT NULL THEN 'dip'
      ELSE 'unknown'
    END
  ) as source_type,

  -- Location info (from various sources)
  COALESCE(loc.name, al.name) as location_name,
  COALESCE(loc.address, al.address) as address,
  COALESCE(loc.latitude, al.latitude) as latitude,
  COALESCE(loc.longitude, al.longitude) as longitude,

  -- Tank capacity
  COALESCE(t.capacity_liters, aa.capacity_liters, sf.capacity) as capacity_liters,
  COALESCE(t.safe_level_liters, aa.capacity_liters, sf.safe_fill_level) as safe_level_liters,

  -- Current level (from best available source)
  COALESCE(
    aa.current_level_liters,
    sf.current_volume,
    t.current_level_liters
  ) as current_level_liters,

  -- Current percentage
  COALESCE(
    aa.current_level_percent,
    sf.current_volume_percent,
    CASE WHEN t.capacity_liters > 0 THEN (t.current_level_liters / t.capacity_liters * 100) END
  ) as current_level_percent,

  -- Last reading timestamp
  COALESCE(
    aa.last_telemetry_at,
    sf.last_reading_at,
    t.current_level_datetime
  ) as last_reading_at,

  -- Consumption & predictions (mainly from AgBot)
  aa.daily_consumption_liters,
  aa.days_remaining,

  -- Device status (AgBot only)
  aa.is_online as device_online,
  aa.battery_voltage,
  aa.temperature_c,

  -- Product type
  COALESCE(p.name, aa.commodity) as product_type,

  -- Customer info
  COALESCE(al.customer_name, sfc.name) as customer_name,

  -- Source-specific IDs for detailed queries
  cta.agbot_location_id,
  cta.smartfill_tank_id,
  aa.id as agbot_asset_id,

  -- ========================================================================
  -- NEW: Urgency status (matches ta_tank_full_status calculation)
  -- ========================================================================
  CASE
    -- Critical: fill ≤ 10%
    WHEN COALESCE(
      aa.current_level_percent,
      sf.current_volume_percent,
      CASE WHEN t.capacity_liters > 0 THEN (t.current_level_liters / t.capacity_liters * 100) END,
      100
    ) <= 10 THEN 'critical'

    -- Urgent: fill ≤ 20%
    WHEN COALESCE(
      aa.current_level_percent,
      sf.current_volume_percent,
      CASE WHEN t.capacity_liters > 0 THEN (t.current_level_liters / t.capacity_liters * 100) END,
      100
    ) <= 20 THEN 'urgent'

    -- Urgent: days remaining ≤ 3
    WHEN COALESCE(aa.days_remaining, 999) <= 3 THEN 'urgent'

    -- Warning: fill ≤ 30%
    WHEN COALESCE(
      aa.current_level_percent,
      sf.current_volume_percent,
      CASE WHEN t.capacity_liters > 0 THEN (t.current_level_liters / t.capacity_liters * 100) END,
      100
    ) <= 30 THEN 'warning'

    -- Warning: days remaining ≤ 7
    WHEN COALESCE(aa.days_remaining, 999) <= 7 THEN 'warning'

    -- Warning: below safe level
    WHEN COALESCE(
      aa.current_level_liters,
      sf.current_volume,
      t.current_level_liters,
      0
    ) <= COALESCE(t.safe_level_liters, aa.capacity_liters, sf.safe_fill_level, 0) THEN 'warning'

    -- OK: everything else
    ELSE 'ok'
  END as urgency_status,

  -- Priority score for sorting (lower = more urgent)
  CASE
    WHEN COALESCE(
      aa.current_level_percent,
      sf.current_volume_percent,
      CASE WHEN t.capacity_liters > 0 THEN (t.current_level_liters / t.capacity_liters * 100) END,
      100
    ) <= 10 THEN 1
    WHEN COALESCE(
      aa.current_level_percent,
      sf.current_volume_percent,
      CASE WHEN t.capacity_liters > 0 THEN (t.current_level_liters / t.capacity_liters * 100) END,
      100
    ) <= 20 THEN 2
    WHEN COALESCE(aa.days_remaining, 999) <= 3 THEN 2
    WHEN COALESCE(
      aa.current_level_percent,
      sf.current_volume_percent,
      CASE WHEN t.capacity_liters > 0 THEN (t.current_level_liters / t.capacity_liters * 100) END,
      100
    ) <= 30 THEN 3
    WHEN COALESCE(aa.days_remaining, 999) <= 7 THEN 3
    ELSE 4
  END as priority_score

FROM customer_tank_access cta

-- Join ta_tanks if we have tank_id
LEFT JOIN ta_tanks t ON cta.tank_id = t.id
LEFT JOIN ta_locations loc ON t.location_id = loc.id
LEFT JOIN ta_products p ON t.product_id = p.id

-- Join ta_tank_sources to get agbot/smartfill links from ta_tanks
LEFT JOIN ta_tank_sources ts ON ts.ta_tank_id = t.id AND ts.is_active = true

-- Join AgBot tables if we have agbot_location_id
LEFT JOIN ta_agbot_locations al ON cta.agbot_location_id = al.id
LEFT JOIN ta_agbot_assets aa ON aa.location_id = al.id

-- Join SmartFill tables if we have smartfill_tank_id
LEFT JOIN ta_smartfill_tanks sf ON cta.smartfill_tank_id = sf.id
LEFT JOIN ta_smartfill_customers sfc ON sf.customer_id = sfc.id;

-- Grant permissions
GRANT SELECT ON customer_tanks_unified TO authenticated;

-- ============================================================================
-- Summary of changes:
-- 1. Added urgency_status column matching ta_tank_full_status logic
-- 2. Added priority_score for consistent sorting
-- 3. Thresholds: critical ≤10%, urgent ≤20%/≤3d, warning ≤30%/≤7d, ok otherwise
-- ============================================================================

SELECT 'Migration complete: customer_tanks_unified now has urgency_status matching admin panel' as result;
