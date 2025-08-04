-- Fix captive_deliveries materialized view
-- This script recreates the view without unique constraints that cause issues

-- Drop existing materialized view
DROP MATERIALIZED VIEW IF EXISTS captive_deliveries CASCADE;

-- Recreate captive_deliveries without the problematic unique constraint
CREATE MATERIALIZED VIEW captive_deliveries AS
SELECT 
  -- Delivery identification
  bill_of_lading,
  delivery_date,
  customer,
  terminal,
  carrier,
  
  -- Aggregated data
  array_agg(DISTINCT product ORDER BY product) as products,
  sum(volume_litres) as total_volume_litres,
  abs(sum(volume_litres)) as total_volume_litres_abs,
  count(*) as record_count,
  
  -- Metadata
  min(created_at) as first_created_at,
  max(updated_at) as last_updated_at,
  
  -- Delivery key without unique constraint (we'll handle duplicates in application)
  bill_of_lading || '-' || delivery_date || '-' || customer as delivery_key
  
FROM captive_payment_records 
GROUP BY bill_of_lading, delivery_date, customer, terminal, carrier
ORDER BY delivery_date DESC, bill_of_lading;

-- Create non-unique indexes for performance
CREATE INDEX idx_captive_deliveries_date ON captive_deliveries (delivery_date DESC);
CREATE INDEX idx_captive_deliveries_carrier ON captive_deliveries (carrier);
CREATE INDEX idx_captive_deliveries_customer ON captive_deliveries (customer);
CREATE INDEX idx_captive_deliveries_terminal ON captive_deliveries (terminal);
CREATE INDEX idx_captive_deliveries_key ON captive_deliveries (delivery_key);
CREATE INDEX idx_captive_deliveries_bol ON captive_deliveries (bill_of_lading);

-- Refresh function that doesn't fail on unique constraints
CREATE OR REPLACE FUNCTION refresh_captive_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW captive_deliveries;
  
  -- Log the refresh (only if audit_log table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    INSERT INTO audit_log (
      table_name, 
      action, 
      details,
      user_id
    ) VALUES (
      'captive_deliveries',
      'REFRESH_MATERIALIZED_VIEW',
      'Refreshed captive payments analytics views',
      auth.uid()
    );
  END IF;
END;
$$;

-- Test the function
SELECT refresh_captive_analytics();

-- Show statistics
SELECT 
  'Migration Statistics' as status,
  (SELECT count(*) FROM captive_payment_records) as payment_records,
  (SELECT count(*) FROM captive_deliveries) as unique_deliveries,
  (SELECT count(DISTINCT carrier) FROM captive_payment_records) as carriers,
  (SELECT min(delivery_date) FROM captive_payment_records) as earliest_date,
  (SELECT max(delivery_date) FROM captive_payment_records) as latest_date;