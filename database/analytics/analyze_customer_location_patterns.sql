-- ============================================================================
-- CUSTOMER LOCATION PATTERN ANALYSIS
-- Analyze captive payments data to understand customer-terminal relationships
-- ============================================================================

-- Enable fuzzy string matching extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- CUSTOMER-TERMINAL RELATIONSHIP ANALYSIS
-- ============================================================================

-- Analyze which customers use which terminals
CREATE OR REPLACE VIEW customer_terminal_patterns AS
SELECT 
  customer,
  terminal,
  carrier,
  
  -- Delivery metrics
  COUNT(DISTINCT bill_of_lading || '-' || delivery_date) as unique_deliveries,
  SUM(volume_litres) as total_volume_litres,
  
  -- Date patterns
  MIN(delivery_date) as first_delivery_date,
  MAX(delivery_date) as last_delivery_date,
  COUNT(DISTINCT DATE_TRUNC('month', delivery_date)) as months_active,
  
  -- Calculate customer loyalty to terminal
  ROUND(
    (COUNT(DISTINCT bill_of_lading || '-' || delivery_date) * 100.0) / 
    (
      SELECT COUNT(DISTINCT bill_of_lading || '-' || delivery_date) 
      FROM captive_payment_records cpr2 
      WHERE cpr2.customer = cpr.customer
    ), 2
  ) as terminal_loyalty_percentage,
  
  -- Average delivery size
  CASE 
    WHEN COUNT(DISTINCT bill_of_lading || '-' || delivery_date) > 0 
    THEN ROUND(SUM(volume_litres) / COUNT(DISTINCT bill_of_lading || '-' || delivery_date), 0)
    ELSE 0 
  END as avg_delivery_size_litres

FROM captive_payment_records cpr
GROUP BY customer, terminal, carrier
HAVING COUNT(DISTINCT bill_of_lading || '-' || delivery_date) >= 1
ORDER BY customer, unique_deliveries DESC;

-- ============================================================================
-- CUSTOMER GEOGRAPHIC CLASSIFICATION
-- ============================================================================

-- Classify customers by their likely geographic location based on names and patterns
CREATE OR REPLACE VIEW customer_geographic_classification AS
WITH customer_analysis AS (
  SELECT 
    customer,
    STRING_AGG(DISTINCT terminal, ', ' ORDER BY terminal) as terminals_used,
    COUNT(DISTINCT terminal) as terminal_count,
    
    -- Most frequently used terminal
    (
      SELECT terminal 
      FROM customer_terminal_patterns ctp2 
      WHERE ctp2.customer = ctp.customer 
      ORDER BY unique_deliveries DESC 
      LIMIT 1
    ) as primary_terminal,
    
    -- Total activity
    SUM(unique_deliveries) as total_deliveries,
    SUM(total_volume_litres) as total_volume_litres
    
  FROM customer_terminal_patterns ctp
  GROUP BY customer
)
SELECT 
  customer,
  primary_terminal,
  terminals_used,
  terminal_count,
  total_deliveries,
  total_volume_litres,
  
  -- Geographic classification based on customer name patterns
  CASE 
    -- Mining regions
    WHEN LOWER(customer) LIKE '%kalgoorlie%' OR LOWER(customer) LIKE '%kcgm%' 
      OR LOWER(customer) LIKE '%goldfield%' THEN 'Kalgoorlie/Goldfields'
    WHEN LOWER(customer) LIKE '%pilbara%' OR LOWER(customer) LIKE '%newman%' 
      OR LOWER(customer) LIKE '%port hedland%' THEN 'Pilbara'
    WHEN LOWER(customer) LIKE '%geraldton%' OR LOWER(customer) LIKE '%mid west%' THEN 'Mid West'
    WHEN LOWER(customer) LIKE '%broome%' OR LOWER(customer) LIKE '%kimberley%' THEN 'Kimberley'
    WHEN LOWER(customer) LIKE '%esperance%' THEN 'Esperance'
    WHEN LOWER(customer) LIKE '%albany%' OR LOWER(customer) LIKE '%great southern%' THEN 'Great Southern'
    
    -- Perth metro and industrial areas
    WHEN LOWER(customer) LIKE '%perth%' OR LOWER(customer) LIKE '%kewdale%' 
      OR LOWER(customer) LIKE '%airport%' OR LOWER(customer) LIKE '%airpt%' THEN 'Perth Metro'
    WHEN LOWER(customer) LIKE '%fremantle%' OR LOWER(customer) LIKE '%cockburn%' 
      OR LOWER(customer) LIKE '%kwinana%' OR LOWER(customer) LIKE '%rockingham%' 
      OR LOWER(customer) LIKE '%naval base%' THEN 'Perth Industrial'
    WHEN LOWER(customer) LIKE '%bunbury%' OR LOWER(customer) LIKE '%south west%' 
      OR LOWER(customer) LIKE '%worsley%' THEN 'South West'
      
    -- Mining companies (general)
    WHEN LOWER(customer) LIKE '%mine%' OR LOWER(customer) LIKE '%mining%' 
      OR LOWER(customer) LIKE '%gold%' OR LOWER(customer) LIKE '%iron ore%' THEN 'Mining (General)'
    
    -- Transport/logistics
    WHEN LOWER(customer) LIKE '%transport%' OR LOWER(customer) LIKE '%logistics%' 
      OR LOWER(customer) LIKE '%carrier%' THEN 'Transport/Logistics'
    
    -- Construction
    WHEN LOWER(customer) LIKE '%construction%' OR LOWER(customer) LIKE '%concrete%' 
      OR LOWER(customer) LIKE '%bgc%' THEN 'Construction'
    
    -- Government/utilities
    WHEN LOWER(customer) LIKE '%power%' OR LOWER(customer) LIKE '%water%' 
      OR LOWER(customer) LIKE '%government%' OR LOWER(customer) LIKE '%council%' THEN 'Government/Utilities'
    
    ELSE 'Other/Unknown'
  END as geographic_region,
  
  -- Customer type classification
  CASE 
    WHEN LOWER(customer) LIKE '%mine%' OR LOWER(customer) LIKE '%mining%' 
      OR LOWER(customer) LIKE '%kcgm%' OR LOWER(customer) LIKE '%gold%' THEN 'Mining'
    WHEN LOWER(customer) LIKE '%airport%' OR LOWER(customer) LIKE '%airpt%' THEN 'Aviation'
    WHEN LOWER(customer) LIKE '%transport%' OR LOWER(customer) LIKE '%carrier%' 
      OR LOWER(customer) LIKE '%logistics%' THEN 'Transport'
    WHEN LOWER(customer) LIKE '%construction%' OR LOWER(customer) LIKE '%concrete%' 
      OR LOWER(customer) LIKE '%precast%' THEN 'Construction'
    WHEN LOWER(customer) LIKE '%power%' OR LOWER(customer) LIKE '%water%' 
      OR LOWER(customer) LIKE '%refinery%' THEN 'Utilities/Industrial'
    WHEN LOWER(customer) LIKE '%garage%' OR LOWER(customer) LIKE '%service%' THEN 'Retail/Service'
    ELSE 'Other'
  END as customer_type

FROM customer_analysis
ORDER BY total_volume_litres DESC;

-- ============================================================================
-- TERMINAL EFFICIENCY ANALYSIS
-- ============================================================================

-- Analyze terminal efficiency and service patterns
CREATE OR REPLACE VIEW terminal_service_analysis AS
SELECT 
  terminal,
  carrier,
  
  -- Customer metrics
  COUNT(DISTINCT customer) as unique_customers,
  COUNT(DISTINCT bill_of_lading || '-' || delivery_date) as total_deliveries,
  SUM(volume_litres) as total_volume_litres,
  
  -- Service area analysis
  STRING_AGG(DISTINCT 
    CASE 
      WHEN LOWER(customer) LIKE '%kalgoorlie%' OR LOWER(customer) LIKE '%kcgm%' THEN 'Kalgoorlie'
      WHEN LOWER(customer) LIKE '%pilbara%' OR LOWER(customer) LIKE '%newman%' THEN 'Pilbara'  
      WHEN LOWER(customer) LIKE '%geraldton%' THEN 'Geraldton'
      WHEN LOWER(customer) LIKE '%perth%' OR LOWER(customer) LIKE '%kewdale%' THEN 'Perth'
      WHEN LOWER(customer) LIKE '%broome%' THEN 'Broome'
      WHEN LOWER(customer) LIKE '%esperance%' THEN 'Esperance'
      WHEN LOWER(customer) LIKE '%albany%' THEN 'Albany'
      ELSE 'Other'
    END, 
    ', ' ORDER BY 
    CASE 
      WHEN LOWER(customer) LIKE '%kalgoorlie%' OR LOWER(customer) LIKE '%kcgm%' THEN 'Kalgoorlie'
      WHEN LOWER(customer) LIKE '%pilbara%' OR LOWER(customer) LIKE '%newman%' THEN 'Pilbara'  
      WHEN LOWER(customer) LIKE '%geraldton%' THEN 'Geraldton'
      WHEN LOWER(customer) LIKE '%perth%' OR LOWER(customer) LIKE '%kewdale%' THEN 'Perth'
      WHEN LOWER(customer) LIKE '%broome%' THEN 'Broome'
      WHEN LOWER(customer) LIKE '%esperance%' THEN 'Esperance'
      WHEN LOWER(customer) LIKE '%albany%' THEN 'Albany'
      ELSE 'Other'
    END
  ) as service_regions,
  
  -- Top customers by volume
  (
    SELECT STRING_AGG(customer || ' (' || ROUND(volume_pct, 1) || '%)', ', ' ORDER BY volume_pct DESC)
    FROM (
      SELECT 
        customer,
        (SUM(volume_litres) * 100.0 / t.total_volume_litres) as volume_pct
      FROM captive_payment_records cpr2
      WHERE cpr2.terminal = cpr.terminal
      GROUP BY customer
      ORDER BY volume_pct DESC
      LIMIT 3
    ) top_customers
  ) as top_customers_with_percentage,
  
  -- Average delivery size
  ROUND(SUM(volume_litres) / COUNT(DISTINCT bill_of_lading || '-' || delivery_date), 0) as avg_delivery_size,
  
  -- Date range
  MIN(delivery_date) as first_delivery,
  MAX(delivery_date) as last_delivery

FROM captive_payment_records cpr
CROSS JOIN (
  SELECT SUM(volume_litres) as total_volume_litres 
  FROM captive_payment_records cpr_total 
  WHERE cpr_total.terminal = cpr.terminal
) t
GROUP BY terminal, carrier, t.total_volume_litres
ORDER BY total_volume_litres DESC;

-- ============================================================================
-- CUSTOMER NAME NORMALIZATION FOR TRIP MATCHING
-- ============================================================================

-- Create normalized customer names for fuzzy matching with trip data
CREATE OR REPLACE VIEW customer_name_variants AS
SELECT DISTINCT
  customer as original_name,
  
  -- Normalized versions for matching
  UPPER(REGEXP_REPLACE(customer, '[^A-Za-z0-9\s]', '', 'g')) as alphanumeric_only,
  UPPER(REGEXP_REPLACE(customer, '\s+(PTY|LTD|CORPORATION|CORP|INC|EX|GARAGE|MINE|MINING|REFINERY)\s*', ' ', 'gi')) as business_suffix_removed,
  
  -- Extract key identifying words
  CASE 
    WHEN customer ILIKE '%KCGM%' THEN 'KCGM'
    WHEN customer ILIKE '%WORSLEY%' THEN 'WORSLEY'
    WHEN customer ILIKE '%BGC%' THEN 'BGC'
    WHEN customer ILIKE '%SOUTH32%' THEN 'SOUTH32'
    WHEN customer ILIKE '%WESTERN POWER%' THEN 'WESTERN POWER'
    WHEN customer ILIKE '%AIRPORT%' OR customer ILIKE '%AIRPT%' THEN 'AIRPORT'
    ELSE SPLIT_PART(customer, ' ', 1) -- First word as fallback
  END as key_identifier,
  
  -- Geographic location from name
  CASE 
    WHEN LOWER(customer) LIKE '%kalgoorlie%' THEN 'KALGOORLIE'
    WHEN LOWER(customer) LIKE '%geraldton%' THEN 'GERALDTON'
    WHEN LOWER(customer) LIKE '%perth%' THEN 'PERTH'
    WHEN LOWER(customer) LIKE '%kwinana%' THEN 'KWINANA'
    WHEN LOWER(customer) LIKE '%fremantle%' THEN 'FREMANTLE'
    WHEN LOWER(customer) LIKE '%bunbury%' THEN 'BUNBURY'
    WHEN LOWER(customer) LIKE '%esperance%' THEN 'ESPERANCE'
    WHEN LOWER(customer) LIKE '%albany%' THEN 'ALBANY'
    WHEN LOWER(customer) LIKE '%newman%' THEN 'NEWMAN'
    WHEN LOWER(customer) LIKE '%broome%' THEN 'BROOME'
    ELSE NULL
  END as location_keyword

FROM captive_payment_records
WHERE customer IS NOT NULL AND customer != '';

-- ============================================================================
-- SUMMARY STATISTICS
-- ============================================================================

-- Overall customer distribution summary
CREATE OR REPLACE VIEW customer_location_summary AS
SELECT 
  'Total Unique Customers' as metric,
  COUNT(DISTINCT customer)::TEXT as value
FROM captive_payment_records

UNION ALL

SELECT 
  'Customers Using Multiple Terminals' as metric,
  COUNT(*)::TEXT as value
FROM (
  SELECT customer 
  FROM captive_payment_records 
  GROUP BY customer 
  HAVING COUNT(DISTINCT terminal) > 1
) multi_terminal

UNION ALL

SELECT 
  'Average Terminals per Customer' as metric,
  ROUND(AVG(terminal_count), 2)::TEXT as value
FROM (
  SELECT customer, COUNT(DISTINCT terminal) as terminal_count
  FROM captive_payment_records 
  GROUP BY customer
) customer_terminals

UNION ALL

SELECT 
  'Geographic Regions Identified' as metric,
  COUNT(DISTINCT geographic_region)::TEXT as value
FROM customer_geographic_classification
WHERE geographic_region != 'Other/Unknown';

-- Grant permissions
GRANT SELECT ON customer_terminal_patterns TO authenticated;
GRANT SELECT ON customer_geographic_classification TO authenticated;
GRANT SELECT ON terminal_service_analysis TO authenticated;
GRANT SELECT ON customer_name_variants TO authenticated;
GRANT SELECT ON customer_location_summary TO authenticated;

-- Create comments
COMMENT ON VIEW customer_terminal_patterns IS 'Analysis of which customers use which terminals and their loyalty patterns';
COMMENT ON VIEW customer_geographic_classification IS 'Geographic classification of customers based on name patterns and terminal usage';
COMMENT ON VIEW terminal_service_analysis IS 'Terminal efficiency and service area analysis';
COMMENT ON VIEW customer_name_variants IS 'Normalized customer names for fuzzy matching with trip location data';
COMMENT ON VIEW customer_location_summary IS 'Summary statistics of customer location patterns';

SELECT 'Customer location pattern analysis views created successfully' as result;