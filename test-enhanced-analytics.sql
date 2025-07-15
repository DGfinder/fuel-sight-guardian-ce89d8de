-- Test the ENHANCED bulletproof view with visual fuel indicators
-- Run this in Supabase SQL Editor to verify:
-- 1. Rolling averages show negative values (e.g., -4378) for consumption visualization
-- 2. Previous day used shows negative for consumption (-2500), positive for refills (+15000)
-- 3. Ullage shows available fuel capacity that can be added
-- 4. Jandakot now shows rolling average instead of 0

-- Test 1: Visual Indicators Test
SELECT 
    'Visual Fuel Indicators Test' as test_name,
    location,
    current_level,
    safe_fill,
    ullage,
    rolling_avg_lpd,
    prev_day_used,
    CASE 
        WHEN rolling_avg_lpd < 0 THEN '✅ Negative (consumption shown)'
        WHEN rolling_avg_lpd = 0 THEN '⚠️ Zero (no data)'
        ELSE '❌ Positive (should be negative)'
    END as rolling_avg_visual,
    CASE 
        WHEN prev_day_used < 0 THEN '✅ Negative (consumption)'
        WHEN prev_day_used > 1000 THEN '✅ Positive (refill)'
        WHEN prev_day_used = 0 THEN '⚪ Zero (no change)'
        ELSE '⚠️ Small change'
    END as prev_day_visual,
    CASE 
        WHEN ullage > 0 THEN CONCAT('✅ Available: ', ullage, 'L')
        ELSE '❌ No capacity'
    END as ullage_visual
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin' OR location = 'Jandakot'
ORDER BY location;

-- Test 2: Status Distribution Across All Tanks
SELECT 
    'Status Distribution' as test_name,
    status,
    COUNT(*) as tank_count,
    ROUND(AVG(current_level_percent), 1) as avg_percent_above_min
FROM tanks_with_rolling_avg
WHERE status IS NOT NULL
GROUP BY status
ORDER BY 
    CASE status 
        WHEN 'Critical' THEN 1 
        WHEN 'Low' THEN 2 
        WHEN 'Medium' THEN 3 
        WHEN 'Good' THEN 4 
        ELSE 5 
    END;

-- Test 3: Rolling Average and Previous Day Validation
SELECT 
    'Rolling Average & Prev Day Test' as test_name,
    location,
    rolling_avg_lpd,
    prev_day_used,
    CASE 
        WHEN rolling_avg_lpd < 0 THEN 'Consuming fuel (correct)'
        WHEN rolling_avg_lpd = 0 THEN 'No consumption data'
        ELSE 'Positive value (check logic)'
    END as rolling_avg_status,
    CASE 
        WHEN prev_day_used < 0 THEN 'Fuel consumed (correct)'
        WHEN prev_day_used > 1000 THEN 'Refill detected (correct)'
        WHEN prev_day_used = 0 THEN 'No change'
        ELSE 'Small change'
    END as prev_day_status
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin' OR location = 'Jandakot'
ORDER BY location;

-- Test 4: Days to Minimum Validation
SELECT 
    'Days to Minimum' as test_name,
    location,
    current_level,
    min_level,
    rolling_avg_lpd,
    days_to_min_level,
    CASE 
        WHEN days_to_min_level IS NOT NULL AND days_to_min_level <= 1 THEN 'CRITICAL ⚠️'
        WHEN days_to_min_level IS NOT NULL AND days_to_min_level <= 2 THEN 'LOW 🟡'
        WHEN days_to_min_level IS NOT NULL AND days_to_min_level <= 7 THEN 'MEDIUM 🟠'
        WHEN days_to_min_level IS NOT NULL THEN 'GOOD 🟢'
        ELSE 'No data'
    END as urgency
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin'
ORDER BY location;

-- Test 5: Percentage Calculation Verification
SELECT 
    'Percentage Verification' as test_name,
    location,
    current_level,
    min_level,
    safe_fill,
    current_level_percent as view_percentage,
    CASE 
        WHEN safe_fill > min_level AND current_level >= min_level
        THEN ROUND(((current_level - min_level)::numeric / (safe_fill - min_level)::numeric) * 100, 1)
        ELSE 0
    END as calculated_percentage,
    CASE 
        WHEN ABS(current_level_percent - 
                CASE 
                    WHEN safe_fill > min_level AND current_level >= min_level
                    THEN ROUND(((current_level - min_level)::numeric / (safe_fill - min_level)::numeric) * 100, 1)
                    ELSE 0
                END) <= 0.1 
        THEN '✅ CORRECT'
        ELSE '❌ WRONG'
    END as percentage_check
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin'
ORDER BY location;
