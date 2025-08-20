-- Check Location Mapping Table Structure
-- This script shows what columns actually exist in your location_mapping table

-- Check if the table exists
SELECT 
  'Table Existence' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'location_mapping'
  ) THEN '✅ Table exists' ELSE '❌ Table does not exist' END as status;

-- Show the actual table structure
SELECT 
  'Table Structure' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'location_mapping'
ORDER BY ordinal_position;

-- Show sample data to understand the current structure
SELECT 
  'Sample Data' as info,
  *
FROM location_mapping 
LIMIT 5;

-- Check if we need to add the business relationship columns
SELECT 
  'Missing Columns Check' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'location_mapping' 
      AND column_name = 'is_bp_customer'
  ) THEN '✅ is_bp_customer exists' ELSE '❌ is_bp_customer missing' END as bp_customer_status,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'location_mapping' 
      AND column_name = 'logistics_provider'
  ) THEN '✅ logistics_provider exists' ELSE '❌ logistics_provider missing' END as logistics_status,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'location_mapping' 
      AND column_name = 'business_relationship'
  ) THEN '✅ business_relationship exists' ELSE '❌ business_relationship missing' END as relationship_status;
