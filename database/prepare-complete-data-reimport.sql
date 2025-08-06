-- =====================================================
-- PREPARE FOR COMPLETE DATA RE-IMPORT
-- =====================================================
-- This script prepares the database for a complete re-import
-- of captive payment data to fix the missing GSF records
-- 
-- ISSUE: GSF CSV had 58,933 rows (638.2ML) but only ~50,000 imported
-- SOLUTION: Clean slate re-import of both GSF and SMB CSV files
-- =====================================================

-- STEP 1: Back up current data counts for verification
SELECT 
    'BEFORE CLEANUP - CURRENT DATA' as step,
    carrier,
    COUNT(*) as current_rows,
    ROUND(SUM(volume_litres) / 1000000, 1) as current_volume_ML,
    MIN(delivery_date) as earliest_date,
    MAX(delivery_date) as latest_date
FROM captive_payment_records
GROUP BY carrier
ORDER BY carrier;

-- STEP 2: Show materialized view current state
SELECT 
    'BEFORE CLEANUP - MATERIALIZED VIEW' as step,
    carrier,
    COUNT(*) as current_deliveries,
    ROUND(SUM(total_volume_litres_abs) / 1000000, 1) as current_volume_ML
FROM captive_deliveries
GROUP BY carrier
ORDER BY carrier;

-- STEP 3: Clean slate - remove all existing captive payment data
-- WARNING: This will delete ALL existing captive payment records!
-- Only run this if you're ready to re-import all CSV data

TRUNCATE TABLE captive_payment_records RESTART IDENTITY CASCADE;

-- STEP 4: Verify cleanup completed
SELECT 
    'AFTER CLEANUP - VERIFICATION' as step,
    COUNT(*) as remaining_records,
    CASE 
        WHEN COUNT(*) = 0 THEN 'SUCCESS: Table is empty and ready for re-import'
        ELSE 'ERROR: Records still remain'
    END as status
FROM captive_payment_records;

-- STEP 5: Refresh materialized view after cleanup
REFRESH MATERIALIZED VIEW captive_deliveries;

-- STEP 6: Verify materialized view is also empty
SELECT 
    'AFTER CLEANUP - MATERIALIZED VIEW' as step,
    COUNT(*) as remaining_deliveries,
    CASE 
        WHEN COUNT(*) = 0 THEN 'SUCCESS: Materialized view is empty'
        ELSE 'ERROR: Deliveries still remain'
    END as status
FROM captive_deliveries;

-- STEP 7: Show table structure for CSV import reference
SELECT 
    'TABLE STRUCTURE FOR CSV IMPORT' as step,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'captive_payment_records' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- =====================================================
-- NEXT STEPS AFTER RUNNING THIS SCRIPT:
-- =====================================================
-- 1. Re-import GSF CSV file with carrier = 'GSF'
-- 2. Re-import SMB CSV file with carrier = 'SMB'  
-- 3. Run the post-import verification script
-- 4. Expected results after re-import:
--    - GSF: 58,933 rows, 638.2ML volume
--    - SMB: 23,042 rows, 410.6ML volume
--    - Total: 81,975 rows, 1,048.8ML volume
-- =====================================================

SELECT 'DATABASE IS NOW READY FOR COMPLETE CSV RE-IMPORT' as final_message,
       'Import GSF CSV first, then SMB CSV, then run verification' as instructions;