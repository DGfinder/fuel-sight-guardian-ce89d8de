-- =====================================================
-- CAPTIVE PAYMENTS SYSTEM MIGRATION
-- =====================================================
-- This migration creates the database schema for captive payments data
-- Currently served from CSV files, this will enable proper RBAC, caching, and performance
--
-- Migration replaces client-side CSV processing with server-side database queries
-- Provides foundation for role-based access control and audit logging
-- =====================================================

-- Drop existing objects if they exist (for safe re-runs)
DROP MATERIALIZED VIEW IF EXISTS captive_deliveries CASCADE;
DROP VIEW IF EXISTS captive_payments_analytics CASCADE;
DROP TABLE IF EXISTS captive_payment_records CASCADE;
DROP TYPE IF EXISTS carrier_type CASCADE;

-- Create custom types
CREATE TYPE carrier_type AS ENUM ('SMB', 'GSF', 'Combined');

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Main captive payment records table
-- Stores individual CSV rows as normalized database records
CREATE TABLE captive_payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core delivery data (from CSV columns)
  bill_of_lading text NOT NULL,
  delivery_date date NOT NULL,
  terminal text NOT NULL,
  customer text NOT NULL,
  product text NOT NULL,
  volume_litres numeric NOT NULL,
  carrier carrier_type NOT NULL DEFAULT 'Combined',
  
  -- Raw location field (for terminal extraction)
  raw_location text,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  -- Data source tracking
  source_file text,
  import_batch_id uuid,
  
  -- Constraints
  CONSTRAINT valid_volume CHECK (volume_litres != 0), -- Allow negative volumes (adjustments)
  CONSTRAINT valid_date CHECK (delivery_date >= '2020-01-01' AND delivery_date <= '2030-12-31')
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Primary BOL grouping index (critical for delivery aggregation)
CREATE INDEX idx_captive_bol_grouping 
ON captive_payment_records (bill_of_lading, delivery_date, customer);

-- Query performance indexes
CREATE INDEX idx_captive_delivery_date ON captive_payment_records (delivery_date DESC);
CREATE INDEX idx_captive_terminal ON captive_payment_records (terminal);
CREATE INDEX idx_captive_customer ON captive_payment_records (customer);
CREATE INDEX idx_captive_product ON captive_payment_records (product);
CREATE INDEX idx_captive_carrier ON captive_payment_records (carrier);
CREATE INDEX idx_captive_created_at ON captive_payment_records (created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX idx_captive_carrier_date ON captive_payment_records (carrier, delivery_date DESC);
CREATE INDEX idx_captive_terminal_date ON captive_payment_records (terminal, delivery_date DESC);

-- =====================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =====================================================

-- Pre-aggregated deliveries view (BOL-grouped)
-- This matches the business logic: unique BOL + Date + Customer = 1 delivery
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

-- Index on materialized view for fast queries
CREATE UNIQUE INDEX idx_captive_deliveries_key ON captive_deliveries (delivery_key);
CREATE INDEX idx_captive_deliveries_date ON captive_deliveries (delivery_date DESC);
CREATE INDEX idx_captive_deliveries_carrier ON captive_deliveries (carrier);

-- =====================================================
-- ANALYTICS VIEWS
-- =====================================================

-- Monthly analytics view
CREATE VIEW captive_monthly_analytics AS
SELECT 
  DATE_TRUNC('month', delivery_date) as month_start,
  EXTRACT(year FROM delivery_date) as year,
  EXTRACT(month FROM delivery_date) as month,
  TO_CHAR(delivery_date, 'Mon') as month_name,
  carrier,
  
  -- Delivery metrics (unique BOL count)
  COUNT(DISTINCT delivery_key) as total_deliveries,
  
  -- Volume metrics  
  SUM(total_volume_litres_abs) as total_volume_litres,
  SUM(total_volume_litres_abs) / 1000000 as total_volume_megalitres,
  
  -- Customer metrics
  COUNT(DISTINCT customer) as unique_customers,
  COUNT(DISTINCT terminal) as unique_terminals,
  
  -- Average delivery size
  CASE 
    WHEN COUNT(DISTINCT delivery_key) > 0 
    THEN SUM(total_volume_litres_abs) / COUNT(DISTINCT delivery_key)
    ELSE 0 
  END as avg_delivery_size_litres

FROM captive_deliveries
GROUP BY DATE_TRUNC('month', delivery_date), EXTRACT(year FROM delivery_date), EXTRACT(month FROM delivery_date), TO_CHAR(delivery_date, 'Mon'), carrier
ORDER BY month_start DESC, carrier;

-- Customer analytics view
CREATE VIEW captive_customer_analytics AS
SELECT 
  customer,
  carrier,
  
  -- Delivery metrics
  COUNT(DISTINCT delivery_key) as total_deliveries,
  
  -- Volume metrics
  SUM(total_volume_litres_abs) as total_volume_litres,
  SUM(total_volume_litres_abs) / 1000000 as total_volume_megalitres,
  
  -- Date range
  MIN(delivery_date) as first_delivery_date,
  MAX(delivery_date) as last_delivery_date,
  
  -- Terminal diversity
  COUNT(DISTINCT terminal) as terminals_served,
  array_agg(DISTINCT terminal ORDER BY terminal) as terminals_list,
  
  -- Recent activity
  COUNT(CASE WHEN delivery_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as deliveries_last_30_days

FROM captive_deliveries
GROUP BY customer, carrier
ORDER BY total_volume_litres DESC;

-- Terminal analytics view
CREATE VIEW captive_terminal_analytics AS
SELECT 
  terminal,
  carrier,
  
  -- Delivery metrics
  COUNT(DISTINCT delivery_key) as total_deliveries,
  
  -- Volume metrics
  SUM(total_volume_litres_abs) as total_volume_litres,
  SUM(total_volume_litres_abs) / 1000000 as total_volume_megalitres,
  
  -- Percentage of total volume by carrier
  ROUND(
    (SUM(total_volume_litres_abs) * 100.0 / 
     SUM(SUM(total_volume_litres_abs)) OVER (PARTITION BY carrier)), 2
  ) as percentage_of_carrier_volume,
  
  -- Customer diversity
  COUNT(DISTINCT customer) as unique_customers,
  
  -- Date range
  MIN(delivery_date) as first_delivery_date,
  MAX(delivery_date) as last_delivery_date,
  
  -- Recent activity
  COUNT(CASE WHEN delivery_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as deliveries_last_30_days

FROM captive_deliveries
GROUP BY terminal, carrier
ORDER BY total_volume_litres DESC;

-- =====================================================
-- FUNCTIONS FOR DATA PROCESSING
-- =====================================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_captive_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW captive_deliveries;
  
  -- Log the refresh
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
END;
$$;

-- Function to extract terminal name from raw location
CREATE OR REPLACE FUNCTION extract_terminal_name(raw_location text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Extract terminal from strings like "AU THDPTY GSF X GERALDTON" or "AU TERM KEWDALE"
  IF raw_location ILIKE '%GERALDTON%' THEN
    RETURN 'Geraldton';
  ELSIF raw_location ILIKE '%KEWDALE%' THEN
    RETURN 'Kewdale';
  ELSIF raw_location ILIKE '%KALGOORLIE%' THEN
    RETURN 'Kalgoorlie';
  ELSIF raw_location ILIKE '%COOGEE%' OR raw_location ILIKE '%ROCKINGHAM%' THEN
    RETURN 'Coogee Rockingham';
  ELSIF raw_location ILIKE '%FREMANTLE%' THEN
    RETURN 'Fremantle';
  ELSIF raw_location ILIKE '%BUNBURY%' THEN
    RETURN 'Bunbury';
  ELSE
    -- Default fallback - return last word
    RETURN COALESCE(
      (string_to_array(trim(raw_location), ' '))[array_length(string_to_array(trim(raw_location), ' '), 1)],
      'Unknown'
    );
  END IF;
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to update terminal field from raw_location
CREATE OR REPLACE FUNCTION update_terminal_from_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Auto-populate terminal from raw_location if terminal is empty
  IF NEW.terminal IS NULL OR NEW.terminal = '' THEN
    NEW.terminal = extract_terminal_name(COALESCE(NEW.raw_location, ''));
  END IF;
  
  -- Update the updated_at timestamp
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_captive_terminal
  BEFORE INSERT OR UPDATE ON captive_payment_records
  FOR EACH ROW
  EXECUTE FUNCTION update_terminal_from_location();

-- =====================================================
-- SAMPLE DATA FOR TESTING (OPTIONAL)
-- =====================================================

-- Insert sample records for testing (can be removed in production)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'captive_payment_records') THEN
    INSERT INTO captive_payment_records (
      bill_of_lading, delivery_date, terminal, customer, product, volume_litres, carrier, raw_location
    ) VALUES
    ('8139648161', '2023-09-01', 'Kewdale', 'SOUTH32 WORSLEY REFINERY GARAGE', 'ULSD 10PPM', 25000, 'SMB', 'AU TERM KEWDALE'),
    ('8139648161', '2023-09-01', 'Kewdale', 'SOUTH32 WORSLEY REFINERY GARAGE', 'JET A-1', 15000, 'SMB', 'AU TERM KEWDALE'),
    ('8139648162', '2023-09-02', 'Geraldton', 'WESTERN POWER CORPORATION', 'ULSD 10PPM', 30000, 'GSF', 'AU THDPTY GSF X GERALDTON')
    ON CONFLICT DO NOTHING; -- Ignore if data already exists
  END IF;
END $$;

-- =====================================================
-- GRANTS AND PERMISSIONS
-- =====================================================

-- Grant basic permissions (RLS policies will control actual access)
GRANT SELECT ON captive_payment_records TO authenticated;
GRANT SELECT ON captive_deliveries TO authenticated;
GRANT SELECT ON captive_monthly_analytics TO authenticated;
GRANT SELECT ON captive_customer_analytics TO authenticated;
GRANT SELECT ON captive_terminal_analytics TO authenticated;

-- Managers and admins can insert/update data
GRANT INSERT, UPDATE ON captive_payment_records TO authenticated;

-- Function permissions
GRANT EXECUTE ON FUNCTION refresh_captive_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION extract_terminal_name(text) TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE captive_payment_records IS 'Core captive payments data migrated from CSV files. Each row represents one line from the original MYOB delivery data.';
COMMENT ON MATERIALIZED VIEW captive_deliveries IS 'Pre-aggregated view grouping records by BOL+Date+Customer. Represents actual business deliveries (not CSV rows).';
COMMENT ON FUNCTION refresh_captive_analytics() IS 'Refreshes materialized views for captive payments analytics. Should be called after bulk data imports.';

-- Migration completed successfully
SELECT 'Captive Payments System migration completed successfully' as status;