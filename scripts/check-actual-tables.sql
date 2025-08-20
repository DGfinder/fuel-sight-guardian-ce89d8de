-- ============================================================================
-- CHECK ACTUAL TABLES IN DATABASE
-- Let's see what tables you actually have for payments and deliveries
-- ============================================================================

-- Check ALL tables in the public schema
SELECT 
  'All Tables' as object_type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check for any tables with 'payment' in the name
SELECT 
  'Payment Related Tables' as object_type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name ILIKE '%payment%'
ORDER BY table_name;

-- Check for any tables with 'delivery' in the name
SELECT 
  'Delivery Related Tables' as object_type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name ILIKE '%delivery%'
ORDER BY table_name;

-- Check for any tables with 'captive' in the name
SELECT 
  'Captive Related Tables' as object_type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name ILIKE '%captive%'
ORDER BY table_name;

-- Check for any tables with 'csv' in the name
SELECT 
  'CSV Related Tables' as object_type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name ILIKE '%csv%'
ORDER BY table_name;

-- Check for any tables with 'bill' or 'bol' in the name
SELECT 
  'Bill of Lading Related Tables' as object_type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name ILIKE '%bill%' OR table_name ILIKE '%bol%')
ORDER BY table_name;

-- Check for any tables with 'terminal' in the name
SELECT 
  'Terminal Related Tables' as object_type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name ILIKE '%terminal%'
ORDER BY table_name;

-- Check for any tables with 'customer' in the name
SELECT 
  'Customer Related Tables' as object_type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name ILIKE '%customer%'
ORDER BY table_name;

-- Check for any tables with 'volume' or 'litres' in the name
SELECT 
  'Volume Related Tables' as object_type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name ILIKE '%volume%' OR table_name ILIKE '%litres%')
ORDER BY table_name;

-- Check for any tables with 'fuel' in the name
SELECT 
  'Fuel Related Tables' as object_type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name ILIKE '%fuel%'
ORDER BY table_name;

-- Check for any tables with 'gsf' or 'gsfs' in the name
SELECT 
  'GSF Related Tables' as object_type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name ILIKE '%gsf%' OR table_name ILIKE '%gsfs%')
ORDER BY table_name;

-- Check for any tables with 'smb' in the name
SELECT 
  'SMB Related Tables' as object_type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name ILIKE '%smb%'
ORDER BY table_name;
