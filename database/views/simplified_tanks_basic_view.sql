-- SIMPLIFIED TANKS BASIC DATA VIEW
-- This view provides only essential tank data without complex analytics
-- All rolling averages and consumption calculations moved to frontend
-- Designed for maximum stability and performance

-- ============================================================================
-- STEP 1: Create simplified basic data view
-- ============================================================================

SELECT 'CREATING SIMPLIFIED TANKS BASIC DATA VIEW' as step;

DROP VIEW IF EXISTS public.tanks_basic_data CASCADE;

CREATE VIEW public.tanks_basic_data 
WITH (security_barrier = true)
AS
SELECT 
  -- ============================================================================
  -- CORE TANK IDENTIFICATION
  -- ============================================================================
  t.id,
  COALESCE(t.location, 'Unknown Location') as location,
  COALESCE(t.product_type, 'Diesel') as product_type, -- Frontend expects product_type
  
  -- ============================================================================
  -- TANK CAPACITY (Basic fields only)
  -- ============================================================================
  COALESCE(t.safe_level, 10000) as safe_level, -- Frontend expects safe_level
  COALESCE(t.min_level, 0) as min_level,
  
  -- ============================================================================
  -- ORGANIZATION (Required for RBAC)
  -- ============================================================================
  t.group_id,
  COALESCE(tg.name, 'Unknown Group') as group_name,
  COALESCE(t.subgroup, 'No Subgroup') as subgroup,
  
  -- ============================================================================
  -- LATEST DIP DATA (Simple subqueries only)
  -- ============================================================================
  COALESCE((
    SELECT dr.value 
    FROM dip_readings dr 
    WHERE dr.tank_id = t.id 
      AND dr.archived_at IS NULL
    ORDER BY dr.created_at DESC 
    LIMIT 1
  ), 0) as current_level,
  
  (SELECT dr.created_at 
   FROM dip_readings dr 
   WHERE dr.tank_id = t.id 
     AND dr.archived_at IS NULL
   ORDER BY dr.created_at DESC 
   LIMIT 1) as last_dip_ts,
   
  COALESCE((
    SELECT dr.recorded_by::text
    FROM dip_readings dr 
    WHERE dr.tank_id = t.id 
      AND dr.archived_at IS NULL
    ORDER BY dr.created_at DESC 
    LIMIT 1
  ), 'No readings') as last_dip_by,
  
  -- ============================================================================
  -- SIMPLE CALCULATED FIELDS (Frontend compatible)
  -- ============================================================================
  
  -- Current level percentage (simple calculation)
  CASE 
    WHEN t.safe_level IS NOT NULL 
         AND t.safe_level > COALESCE(t.min_level, 0)
         AND (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id AND dr.archived_at IS NULL ORDER BY dr.created_at DESC LIMIT 1) IS NOT NULL
    THEN GREATEST(0, LEAST(100, ROUND(
      (((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id AND dr.archived_at IS NULL ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0))::numeric / 
       (t.safe_level - COALESCE(t.min_level, 0))::numeric) * 100, 1
    )))
    ELSE 0
  END AS current_level_percent,
  
  -- Usable capacity
  GREATEST(0, COALESCE(t.safe_level, 10000) - COALESCE(t.min_level, 0)) as usable_capacity,
  
  -- Ullage (available space)
  GREATEST(0, COALESCE(t.safe_level, 10000) - COALESCE((
    SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id AND dr.archived_at IS NULL ORDER BY dr.created_at DESC LIMIT 1
  ), 0)) as ullage,
  
  -- ============================================================================
  -- METADATA (All tank properties for frontend)
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
ORDER BY t.location;

-- ============================================================================
-- STEP 2: Grant permissions
-- ============================================================================

SELECT 'GRANTING PERMISSIONS ON SIMPLIFIED VIEW' as step;

GRANT SELECT ON public.tanks_basic_data TO authenticated;
GRANT SELECT ON public.tanks_basic_data TO anon;

-- ============================================================================
-- STEP 3: Test the simplified view
-- ============================================================================

SELECT 'TESTING SIMPLIFIED VIEW' as step;

-- Test basic functionality
SELECT 
    'Basic View Test' as test_name,
    COUNT(*) as total_tanks,
    COUNT(CASE WHEN current_level > 0 THEN 1 END) as tanks_with_readings,
    COUNT(CASE WHEN current_level_percent > 0 THEN 1 END) as tanks_with_percentage,
    AVG(current_level_percent) as avg_percentage
FROM tanks_basic_data;

-- Test GSFS Narrogin specifically
SELECT 
    'GSFS Narrogin Test' as test_name,
    location,
    product_type,
    safe_level,
    current_level,
    current_level_percent,
    usable_capacity,
    ullage,
    subgroup,
    CASE 
        WHEN current_level_percent > 0 THEN '✅ WORKING'
        WHEN current_level_percent = 0 AND current_level > 0 THEN '⚠️ CALCULATION ISSUE'
        ELSE '❌ NO DATA'
    END as status
FROM tanks_basic_data
WHERE subgroup = 'GSFS Narrogin'
ORDER BY location;

SELECT 'SIMPLIFIED VIEW CREATED SUCCESSFULLY' as result;
SELECT 'All complex analytics should now be moved to frontend hooks' as next_step; 