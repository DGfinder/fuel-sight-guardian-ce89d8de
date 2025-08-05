-- =====================================================
-- FIX CARRIER DATA IMPORT ISSUES
-- =====================================================
-- This script provides fixes for common carrier data import issues
-- Run ONLY after investigating with investigate-carrier-data-import.sql
-- =====================================================

-- OPTION 1: Carrier field is ENUM - no NULL/empty values possible
-- This option not needed since ENUM enforces valid values only
-- All records will have either 'GSF' or 'SMB' values

-- OPTION 2: If volume data is missing, check for import truncation
-- Verify all expected records are present

-- Check if we have the expected number of records per carrier
WITH expected_counts AS (
    SELECT 'GSF' as carrier, 58933 as expected_rows, 638230533.2 as expected_volume
    UNION ALL
    SELECT 'SMB' as carrier, 23042 as expected_rows, 410589473 as expected_volume
),
actual_counts AS (
    SELECT 
        carrier,
        COUNT(*) as actual_rows,
        SUM(volume_litres) as actual_volume
    FROM captive_payment_records
    GROUP BY carrier
)
SELECT 
    e.carrier,
    e.expected_rows,
    COALESCE(a.actual_rows, 0) as actual_rows,
    e.expected_rows - COALESCE(a.actual_rows, 0) as missing_rows,
    ROUND(e.expected_volume, 1) as expected_volume,
    ROUND(COALESCE(a.actual_volume, 0), 1) as actual_volume,
    ROUND(e.expected_volume - COALESCE(a.actual_volume, 0), 1) as missing_volume,
    CASE 
        WHEN COALESCE(a.actual_rows, 0) < e.expected_rows * 0.9 
        THEN 'INCOMPLETE IMPORT - Missing more than 10% of data'
        WHEN COALESCE(a.actual_volume, 0) < e.expected_volume * 0.9
        THEN 'VOLUME DISCREPANCY - Missing more than 10% of volume'
        ELSE 'DATA LOOKS COMPLETE'
    END as status
FROM expected_counts e
LEFT JOIN actual_counts a ON e.carrier = a.carrier;

-- OPTION 3: Refresh materialized view to ensure calculations are current
REFRESH MATERIALIZED VIEW captive_deliveries;

-- OPTION 4: If data needs to be re-imported completely
-- (DANGEROUS - Only run if you're prepared to re-import all data)
/*
-- CAUTION: This will delete all existing data!
-- Only run if you need to completely re-import

TRUNCATE TABLE captive_payment_records RESTART IDENTITY CASCADE;
-- Then re-import your CSV files with proper carrier tagging
*/

-- OPTION 5: Fix carrier assignment if records were imported with wrong carrier
-- (Only run if investigation shows specific patterns of wrong assignment)

/*
-- Example: If some GSF data was incorrectly tagged as SMB
-- Based on customer or product patterns (adjust criteria as needed)

UPDATE captive_payment_records 
SET carrier = 'GSF'
WHERE carrier = 'SMB' 
AND (
    customer ILIKE '%Great Southern%' OR
    customer ILIKE '%GSF%' OR
    product ILIKE '%specific_gsf_product%'
);

UPDATE captive_payment_records 
SET carrier = 'SMB'
WHERE carrier = 'GSF' 
AND (
    customer ILIKE '%Stevemacs%' OR
    customer ILIKE '%SMB%' OR
    product ILIKE '%specific_smb_product%'
);
*/

-- VERIFICATION: After any fixes, verify the totals
SELECT 
    'POST-FIX VERIFICATION' as check_type,
    carrier,
    COUNT(*) as total_rows,
    ROUND(SUM(volume_litres) / 1000000, 1) as total_volume_ML,
    CASE 
        WHEN carrier = 'GSF' AND ROUND(SUM(volume_litres) / 1000000, 1) >= 630 
        THEN '✅ GSF volume looks correct'
        WHEN carrier = 'SMB' AND ROUND(SUM(volume_litres) / 1000000, 1) >= 400
        THEN '✅ SMB volume looks correct'  
        ELSE '❌ Volume still incorrect'
    END as status
FROM captive_payment_records
GROUP BY carrier
ORDER BY carrier;

-- Final step: Refresh materialized view after any data changes
REFRESH MATERIALIZED VIEW captive_deliveries;

-- Final verification against materialized view
SELECT 
    'FINAL MATERIALIZED VIEW CHECK' as check_type,
    carrier,
    COUNT(*) as deliveries,
    ROUND(SUM(total_volume_litres_abs) / 1000000, 1) as volume_ML,
    CASE 
        WHEN carrier = 'GSF' AND ROUND(SUM(total_volume_litres_abs) / 1000000, 1) >= 630
        THEN '✅ GSF deliveries correct'
        WHEN carrier = 'SMB' AND ROUND(SUM(total_volume_litres_abs) / 1000000, 1) >= 400
        THEN '✅ SMB deliveries correct'
        ELSE '❌ Still needs fixing'
    END as status
FROM captive_deliveries
GROUP BY carrier
ORDER BY carrier;

-- SUCCESS MESSAGE
SELECT 
    'If both carriers show ✅ status above, the data import has been fixed!' as result,
    'Dashboard should now show: GSF ~638ML, SMB ~411ML' as expected_outcome;