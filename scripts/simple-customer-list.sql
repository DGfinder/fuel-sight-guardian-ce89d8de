-- Simple Customer List
-- Just the customer names, one per line, for easy copying

-- Option 1: Simple list
SELECT customer as customer_name
FROM captive_payment_records 
WHERE customer IS NOT NULL 
  AND customer != ''
GROUP BY customer
ORDER BY customer;

-- Option 2: With transaction count (to see which customers are most active)
SELECT 
  customer as customer_name,
  COUNT(*) as transaction_count
FROM captive_payment_records 
WHERE customer IS NOT NULL 
  AND customer != ''
GROUP BY customer
ORDER BY transaction_count DESC, customer;

-- Option 3: Alphabetical with activity info
SELECT 
  customer as customer_name,
  COUNT(*) as transaction_count,
  MIN(delivery_date) as first_delivery,
  MAX(delivery_date) as last_delivery
FROM captive_payment_records 
WHERE customer IS NOT NULL 
  AND customer != ''
GROUP BY customer
ORDER BY customer;
