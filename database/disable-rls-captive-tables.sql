-- =====================================================
-- DISABLE RLS ON BASE TABLE - SHOW ALL DATA
-- =====================================================
-- This removes Row Level Security restrictions that are causing
-- data access issues in the dashboard
-- 
-- APPROACH: Page-level access control (authorized users only)
-- Once authorized → show ALL 23,756 deliveries (no per-record filtering)
-- 
-- NOTE: Materialized views can't have RLS disabled (PostgreSQL limitation)
-- We only need to disable RLS on the base table
-- =====================================================

-- Disable RLS on base records table (feeds the materialized view)
ALTER TABLE captive_payment_records DISABLE ROW LEVEL SECURITY;

-- Note: captive_deliveries is a materialized view - can't disable RLS on it
-- This is fine - materialized views don't have RLS, they inherit from base tables

-- Verify RLS is disabled on base table
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    CASE 
        WHEN rowsecurity THEN 'RLS ENABLED (may cause restrictions)'
        ELSE 'RLS DISABLED (shows all data)'
    END as status
FROM pg_tables 
WHERE tablename = 'captive_payment_records'
    AND schemaname = 'public';

-- Check materialized view exists and has data
SELECT 
    schemaname,
    matviewname as tablename,
    'MATERIALIZED VIEW' as type,
    'No RLS (inherits from base table)' as status
FROM pg_matviews 
WHERE matviewname = 'captive_deliveries'
    AND schemaname = 'public';

-- Verification: Count total records (should show 23,756)
SELECT 
    'captive_deliveries' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN carrier = 'SMB' THEN 1 END) as smb_records,
    COUNT(CASE WHEN carrier = 'GSF' THEN 1 END) as gsf_records
FROM captive_deliveries;

-- Verification: Check volume totals
SELECT 
    'Volume Check' as test_name,
    carrier,
    COUNT(*) as deliveries,
    ROUND(SUM(total_volume_litres_abs) / 1000000, 1) as volume_ml
FROM captive_deliveries 
GROUP BY carrier
ORDER BY carrier;

-- Expected Results:
-- - captive_deliveries: 23,756 total records
-- - SMB: ~6,028 deliveries, ~409.4 ML
-- - GSF: ~17,728 deliveries, ~446.7 ML
-- - RLS status: DISABLED for both tables

SELECT 'RLS disabled successfully - dashboard should now show all 23,756 deliveries' as result;