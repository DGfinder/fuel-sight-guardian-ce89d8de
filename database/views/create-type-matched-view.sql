-- CREATE TYPE-MATCHED SIMPLE VIEW
-- This matches the exact data types of the existing view to avoid type change errors

-- ============================================================================
-- STEP 1: CREATE VIEW WITH EXACT TYPE MATCHING
-- ============================================================================

SELECT 'CREATING TYPE-MATCHED SIMPLE VIEW' as step;

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
  
  -- Get latest dip with simple subquery, ensure numeric type
  CAST((SELECT value 
        FROM dip_readings dr 
        WHERE dr.tank_id = t.id 
        ORDER BY dr.created_at DESC 
        LIMIT 1) AS numeric) as current_level,     -- position 9
   
  (SELECT created_at 
   FROM dip_readings dr 
   WHERE dr.tank_id = t.id 
   ORDER BY dr.created_at DESC 
   LIMIT 1) as last_dip_ts,                       -- position 10
   
  (SELECT recorded_by 
   FROM dip_readings dr 
   WHERE dr.tank_id = t.id 
   ORDER BY dr.created_at DESC 
   LIMIT 1) as last_dip_by,                       -- position 11
  
  -- Calculate percentage, ensure numeric type
  CASE 
    WHEN t.safe_level IS NOT NULL 
         AND t.safe_level > COALESCE(t.min_level, 0) 
         AND (SELECT value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) IS NOT NULL
    THEN CAST(GREATEST(0, ROUND(
      (((SELECT value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0)) / 
       (t.safe_level - COALESCE(t.min_level, 0))) * 100, 1
    )) AS numeric)
    ELSE CAST(0 AS numeric)
  END AS current_level_percent,                   -- position 12
  
  -- Placeholder values with correct types
  CAST(0 AS numeric) AS rolling_avg,              -- position 13 - NUMERIC type
  CAST(0 AS numeric) AS prev_day_used,            -- position 14 - NUMERIC type  
  CAST(NULL AS numeric) AS days_to_min_level,     -- position 15 - NUMERIC type (not text!)
  
  -- Coordinates for map
  t.latitude,                                     -- position 16
  t.longitude                                     -- position 17
  
FROM fuel_tanks t
JOIN tank_groups tg ON tg.id = t.group_id;

-- ============================================================================
-- STEP 2: TEST THE TYPE-MATCHED VIEW
-- ============================================================================

SELECT 'TESTING TYPE-MATCHED VIEW' as step;

-- Test basic functionality
SELECT 
    'Type-Matched View Test' as test,
    COUNT(*) as total_rows,
    COUNT(current_level) as rows_with_level,
    COUNT(CASE WHEN safe_level > 0 THEN 1 END) as rows_with_capacity
FROM tanks_with_rolling_avg;

-- Test Sally's specific tanks with data types
SELECT 
    'Sally Tank Data Types Test' as test,
    location,
    safe_level,
    current_level,
    current_level_percent,
    rolling_avg,
    days_to_min_level,
    subgroup
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin'
ORDER BY location;

-- Verify data types are correct
SELECT 'DATA TYPES VERIFICATION' as step;
SELECT 
    column_name,
    data_type,
    'Should match original view types' as note
FROM information_schema.columns 
WHERE table_name = 'tanks_with_rolling_avg'
AND column_name IN ('current_level', 'current_level_percent', 'rolling_avg', 'days_to_min_level')
ORDER BY ordinal_position;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 
    'TYPE-MATCHED VIEW CREATED' as status,
    'All data types should now match existing view' as result,
    'Tank data should display without type errors' as expected_outcome;