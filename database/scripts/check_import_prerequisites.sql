-- ============================================================================
-- CHECK IMPORT PREREQUISITES
-- Verifies all requirements for customer location import are met
-- ============================================================================

RAISE NOTICE '=== CUSTOMER IMPORT PREREQUISITES CHECK ===';

-- 1. Check if customer_locations table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_locations' AND table_schema = 'public') THEN
    RAISE NOTICE '✓ customer_locations table exists';
  ELSE
    RAISE NOTICE '✗ customer_locations table MISSING - run create_customer_locations_system.sql first';
    RAISE EXCEPTION 'Missing required table';
  END IF;
END $$;

-- 2. Check custom enum types
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_type_enum') THEN
    RAISE NOTICE '✓ customer_type_enum exists';
  ELSE
    RAISE NOTICE '✗ customer_type_enum MISSING';
    RAISE EXCEPTION 'Missing required enum type';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_type_enum') THEN
    RAISE NOTICE '✓ contract_type_enum exists';
  ELSE
    RAISE NOTICE '✗ contract_type_enum MISSING';
    RAISE EXCEPTION 'Missing required enum type';
  END IF;
END $$;

-- 3. Check PostGIS extension
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    RAISE NOTICE '✓ PostGIS extension installed';
  ELSE
    RAISE NOTICE '✗ PostGIS extension MISSING';
    RAISE EXCEPTION 'Missing required extension';
  END IF;
END $$;

-- 4. Check pg_trgm extension
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    RAISE NOTICE '✓ pg_trgm extension installed';
  ELSE
    RAISE NOTICE '! pg_trgm extension missing (needed for fuzzy matching)';
  END IF;
END $$;

-- 5. Check table structure
RAISE NOTICE 'Checking table structure...';
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'customer_locations'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. Check constraints
RAISE NOTICE 'Checking table constraints...';
SELECT 
  constraint_name,
  constraint_type,
  CASE 
    WHEN constraint_type = 'CHECK' THEN 
      (SELECT check_clause FROM information_schema.check_constraints cc 
       WHERE cc.constraint_name = tc.constraint_name)
    ELSE 'N/A'
  END as constraint_definition
FROM information_schema.table_constraints tc
WHERE table_name = 'customer_locations'
  AND table_schema = 'public'
ORDER BY constraint_type, constraint_name;

-- 7. Check if table is empty
DO $$
DECLARE
  record_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO record_count FROM customer_locations;
  
  IF record_count = 0 THEN
    RAISE NOTICE '✓ customer_locations table is empty (ready for import)';
  ELSE
    RAISE NOTICE '! customer_locations table has % existing records', record_count;
    
    -- Show existing records
    RAISE NOTICE 'Existing records:';
    FOR rec IN SELECT customer_name, import_batch_id FROM customer_locations LIMIT 5 LOOP
      RAISE NOTICE '  - % (batch: %)', rec.customer_name, rec.import_batch_id;
    END LOOP;
  END IF;
END $$;

-- 8. Check permissions
DO $$
BEGIN
  -- Test insert permission
  BEGIN
    INSERT INTO customer_locations (customer_name, data_source) 
    VALUES ('PERMISSION_TEST', 'Permission Check');
    
    DELETE FROM customer_locations WHERE customer_name = 'PERMISSION_TEST';
    RAISE NOTICE '✓ Insert/Delete permissions confirmed';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '✗ Permission error: %', SQLERRM;
  END;
END $$;

-- 9. Check enum values
RAISE NOTICE 'Available customer_type_enum values:';
SELECT unnest(enum_range(NULL::customer_type_enum)) as customer_type;

RAISE NOTICE 'Available contract_type_enum values:';
SELECT unnest(enum_range(NULL::contract_type_enum)) as contract_type;

-- 10. Test trigger function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'update_customer_geography') THEN
    RAISE NOTICE '✓ update_customer_geography trigger function exists';
  ELSE
    RAISE NOTICE '✗ update_customer_geography trigger function MISSING';
  END IF;
END $$;

RAISE NOTICE '=== PREREQUISITES CHECK COMPLETE ===';
RAISE NOTICE 'If all checks passed with ✓, you can run the import script.';
RAISE NOTICE 'If any checks failed with ✗, fix those issues first.';