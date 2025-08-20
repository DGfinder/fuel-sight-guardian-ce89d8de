-- Get All Distinct Customer Names
-- This script extracts all unique customers from captive payments for manual classification

-- Step 1: Get all distinct customers from captive payments
SELECT 
  'All Distinct Customers' as info,
  customer as customer_name,
  COUNT(*) as transaction_count,
  MIN(delivery_date) as first_delivery,
  MAX(delivery_date) as last_delivery,
  SUM(volume_litres) as total_volume_litres
FROM captive_payment_records 
WHERE customer IS NOT NULL 
  AND customer != ''
GROUP BY customer
ORDER BY customer;

-- Step 2: Get customers that are already in location_mapping
SELECT 
  'Customers Already Classified' as info,
  cpr.customer as customer_name,
  lm.location_type,
  lm.is_bp_customer,
  lm.logistics_provider,
  lm.business_relationship,
  lm.parent_company
FROM captive_payment_records cpr
JOIN location_mapping lm ON cpr.customer = lm.location_name
WHERE cpr.customer IS NOT NULL 
  AND cpr.customer != ''
GROUP BY cpr.customer, lm.location_type, lm.is_bp_customer, lm.logistics_provider, lm.business_relationship, lm.parent_company
ORDER BY cpr.customer;

-- Step 3: Get customers NOT yet in location_mapping (need classification)
SELECT 
  'Customers Needing Classification' as info,
  cpr.customer as customer_name,
  COUNT(*) as transaction_count,
  MIN(delivery_date) as first_delivery,
  MAX(delivery_date) as last_delivery,
  SUM(volume_litres) as total_volume_litres
FROM captive_payment_records cpr
LEFT JOIN location_mapping lm ON cpr.customer = lm.location_name
WHERE cpr.customer IS NOT NULL 
  AND cpr.customer != ''
  AND lm.location_name IS NULL
GROUP BY cpr.customer
ORDER BY cpr.customer;

-- Step 4: Summary counts
SELECT 
  'Classification Summary' as info,
  COUNT(DISTINCT cpr.customer) as total_customers,
  COUNT(DISTINCT CASE WHEN lm.location_name IS NOT NULL THEN cpr.customer END) as classified_customers,
  COUNT(DISTINCT CASE WHEN lm.location_name IS NULL THEN cpr.customer END) as unclassified_customers,
  ROUND(
    (COUNT(DISTINCT CASE WHEN lm.location_name IS NOT NULL THEN cpr.customer END)::DECIMAL / 
     COUNT(DISTINCT cpr.customer)) * 100, 1
  ) as classification_percentage
FROM captive_payment_records cpr
LEFT JOIN location_mapping lm ON cpr.customer = lm.location_name
WHERE cpr.customer IS NOT NULL 
  AND cpr.customer != '';

-- Step 5: Export format for manual classification (CSV-friendly)
SELECT 
  customer as customer_name,
  COUNT(*) as transaction_count,
  MIN(delivery_date) as first_delivery,
  MAX(delivery_date) as last_delivery,
  SUM(volume_litres) as total_volume_litres,
  STRING_AGG(DISTINCT terminal, ', ' ORDER BY terminal) as terminals_used,
  STRING_AGG(DISTINCT carrier, ', ' ORDER BY carrier) as carriers_used
FROM captive_payment_records 
WHERE customer IS NOT NULL 
  AND customer != ''
GROUP BY customer
ORDER BY customer;
