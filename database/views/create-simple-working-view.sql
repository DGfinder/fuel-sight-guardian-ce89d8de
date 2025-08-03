-- CREATE SIMPLE WORKING VIEW - GET BASIC DATA SHOWING
-- This creates a minimal tanks_with_rolling_avg view that should show tank capacity,
-- location, and basic info without complex CTEs that might be broken

-- ============================================================================
-- STEP 1: CREATE MINIMAL WORKING VIEW
-- ============================================================================

SELECT 'CREATING SIMPLE WORKING VIEW' as step;

CREATE OR REPLACE VIEW public.tanks_with_rolling_avg AS
SELECT
  t.id,                                     -- position 1
  t.location,                               -- position 2  
  t.product_type,                           -- position 3
  t.safe_level,                             -- position 4
  COALESCE(t.min_level, 0) as min_level,    -- position 5
  t.group_id,                               -- position 6
  tg.name AS group_name,                    -- position 7
  t.subgroup,                               -- position 8
  
  -- Try to get latest dip with simple subquery instead of CTE
  (SELECT value 
   FROM dip_readings dr 
   WHERE dr.tank_id = t.id 
   ORDER BY dr.created_at DESC 
   LIMIT 1) as current_level,               -- position 9
   
  (SELECT created_at 
   FROM dip_readings dr 
   WHERE dr.tank_id = t.id 
   ORDER BY dr.created_at DESC 
   LIMIT 1) as last_dip_ts,                 -- position 10
   
  (SELECT recorded_by 
   FROM dip_readings dr 
   WHERE dr.tank_id = t.id 
   ORDER BY dr.created_at DESC 
   LIMIT 1) as last_dip_by,                 -- position 11
  
  -- Calculate percentage if we have current level and safe level
  CASE 
    WHEN t.safe_level IS NOT NULL 
         AND t.safe_level > COALESCE(t.min_level, 0) 
         AND (SELECT value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) IS NOT NULL
    THEN GREATEST(0, ROUND(
      (((SELECT value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0)) / 
       (t.safe_level - COALESCE(t.min_level, 0))) * 100, 1
    ))
    ELSE 0
  END AS current_level_percent,             -- position 12
  
  -- Placeholder values for now (will add back complex calculations later)
  0 AS rolling_avg,                         -- position 13
  0 AS prev_day_used,                       -- position 14
  NULL AS days_to_min_level,                -- position 15
  
  -- Coordinates for map
  t.latitude,                               -- position 16
  t.longitude                               -- position 17
  
FROM fuel_tanks t
JOIN tank_groups tg ON tg.id = t.group_id;

-- ============================================================================
-- STEP 2: TEST THE SIMPLE VIEW
-- ============================================================================

SELECT 'TESTING SIMPLE VIEW' as step;

-- Test basic functionality
SELECT 
    'Simple View Test' as test,
    COUNT(*) as total_rows,
    COUNT(current_level) as rows_with_level,
    COUNT(CASE WHEN safe_level > 0 THEN 1 END) as rows_with_capacity
FROM tanks_with_rolling_avg;

-- Test Sally's specific tanks
SELECT 
    'Sally Tank Test' as test,
    location,
    safe_level,
    min_level,
    current_level,
    current_level_percent,
    subgroup
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin'
ORDER BY location;

-- Test if frontend will get data now
SELECT 
    'Frontend Data Test' as test,
    id,
    location,
    product_type,
    safe_level as safe_fill,  -- frontend might expect this name
    current_level,
    current_level_percent,
    group_name,
    subgroup,
    latitude,
    longitude
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin'
LIMIT 3;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 
    'SIMPLE VIEW CREATED' as status,
    'Tank capacity and basic data should now show' as result,
    'Complex calculations temporarily simplified' as note,
    'Sally filtering should be preserved' as permissions_note;