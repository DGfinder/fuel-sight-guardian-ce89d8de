-- =====================================================
-- CREATE BASE ANALYTICS VIEWS - FIX FOR MISSING VIEWS ERROR
-- =====================================================
-- This script creates the base analytics views that the secure views reference
-- Builds directly from the captive_deliveries materialized view which has data
-- =====================================================

-- First, create the base analytics views that were missing

-- 1. MONTHLY ANALYTICS VIEW
CREATE OR REPLACE VIEW captive_monthly_analytics AS
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

-- 2. CUSTOMER ANALYTICS VIEW  
CREATE OR REPLACE VIEW captive_customer_analytics AS
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

-- 3. TERMINAL ANALYTICS VIEW
CREATE OR REPLACE VIEW captive_terminal_analytics AS
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

-- Grant permissions on base analytics views
GRANT SELECT ON captive_monthly_analytics TO authenticated;
GRANT SELECT ON captive_customer_analytics TO authenticated;
GRANT SELECT ON captive_terminal_analytics TO authenticated;
GRANT SELECT ON captive_monthly_analytics TO anon;
GRANT SELECT ON captive_customer_analytics TO anon;
GRANT SELECT ON captive_terminal_analytics TO anon;

-- Now create the secure views as simple aliases
CREATE OR REPLACE VIEW secure_captive_deliveries AS
SELECT * FROM captive_deliveries;

CREATE OR REPLACE VIEW secure_captive_monthly_analytics AS
SELECT * FROM captive_monthly_analytics;

CREATE OR REPLACE VIEW secure_captive_customer_analytics AS
SELECT * FROM captive_customer_analytics;

CREATE OR REPLACE VIEW secure_captive_terminal_analytics AS
SELECT * FROM captive_terminal_analytics;

-- Grant permissions on secure views
GRANT SELECT ON secure_captive_deliveries TO authenticated;
GRANT SELECT ON secure_captive_monthly_analytics TO authenticated;
GRANT SELECT ON secure_captive_customer_analytics TO authenticated;
GRANT SELECT ON secure_captive_terminal_analytics TO authenticated;
GRANT SELECT ON secure_captive_deliveries TO anon;
GRANT SELECT ON secure_captive_monthly_analytics TO anon;
GRANT SELECT ON secure_captive_customer_analytics TO anon;
GRANT SELECT ON secure_captive_terminal_analytics TO anon;

-- Add helpful comments
COMMENT ON VIEW captive_monthly_analytics IS 'Monthly aggregated analytics computed from captive_deliveries materialized view';
COMMENT ON VIEW captive_customer_analytics IS 'Customer performance analytics computed from captive_deliveries materialized view';
COMMENT ON VIEW captive_terminal_analytics IS 'Terminal performance analytics computed from captive_deliveries materialized view';
COMMENT ON VIEW secure_captive_deliveries IS 'Secure access to captive deliveries data - resolves frontend 404 errors';
COMMENT ON VIEW secure_captive_monthly_analytics IS 'Secure access to monthly analytics - resolves frontend 404 errors';
COMMENT ON VIEW secure_captive_customer_analytics IS 'Secure access to customer analytics - resolves frontend 404 errors';
COMMENT ON VIEW secure_captive_terminal_analytics IS 'Secure access to terminal analytics - resolves frontend 404 errors';

-- Test that views were created successfully
SELECT 'Base analytics views created successfully' as status;
SELECT 
  'captive_monthly_analytics' as view_name,
  COUNT(*) as record_count
FROM captive_monthly_analytics
UNION ALL
SELECT 
  'captive_customer_analytics' as view_name,
  COUNT(*) as record_count  
FROM captive_customer_analytics
UNION ALL
SELECT 
  'captive_terminal_analytics' as view_name,
  COUNT(*) as record_count
FROM captive_terminal_analytics
UNION ALL
SELECT 
  'secure_captive_deliveries' as view_name,
  COUNT(*) as record_count
FROM secure_captive_deliveries;