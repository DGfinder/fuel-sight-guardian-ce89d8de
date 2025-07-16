-- TEST: Improved Tank Status Logic for Better Scheduler Decision Making
-- This tests the updated status conditions that should be more practical for delivery scheduling

-- Test cases based on the new logic:
-- Critical: ≤1.5 days OR ≤10% fuel (immediate action required)
-- Low: ≤2.5 days OR ≤20% fuel (schedule soon)  
-- Normal: >2.5 days AND >20% fuel (no immediate concern)

SELECT 
    'Tank Status Logic Test' as test_name,
    location,
    current_level,
    safe_level,
    days_to_min_level,
    
    -- Calculate percentage above minimum for reference
    CASE 
        WHEN safe_level > COALESCE(min_level, 0) AND current_level IS NOT NULL THEN
            ROUND(((current_level - COALESCE(min_level, 0))::numeric / 
                   (safe_level - COALESCE(min_level, 0))::numeric) * 100, 1)
        ELSE NULL
    END as percent_above_min,
    
    status,
    
    -- Validate the status makes sense for schedulers
    CASE 
        WHEN status = 'Critical' AND (days_to_min_level <= 1.5 OR 
            (safe_level > COALESCE(min_level, 0) AND current_level IS NOT NULL AND
             ((current_level - COALESCE(min_level, 0))::numeric / 
              (safe_level - COALESCE(min_level, 0))::numeric) * 100 <= 10))
        THEN '✅ Critical status correct - needs immediate action'
        
        WHEN status = 'Low' AND (days_to_min_level <= 2.5 OR 
            (safe_level > COALESCE(min_level, 0) AND current_level IS NOT NULL AND
             ((current_level - COALESCE(min_level, 0))::numeric / 
              (safe_level - COALESCE(min_level, 0))::numeric) * 100 <= 20))
        THEN '✅ Low status correct - schedule soon'
        
        WHEN status = 'Normal' AND days_to_min_level > 2.5 AND
            (safe_level > COALESCE(min_level, 0) AND current_level IS NOT NULL AND
             ((current_level - COALESCE(min_level, 0))::numeric / 
              (safe_level - COALESCE(min_level, 0))::numeric) * 100 > 20)
        THEN '✅ Normal status correct - no immediate concern'
        
        WHEN status = 'Critical' THEN '❌ Critical may be too aggressive'
        WHEN status = 'Low' THEN '❌ Low may be too conservative' 
        WHEN status = 'Normal' THEN '⚠️ Check if should be Low/Critical'
        ELSE '❓ Status logic unclear'
    END as scheduler_assessment,
    
    -- Specific test case: 30% fuel with 10 days should now be Normal (not Low)
    CASE 
        WHEN percent_above_min BETWEEN 25 AND 35 AND days_to_min_level BETWEEN 8 AND 12 THEN
            CASE 
                WHEN status = 'Normal' THEN '✅ FIXED: 30%/10days now shows Normal'
                ELSE '❌ STILL BROKEN: 30%/10days should be Normal, shows ' || status
            END
        ELSE '—'
    END as specific_fix_test

FROM tanks_with_rolling_avg 
WHERE current_level IS NOT NULL 
  AND safe_level IS NOT NULL
  AND days_to_min_level IS NOT NULL
ORDER BY 
    CASE status 
        WHEN 'Critical' THEN 1 
        WHEN 'Low' THEN 2 
        WHEN 'Normal' THEN 3 
        ELSE 4 
    END,
    days_to_min_level ASC
LIMIT 15;

-- Summary statistics for the new status distribution
SELECT 
    'Status Distribution Summary' as test_name,
    status,
    COUNT(*) as tank_count,
    ROUND(AVG(days_to_min_level), 1) as avg_days_to_min,
    ROUND(MIN(days_to_min_level), 1) as min_days_to_min,
    ROUND(MAX(days_to_min_level), 1) as max_days_to_min,
    
    -- Percentage distribution  
    ROUND((COUNT(*)::numeric / (SELECT COUNT(*) FROM tanks_with_rolling_avg WHERE status IS NOT NULL)::numeric) * 100, 1) as percent_of_total

FROM tanks_with_rolling_avg 
WHERE status IS NOT NULL
  AND days_to_min_level IS NOT NULL
GROUP BY status
ORDER BY 
    CASE status 
        WHEN 'Critical' THEN 1 
        WHEN 'Low' THEN 2 
        WHEN 'Normal' THEN 3 
        ELSE 4 
    END;