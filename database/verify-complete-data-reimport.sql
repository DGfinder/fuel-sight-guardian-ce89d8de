-- =====================================================
-- VERIFY COMPLETE DATA RE-IMPORT SUCCESS
-- =====================================================
-- Run this script AFTER re-importing both GSF and SMB CSV files
-- to verify the data import was successful and complete
-- 
-- EXPECTED RESULTS:
-- - GSF: 58,933 rows, 638.2ML volume  
-- - SMB: 23,042 rows, 410.6ML volume
-- - Total: 81,975 rows, 1,048.8ML volume
-- =====================================================

-- STEP 1: Verify raw import data counts
SELECT 
    'POST-IMPORT RAW DATA VERIFICATION' as verification_step,
    carrier,
    COUNT(*) as actual_rows,
    CASE 
        WHEN carrier = 'GSF' AND COUNT(*) >= 58000 THEN '✅ GSF row count looks correct'
        WHEN carrier = 'SMB' AND COUNT(*) >= 23000 THEN '✅ SMB row count looks correct'
        ELSE '❌ Row count appears low'
    END as row_status,
    ROUND(SUM(volume_litres) / 1000000, 1) as actual_volume_ML,
    CASE 
        WHEN carrier = 'GSF' AND ROUND(SUM(volume_litres) / 1000000, 1) >= 630 THEN '✅ GSF volume looks correct'
        WHEN carrier = 'SMB' AND ROUND(SUM(volume_litres) / 1000000, 1) >= 400 THEN '✅ SMB volume looks correct'
        ELSE '❌ Volume appears low'
    END as volume_status,
    MIN(delivery_date) as earliest_date,
    MAX(delivery_date) as latest_date,
    COUNT(DISTINCT bill_of_lading) as unique_bols,
    COUNT(DISTINCT customer) as unique_customers,
    COUNT(DISTINCT terminal) as unique_terminals
FROM captive_payment_records
GROUP BY carrier
ORDER BY carrier;

-- STEP 2: Expected vs Actual comparison
WITH expected_data AS (
    SELECT 'GSF'::carrier_type as carrier, 58933 as expected_rows, 638.2 as expected_volume_ML
    UNION ALL
    SELECT 'SMB'::carrier_type as carrier, 23042 as expected_rows, 410.6 as expected_volume_ML
),
actual_data AS (
    SELECT 
        carrier,
        COUNT(*) as actual_rows,
        ROUND(SUM(volume_litres) / 1000000, 1) as actual_volume_ML
    FROM captive_payment_records
    GROUP BY carrier
)
SELECT 
    'EXPECTED VS ACTUAL COMPARISON' as verification_step,
    e.carrier::text as carrier,
    e.expected_rows,
    COALESCE(a.actual_rows, 0) as actual_rows,
    e.expected_rows - COALESCE(a.actual_rows, 0) as missing_rows,
    e.expected_volume_ML,
    COALESCE(a.actual_volume_ML, 0) as actual_volume_ML,
    ROUND(e.expected_volume_ML - COALESCE(a.actual_volume_ML, 0), 1) as missing_volume_ML,
    CASE 
        WHEN COALESCE(a.actual_rows, 0) >= e.expected_rows * 0.98 
            AND COALESCE(a.actual_volume_ML, 0) >= e.expected_volume_ML * 0.98
        THEN '✅ IMPORT SUCCESS - Data matches expected'
        WHEN COALESCE(a.actual_rows, 0) < e.expected_rows * 0.9
        THEN '❌ INCOMPLETE IMPORT - Missing more than 10% of rows'
        WHEN COALESCE(a.actual_volume_ML, 0) < e.expected_volume_ML * 0.9
        THEN '❌ VOLUME DISCREPANCY - Missing more than 10% of volume'
        ELSE '⚠️ MINOR DISCREPANCY - Within acceptable range'
    END as import_status
FROM expected_data e
LEFT JOIN actual_data a ON e.carrier = a.carrier
ORDER BY e.carrier;

-- STEP 3: Refresh materialized view with new data
REFRESH MATERIALIZED VIEW captive_deliveries;

-- STEP 4: Verify materialized view after refresh
SELECT 
    'POST-REFRESH MATERIALIZED VIEW' as verification_step,
    carrier,
    COUNT(*) as total_deliveries,
    ROUND(SUM(total_volume_litres_abs) / 1000000, 1) as total_volume_ML,
    CASE 
        WHEN carrier = 'GSF' AND ROUND(SUM(total_volume_litres_abs) / 1000000, 1) >= 630
        THEN '✅ GSF deliveries volume correct'
        WHEN carrier = 'SMB' AND ROUND(SUM(total_volume_litres_abs) / 1000000, 1) >= 400
        THEN '✅ SMB deliveries volume correct'
        ELSE '❌ Deliveries volume still incorrect'
    END as delivery_status,
    MIN(delivery_date) as earliest_delivery,
    MAX(delivery_date) as latest_delivery,
    COUNT(DISTINCT customer) as unique_customers,
    COUNT(DISTINCT terminal) as unique_terminals
FROM captive_deliveries
GROUP BY carrier
ORDER BY carrier;

-- STEP 5: Overall totals verification
SELECT 
    'OVERALL TOTALS VERIFICATION' as verification_step,
    COUNT(*) as total_raw_records,
    ROUND(SUM(volume_litres) / 1000000, 1) as total_volume_ML,
    CASE 
        WHEN COUNT(*) >= 80000 AND ROUND(SUM(volume_litres) / 1000000, 1) >= 1040
        THEN '✅ TOTAL IMPORT SUCCESS - All data imported correctly'
        WHEN COUNT(*) < 70000
        THEN '❌ MAJOR IMPORT FAILURE - Significant data missing'
        ELSE '⚠️ PARTIAL IMPORT - Some data may be missing'
    END as overall_status,
    (SELECT COUNT(*) FROM captive_deliveries) as total_deliveries,
    COUNT(DISTINCT bill_of_lading) as unique_bols,
    COUNT(DISTINCT customer) as unique_customers,
    COUNT(DISTINCT terminal) as unique_terminals,
    COUNT(DISTINCT carrier) as carriers_present
FROM captive_payment_records;

-- STEP 6: Data quality checks
SELECT 
    'DATA QUALITY VERIFICATION' as verification_step,
    carrier,
    COUNT(CASE WHEN volume_litres <= 0 THEN 1 END) as zero_or_negative_volumes,
    COUNT(CASE WHEN bill_of_lading IS NULL OR bill_of_lading = '' THEN 1 END) as missing_bol,
    COUNT(CASE WHEN customer IS NULL OR customer = '' THEN 1 END) as missing_customer,
    COUNT(CASE WHEN terminal IS NULL OR terminal = '' THEN 1 END) as missing_terminal,
    COUNT(CASE WHEN delivery_date IS NULL THEN 1 END) as missing_dates,
    CASE 
        WHEN COUNT(CASE WHEN volume_litres <= 0 THEN 1 END) = 0
            AND COUNT(CASE WHEN bill_of_lading IS NULL OR bill_of_lading = '' THEN 1 END) = 0
            AND COUNT(CASE WHEN customer IS NULL OR customer = '' THEN 1 END) = 0
            AND COUNT(CASE WHEN terminal IS NULL OR terminal = '' THEN 1 END) = 0
            AND COUNT(CASE WHEN delivery_date IS NULL THEN 1 END) = 0
        THEN '✅ Data quality excellent'
        ELSE '⚠️ Data quality issues found'
    END as quality_status
FROM captive_payment_records
GROUP BY carrier
ORDER BY carrier;

-- STEP 7: Sample records for manual verification
SELECT 
    'SAMPLE GSF RECORDS' as verification_step,
    bill_of_lading,
    delivery_date,
    customer,
    terminal,
    product,
    volume_litres,
    carrier
FROM captive_payment_records
WHERE carrier = 'GSF'
ORDER BY volume_litres DESC
LIMIT 3;

SELECT 
    'SAMPLE SMB RECORDS' as verification_step,
    bill_of_lading,
    delivery_date,
    customer,
    terminal,
    product,
    volume_litres,
    carrier
FROM captive_payment_records
WHERE carrier = 'SMB'
ORDER BY volume_litres DESC
LIMIT 3;

-- FINAL SUCCESS MESSAGE
SELECT 
    'IMPORT VERIFICATION COMPLETE' as final_status,
    CASE 
        WHEN (SELECT COUNT(*) FROM captive_payment_records WHERE carrier = 'GSF') >= 58000
            AND (SELECT COUNT(*) FROM captive_payment_records WHERE carrier = 'SMB') >= 23000
            AND (SELECT SUM(volume_litres) FROM captive_payment_records WHERE carrier = 'GSF') / 1000000 >= 630
            AND (SELECT SUM(volume_litres) FROM captive_payment_records WHERE carrier = 'SMB') / 1000000 >= 400
        THEN '🎉 SUCCESS: Complete data re-import successful! Dashboard should now show correct volumes.'
        ELSE '⚠️ ISSUES DETECTED: Review verification results above and consider re-importing problem datasets.'
    END as result,
    'Expected Dashboard Totals: GSF ~638ML, SMB ~411ML, Combined ~1049ML' as expected_dashboard_display;