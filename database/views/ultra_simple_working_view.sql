-- ULTRA SIMPLE WORKING VIEW 
-- Absolute minimum complexity to get analytics working
-- No window functions, minimal JOINs, basic calculations only

-- ============================================================================
-- STEP 1: Create ultra-simple view that should definitely work
-- ============================================================================

SELECT 'CREATING ULTRA SIMPLE VIEW' as step;

DROP VIEW IF EXISTS tanks_with_rolling_avg CASCADE;

CREATE OR REPLACE VIEW tanks_with_rolling_avg AS
SELECT 
  t.id,
  t.location,
  t.product_type,
  t.safe_level,
  COALESCE(t.min_level, 0) as min_level,
  t.group_id,
  tg.name AS group_name,
  t.subgroup,
  
  -- Current level (simple subquery)
  (SELECT dr.value 
   FROM dip_readings dr 
   WHERE dr.tank_id = t.id 
   ORDER BY dr.created_at DESC 
   LIMIT 1) as current_level,
   
  (SELECT dr.created_at 
   FROM dip_readings dr 
   WHERE dr.tank_id = t.id 
   ORDER BY dr.created_at DESC 
   LIMIT 1) as last_dip_ts,
   
  (SELECT dr.recorded_by 
   FROM dip_readings dr 
   WHERE dr.tank_id = t.id 
   ORDER BY dr.created_at DESC 
   LIMIT 1) as last_dip_by,
  
  -- Current level percentage (simple calculation)
  CASE
    WHEN t.safe_level IS NOT NULL AND t.safe_level > COALESCE(t.min_level, 0)
         AND (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) IS NOT NULL
    THEN GREATEST(0, ROUND(
      (((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0)) /
       (t.safe_level - COALESCE(t.min_level, 0))) * 100, 1
    ))
    ELSE 0
  END AS current_level_percent,
  
  -- Duplicate for frontend compatibility
  CASE
    WHEN t.safe_level IS NOT NULL AND t.safe_level > COALESCE(t.min_level, 0)
         AND (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) IS NOT NULL
    THEN GREATEST(0, ROUND(
      (((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0)) /
       (t.safe_level - COALESCE(t.min_level, 0))) * 100, 1
    ))
    ELSE 0
  END AS current_level_percent_display,
  
  -- SUPER SIMPLE rolling average - just average of last few readings
  COALESCE((
    SELECT ROUND(AVG(consumption_amount)::numeric, 0)
    FROM (
      SELECT (latest.value - earlier.value) as consumption_amount
      FROM (
        SELECT dr1.value, dr1.created_at
        FROM dip_readings dr1
        WHERE dr1.tank_id = t.id
        ORDER BY dr1.created_at DESC
        LIMIT 5
      ) latest
      CROSS JOIN (
        SELECT dr2.value, dr2.created_at
        FROM dip_readings dr2
        WHERE dr2.tank_id = t.id
        ORDER BY dr2.created_at DESC
        OFFSET 1 LIMIT 5
      ) earlier
      WHERE latest.created_at > earlier.created_at
        AND latest.value < earlier.value  -- Only consumption
        AND (earlier.value - latest.value) BETWEEN 100 AND 5000  -- Reasonable range
      LIMIT 3
    ) simple_consumption
  ), 0) as rolling_avg_lpd,
  
  -- SUPER SIMPLE previous day - just most recent consumption
  COALESCE((
    SELECT (older.value - newer.value)
    FROM (SELECT dr.value, dr.created_at FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) newer
    CROSS JOIN (SELECT dr.value, dr.created_at FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC OFFSET 1 LIMIT 1) older
    WHERE newer.value < older.value
      AND (older.value - newer.value) BETWEEN 50 AND 8000
  ), 0) as prev_day_used,
  
  -- SUPER SIMPLE days to minimum - basic division
  CASE 
    WHEN (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) > COALESCE(t.min_level, 0)
    THEN 
      CASE 
        WHEN COALESCE((
          SELECT (older.value - newer.value)
          FROM (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) newer
          CROSS JOIN (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC OFFSET 1 LIMIT 1) older
          WHERE newer.value < older.value AND (older.value - newer.value) > 0
        ), 0) > 0
        THEN ROUND(
          ((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0)) / 
          COALESCE((
            SELECT (older.value - newer.value)
            FROM (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) newer
            CROSS JOIN (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC OFFSET 1 LIMIT 1) older
            WHERE newer.value < older.value AND (older.value - newer.value) > 0
          ), 1000)  -- Default to 1000L/day if no data
        , 1)
        ELSE NULL
      END
    ELSE NULL
  END as days_to_min_level,
  
  -- Basic additional fields
  t.latitude,
  t.longitude

FROM fuel_tanks t
LEFT JOIN tank_groups tg ON tg.id = t.group_id;

-- Grant permissions
GRANT SELECT ON public.tanks_with_rolling_avg TO authenticated;

-- ============================================================================
-- STEP 2: Test the ultra simple view
-- ============================================================================

SELECT 'TESTING ULTRA SIMPLE VIEW' as step;

-- Basic test
SELECT 
    'Ultra Simple Test' as test,
    COUNT(*) as total_tanks,
    COUNT(current_level) as tanks_with_readings,
    AVG(CASE WHEN rolling_avg_lpd > 0 THEN rolling_avg_lpd END) as avg_rolling_avg,
    AVG(CASE WHEN prev_day_used > 0 THEN prev_day_used END) as avg_prev_day_used
FROM tanks_with_rolling_avg;

-- Specific tank test
SELECT 
    'Analytics Test' as test,
    location,
    current_level,
    current_level_percent,
    rolling_avg_lpd,
    prev_day_used,
    days_to_min_level,
    CASE 
        WHEN rolling_avg_lpd > 0 OR prev_day_used > 0 THEN '✅ Has Some Analytics'
        ELSE '⚠️ No Analytics Data'
    END as status
FROM tanks_with_rolling_avg
WHERE subgroup LIKE '%Narrogin%' OR location LIKE '%Narrogin%'
LIMIT 3;

-- Success message
SELECT 'ULTRA SIMPLE VIEW CREATED' as status;
SELECT 'Should work without any complex SQL errors' as note;