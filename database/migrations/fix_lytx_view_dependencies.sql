-- Fix LYTX View Dependencies Migration
-- Purpose: Update lytx_events_driver_enriched view to use foreign keys while handling dependent views
-- Date: 2025-08-21

-- Step 1: Drop dependent views first
DROP VIEW IF EXISTS depot_manager_overview;

-- Step 2: Drop and recreate the main enriched view with foreign key support
DROP VIEW IF EXISTS lytx_events_driver_enriched;

CREATE OR REPLACE VIEW lytx_events_driver_enriched AS
SELECT
  e.*,
  
  -- Vehicle resolution (unchanged from original)
  v.id as vehicle_id,
  COALESCE(NULLIF(e.vehicle_registration,''), v.registration) as resolved_registration,
  v.fleet as resolved_fleet,
  v.depot as resolved_depot,
  
  -- Driver resolution using foreign key (preferred) or fallback to name matching
  COALESCE(
    e.driver_id,                                    -- 1st priority: direct foreign key
    dm.driver_id,                                   -- 2nd priority: explicit name mapping
    d.id                                            -- 3rd priority: fuzzy name match
  ) as resolved_driver_id,
  
  -- Driver details from resolved driver
  CASE 
    WHEN e.driver_id IS NOT NULL THEN dr.full_name
    WHEN dm.driver_id IS NOT NULL THEN dm_dr.full_name
    ELSE d.full_name
  END as resolved_driver_name,
  
  CASE 
    WHEN e.driver_id IS NOT NULL THEN dr.fleet
    WHEN dm.driver_id IS NOT NULL THEN dm_dr.fleet
    ELSE d.fleet
  END as resolved_driver_fleet,
  
  CASE 
    WHEN e.driver_id IS NOT NULL THEN dr.depot
    WHEN dm.driver_id IS NOT NULL THEN dm_dr.depot
    ELSE d.depot
  END as resolved_driver_depot,
  
  -- Association metadata (new fields)
  e.driver_association_confidence,
  e.driver_association_method,
  e.driver_association_updated_at,
  
  -- Resolution method indicator (new field)
  CASE 
    WHEN e.driver_id IS NOT NULL THEN 'foreign_key'
    WHEN dm.driver_id IS NOT NULL THEN 'name_mapping'
    WHEN d.id IS NOT NULL THEN 'fuzzy_match'
    ELSE 'unresolved'
  END as driver_resolution_method

FROM lytx_safety_events e

-- Vehicle joins (unchanged)
LEFT JOIN vehicles v
  ON UPPER(e.vehicle_registration) = UPPER(v.registration)
  OR (e.device_serial IS NOT NULL AND e.device_serial = v.lytx_device)

-- Driver joins using foreign key (NEW - primary method)
LEFT JOIN drivers dr ON e.driver_id = dr.id

-- Driver name mappings (fallback method)
LEFT JOIN driver_name_mappings dm
  ON LOWER(e.driver_name) = LOWER(dm.mapped_name) 
  AND dm.system_name = 'LYTX'
LEFT JOIN drivers dm_dr ON dm.driver_id = dm_dr.id

-- Fuzzy driver name matching (final fallback)
LEFT JOIN drivers d
  ON LOWER(e.driver_name) = LOWER(d.full_name) 
  AND (v.fleet IS NULL OR d.fleet = v.fleet)
  AND e.driver_id IS NULL  -- Only if no foreign key exists
  AND dm.driver_id IS NULL; -- Only if no name mapping exists

-- Step 3: Recreate the dependent depot_manager_overview view
CREATE OR REPLACE VIEW depot_manager_overview AS
WITH recent_lytx AS (
  SELECT resolved_fleet AS fleet, COALESCE(resolved_depot, depot) AS depot,
         COUNT(*) AS lytx_events_30d
  FROM lytx_events_driver_enriched
  WHERE event_datetime >= now() - INTERVAL '30 days'
  GROUP BY resolved_fleet, COALESCE(resolved_depot, depot)
)
SELECT
  v.fleet,
  v.depot,
  COUNT(DISTINCT v.id)::int AS total_vehicles,
  COUNT(DISTINCT CASE WHEN v.status = 'Active' THEN v.id END)::int AS active_vehicles,
  COUNT(DISTINCT d.id)::int AS total_drivers,
  COALESCE(r.lytx_events_30d, 0)::int AS lytx_events_30d
FROM vehicles v
LEFT JOIN drivers d ON d.fleet = v.fleet AND d.depot = v.depot
LEFT JOIN recent_lytx r ON r.fleet = v.fleet AND r.depot = v.depot
GROUP BY v.fleet, v.depot, r.lytx_events_30d
ORDER BY v.fleet, v.depot;

-- Step 4: Add comments for documentation
COMMENT ON VIEW lytx_events_driver_enriched IS 'Enhanced LYTX safety events with resolved vehicle and driver relationships using foreign keys, name mappings, and fuzzy matching as fallbacks. Updated to use driver_id foreign key as primary resolution method.';

COMMENT ON VIEW depot_manager_overview IS 'Depot manager overview with vehicle, driver, and LYTX event counts for the last 30 days. Depends on lytx_events_driver_enriched view.';

-- Step 5: Grant permissions
GRANT SELECT ON lytx_events_driver_enriched TO authenticated;
GRANT SELECT ON depot_manager_overview TO authenticated;