-- ULTRA SIMPLE WORKING VIEW - PHASE 1
-- This creates the absolute minimal view that should work without any 500 errors
-- All complex analytics moved to frontend for speed and accuracy
-- Designed for 281 tanks max with RBAC filtering to 3-160 tanks per user

-- ============================================================================
-- STEP 1: Create minimal view with no complex calculations
-- ============================================================================

SELECT 'CREATING ULTRA SIMPLE VIEW - NO COMPLEX ANALYTICS' as step;

DROP VIEW IF EXISTS public.tanks_with_rolling_avg CASCADE;

CREATE VIEW public.tanks_with_rolling_avg AS
SELECT 
  -- ============================================================================
  -- CORE TANK IDENTIFICATION (Required fields)
  -- ============================================================================
  t.id,
  COALESCE(t.location, 'Unknown Location') as location,
  COALESCE(t.product_type, 'Diesel') as product_type,
  
  -- ============================================================================
  -- TANK CAPACITY (Simple, no complex calculations)
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
  -- CURRENT LEVEL (Single simple subquery only)
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
  -- CURRENT LEVEL PERCENTAGE (Simple calculation only)
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
  
  -- Frontend compatibility duplicate
  CASE
    WHEN COALESCE(t.safe_level, 10000) > COALESCE(t.min_level, 0)
         AND (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) IS NOT NULL
    THEN GREATEST(0, LEAST(100, ROUND(
      (((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0)) /
       (COALESCE(t.safe_level, 10000) - COALESCE(t.min_level, 0))) * 100, 1
    )))
    ELSE 0
  END AS current_level_percent_display,
  
  -- ============================================================================
  -- PLACEHOLDER ANALYTICS (Calculated in frontend for accuracy/speed)
  -- ============================================================================
  0 as rolling_avg_lpd,        -- Frontend will calculate this
  0 as prev_day_used,          -- Frontend will calculate this  
  NULL as days_to_min_level,   -- Frontend will calculate this
  
  -- ============================================================================
  -- MAP AND LOCATION DATA (Frontend needs these)
  -- ============================================================================
  t.latitude,
  t.longitude,
  
  -- ============================================================================
  -- ADDITIONAL TANK DETAILS (Full compatibility)
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
  t.created_at,
  t.updated_at,
  
  -- ============================================================================
  -- CALCULATED FIELDS (Simple calculations only)
  -- ============================================================================
  CASE 
    WHEN COALESCE(t.safe_level, 10000) > COALESCE(t.min_level, 0) 
    THEN COALESCE(t.safe_level, 10000) - COALESCE(t.min_level, 0)
    ELSE NULL
  END as usable_capacity,
  
  -- Legacy field aliases for frontend compatibility
  COALESCE((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1), 0) as latest_dip_value,
  COALESCE((SELECT dr.created_at FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1), t.created_at) as latest_dip_date,
  COALESCE((SELECT dr.recorded_by FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1), 'System') as latest_dip_by

FROM fuel_tanks t
LEFT JOIN tank_groups tg ON tg.id = t.group_id
WHERE t.status = 'active';

-- ============================================================================
-- STEP 2: Grant permissions
-- ============================================================================

GRANT SELECT ON public.tanks_with_rolling_avg TO authenticated;

-- ============================================================================
-- STEP 3: Test the ultra simple view
-- ============================================================================

SELECT 'TESTING ULTRA SIMPLE VIEW' as step;

-- Basic functionality test
SELECT 
    'Basic Data Test' as test,
    COUNT(*) as total_tanks,
    COUNT(current_level) as tanks_with_readings,
    COUNT(CASE WHEN current_level_percent > 0 THEN 1 END) as tanks_with_percentage,
    COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as tanks_with_coordinates
FROM tanks_with_rolling_avg;

-- Specific tank test (look for Narrogin or any available)
SELECT 
    'Tank Data Sample' as test,
    location,
    current_level,
    current_level_percent,
    current_level_percent_display,
    rolling_avg_lpd as rolling_avg_placeholder,
    prev_day_used as prev_day_placeholder,
    days_to_min_level as days_to_min_placeholder,
    usable_capacity,
    group_name,
    subgroup,
    CASE 
        WHEN current_level > 0 AND current_level_percent > 0 THEN '✅ Basic Data Working'
        WHEN current_level > 0 THEN '⚠️ Level OK, Percentage Issue'
        ELSE '❓ No Readings'
    END as status
FROM tanks_with_rolling_avg
WHERE subgroup LIKE '%Narrogin%' OR location LIKE '%Narrogin%' OR subgroup IS NOT NULL
ORDER BY location
LIMIT 5;

-- RBAC test - make sure group filtering will work
SELECT 
    'RBAC Test' as test,
    group_name,
    subgroup,
    COUNT(*) as tank_count
FROM tanks_with_rolling_avg
GROUP BY group_name, subgroup
ORDER BY tank_count DESC
LIMIT 10;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'ULTRA SIMPLE VIEW CREATED SUCCESSFULLY' as status;
SELECT 'No complex analytics - all moved to frontend' as approach;
SELECT 'Should work without 500 errors for 281 tanks' as capacity;
SELECT 'Rolling avg, prev day usage, days to min = placeholders' as note;
SELECT 'Next step: Implement analytics calculations in useTanks.ts' as next_step;