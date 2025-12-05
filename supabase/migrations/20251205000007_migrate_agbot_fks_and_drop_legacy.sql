-- Migration: Migrate Foreign Keys to ta_agbot Tables and Drop Legacy AgBot Tables
-- Date: 2025-12-05
-- Purpose: Update FK constraints to point to ta_agbot tables, then drop legacy agbot tables
-- Risk Level: MEDIUM - Updating FK constraints and dropping tables with data
-- Impact: Removes 4 legacy tables (~3 MB), updates FK constraints for customer_tank_access and delivery_requests

-- Business Context:
-- Application code has been fully migrated to use ta_agbot_locations and ta_agbot_assets
-- Verified: agbot-api.ts uses only ta_ tables (17 references, 0 legacy references)
-- Verified: Customer portal (useCustomerAuth.ts) uses ta_agbot_locations
-- IDs match between old and new tables, so FK data is valid

-- Step 1: Update customer_tank_access FK constraint
-- Points to agbot_locations → should point to ta_agbot_locations
ALTER TABLE customer_tank_access
  DROP CONSTRAINT IF EXISTS customer_tank_access_agbot_location_id_fkey;

-- Create new FK pointing to ta_agbot_locations in PUBLIC schema
ALTER TABLE customer_tank_access
  ADD CONSTRAINT customer_tank_access_agbot_location_id_fkey
  FOREIGN KEY (agbot_location_id)
  REFERENCES public.ta_agbot_locations(id)
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT customer_tank_access_agbot_location_id_fkey ON customer_tank_access IS
  'FK migrated from agbot_locations to ta_agbot_locations on 2025-12-05';

-- Step 2: Update delivery_requests FK constraint
-- Points to agbot_locations → should point to ta_agbot_locations
ALTER TABLE delivery_requests
  DROP CONSTRAINT IF EXISTS delivery_requests_agbot_location_id_fkey;

-- Create new FK pointing to ta_agbot_locations in PUBLIC schema
ALTER TABLE delivery_requests
  ADD CONSTRAINT delivery_requests_agbot_location_id_fkey
  FOREIGN KEY (agbot_location_id)
  REFERENCES public.ta_agbot_locations(id)
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT delivery_requests_agbot_location_id_fkey ON delivery_requests IS
  'FK migrated from agbot_locations to ta_agbot_locations on 2025-12-05';

-- Step 3: Drop legacy agbot_readings_history table
-- Has FK to agbot_assets, must drop before dropping agbot_assets
-- 6,682 rows (vs 8,258 in ta_agbot_readings - new table has MORE data)
DROP TABLE IF EXISTS agbot_readings_history CASCADE;
COMMENT ON SCHEMA public IS 'Dropped agbot_readings_history (6,682 rows, 2.1 MB) on 2025-12-05 - replaced by ta_agbot_readings';

-- Step 4: Drop legacy agbot_alerts table
-- Empty table (0 rows vs 8 rows in ta_agbot_alerts)
DROP TABLE IF EXISTS agbot_alerts CASCADE;
COMMENT ON SCHEMA public IS 'Dropped agbot_alerts (0 rows, 24 kB) on 2025-12-05 - replaced by ta_agbot_alerts';

-- Step 5: Drop legacy agbot_assets table
-- Has FK to agbot_locations, must drop before dropping agbot_locations
-- 23 rows (vs 22 in ta_agbot_assets - tables are nearly identical)
DROP TABLE IF EXISTS agbot_assets CASCADE;
COMMENT ON SCHEMA public IS 'Dropped agbot_assets (23 rows, 376 kB) on 2025-12-05 - replaced by ta_agbot_assets';

-- Step 6: Drop legacy agbot_locations table
-- Now safe to drop after all FK dependencies removed
-- 26 rows (vs 45 in ta_agbot_locations - new table has 19 MORE rows)
DROP TABLE IF EXISTS agbot_locations CASCADE;
COMMENT ON SCHEMA public IS 'Dropped agbot_locations (26 rows, 280 kB) on 2025-12-05 - replaced by ta_agbot_locations';

-- Summary and verification
DO $$
DECLARE
  remaining_agbot_tables INTEGER;
  customer_fk_valid BOOLEAN;
  delivery_fk_valid BOOLEAN;
BEGIN
  -- Count any remaining agbot tables in public schema (excluding ta_ tables)
  SELECT COUNT(*) INTO remaining_agbot_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name LIKE 'agbot_%'
  AND table_name NOT LIKE 'ta_agbot_%';

  -- Verify customer_tank_access FK points to ta_agbot_locations
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'customer_tank_access'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'ta_agbot_locations'
  ) INTO customer_fk_valid;

  -- Verify delivery_requests FK points to ta_agbot_locations
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'delivery_requests'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'ta_agbot_locations'
  ) INTO delivery_fk_valid;

  RAISE NOTICE '================================================';
  RAISE NOTICE 'LEGACY AGBOT TABLES MIGRATION SUMMARY';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Tables dropped: 4';
  RAISE NOTICE 'Rows deleted: ~6,711';
  RAISE NOTICE 'Space reclaimed: ~3 MB';
  RAISE NOTICE '';
  RAISE NOTICE 'Dropped Tables:';
  RAISE NOTICE '  ✓ agbot_locations (26 rows, 280 kB)';
  RAISE NOTICE '  ✓ agbot_assets (23 rows, 376 kB)';
  RAISE NOTICE '  ✓ agbot_readings_history (6,682 rows, 2.1 MB)';
  RAISE NOTICE '  ✓ agbot_alerts (0 rows, 24 kB)';
  RAISE NOTICE '';
  RAISE NOTICE 'FK Constraints Updated:';
  RAISE NOTICE '  ✓ customer_tank_access → ta_agbot_locations: %',
    CASE WHEN customer_fk_valid THEN 'VALID' ELSE 'INVALID' END;
  RAISE NOTICE '  ✓ delivery_requests → ta_agbot_locations: %',
    CASE WHEN delivery_fk_valid THEN 'VALID' ELSE 'INVALID' END;
  RAISE NOTICE '';
  RAISE NOTICE 'Remaining legacy agbot tables in public schema: %', remaining_agbot_tables;

  IF remaining_agbot_tables > 0 THEN
    RAISE WARNING 'WARNING: % legacy agbot tables still exist in public schema!', remaining_agbot_tables;
  ELSE
    RAISE NOTICE '✅ All legacy agbot tables successfully removed!';
  END IF;

  IF NOT customer_fk_valid THEN
    RAISE WARNING 'WARNING: customer_tank_access FK does not point to ta_agbot_locations!';
  END IF;

  IF NOT delivery_fk_valid THEN
    RAISE WARNING 'WARNING: delivery_requests FK does not point to ta_agbot_locations!';
  END IF;

  RAISE NOTICE '================================================';
END $$;
