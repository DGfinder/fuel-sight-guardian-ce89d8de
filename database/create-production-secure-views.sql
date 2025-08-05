-- =====================================================
-- PRODUCTION SECURE VIEWS - FINAL FIX
-- =====================================================
-- This script creates all required secure views for production
-- Run this in Supabase SQL Editor to fix 404 errors and data access
-- =====================================================

-- 1. Create secure captive deliveries view
CREATE OR REPLACE VIEW secure_captive_deliveries AS
SELECT 
  bill_of_lading,
  delivery_date,
  customer,
  terminal,
  carrier,
  products,
  total_volume_litres,
  total_volume_litres_abs,
  record_count,
  first_created_at,
  last_updated_at,
  delivery_key
FROM captive_deliveries;

-- 2. Create secure monthly analytics view (computed directly)
CREATE OR REPLACE VIEW secure_captive_monthly_analytics AS
SELECT 
  DATE_TRUNC('month', delivery_date) as month_start,
  EXTRACT(year FROM delivery_date)::integer as year,
  EXTRACT(month FROM delivery_date)::integer as month,
  TO_CHAR(delivery_date, 'Mon') as month_name,
  carrier,
  COUNT(*)::integer as total_deliveries,
  SUM(total_volume_litres_abs)::numeric as total_volume_litres,
  (SUM(total_volume_litres_abs) / 1000000)::numeric as total_volume_megalitres,
  COUNT(DISTINCT customer)::integer as unique_customers,
  COUNT(DISTINCT terminal)::integer as unique_terminals,
  COALESCE(AVG(total_volume_litres_abs), 0)::numeric as avg_delivery_size_litres
FROM captive_deliveries
GROUP BY DATE_TRUNC('month', delivery_date), EXTRACT(year FROM delivery_date), EXTRACT(month FROM delivery_date), TO_CHAR(delivery_date, 'Mon'), carrier
ORDER BY month_start DESC, carrier;

-- 3. Create secure customer analytics view (computed directly)
CREATE OR REPLACE VIEW secure_captive_customer_analytics AS
SELECT 
  customer,
  carrier,
  COUNT(*)::integer as total_deliveries,
  SUM(total_volume_litres_abs)::numeric as total_volume_litres,
  (SUM(total_volume_litres_abs) / 1000000)::numeric as total_volume_megalitres,
  MIN(delivery_date)::date as first_delivery_date,
  MAX(delivery_date)::date as last_delivery_date,
  COUNT(DISTINCT terminal)::integer as terminals_served,
  array_agg(DISTINCT terminal ORDER BY terminal) as terminals_list,
  COUNT(CASE WHEN delivery_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END)::integer as deliveries_last_30_days
FROM captive_deliveries
GROUP BY customer, carrier
ORDER BY total_volume_litres DESC;

-- 4. Create secure terminal analytics view (computed directly)
CREATE OR REPLACE VIEW secure_captive_terminal_analytics AS
SELECT 
  terminal,
  carrier,
  COUNT(*)::integer as total_deliveries,
  SUM(total_volume_litres_abs)::numeric as total_volume_litres,
  (SUM(total_volume_litres_abs) / 1000000)::numeric as total_volume_megalitres,
  COALESCE(
    ROUND(
      (SUM(total_volume_litres_abs) * 100.0 / NULLIF(SUM(SUM(total_volume_litres_abs)) OVER (PARTITION BY carrier), 0)), 
      2
    ), 
    0
  )::numeric as percentage_of_carrier_volume,
  COUNT(DISTINCT customer)::integer as unique_customers,
  MIN(delivery_date)::date as first_delivery_date,
  MAX(delivery_date)::date as last_delivery_date,
  COUNT(CASE WHEN delivery_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END)::integer as deliveries_last_30_days
FROM captive_deliveries
GROUP BY terminal, carrier
ORDER BY total_volume_litres DESC;

-- Grant all necessary permissions
GRANT SELECT ON secure_captive_deliveries TO authenticated, anon;
GRANT SELECT ON secure_captive_monthly_analytics TO authenticated, anon;
GRANT SELECT ON secure_captive_customer_analytics TO authenticated, anon;
GRANT SELECT ON secure_captive_terminal_analytics TO authenticated, anon;

-- Add documentation
COMMENT ON VIEW secure_captive_deliveries IS 'Secure access to captive deliveries - fixes API 404 errors';
COMMENT ON VIEW secure_captive_monthly_analytics IS 'Secure monthly analytics for compliance reporting';
COMMENT ON VIEW secure_captive_customer_analytics IS 'Secure customer analytics for dashboard';
COMMENT ON VIEW secure_captive_terminal_analytics IS 'Secure terminal analytics for compliance';

-- Verification queries
SELECT 'Production secure views created successfully' as status;

SELECT 
  'secure_captive_deliveries' as view_name,
  COUNT(*) as record_count
FROM secure_captive_deliveries
UNION ALL
SELECT 
  'secure_captive_monthly_analytics' as view_name,
  COUNT(*) as record_count
FROM secure_captive_monthly_analytics
UNION ALL
SELECT 
  'secure_captive_customer_analytics' as view_name,
  COUNT(*) as record_count
FROM secure_captive_customer_analytics
UNION ALL
SELECT 
  'secure_captive_terminal_analytics' as view_name,
  COUNT(*) as record_count
FROM secure_captive_terminal_analytics;

-- Test carrier-specific queries
SELECT 
  'SMB Data Test' as test_name,
  COUNT(*) as smb_deliveries,
  ROUND(SUM(total_volume_litres_abs) / 1000000, 1) as smb_volume_ml
FROM secure_captive_deliveries 
WHERE carrier = 'SMB'
UNION ALL
SELECT 
  'GSF Data Test' as test_name,
  COUNT(*) as gsf_deliveries,
  ROUND(SUM(total_volume_litres_abs) / 1000000, 1) as gsf_volume_ml
FROM secure_captive_deliveries 
WHERE carrier = 'GSF'
UNION ALL
SELECT 
  'Combined Data Test' as test_name,
  COUNT(*) as total_deliveries,
  ROUND(SUM(total_volume_litres_abs) / 1000000, 1) as total_volume_ml
FROM secure_captive_deliveries;