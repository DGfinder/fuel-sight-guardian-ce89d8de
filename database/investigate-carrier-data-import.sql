-- =====================================================
-- INVESTIGATE CARRIER DATA IMPORT ISSUE
-- =====================================================
-- Investigating missing GSF volume data
-- Expected: GSF 638.2ML, SMB 410.6ML (from CSV files)
-- Actual: GSF 446.7ML, SMB 409.4ML (missing 191.5ML GSF!)
-- =====================================================

-- 1. CHECK RAW IMPORT DATA (captive_payment_records)
SELECT 
    'RAW IMPORT DATA' as analysis_type,
    carrier,
    COUNT(*) as total_rows,
    SUM(volume_litres) as total_volume_litres,
    ROUND(SUM(volume_litres) / 1000000, 1) as total_volume_ML,
    MIN(delivery_date) as earliest_date,
    MAX(delivery_date) as latest_date,
    COUNT(DISTINCT bill_of_lading) as unique_bols,
    COUNT(DISTINCT customer) as unique_customers
FROM captive_payment_records 
GROUP BY carrier
ORDER BY carrier;

-- 2. CHECK MATERIALIZED VIEW DATA (captive_deliveries) 
SELECT 
    'MATERIALIZED VIEW DATA' as analysis_type,
    carrier,
    COUNT(*) as total_deliveries,
    SUM(total_volume_litres_abs) as total_volume_litres,
    ROUND(SUM(total_volume_litres_abs) / 1000000, 1) as total_volume_ML,
    MIN(delivery_date) as earliest_date,
    MAX(delivery_date) as latest_date,
    COUNT(DISTINCT customer) as unique_customers
FROM captive_deliveries
GROUP BY carrier
ORDER BY carrier;

-- 3. EXPECTED VS ACTUAL COMPARISON
SELECT 
    'VOLUME DISCREPANCY ANALYSIS' as analysis_type,
    'GSF' as carrier,
    638.2 as expected_volume_ML,
    ROUND(SUM(CASE WHEN carrier = 'GSF' THEN total_volume_litres_abs ELSE 0 END) / 1000000, 1) as actual_volume_ML,
    ROUND(638.2 - SUM(CASE WHEN carrier = 'GSF' THEN total_volume_litres_abs ELSE 0 END) / 1000000, 1) as missing_volume_ML
FROM captive_deliveries
UNION ALL
SELECT 
    'VOLUME DISCREPANCY ANALYSIS' as analysis_type,
    'SMB' as carrier,
    410.6 as expected_volume_ML,
    ROUND(SUM(CASE WHEN carrier = 'SMB' THEN total_volume_litres_abs ELSE 0 END) / 1000000, 1) as actual_volume_ML,
    ROUND(410.6 - SUM(CASE WHEN carrier = 'SMB' THEN total_volume_litres_abs ELSE 0 END) / 1000000, 1) as missing_volume_ML
FROM captive_deliveries;

-- 4. CHECK FOR DATA ANOMALIES
SELECT 
    'DATA QUALITY CHECK' as analysis_type,
    carrier,
    COUNT(CASE WHEN volume_litres < 0 THEN 1 END) as negative_volumes,
    COUNT(CASE WHEN volume_litres = 0 THEN 1 END) as zero_volumes,
    COUNT(CASE WHEN volume_litres > 100000 THEN 1 END) as very_large_volumes,
    MIN(volume_litres) as min_volume,
    MAX(volume_litres) as max_volume,
    AVG(volume_litres) as avg_volume
FROM captive_payment_records
GROUP BY carrier
ORDER BY carrier;

-- 5. CHECK CARRIER FIELD VALUES (ENUM type - only valid values)
SELECT 
    'CARRIER FIELD ANALYSIS' as analysis_type,
    carrier,
    COUNT(*) as record_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM captive_payment_records
GROUP BY carrier
ORDER BY record_count DESC;

-- 6. VERIFY CARRIER ENUM VALUES (no NULL/empty possible with ENUM)
SELECT 
    'ENUM CARRIER VALUES' as analysis_type,
    carrier,
    COUNT(*) as record_count,
    'Valid ENUM value' as status
FROM captive_payment_records
GROUP BY carrier
ORDER BY carrier;

-- 7. VOLUME CALCULATION VERIFICATION
SELECT 
    'VOLUME CALCULATION CHECK' as analysis_type,
    carrier,
    SUM(volume_litres) as sum_raw_volume,
    SUM(ABS(volume_litres)) as sum_abs_volume,
    ROUND(SUM(volume_litres) / 1000000, 1) as sum_raw_ML,
    ROUND(SUM(ABS(volume_litres)) / 1000000, 1) as sum_abs_ML,
    COUNT(CASE WHEN volume_litres != ABS(volume_litres) THEN 1 END) as negative_count
FROM captive_payment_records
GROUP BY carrier
ORDER BY carrier;

-- 8. SAMPLE RECORDS FOR VERIFICATION
SELECT 
    'SAMPLE GSF RECORDS' as analysis_type,
    bill_of_lading,
    delivery_date,
    customer,
    product,
    volume_litres,
    carrier
FROM captive_payment_records
WHERE carrier = 'GSF'
ORDER BY volume_litres DESC
LIMIT 5;

SELECT 
    'SAMPLE SMB RECORDS' as analysis_type,
    bill_of_lading,
    delivery_date,
    customer,
    product,
    volume_litres,
    carrier
FROM captive_payment_records
WHERE carrier = 'SMB'
ORDER BY volume_litres DESC
LIMIT 5;

-- SUMMARY REPORT
SELECT 
    'INVESTIGATION SUMMARY' as report_type,
    'Data Import Status' as metric,
    CASE 
        WHEN (SELECT COUNT(*) FROM captive_payment_records WHERE carrier = 'GSF') > 50000 
        THEN 'GSF data appears complete (50k+ rows)'
        ELSE 'GSF data may be incomplete (less than 50k rows)'
    END as status
UNION ALL
SELECT 
    'INVESTIGATION SUMMARY' as report_type,
    'Volume Discrepancy' as metric,
    CASE 
        WHEN (SELECT SUM(total_volume_litres_abs) FROM captive_deliveries WHERE carrier = 'GSF') / 1000000 < 600
        THEN 'GSF volume significantly below expected 638.2ML'
        ELSE 'GSF volume close to expected'
    END as status;

-- Expected Results Analysis:
-- If GSF CSV had 58,933 rows with 638.2ML volume, we should see:
-- 1. Raw import: ~58,933 GSF records with ~638,200,000L total
-- 2. Materialized view: Fewer GSF deliveries but same ~638.2ML volume
-- 3. Any significant difference indicates import or processing issue