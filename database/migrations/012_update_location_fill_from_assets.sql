-- Migration: Auto-Update Location Fill Level from Assets
-- Description: Automatically update ta_agbot_locations.calibrated_fill_level from asset data
-- This ensures the location-level field stays in sync with live asset readings
-- Author: Claude Code
-- Date: 2025-12-05
-- Phase: Wire Customer Portal to Live Data - Phase 2

-- =============================================================================
-- FUNCTION: Update location calibrated_fill_level from assets
-- =============================================================================
-- Calculates average fill level from all assets at a location
-- Updates location table whenever assets are inserted/updated

CREATE OR REPLACE FUNCTION update_location_fill_from_assets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_location_id UUID;
  avg_fill_level DECIMAL(5,2);
BEGIN
  -- Determine which location to update
  target_location_id := COALESCE(NEW.location_id, OLD.location_id);

  IF target_location_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate average fill level from all active assets at this location
  SELECT ROUND(AVG(current_level_percent)::numeric, 2)
  INTO avg_fill_level
  FROM ta_agbot_assets
  WHERE location_id = target_location_id
    AND is_disabled = false
    AND current_level_percent IS NOT NULL;

  -- Update location's calibrated_fill_level if we have asset data
  -- Keep existing value if no assets or all assets have NULL levels
  IF avg_fill_level IS NOT NULL THEN
    UPDATE ta_agbot_locations
    SET
      calibrated_fill_level = avg_fill_level,
      updated_at = NOW()
    WHERE id = target_location_id;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- TRIGGER: Auto-update on asset insert/update
-- =============================================================================
-- Triggers whenever an asset's current_level_percent changes

DROP TRIGGER IF EXISTS tr_update_location_fill_from_assets ON ta_agbot_assets;

CREATE TRIGGER tr_update_location_fill_from_assets
  AFTER INSERT OR UPDATE OF current_level_percent, is_disabled ON ta_agbot_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_location_fill_from_assets();

-- =============================================================================
-- INITIAL BACKFILL: Update all existing locations
-- =============================================================================
-- Calculate and set calibrated_fill_level for all locations based on current asset data

UPDATE ta_agbot_locations l
SET
  calibrated_fill_level = COALESCE(
    (SELECT ROUND(AVG(a.current_level_percent)::numeric, 2)
     FROM ta_agbot_assets a
     WHERE a.location_id = l.id
       AND a.is_disabled = false
       AND a.current_level_percent IS NOT NULL),
    l.calibrated_fill_level  -- Keep existing value if no asset data
  ),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1
  FROM ta_agbot_assets a
  WHERE a.location_id = l.id
    AND a.is_disabled = false
    AND a.current_level_percent IS NOT NULL
);

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  locations_updated INTEGER;
  locations_with_assets INTEGER;
  locations_with_null INTEGER;
BEGIN
  -- Count locations that were updated
  SELECT COUNT(*) INTO locations_updated
  FROM ta_agbot_locations l
  WHERE EXISTS (
    SELECT 1
    FROM ta_agbot_assets a
    WHERE a.location_id = l.id
      AND a.is_disabled = false
      AND a.current_level_percent IS NOT NULL
  );

  -- Count locations with assets
  SELECT COUNT(DISTINCT location_id) INTO locations_with_assets
  FROM ta_agbot_assets
  WHERE is_disabled = false
    AND current_level_percent IS NOT NULL;

  -- Count locations with NULL fill level (no asset data)
  SELECT COUNT(*) INTO locations_with_null
  FROM ta_agbot_locations
  WHERE calibrated_fill_level IS NULL;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'LOCATION FILL LEVEL AUTO-UPDATE ENABLED';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Locations with asset data: %', locations_with_assets;
  RAISE NOTICE 'Locations updated from assets: %', locations_updated;
  RAISE NOTICE 'Locations with NULL (no asset data): %', locations_with_null;
  RAISE NOTICE '';
  RAISE NOTICE 'Trigger created: tr_update_location_fill_from_assets';
  RAISE NOTICE 'Function: update_location_fill_from_assets()';
  RAISE NOTICE '';
  RAISE NOTICE 'Behavior:';
  RAISE NOTICE '  ✓ calibrated_fill_level auto-updates when assets change';
  RAISE NOTICE '  ✓ Uses average of all active assets at location';
  RAISE NOTICE '  ✓ Preserves existing value if no asset data';
  RAISE NOTICE '  ✓ All existing queries continue to work';
  RAISE NOTICE '============================================';
END $$;

