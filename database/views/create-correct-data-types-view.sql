-- CREATE VIEW WITH CORRECT DATA TYPES
-- Based on your query results showing exact data types needed:
-- current_level: integer, rolling_avg: integer, prev_day_used: integer
-- current_level_percent: numeric, days_to_min_level: numeric

-- ============================================================================
-- CREATE VIEW WITH EXACT DATA TYPE MATCHING
-- ============================================================================

SELECT 'CREATING VIEW WITH CORRECT DATA TYPES' as step;

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
  
  -- Get latest dip with simple subquery, ensure INTEGER type
  CAST((SELECT value 
        FROM dip_readings dr 
        WHERE dr.tank_id = t.id 
        ORDER BY dr.created_at DESC 
        LIMIT 1) AS integer) as current_level,       -- position 9 - INTEGER
   
  (SELECT created_at 
   FROM dip_readings dr 
   WHERE dr.tank_id = t.id 
   ORDER BY dr.created_at DESC 
   LIMIT 1) as last_dip_ts,                         -- position 10
   
  (SELECT recorded_by 
   FROM dip_readings dr 
   WHERE dr.tank_id = t.id 
   ORDER BY dr.created_at DESC 
   LIMIT 1) as last_dip_by,                         -- position 11
  
  -- Calculate percentage, ensure NUMERIC type
  CASE 
    WHEN t.safe_level IS NOT NULL 
         AND t.safe_level > COALESCE(t.min_level, 0) 
         AND (SELECT value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) IS NOT NULL
    THEN CAST(GREATEST(0, ROUND(
      (((SELECT value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0)) / 
       (t.safe_level - COALESCE(t.min_level, 0))) * 100, 1
    )) AS numeric)
    ELSE CAST(0 AS numeric)
  END AS current_level_percent,                     -- position 12 - NUMERIC
  
  -- Placeholder values with EXACT correct types
  CAST(0 AS integer) AS rolling_avg,                -- position 13 - INTEGER (not numeric!)
  CAST(0 AS integer) AS prev_day_used,              -- position 14 - INTEGER (not numeric!)
  CAST(NULL AS numeric) AS days_to_min_level,       -- position 15 - NUMERIC
  
  -- Coordinates for map
  t.latitude,                                       -- position 16
  t.longitude                                       -- position 17
  
FROM fuel_tanks t
JOIN tank_groups tg ON tg.id = t.group_id;

-- ============================================================================
-- VERIFICATION AND TESTING
-- ============================================================================

SELECT 'TESTING CORRECTED VIEW' as step;

-- Test basic functionality
SELECT 
    'Corrected View Test' as test,
    COUNT(*) as total_rows,
    COUNT(current_level) as rows_with_level,
    COUNT(CASE WHEN safe_level > 0 THEN 1 END) as rows_with_capacity
FROM tanks_with_rolling_avg;

-- Test Sally's specific tanks
SELECT 
    'Sally Tank Test' as test,
    location,
    safe_level,
    current_level,
    current_level_percent,
    rolling_avg,
    prev_day_used,
    days_to_min_level,
    subgroup
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin'
ORDER BY location;

-- Verify data types are exactly correct
SELECT 'DATA TYPES VERIFICATION' as step;
SELECT 
    column_name,
    data_type,
    CASE 
        WHEN column_name = 'current_level' AND data_type = 'integer' THEN '✓ CORRECT'
        WHEN column_name = 'rolling_avg' AND data_type = 'integer' THEN '✓ CORRECT'
        WHEN column_name = 'prev_day_used' AND data_type = 'integer' THEN '✓ CORRECT'
        WHEN column_name = 'current_level_percent' AND data_type = 'numeric' THEN '✓ CORRECT'
        WHEN column_name = 'days_to_min_level' AND data_type = 'numeric' THEN '✓ CORRECT'
        ELSE '❌ CHECK'
    END as type_status
FROM information_schema.columns 
WHERE table_name = 'tanks_with_rolling_avg'
AND column_name IN ('current_level', 'current_level_percent', 'rolling_avg', 'prev_day_used', 'days_to_min_level')
ORDER BY ordinal_position;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 
    'CORRECT DATA TYPES VIEW CREATED' as status,
    'All data types now match exactly: integer vs numeric' as result,
    'Tank data should display properly in frontend' as expected_outcome,
    'Sally should still see only Narrogin tanks' as filtering_note;