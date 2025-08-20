-- ============================================================================
-- CREATE CAPTIVE DELIVERIES MATERIALIZED VIEW
-- This creates the missing view needed for the correlation system
-- ============================================================================

-- Check if captive_payment_records table exists first
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'captive_payment_records') THEN
    RAISE EXCEPTION 'Table captive_payment_records does not exist. Run create_captive_payments_system.sql first.';
  END IF;
  
  RAISE NOTICE 'Table captive_payment_records exists. Proceeding to create captive_deliveries view...';
END $$;

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS captive_deliveries CASCADE;

-- Create the captive_deliveries materialized view
-- This aggregates individual payment records into delivery-level records
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
  abs(sum(volume_litres)) as total_volume_litres_abs, -- For analytics calculations
  count(*) as record_count,
  
  -- Metadata
  min(created_at) as first_created_at,
  max(updated_at) as last_updated_at,
  
  -- Unique delivery key for joins
  bill_of_lading || '-' || delivery_date || '-' || customer as delivery_key
  
FROM captive_payment_records 
GROUP BY bill_of_lading, delivery_date, customer, terminal, carrier
ORDER BY delivery_date DESC, bill_of_lading;

-- Create indexes on the materialized view for fast queries
CREATE UNIQUE INDEX idx_captive_deliveries_key ON captive_deliveries (delivery_key);
CREATE INDEX idx_captive_deliveries_date ON captive_deliveries (delivery_date DESC);
CREATE INDEX idx_captive_deliveries_carrier ON captive_deliveries (carrier);
CREATE INDEX idx_captive_deliveries_customer ON captive_deliveries (customer);
CREATE INDEX idx_captive_deliveries_terminal ON captive_deliveries (terminal);

-- Grant permissions
GRANT SELECT ON captive_deliveries TO authenticated;

-- Verify the view was created
SELECT 
  'Captive Deliveries View Status' as check_type,
  (SELECT COUNT(*) FROM captive_deliveries) as delivery_count,
  (SELECT COUNT(DISTINCT customer) FROM captive_deliveries) as unique_customers,
  (SELECT COUNT(DISTINCT terminal) FROM captive_deliveries) as unique_terminals,
  (SELECT MIN(delivery_date) FROM captive_deliveries) as earliest_delivery,
  (SELECT MAX(delivery_date) FROM captive_deliveries) as latest_delivery;

-- Show sample data
SELECT 
  'Sample Deliveries' as info,
  delivery_key,
  customer,
  terminal,
  delivery_date,
  total_volume_litres,
  carrier
FROM captive_deliveries 
ORDER BY delivery_date DESC 
LIMIT 5;
