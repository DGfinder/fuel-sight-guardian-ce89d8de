-- ============================================================================
-- Migration: Extend Customer Tank Access for Multi-Source Support
-- Adds support for SmartFill tanks and manual dip tanks in customer portal
-- ============================================================================

-- ============================================================================
-- STEP 1: Add new columns to customer_tank_access
-- ============================================================================

-- Add tank_id column (references ta_tanks for unified access)
ALTER TABLE customer_tank_access
ADD COLUMN IF NOT EXISTS tank_id UUID REFERENCES ta_tanks(id) ON DELETE CASCADE;

-- Add tank_type to track the source type
ALTER TABLE customer_tank_access
ADD COLUMN IF NOT EXISTS tank_type TEXT CHECK (tank_type IN ('agbot', 'smartfill', 'dip', 'manual'));

-- Add smartfill_tank_id for direct SmartFill references
ALTER TABLE customer_tank_access
ADD COLUMN IF NOT EXISTS smartfill_tank_id UUID;

-- Make agbot_location_id nullable (not all tanks are AgBot)
ALTER TABLE customer_tank_access
ALTER COLUMN agbot_location_id DROP NOT NULL;

-- Add constraint: must have at least one tank reference
ALTER TABLE customer_tank_access
DROP CONSTRAINT IF EXISTS customer_tank_access_has_tank;

ALTER TABLE customer_tank_access
ADD CONSTRAINT customer_tank_access_has_tank
CHECK (
  agbot_location_id IS NOT NULL OR
  tank_id IS NOT NULL OR
  smartfill_tank_id IS NOT NULL
);

-- ============================================================================
-- STEP 2: Create indexes for new columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_customer_tank_access_tank_id
ON customer_tank_access(tank_id);

CREATE INDEX IF NOT EXISTS idx_customer_tank_access_tank_type
ON customer_tank_access(tank_type);

CREATE INDEX IF NOT EXISTS idx_customer_tank_access_smartfill
ON customer_tank_access(smartfill_tank_id);

-- ============================================================================
-- STEP 3: Create unified customer tanks view
-- This view returns all tanks a customer has access to, regardless of source
-- ============================================================================

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
  aa.id as agbot_asset_id

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

-- ============================================================================
-- STEP 4: RLS Policies for the unified view
-- ============================================================================

-- Customers can only see their own tanks
DROP POLICY IF EXISTS "Customers view own unified tanks" ON customer_tank_access;
CREATE POLICY "Customers view own unified tanks" ON customer_tank_access
  FOR SELECT TO authenticated USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 5: Grant permissions
-- ============================================================================

GRANT SELECT ON customer_tanks_unified TO authenticated;

-- ============================================================================
-- STEP 6: Helper function to assign any tank type to a customer
-- ============================================================================

CREATE OR REPLACE FUNCTION assign_tank_to_customer(
  p_customer_account_id UUID,
  p_tank_type TEXT,
  p_tank_id UUID DEFAULT NULL,
  p_agbot_location_id UUID DEFAULT NULL,
  p_smartfill_tank_id UUID DEFAULT NULL,
  p_access_level TEXT DEFAULT 'read'
)
RETURNS UUID AS $$
DECLARE
  v_access_id UUID;
BEGIN
  -- Validate tank type
  IF p_tank_type NOT IN ('agbot', 'smartfill', 'dip', 'manual') THEN
    RAISE EXCEPTION 'Invalid tank_type: %. Must be agbot, smartfill, dip, or manual', p_tank_type;
  END IF;

  -- Validate that appropriate ID is provided
  IF p_tank_type = 'agbot' AND p_agbot_location_id IS NULL THEN
    RAISE EXCEPTION 'agbot_location_id required for tank_type agbot';
  END IF;
  IF p_tank_type = 'smartfill' AND p_smartfill_tank_id IS NULL THEN
    RAISE EXCEPTION 'smartfill_tank_id required for tank_type smartfill';
  END IF;
  IF p_tank_type IN ('dip', 'manual') AND p_tank_id IS NULL THEN
    RAISE EXCEPTION 'tank_id required for tank_type dip/manual';
  END IF;

  INSERT INTO customer_tank_access (
    customer_account_id,
    tank_type,
    tank_id,
    agbot_location_id,
    smartfill_tank_id,
    access_level
  ) VALUES (
    p_customer_account_id,
    p_tank_type,
    p_tank_id,
    p_agbot_location_id,
    p_smartfill_tank_id,
    p_access_level
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_access_id;

  RETURN v_access_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION assign_tank_to_customer TO authenticated;

-- ============================================================================
-- STEP 7: Update existing records to set tank_type
-- ============================================================================

UPDATE customer_tank_access
SET tank_type = 'agbot'
WHERE agbot_location_id IS NOT NULL AND tank_type IS NULL;

SELECT 'Migration complete: customer_tank_access now supports agbot, smartfill, and dip tanks' as result;
