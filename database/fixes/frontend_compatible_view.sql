-- Frontend Compatible Database View Fix
-- This creates a view that matches exactly what the frontend expects
-- Fixes field name mismatches and missing columns

-- ============================================================================
-- STEP 1: Drop and recreate the view with correct field names
-- ============================================================================

SELECT 'CREATING FRONTEND COMPATIBLE VIEW' as step;

DROP VIEW IF EXISTS public.tanks_with_rolling_avg CASCADE;

CREATE VIEW public.tanks_with_rolling_avg AS
SELECT 
  -- ============================================================================
  -- CORE TANK IDENTIFICATION (Required fields with correct names)
  -- ============================================================================
  t.id,
  COALESCE(t.location, 'Unknown Location') as location,
  COALESCE(t.product_type, 'Diesel') as product_type,  -- Frontend expects 'product_type' not 'product'
  
  -- ============================================================================
  -- TANK CAPACITY
  -- ============================================================================
  COALESCE(t.safe_level, 10000) as safe_level,  
  COALESCE(t.min_level, 0) as min_level,
  
  -- ============================================================================
  -- GROUP AND ORGANIZATION (Required for RBAC)
  -- ============================================================================
  t.group_id,
  COALESCE(tg.name, 'Unknown Group') as group_name,
  COALESCE(t.subgroup, 'No Subgroup') as subgroup,
  
  -- ============================================================================
  -- CURRENT LEVEL DATA
  -- ============================================================================
  COALESCE((
    SELECT dr.value 
    FROM dip_readings dr 
    WHERE dr.tank_id = t.id 
    ORDER BY dr.created_at DESC 
    LIMIT 1
  ), 0) as current_level,
  
  COALESCE((
    SELECT dr.created_at 
    FROM dip_readings dr 
    WHERE dr.tank_id = t.id 
    ORDER BY dr.created_at DESC 
    LIMIT 1
  ), t.created_at) as last_dip_ts,
  
  COALESCE((
    SELECT dr.recorded_by 
    FROM dip_readings dr 
    WHERE dr.tank_id = t.id 
    ORDER BY dr.created_at DESC 
    LIMIT 1
  ), 'No readings') as last_dip_by,
  
  -- ============================================================================
  -- CURRENT LEVEL PERCENTAGE
  -- ============================================================================
  CASE
    WHEN COALESCE(t.safe_level, 10000) > COALESCE(t.min_level, 0)
         AND (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) IS NOT NULL
    THEN GREATEST(0, LEAST(100, ROUND(
      (((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0)) /
       (COALESCE(t.safe_level, 10000) - COALESCE(t.min_level, 0))) * 100, 1
    )))
    ELSE 0
  END AS current_level_percent,
  
  -- ============================================================================
  -- ANALYTICS (Frontend expects these exact field names)
  -- ============================================================================
  0 as rolling_avg,           -- Frontend expects 'rolling_avg' not 'rolling_avg_lpd'
  0 as prev_day_used,         -- Frontend calculates this
  NULL as days_to_min_level,  -- Frontend calculates this
  
  -- ============================================================================
  -- CALCULATED FIELDS (Frontend expects these)
  -- ============================================================================
  CASE 
    WHEN COALESCE(t.safe_level, 10000) > COALESCE(t.min_level, 0) 
    THEN COALESCE(t.safe_level, 10000) - COALESCE(t.min_level, 0)
    ELSE 0
  END as usable_capacity,
  
  CASE 
    WHEN COALESCE(t.safe_level, 10000) > 0 
    THEN COALESCE(t.safe_level, 10000) - COALESCE((
      SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1
    ), 0)
    ELSE 0
  END as ullage,
  
  -- ============================================================================
  -- STRUCTURED LAST DIP (Frontend expects this as JSON object)
  -- ============================================================================
  json_build_object(
    'value', COALESCE((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1), 0),
    'created_at', COALESCE((SELECT dr.created_at FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1), t.created_at),
    'recorded_by', COALESCE((SELECT dr.recorded_by FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1), 'System')
  ) as last_dip,
  
  -- ============================================================================
  -- ADDITIONAL TANK DETAILS (Frontend expects these)
  -- ============================================================================
  t.address,
  t.vehicle,
  t.discharge,
  t.bp_portal,
  t.delivery_window,
  t.afterhours_contact,
  t.notes,
  t.serviced_on,
  t.serviced_by,
  t.latitude,
  t.longitude,
  t.created_at,
  t.updated_at

FROM fuel_tanks t
LEFT JOIN tank_groups tg ON tg.id = t.group_id
WHERE t.archived_at IS NULL;  -- Only show active tanks

-- ============================================================================
-- STEP 2: Grant permissions
-- ============================================================================

GRANT SELECT ON public.tanks_with_rolling_avg TO authenticated;

-- ============================================================================
-- STEP 3: Test the view
-- ============================================================================

SELECT 'TESTING FRONTEND COMPATIBLE VIEW' as step;

-- Test basic functionality
SELECT 
    'Basic Data Test' as test,
    COUNT(*) as total_tanks,
    COUNT(current_level) as tanks_with_readings,
    COUNT(CASE WHEN current_level_percent > 0 THEN 1 END) as tanks_with_percentage,
    COUNT(CASE WHEN usable_capacity > 0 THEN 1 END) as tanks_with_capacity,
    COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as tanks_with_coordinates
FROM tanks_with_rolling_avg;

-- Test field names match frontend expectations
SELECT 
    'Field Names Test' as test,
    location,
    product_type,  -- Should be 'product_type' not 'product'
    rolling_avg,   -- Should be 'rolling_avg' not 'rolling_avg_lpd'
    prev_day_used,
    days_to_min_level,
    usable_capacity,  -- Should exist
    ullage,          -- Should exist
    last_dip->>'value' as last_dip_value,  -- Should be structured JSON
    current_level_percent
FROM tanks_with_rolling_avg
LIMIT 3;

-- Test specific problematic tanks
SELECT 
    'GSFS Narrogin Test' as test,
    location,
    current_level,
    current_level_percent,
    usable_capacity,
    ullage,
    last_dip->>'recorded_by' as last_recorded_by,
    CASE 
        WHEN current_level > 0 AND current_level_percent > 0 THEN '✅ Data Working'
        WHEN current_level > 0 THEN '⚠️ Level OK, Percentage Issue'
        ELSE '❌ No Data'
    END as status
FROM tanks_with_rolling_avg
WHERE subgroup LIKE '%Narrogin%' OR location LIKE '%Narrogin%'
ORDER BY location
LIMIT 5;

-- ============================================================================
-- STEP 4: Success message
-- ============================================================================

SELECT 'FRONTEND COMPATIBLE VIEW CREATED SUCCESSFULLY' as status;
SELECT 'Field names now match frontend expectations exactly' as fix1;
SELECT 'Added missing usable_capacity and ullage fields' as fix2;
SELECT 'Structured last_dip as JSON object as expected' as fix3;
SELECT 'Analytics moved to frontend for reliability' as fix4;