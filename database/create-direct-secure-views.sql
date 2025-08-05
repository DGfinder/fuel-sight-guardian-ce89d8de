-- =====================================================
-- DIRECT SECURE VIEWS - ALTERNATIVE APPROACH
-- =====================================================
-- If the base analytics views approach fails, use this alternative
-- Creates secure views directly from materialized view without intermediate steps
-- This bypasses any "relation does not exist" errors
-- =====================================================

-- 1. SECURE DELIVERIES VIEW (direct from materialized view)
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

-- 2. SECURE MONTHLY ANALYTICS (computed directly)
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

-- 3. SECURE CUSTOMER ANALYTICS (computed directly)
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

-- 4. SECURE TERMINAL ANALYTICS (computed directly)
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
COMMENT ON VIEW secure_captive_deliveries IS 'Direct secure access to captive deliveries - fixes 404 errors';
COMMENT ON VIEW secure_captive_monthly_analytics IS 'Direct secure monthly analytics computed from captive_deliveries - fixes 404 errors';
COMMENT ON VIEW secure_captive_customer_analytics IS 'Direct secure customer analytics computed from captive_deliveries - fixes 404 errors';
COMMENT ON VIEW secure_captive_terminal_analytics IS 'Direct secure terminal analytics computed from captive_deliveries - fixes 404 errors';

-- Verification query
SELECT 'Direct secure views created successfully' as status;
SELECT 
  'secure_captive_deliveries' as view_name,
  COUNT(*) as record_count
FROM secure_captive_deliveries
WHERE carrier IN ('SMB', 'GSF')
LIMIT 1;