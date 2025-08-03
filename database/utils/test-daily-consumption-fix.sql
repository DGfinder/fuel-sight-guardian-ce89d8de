-- TEST: Daily Consumption Calculation Fix
-- This tests the corrected rolling average calculation that should show ~4,578 L/day instead of 7,630 L/day

-- Test data based on user's provided readings:
-- Jul 14, 2025 8:00 AM: 18,456 L (35% capacity)
-- Jul 11, 2025 8:00 AM: 30,501 L (59% capacity) 
-- Jul 10, 2025 8:00 AM: 35,835 L (69% capacity)
-- Jul 9, 2025 8:00 AM: 41,347 L

-- Expected manual calculation: 4,578 L/day average
-- Previous SQL bug result: ~7,630 L/day (67% too high)

-- Test the specific tank that was mentioned (ID: 0799bae8-cd0e-4e5b-bd72-a3b2f0d98f3a)
SELECT 
    'FIXED Daily Consumption Test' as test_name,
    id,
    location,
    rolling_avg_lpd as calculated_daily_avg,
    ABS(rolling_avg_lpd) as daily_consumption_liters,
    
    -- Compare with manual calculation
    CASE 
        WHEN ABS(rolling_avg_lpd) BETWEEN 4000 AND 5000 THEN 
            '✅ FIXED: Matches manual calculation (~4,578 L/day)'
        WHEN ABS(rolling_avg_lpd) BETWEEN 7000 AND 8000 THEN 
            '❌ STILL BROKEN: Shows old inflated rate (~7,630 L/day)'
        WHEN ABS(rolling_avg_lpd) = 0 THEN 
            '⚠️ No consumption data available'
        ELSE 
            CONCAT('⚪ Other rate: ', ABS(rolling_avg_lpd), ' L/day')
    END as fix_status,
    
    -- Show the difference from expected
    CASE 
        WHEN rolling_avg_lpd != 0 THEN 
            ROUND(((ABS(rolling_avg_lpd) - 4578) / 4578.0 * 100)::numeric, 1)
        ELSE NULL
    END as percent_diff_from_manual

FROM tanks_with_rolling_avg 
WHERE id = '0799bae8-cd0e-4e5b-bd72-a3b2f0d98f3a'
   OR location ILIKE '%test%'  -- In case the ID doesn't match exactly
   OR id IN (
       -- Try to find tanks with similar consumption patterns
       SELECT id FROM tanks_with_rolling_avg 
       WHERE ABS(rolling_avg_lpd) BETWEEN 4000 AND 8000
       LIMIT 5
   );

-- Also test a few other tanks to ensure the fix doesn't break other calculations
SELECT 
    'General Tank Rolling Average Test' as test_name,
    location,
    ABS(rolling_avg_lpd) as daily_consumption,
    CASE 
        WHEN ABS(rolling_avg_lpd) BETWEEN 1000 AND 10000 THEN '✅ Reasonable rate'
        WHEN ABS(rolling_avg_lpd) > 15000 THEN '❌ Still too high (possible bug)'
        WHEN ABS(rolling_avg_lpd) = 0 THEN '⚪ No data'
        ELSE '⚠️ Very low consumption'
    END as rate_assessment
FROM tanks_with_rolling_avg 
WHERE rolling_avg_lpd IS NOT NULL 
ORDER BY ABS(rolling_avg_lpd) DESC
LIMIT 10;