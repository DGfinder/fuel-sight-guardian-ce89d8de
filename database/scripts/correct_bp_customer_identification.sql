-- ============================================================================
-- CORRECT BP CUSTOMER IDENTIFICATION
-- Script to fix BP customer identification using captive payments data
-- ============================================================================

-- Prerequisites: 
-- 1. customer_locations table must exist
-- 2. captive_payment_records table must exist
-- 3. Functions from create_customer_locations_system.sql must be deployed

BEGIN;

RAISE NOTICE '=== BP Customer Identification Correction ===';
RAISE NOTICE 'Starting at: %', NOW();

-- Step 1: Validate current state
RAISE NOTICE 'Step 1: Current state validation';
DO $$
DECLARE
  total_customers INTEGER;
  current_bp_customers INTEGER;
  total_captive_customers INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_customers FROM customer_locations;
  SELECT COUNT(*) INTO current_bp_customers FROM customer_locations WHERE is_bp_customer = TRUE;
  SELECT COUNT(DISTINCT customer) INTO total_captive_customers FROM captive_payment_records WHERE customer IS NOT NULL AND customer != '';
  
  RAISE NOTICE 'Total customers in CSV: %', total_customers;
  RAISE NOTICE 'Currently flagged as BP: %', current_bp_customers;
  RAISE NOTICE 'Unique customers in captive payments: %', total_captive_customers;
END $$;

-- Step 2: Show current BP customers (incorrectly identified by name patterns)
RAISE NOTICE 'Step 2: Current BP customers (potentially incorrect)';
SELECT 
  customer_name,
  contract_type,
  CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 'Yes' ELSE 'No' END as has_gps
FROM customer_locations 
WHERE is_bp_customer = TRUE 
ORDER BY customer_name;

-- Step 3: Run validation to see matches between CSV and captive payments
RAISE NOTICE 'Step 3: Customer matching validation (showing top 20 matches)';
SELECT 
  csv_customer_name,
  has_gps,
  captive_matches,
  best_captive_match,
  confidence_score,
  match_method
FROM validate_customer_captive_matching()
WHERE captive_matches > 0
LIMIT 20;

-- Step 4: Update BP customer flags based on captive payments
RAISE NOTICE 'Step 4: Updating BP customer flags based on captive payments';
DO $$
DECLARE
  result RECORD;
BEGIN
  SELECT * INTO result FROM update_bp_customer_flags();
  RAISE NOTICE 'Updated % customers', result.updated_customers;
  RAISE NOTICE 'Found % BP customers in captive payments', result.bp_customers_found;
  RAISE NOTICE 'Total captive payment customers: %', result.total_captive_customers;
END $$;

-- Step 5: Show corrected BP customers
RAISE NOTICE 'Step 5: Corrected BP customers (based on captive payments)';
SELECT 
  customer_name,
  contract_type,
  CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 'Yes' ELSE 'No' END as has_gps,
  LEFT(notes, 100) || '...' as notes_preview
FROM customer_locations 
WHERE is_bp_customer = TRUE 
ORDER BY customer_name;

-- Step 6: Show customers with GPS but no captive payments match
RAISE NOTICE 'Step 6: Customers with GPS coordinates but no captive payments match';
SELECT 
  csv_customer_name,
  'GPS Available' as status
FROM validate_customer_captive_matching()
WHERE has_gps = TRUE 
  AND captive_matches = 0
ORDER BY csv_customer_name
LIMIT 10;

-- Step 7: Show captive payment customers without GPS coordinates
RAISE NOTICE 'Step 7: Top captive payment customers that need GPS coordinates';
WITH captive_only AS (
  SELECT 
    customer,
    COUNT(*) as delivery_count,
    SUM(volume_litres) as total_volume
  FROM captive_payment_records 
  WHERE customer IS NOT NULL AND customer != ''
  GROUP BY customer
),
unmatched_captive AS (
  SELECT co.*
  FROM captive_only co
  LEFT JOIN identify_bp_customers_from_captive_payments() bp ON co.customer = bp.matched_captive_customer
  WHERE bp.matched_captive_customer IS NULL
)
SELECT 
  customer as captive_customer,
  delivery_count,
  ROUND(total_volume::NUMERIC, 0) as total_volume_litres
FROM unmatched_captive
ORDER BY delivery_count DESC
LIMIT 15;

RAISE NOTICE 'BP Customer identification correction completed at: %', NOW();
RAISE NOTICE '=== Next Steps ===';
RAISE NOTICE '1. Review the corrected BP customer list above';
RAISE NOTICE '2. Add GPS coordinates for high-volume captive customers without matches';
RAISE NOTICE '3. Run this script again after adding GPS coordinates to verify matches';

COMMIT;