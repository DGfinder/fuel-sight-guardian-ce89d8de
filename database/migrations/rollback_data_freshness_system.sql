-- =====================================================
-- ROLLBACK DATA FRESHNESS TRACKING SYSTEM
-- =====================================================
-- This script completely removes the data freshness tracking system
-- Use this if you need to start fresh or remove the system entirely
-- 
-- WARNING: This will delete all data freshness tracking data!
-- =====================================================

-- Drop triggers first
DO $$
BEGIN
  -- Guardian Events triggers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guardian_events') THEN
    DROP TRIGGER IF EXISTS guardian_events_availability_trigger ON guardian_events;
    DROP TRIGGER IF EXISTS guardian_events_freshness_trigger ON guardian_events;
  END IF;

  -- Captive Payment Records triggers  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'captive_payment_records') THEN
    DROP TRIGGER IF EXISTS captive_payment_records_availability_trigger ON captive_payment_records;
    DROP TRIGGER IF EXISTS captive_payment_records_freshness_trigger ON captive_payment_records;
  END IF;

  -- CSV Upload Sessions triggers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'csv_upload_sessions') THEN
    DROP TRIGGER IF EXISTS csv_upload_sessions_availability_trigger ON csv_upload_sessions;
    DROP TRIGGER IF EXISTS csv_upload_sessions_freshness_trigger ON csv_upload_sessions;
  END IF;
END $$;

-- Drop functions
DROP FUNCTION IF EXISTS update_data_availability_on_insert() CASCADE;
DROP FUNCTION IF EXISTS refresh_source_freshness(TEXT) CASCADE;
DROP FUNCTION IF EXISTS trigger_update_freshness() CASCADE;
DROP FUNCTION IF EXISTS update_data_availability_batch(TEXT, DATE, INTEGER, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS scheduled_freshness_refresh() CASCADE;
DROP FUNCTION IF EXISTS refresh_data_freshness() CASCADE;
DROP FUNCTION IF EXISTS calculate_freshness_status(DECIMAL, INTEGER, INTEGER, INTEGER) CASCADE;

-- Drop views
DROP VIEW IF EXISTS data_freshness_dashboard CASCADE;
DROP VIEW IF EXISTS data_availability_summary CASCADE;

-- Drop tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS data_availability_calendar CASCADE;
DROP TABLE IF EXISTS data_freshness_tracking CASCADE;
DROP TABLE IF EXISTS data_source_registry CASCADE;

-- Drop types
DROP TYPE IF EXISTS freshness_status CASCADE;
DROP TYPE IF EXISTS data_source_type CASCADE;

SELECT 'Data freshness tracking system completely removed' as result;