-- ============================================================================
-- CHECK DATABASE STRUCTURE
-- See what tables and views exist for the correlation system
-- ============================================================================

-- Check all tables in the public schema
SELECT 
  'Tables' as object_type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%captive%' 
   OR table_name LIKE '%mtdata%'
   OR table_name LIKE '%trip%'
   OR table_name LIKE '%payment%'
   OR table_name LIKE '%delivery%'
ORDER BY table_name;

-- Check all views in the public schema
SELECT 
  'Views' as object_type,
  table_name as view_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'VIEW'
  AND (table_name LIKE '%captive%' 
       OR table_name LIKE '%mtdata%'
       OR table_name LIKE '%trip%'
       OR table_name LIKE '%payment%'
       OR table_name LIKE '%delivery%')
ORDER BY table_name;

-- Check all materialized views in the public schema
SELECT 
  'Materialized Views' as object_type,
  matviewname as view_name
FROM pg_matviews 
WHERE schemaname = 'public'
  AND (matviewname LIKE '%captive%' 
       OR matviewname LIKE '%mtdata%'
       OR matviewname LIKE '%trip%'
       OR matviewname LIKE '%payment%'
       OR matviewname LIKE '%delivery%')
ORDER BY matviewname;

-- Check if captive_payment_records table exists and has data
SELECT 
  'Captive Payment Records' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'captive_payment_records') 
    THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as table_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'captive_payment_records') 
    THEN (SELECT COUNT(*) FROM captive_payment_records)::TEXT
    ELSE 'N/A' 
  END as record_count;

-- Check if mtdata_trip_history table exists and has data
SELECT 
  'MTdata Trip History' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mtdata_trip_history') 
    THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as table_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mtdata_trip_history') 
    THEN (SELECT COUNT(*) FROM mtdata_trip_history)::TEXT
    ELSE 'N/A' 
  END as record_count;

-- Check if mtdata_captive_correlations table exists
SELECT 
  'MTdata Captive Correlations' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mtdata_captive_correlations') 
    THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as table_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mtdata_captive_correlations') 
    THEN (SELECT COUNT(*) FROM mtdata_captive_correlations)::TEXT
    ELSE 'N/A' 
  END as record_count;
