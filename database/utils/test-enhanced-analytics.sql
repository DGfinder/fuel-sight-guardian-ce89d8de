-- Test the ENHANCED bulletproof view (WITH REFILL PROTECTION)
-- Run this in Supabase SQL Editor to verify:
-- 1. Rolling averages use consecutive readings only (eliminates over-counting)
-- 2. Refill protection: averages restart after refills for accurate rates
-- 3. Mt Claremont shows ~3000 L/day (NOT 16,829 L/day from over-counting)
-- 4. Tanks with recent refills show post-refill consumption patterns only
-- 5. Visual indicators work: minus signs for consumption, plus for refills

-- Test 1: Visual Indicators Test
SELECT 
    'Visual Fuel Indicators Test' as test_name,
    location,
    current_level,
    safe_fill,
    ullage,
    ullage_display,
    rolling_avg_lpd,
    rolling_avg_lpd_display,
    prev_day_used,
    prev_day_used_display,
    CASE 
        WHEN rolling_avg_lpd_display LIKE '-%' THEN '✅ Shows minus sign'
        WHEN rolling_avg_lpd_display = '0' THEN '⚠️ Zero (no data)'
        WHEN rolling_avg_lpd_display LIKE '+%' THEN '⚠️ Shows plus (unusual)'
        ELSE '❌ No sign formatting'
    END as rolling_avg_visual,
    CASE 
        WHEN prev_day_used_display LIKE '-%' THEN '✅ Shows minus (consumption)'
        WHEN prev_day_used_display LIKE '+%' THEN '✅ Shows plus (refill)'
        WHEN prev_day_used_display = '0' THEN '⚪ Zero (no change)'
        ELSE '❌ No sign formatting'
    END as prev_day_visual,
    CASE 
        WHEN ullage_display LIKE '+%' THEN '✅ Shows plus sign'
        ELSE '❌ No plus sign'
    END as ullage_visual
FROM tanks_with_rolling_avg
WHERE subgroup = 'GSFS Narrogin' OR location = 'Jandakot' OR location = 'Mt Claremont'
ORDER BY location;

-- Test 2: Mt Claremont Over-Counting Fix Verification
SELECT 
    'Mt Claremont Rolling Average Fix' as test_name,
    location,
    rolling_avg_lpd,
    rolling_avg_lpd_display,
    CASE 
        WHEN rolling_avg_lpd BETWEEN -5000 AND -1000 THEN '✅ FIXED: Realistic consumption range'
        WHEN rolling_avg_lpd < -10000 THEN '❌ Still too high (over-counting bug)'
        WHEN rolling_avg_lpd = 0 THEN '⚠️ No consumption data'
        ELSE '⚠️ Unusual value'
    END as rolling_avg_status,
    'Previous bug: 16,829 L/day' as previous_bug,
    'Expected: ~3,000 L/day' as expected_fix
FROM tanks_with_rolling_avg
WHERE location = 'Mt Claremont';

-- Test 3: Refill Protection Logic Verification
SELECT 
    'Refill Protection Test' as test_name,
    location,
    rolling_avg_lpd,
    rolling_avg_lpd_display,
    prev_day_used,
    prev_day_used_display,
    CASE 
        WHEN prev_day_used_display LIKE '+%' AND rolling_avg_lpd BETWEEN -5000 AND -500 THEN '✅ REFILL DETECTED: Post-refill avg calculated'
        WHEN prev_day_used_display LIKE '+%' AND rolling_avg_lpd = 0 THEN '⚠️ REFILL DETECTED: No post-refill consumption yet'
        WHEN prev_day_used_display LIKE '+%' AND ABS(rolling_avg_lpd) > 10000 THEN '❌ REFILL DETECTED: Still using pre-refill data'
        WHEN prev_day_used_display LIKE '-%' THEN '✅ NORMAL CONSUMPTION: Rolling avg calculated normally'
        ELSE '⚪ NO RECENT ACTIVITY'
    END as refill_protection_status,
    'Refill protection ensures accurate post-refill consumption rates' as explanation
FROM tanks_with_rolling_avg
WHERE prev_day_used_display LIKE '+%' OR location = 'Mt Claremont'
ORDER BY prev_day_used_display DESC;

-- Test 4: Status Distribution Across All Tanks
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

-- Test 5: Rolling Average and Previous Day Validation
SELECT 
    'Rolling Average & Prev Day Test' as test_name,
    location,
    rolling_avg_lpd,
    rolling_avg_lpd_display,
    prev_day_used,
    prev_day_used_display,
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
WHERE subgroup = 'GSFS Narrogin' OR location = 'Jandakot' OR location = 'Mt Claremont'
ORDER BY location;

-- Test 6: Days to Minimum Validation
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

-- Test 7: Percentage Calculation Verification
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
