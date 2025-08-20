-- =====================================================
-- DATA FRESHNESS SYSTEM - STEP 7: SETUP SECURITY
-- =====================================================
-- This sets up RLS policies for the data freshness system
-- =====================================================

-- Enable RLS on tables
ALTER TABLE data_source_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_freshness_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_availability_calendar ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read data source registry
DO $$ BEGIN
  CREATE POLICY "Users can view data source registry" ON data_source_registry
    FOR SELECT TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- All authenticated users can read freshness data
DO $$ BEGIN
  CREATE POLICY "Users can view freshness tracking" ON data_freshness_tracking
    FOR SELECT TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- All authenticated users can read availability calendar
DO $$ BEGIN
  CREATE POLICY "Users can view availability calendar" ON data_availability_calendar
    FOR SELECT TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Only system/admin can modify these tables
DO $$ BEGIN
  CREATE POLICY "System can manage data source registry" ON data_source_registry
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "System can manage freshness tracking" ON data_freshness_tracking
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "System can manage availability calendar" ON data_availability_calendar
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

SELECT 'Data freshness security policies created successfully' as result;