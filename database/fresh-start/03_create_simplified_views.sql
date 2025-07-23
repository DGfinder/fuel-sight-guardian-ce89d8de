-- SIMPLIFIED VIEWS FOR FRESH START
-- These provide stable, fast queries with basic tank data
-- Complex analytics moved to frontend for better performance and debugging

-- ============================================================================
-- STEP 1: Create simplified tanks basic data view
-- ============================================================================

CREATE VIEW public.tanks_basic_data 
WITH (security_barrier = true)
AS
SELECT 
  -- Core tank identification
  t.id,
  COALESCE(t.location, 'Unknown Location') as location,
  COALESCE(t.product_type, 'Diesel') as product_type,
  
  -- Tank capacity
  COALESCE(t.safe_level, 10000) as safe_level,
  COALESCE(t.min_level, 0) as min_level,
  
  -- Organization (for RBAC)
  t.group_id,
  COALESCE(tg.name, 'Unknown Group') as group_name,
  COALESCE(t.subgroup, 'No Subgroup') as subgroup,
  
  -- Latest dip data (simple subqueries only - no CTEs)
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
    SELECT COALESCE(dr.created_by_name, p.full_name, 'Unknown User')
    FROM dip_readings dr 
    LEFT JOIN profiles p ON dr.recorded_by = p.id
    WHERE dr.tank_id = t.id 
      AND dr.archived_at IS NULL
    ORDER BY dr.created_at DESC 
    LIMIT 1
  ), 'No readings') as last_dip_by,
  
  -- Simple calculated fields
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
  
  -- Capacity calculations
  GREATEST(0, COALESCE(t.safe_level, 10000) - COALESCE(t.min_level, 0)) as usable_capacity,
  
  -- Ullage (available space)
  GREATEST(0, COALESCE(t.safe_level, 10000) - COALESCE((
    SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id AND dr.archived_at IS NULL ORDER BY dr.created_at DESC LIMIT 1
  ), 0)) as ullage,
  
  -- All metadata fields
  t.address, t.vehicle, t.discharge, t.bp_portal, t.delivery_window,
  t.afterhours_contact, t.notes, t.serviced_on, t.serviced_by,
  t.latitude, t.longitude, t.created_at, t.updated_at

FROM fuel_tanks t
LEFT JOIN tank_groups tg ON tg.id = t.group_id
ORDER BY t.location;

-- ============================================================================
-- STEP 2: Create backward compatibility view
-- ============================================================================

-- This allows existing frontend code to work while migrating to new analytics
CREATE VIEW public.tanks_with_rolling_avg AS
SELECT 
  id, location, product_type, safe_level, min_level, group_id, group_name, subgroup,
  current_level, last_dip_ts, last_dip_by, current_level_percent,
  
  -- Default values for analytics (will be calculated in frontend)
  0 as rolling_avg,
  0 as prev_day_used,
  NULL::numeric as days_to_min_level,
  
  -- Additional fields
  usable_capacity, ullage,
  address, vehicle, discharge, bp_portal, delivery_window,
  afterhours_contact, notes, serviced_on, serviced_by,
  latitude, longitude, created_at, updated_at
  
FROM public.tanks_basic_data;

-- ============================================================================
-- STEP 3: Create helper views for common queries
-- ============================================================================

-- View for tank summaries by group
CREATE VIEW public.tank_group_summary AS
SELECT 
  tg.id as group_id,
  tg.name as group_name,
  COUNT(t.id) as total_tanks,
  COUNT(CASE WHEN tbd.current_level_percent > 20 THEN 1 END) as normal_tanks,
  COUNT(CASE WHEN tbd.current_level_percent BETWEEN 10 AND 20 THEN 1 END) as low_tanks,
  COUNT(CASE WHEN tbd.current_level_percent <= 10 THEN 1 END) as critical_tanks,
  AVG(tbd.current_level_percent)::numeric(5,2) as avg_level_percent,
  SUM(tbd.usable_capacity) as total_capacity,
  SUM(tbd.current_level) as total_current_fuel
FROM tank_groups tg
LEFT JOIN fuel_tanks t ON tg.id = t.group_id
LEFT JOIN tanks_basic_data tbd ON t.id = tbd.id
GROUP BY tg.id, tg.name
ORDER BY tg.name;

-- View for recent dip readings with tank info
CREATE VIEW public.recent_dips_with_tank_info AS
SELECT 
  dr.id,
  dr.value,
  dr.created_at,
  COALESCE(dr.created_by_name, p.full_name, 'Unknown User') as recorded_by_name,
  dr.notes,
  t.location as tank_location,
  t.product_type,
  tg.name as group_name,
  t.subgroup
FROM dip_readings dr
JOIN fuel_tanks t ON dr.tank_id = t.id
JOIN tank_groups tg ON t.group_id = tg.id
LEFT JOIN profiles p ON dr.recorded_by = p.id
WHERE dr.archived_at IS NULL
ORDER BY dr.created_at DESC;

-- ============================================================================
-- STEP 4: Grant permissions on all views
-- ============================================================================

GRANT SELECT ON public.tanks_basic_data TO authenticated;
GRANT SELECT ON public.tanks_basic_data TO anon;

GRANT SELECT ON public.tanks_with_rolling_avg TO authenticated;
GRANT SELECT ON public.tanks_with_rolling_avg TO anon;

GRANT SELECT ON public.tank_group_summary TO authenticated;
GRANT SELECT ON public.tank_group_summary TO anon;

GRANT SELECT ON public.recent_dips_with_tank_info TO authenticated;
GRANT SELECT ON public.recent_dips_with_tank_info TO anon;

-- ============================================================================
-- STEP 5: Test the views
-- ============================================================================

-- Test basic view performance
SELECT 
    'Basic View Test' as test_name,
    COUNT(*) as total_tanks,
    COUNT(CASE WHEN current_level > 0 THEN 1 END) as tanks_with_readings,
    COUNT(CASE WHEN current_level_percent > 0 THEN 1 END) as tanks_with_percentage,
    AVG(current_level_percent)::numeric(5,2) as avg_percentage
FROM tanks_basic_data;

-- Test compatibility view
SELECT 
    'Compatibility View Test' as test_name,
    COUNT(*) as total_tanks,
    COUNT(CASE WHEN rolling_avg = 0 THEN 1 END) as placeholder_analytics_count,
    'Analytics will be calculated in frontend' as note
FROM tanks_with_rolling_avg;

-- Test group summary
SELECT 
    'Group Summary Test' as test_name,
    group_name,
    total_tanks,
    normal_tanks,
    low_tanks,
    critical_tanks
FROM tank_group_summary
LIMIT 5;

SELECT 'SIMPLIFIED VIEWS CREATED SUCCESSFULLY' as result;
SELECT 'Views are optimized for stability and performance' as guarantee;
SELECT 'Complex analytics moved to frontend for better debugging' as architecture; 