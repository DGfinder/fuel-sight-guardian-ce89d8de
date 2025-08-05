-- =====================================================
-- SIMPLE SECURE VIEWS CREATION - IMMEDIATE FIX
-- =====================================================
-- This script creates the minimal secure views needed to resolve 404 errors
-- These are simplified versions without full RLS for immediate production fix
-- Can be enhanced with proper RLS policies later
-- =====================================================

-- Create secure_captive_deliveries as alias to materialized view
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

-- Create secure_captive_monthly_analytics as alias
CREATE OR REPLACE VIEW secure_captive_monthly_analytics AS
SELECT 
  month_start,
  year,
  month,
  month_name,
  carrier,
  total_deliveries,
  total_volume_litres,
  total_volume_megalitres,
  unique_customers,
  unique_terminals,
  avg_delivery_size_litres
FROM captive_monthly_analytics;

-- Create secure_captive_customer_analytics as alias  
CREATE OR REPLACE VIEW secure_captive_customer_analytics AS
SELECT 
  customer,
  carrier,
  total_deliveries,
  total_volume_litres,
  total_volume_megalitres,
  first_delivery_date,
  last_delivery_date,
  terminals_served,
  terminals_list,
  deliveries_last_30_days
FROM captive_customer_analytics;

-- Create secure_captive_terminal_analytics as alias
CREATE OR REPLACE VIEW secure_captive_terminal_analytics AS
SELECT 
  terminal,
  carrier,
  total_deliveries,
  total_volume_litres,
  total_volume_megalitres,
  percentage_of_carrier_volume,
  unique_customers,
  first_delivery_date,
  last_delivery_date,
  deliveries_last_30_days
FROM captive_terminal_analytics;

-- Grant permissions
GRANT SELECT ON secure_captive_deliveries TO authenticated;
GRANT SELECT ON secure_captive_deliveries TO anon;
GRANT SELECT ON secure_captive_monthly_analytics TO authenticated;
GRANT SELECT ON secure_captive_monthly_analytics TO anon;
GRANT SELECT ON secure_captive_customer_analytics TO authenticated;
GRANT SELECT ON secure_captive_customer_analytics TO anon;
GRANT SELECT ON secure_captive_terminal_analytics TO authenticated;
GRANT SELECT ON secure_captive_terminal_analytics TO anon;

-- Add comments
COMMENT ON VIEW secure_captive_deliveries IS 'Secure view for captive deliveries - resolves frontend 404 errors';
COMMENT ON VIEW secure_captive_monthly_analytics IS 'Secure view for monthly analytics - resolves frontend 404 errors';
COMMENT ON VIEW secure_captive_customer_analytics IS 'Secure view for customer analytics - resolves frontend 404 errors';
COMMENT ON VIEW secure_captive_terminal_analytics IS 'Secure view for terminal analytics - resolves frontend 404 errors';