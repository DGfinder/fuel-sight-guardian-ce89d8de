-- =====================================================
-- COMPLETE DATA FRESHNESS TRACKING SYSTEM
-- =====================================================
-- This migration creates a comprehensive data freshness tracking system
-- to monitor when data was last updated across all data sources
-- and provide calendar-based data availability insights
--
-- IMPORTANT: This combines both the main system and triggers in correct order
-- IDEMPOTENT: Can be run multiple times safely
-- =====================================================

-- Optional: Clean slate approach (uncomment if you want to recreate everything)
-- DROP TABLE IF EXISTS data_availability_calendar CASCADE;
-- DROP TABLE IF EXISTS data_freshness_tracking CASCADE;
-- DROP TABLE IF EXISTS data_source_registry CASCADE;
-- DROP TYPE IF EXISTS freshness_status CASCADE;
-- DROP TYPE IF EXISTS data_source_type CASCADE;

-- Create enum for data source types (idempotent)
DO $$ BEGIN
  CREATE TYPE data_source_type AS ENUM (
    'csv_upload', 'api_sync', 'manual_entry', 'webhook', 'scheduled_import'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for freshness status (idempotent)
DO $$ BEGIN
  CREATE TYPE freshness_status AS ENUM (
    'fresh', 'stale', 'very_stale', 'critical'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- DATA SOURCE REGISTRY
-- =====================================================
-- Central registry of all data sources in the system
CREATE TABLE IF NOT EXISTS data_source_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  source_key TEXT UNIQUE NOT NULL, -- e.g., 'guardian_events', 'captive_payments'
  display_name TEXT NOT NULL, -- e.g., 'Guardian Compliance', 'Captive Payments'
  description TEXT,
  
  -- Database information
  table_name TEXT NOT NULL, -- Primary table name
  timestamp_column TEXT NOT NULL DEFAULT 'created_at', -- Column to check for freshness
  
  -- Freshness expectations (in hours)
  fresh_threshold_hours INTEGER DEFAULT 24, -- Data is fresh within this time
  stale_threshold_hours INTEGER DEFAULT 72, -- Data becomes stale after this
  critical_threshold_hours INTEGER DEFAULT 168, -- Data is critical after this (1 week)
  
  -- Source configuration
  source_type data_source_type NOT NULL DEFAULT 'csv_upload',
  route_path TEXT, -- URL path for the data source page
  icon_name TEXT, -- Icon identifier for UI
  color_class TEXT, -- CSS color class
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- DATA FRESHNESS TRACKING
-- =====================================================
-- Tracks the freshness status of each data source
CREATE TABLE IF NOT EXISTS data_freshness_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source reference
  source_key TEXT NOT NULL REFERENCES data_source_registry(source_key),
  
  -- Freshness data
  last_updated_at TIMESTAMPTZ NOT NULL,
  record_count BIGINT DEFAULT 0, -- Number of records in latest update
  total_records BIGINT DEFAULT 0, -- Total records in the source
  
  -- Status and metrics
  freshness_status freshness_status NOT NULL,
  hours_since_update DECIMAL(10, 2), -- Calculated hours since last update
  
  -- Source information
  last_upload_user_id UUID REFERENCES auth.users(id),
  last_upload_session_id UUID REFERENCES csv_upload_sessions(id),
  last_upload_filename TEXT,
  
  -- Metadata
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- DATA AVAILABILITY CALENDAR
-- =====================================================
-- Tracks which dates have data for each source (for calendar widget)
CREATE TABLE IF NOT EXISTS data_availability_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source and date
  source_key TEXT NOT NULL REFERENCES data_source_registry(source_key),
  data_date DATE NOT NULL,
  
  -- Availability metrics
  record_count INTEGER DEFAULT 0,
  upload_count INTEGER DEFAULT 0, -- Number of uploads on this date
  
  -- Latest upload info for this date
  latest_upload_at TIMESTAMPTZ,
  latest_upload_user_id UUID REFERENCES auth.users(id),
  latest_upload_filename TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one record per source per date
  UNIQUE(source_key, data_date)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_data_freshness_tracking_source_key ON data_freshness_tracking(source_key);
CREATE INDEX IF NOT EXISTS idx_data_freshness_tracking_last_updated ON data_freshness_tracking(last_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_freshness_tracking_status ON data_freshness_tracking(freshness_status);

CREATE INDEX IF NOT EXISTS idx_data_availability_calendar_source_date ON data_availability_calendar(source_key, data_date DESC);
CREATE INDEX IF NOT EXISTS idx_data_availability_calendar_date ON data_availability_calendar(data_date DESC);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to calculate freshness status based on hours since update
CREATE OR REPLACE FUNCTION calculate_freshness_status(
  hours_since_update DECIMAL,
  fresh_threshold INTEGER,
  stale_threshold INTEGER,
  critical_threshold INTEGER
) RETURNS freshness_status AS $$
BEGIN
  IF hours_since_update <= fresh_threshold THEN
    RETURN 'fresh';
  ELSIF hours_since_update <= stale_threshold THEN
    RETURN 'stale';
  ELSIF hours_since_update <= critical_threshold THEN
    RETURN 'very_stale';
  ELSE
    RETURN 'critical';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to refresh freshness data for all sources
CREATE OR REPLACE FUNCTION refresh_data_freshness()
RETURNS TABLE(
  source_key TEXT,
  last_updated_at TIMESTAMPTZ,
  hours_since_update DECIMAL,
  freshness_status freshness_status,
  record_count BIGINT
) AS $$
BEGIN
  -- Delete old freshness tracking records
  DELETE FROM data_freshness_tracking WHERE checked_at < NOW() - INTERVAL '1 hour';
  
  -- Insert fresh data for each registered source
  INSERT INTO data_freshness_tracking (
    source_key,
    last_updated_at,
    record_count,
    freshness_status,
    hours_since_update,
    checked_at
  )
  SELECT 
    dsr.source_key,
    COALESCE(latest_data.last_updated, '1970-01-01'::TIMESTAMPTZ) as last_updated_at,
    COALESCE(latest_data.record_count, 0) as record_count,
    calculate_freshness_status(
      EXTRACT(EPOCH FROM (NOW() - COALESCE(latest_data.last_updated, '1970-01-01'::TIMESTAMPTZ))) / 3600,
      dsr.fresh_threshold_hours,
      dsr.stale_threshold_hours,
      dsr.critical_threshold_hours
    ) as freshness_status,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(latest_data.last_updated, '1970-01-01'::TIMESTAMPTZ))) / 3600 as hours_since_update,
    NOW() as checked_at
  FROM data_source_registry dsr
  LEFT JOIN LATERAL (
    -- Dynamic query to get latest data from each source table
    SELECT 
      MAX(CASE 
        WHEN dsr.table_name = 'guardian_events' THEN ge.created_at
        WHEN dsr.table_name = 'captive_payment_records' THEN cpr.created_at
        WHEN dsr.table_name = 'csv_upload_sessions' THEN cus.created_at
        -- Add more table mappings as needed
      END) as last_updated,
      COUNT(*) as record_count
    FROM (VALUES (1)) v(dummy) -- Dummy table for lateral join
    LEFT JOIN guardian_events ge ON dsr.table_name = 'guardian_events' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guardian_events')
    LEFT JOIN captive_payment_records cpr ON dsr.table_name = 'captive_payment_records' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'captive_payment_records')
    LEFT JOIN csv_upload_sessions cus ON dsr.table_name = 'csv_upload_sessions' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'csv_upload_sessions')
    WHERE CASE 
      WHEN dsr.table_name = 'guardian_events' THEN ge.id IS NOT NULL
      WHEN dsr.table_name = 'captive_payment_records' THEN cpr.id IS NOT NULL
      WHEN dsr.table_name = 'csv_upload_sessions' THEN cus.id IS NOT NULL
      ELSE FALSE
    END
  ) latest_data ON TRUE
  WHERE dsr.is_active = TRUE;
  
  -- Return the results
  RETURN QUERY
  SELECT 
    dft.source_key,
    dft.last_updated_at,
    dft.hours_since_update,
    dft.freshness_status,
    dft.record_count
  FROM data_freshness_tracking dft
  WHERE dft.checked_at >= NOW() - INTERVAL '5 minutes'
  ORDER BY dft.source_key;
END;
$$ LANGUAGE plpgsql;

-- Function to update data availability when new data is uploaded
CREATE OR REPLACE FUNCTION update_data_availability_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  source_key_var TEXT;
  data_date_var DATE;
  user_id_var UUID;
  filename_var TEXT;
BEGIN
  -- Determine source key based on table name
  CASE TG_TABLE_NAME
    WHEN 'guardian_events' THEN source_key_var := 'guardian_events';
    WHEN 'captive_payment_records' THEN source_key_var := 'captive_payments';
    WHEN 'csv_upload_sessions' THEN source_key_var := 'data_import';
    ELSE source_key_var := TG_TABLE_NAME;
  END CASE;

  -- Determine data date based on table structure
  CASE TG_TABLE_NAME
    WHEN 'guardian_events' THEN data_date_var := NEW.detection_time::DATE;
    WHEN 'captive_payment_records' THEN data_date_var := NEW.delivery_date;
    WHEN 'csv_upload_sessions' THEN data_date_var := NEW.created_at::DATE;
    ELSE data_date_var := COALESCE(NEW.created_at::DATE, CURRENT_DATE);
  END CASE;

  -- Get user info
  CASE TG_TABLE_NAME
    WHEN 'guardian_events' THEN 
      user_id_var := NULL; -- Guardian events don't have direct user association
      filename_var := NULL;
    WHEN 'captive_payment_records' THEN 
      user_id_var := NEW.created_by;
      filename_var := NEW.source_file;
    WHEN 'csv_upload_sessions' THEN 
      user_id_var := NEW.user_id;
      filename_var := NEW.original_filename;
    ELSE 
      user_id_var := NULL;
      filename_var := NULL;
  END CASE;

  -- Update or insert into data availability calendar
  INSERT INTO data_availability_calendar (
    source_key,
    data_date,
    record_count,
    upload_count,
    latest_upload_at,
    latest_upload_user_id,
    latest_upload_filename,
    updated_at
  ) VALUES (
    source_key_var,
    data_date_var,
    1, -- Will be updated by the update clause
    1, -- Will be updated by the update clause
    NOW(),
    user_id_var,
    filename_var,
    NOW()
  ) ON CONFLICT (source_key, data_date) DO UPDATE SET
    record_count = data_availability_calendar.record_count + 1,
    upload_count = CASE 
      WHEN filename_var IS NOT NULL AND filename_var != data_availability_calendar.latest_upload_filename 
      THEN data_availability_calendar.upload_count + 1
      ELSE data_availability_calendar.upload_count
    END,
    latest_upload_at = GREATEST(data_availability_calendar.latest_upload_at, NOW()),
    latest_upload_user_id = COALESCE(user_id_var, data_availability_calendar.latest_upload_user_id),
    latest_upload_filename = COALESCE(filename_var, data_availability_calendar.latest_upload_filename),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh freshness tracking for a specific source
CREATE OR REPLACE FUNCTION refresh_source_freshness(source_key_param TEXT)
RETURNS VOID AS $$
DECLARE
  source_config RECORD;
  latest_timestamp TIMESTAMPTZ;
  record_count_val BIGINT;
  hours_since DECIMAL;
  freshness_status_val freshness_status;
BEGIN
  -- Get source configuration
  SELECT * INTO source_config
  FROM data_source_registry
  WHERE source_key = source_key_param AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN; -- Source not found or not active
  END IF;

  -- Get latest timestamp and record count based on table (only if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = source_config.table_name) THEN
    EXECUTE format('
      SELECT MAX(%I) as latest_timestamp, COUNT(*) as record_count
      FROM %I
      WHERE %I IS NOT NULL
    ', source_config.timestamp_column, source_config.table_name, source_config.timestamp_column)
    INTO latest_timestamp, record_count_val;
  ELSE
    latest_timestamp := NULL;
    record_count_val := 0;
  END IF;

  -- Calculate hours since update
  hours_since := EXTRACT(EPOCH FROM (NOW() - COALESCE(latest_timestamp, '1970-01-01'::TIMESTAMPTZ))) / 3600;

  -- Calculate freshness status
  freshness_status_val := calculate_freshness_status(
    hours_since,
    source_config.fresh_threshold_hours,
    source_config.stale_threshold_hours,
    source_config.critical_threshold_hours
  );

  -- Delete old tracking record for this source
  DELETE FROM data_freshness_tracking 
  WHERE source_key = source_key_param;

  -- Insert new tracking record
  INSERT INTO data_freshness_tracking (
    source_key,
    last_updated_at,
    record_count,
    total_records,
    freshness_status,
    hours_since_update,
    checked_at
  ) VALUES (
    source_key_param,
    COALESCE(latest_timestamp, '1970-01-01'::TIMESTAMPTZ),
    record_count_val,
    record_count_val,
    freshness_status_val,
    hours_since,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Function to be called by triggers to update freshness
CREATE OR REPLACE FUNCTION trigger_update_freshness()
RETURNS TRIGGER AS $$
DECLARE
  source_key_var TEXT;
BEGIN
  -- Map table name to source key
  CASE TG_TABLE_NAME
    WHEN 'guardian_events' THEN source_key_var := 'guardian_events';
    WHEN 'captive_payment_records' THEN source_key_var := 'captive_payments';
    WHEN 'csv_upload_sessions' THEN source_key_var := 'data_import';
    ELSE source_key_var := TG_TABLE_NAME;
  END CASE;

  -- Update freshness for this source (async to avoid blocking)
  PERFORM refresh_source_freshness(source_key_var);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update data availability for batch uploads
CREATE OR REPLACE FUNCTION update_data_availability_batch(
  source_key_param TEXT,
  data_date_param DATE,
  record_count_param INTEGER,
  user_id_param UUID DEFAULT NULL,
  filename_param TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO data_availability_calendar (
    source_key,
    data_date,
    record_count,
    upload_count,
    latest_upload_at,
    latest_upload_user_id,
    latest_upload_filename,
    updated_at
  ) VALUES (
    source_key_param,
    data_date_param,
    record_count_param,
    1,
    NOW(),
    user_id_param,
    filename_param,
    NOW()
  ) ON CONFLICT (source_key, data_date) DO UPDATE SET
    record_count = data_availability_calendar.record_count + record_count_param,
    upload_count = data_availability_calendar.upload_count + 1,
    latest_upload_at = NOW(),
    latest_upload_user_id = COALESCE(user_id_param, data_availability_calendar.latest_upload_user_id),
    latest_upload_filename = COALESCE(filename_param, data_availability_calendar.latest_upload_filename),
    updated_at = NOW();

  -- Update freshness for this source
  PERFORM refresh_source_freshness(source_key_param);
END;
$$ LANGUAGE plpgsql;

-- Function to be called by a scheduled job (e.g., every hour)
CREATE OR REPLACE FUNCTION scheduled_freshness_refresh()
RETURNS TEXT AS $$
DECLARE
  source_record RECORD;
  refresh_count INTEGER := 0;
BEGIN
  -- Refresh all active sources
  FOR source_record IN 
    SELECT source_key FROM data_source_registry WHERE is_active = TRUE
  LOOP
    PERFORM refresh_source_freshness(source_record.source_key);
    refresh_count := refresh_count + 1;
  END LOOP;

  RETURN format('Refreshed freshness data for %s sources', refresh_count);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- POPULATE INITIAL DATA SOURCES
-- =====================================================
INSERT INTO data_source_registry (
  source_key, display_name, description, table_name, 
  route_path, icon_name, color_class, source_type,
  fresh_threshold_hours, stale_threshold_hours, critical_threshold_hours
) VALUES 
  (
    'guardian_events', 'Guardian Compliance', 
    'Monitor distraction and fatigue events with verification workflows',
    'guardian_events', '/data-centre/guardian', 'Shield', 'bg-blue-500', 'csv_upload',
    24, 72, 168
  ),
  (
    'captive_payments', 'Captive Payments',
    'Track SMB and GSF carrier performance and volume metrics', 
    'captive_payment_records', '/data-centre/captive-payments', 'CreditCard', 'bg-green-500', 'csv_upload',
    24, 72, 168
  ),
  (
    'lytx_safety', 'LYTX Safety',
    'Driver safety scores, coaching workflows, and risk assessment',
    'csv_upload_sessions', '/data-centre/safety', 'AlertTriangle', 'bg-orange-500', 'api_sync',
    12, 48, 120
  ),
  (
    'data_import', 'Data Import',
    'Upload and process Excel/CSV files from multiple sources',
    'csv_upload_sessions', '/data-centre/import', 'Upload', 'bg-purple-500', 'csv_upload',
    1, 6, 24
  ),
  (
    'mtdata_trips', 'MtData Trip Analytics',
    'Operational insights from vehicle trip data and route optimization',
    'csv_upload_sessions', '/data-centre/mtdata', 'Navigation', 'bg-emerald-500', 'csv_upload',
    24, 72, 168
  ),
  (
    'driver_profiles', 'Driver Profiles',
    'Comprehensive driver analytics with LYTX, Guardian, and trip data',
    'csv_upload_sessions', '/data-centre/drivers', 'Users', 'bg-cyan-500', 'csv_upload',
    24, 72, 168
  )
ON CONFLICT (source_key) DO NOTHING;

-- =====================================================
-- CREATE TRIGGERS ON DATA TABLES
-- =====================================================

-- Guardian Events triggers (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guardian_events') THEN
    DROP TRIGGER IF EXISTS guardian_events_availability_trigger ON guardian_events;
    CREATE TRIGGER guardian_events_availability_trigger
      AFTER INSERT ON guardian_events
      FOR EACH ROW EXECUTE FUNCTION update_data_availability_on_insert();

    DROP TRIGGER IF EXISTS guardian_events_freshness_trigger ON guardian_events;
    CREATE TRIGGER guardian_events_freshness_trigger
      AFTER INSERT OR UPDATE ON guardian_events
      FOR EACH STATEMENT EXECUTE FUNCTION trigger_update_freshness();
  END IF;
END $$;

-- Captive Payment Records triggers (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'captive_payment_records') THEN
    DROP TRIGGER IF EXISTS captive_payment_records_availability_trigger ON captive_payment_records;
    CREATE TRIGGER captive_payment_records_availability_trigger
      AFTER INSERT ON captive_payment_records
      FOR EACH ROW EXECUTE FUNCTION update_data_availability_on_insert();

    DROP TRIGGER IF EXISTS captive_payment_records_freshness_trigger ON captive_payment_records;
    CREATE TRIGGER captive_payment_records_freshness_trigger
      AFTER INSERT OR UPDATE ON captive_payment_records
      FOR EACH STATEMENT EXECUTE FUNCTION trigger_update_freshness();
  END IF;
END $$;

-- CSV Upload Sessions triggers (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'csv_upload_sessions') THEN
    DROP TRIGGER IF EXISTS csv_upload_sessions_availability_trigger ON csv_upload_sessions;
    CREATE TRIGGER csv_upload_sessions_availability_trigger
      AFTER INSERT ON csv_upload_sessions
      FOR EACH ROW EXECUTE FUNCTION update_data_availability_on_insert();

    DROP TRIGGER IF EXISTS csv_upload_sessions_freshness_trigger ON csv_upload_sessions;
    CREATE TRIGGER csv_upload_sessions_freshness_trigger
      AFTER INSERT OR UPDATE ON csv_upload_sessions
      FOR EACH STATEMENT EXECUTE FUNCTION trigger_update_freshness();
  END IF;
END $$;

-- =====================================================
-- VIEWS FOR EASY QUERYING
-- =====================================================

-- Comprehensive view combining source registry with freshness data
CREATE OR REPLACE VIEW data_freshness_dashboard AS
SELECT 
  dsr.source_key,
  dsr.display_name,
  dsr.description,
  dsr.route_path,
  dsr.icon_name,
  dsr.color_class,
  dsr.source_type,
  dft.last_updated_at,
  dft.freshness_status,
  dft.hours_since_update,
  dft.record_count,
  dft.total_records,
  dft.last_upload_filename,
  dsr.fresh_threshold_hours,
  dsr.stale_threshold_hours,
  dsr.critical_threshold_hours,
  -- Calculate percentage of fresh data
  CASE 
    WHEN dsr.fresh_threshold_hours > 0 THEN
      GREATEST(0, LEAST(100, 100 - (dft.hours_since_update / dsr.fresh_threshold_hours * 100)))
    ELSE 100
  END as freshness_percentage
FROM data_source_registry dsr
LEFT JOIN data_freshness_tracking dft ON dsr.source_key = dft.source_key
WHERE dsr.is_active = TRUE
  AND (dft.checked_at IS NULL OR dft.checked_at >= NOW() - INTERVAL '1 hour')
ORDER BY 
  CASE dft.freshness_status
    WHEN 'critical' THEN 1
    WHEN 'very_stale' THEN 2 
    WHEN 'stale' THEN 3
    WHEN 'fresh' THEN 4
    ELSE 5
  END,
  dft.hours_since_update DESC NULLS LAST;

-- Calendar view for data availability
CREATE OR REPLACE VIEW data_availability_summary AS
SELECT 
  dac.source_key,
  dsr.display_name,
  dac.data_date,
  dac.record_count,
  dac.upload_count,
  dac.latest_upload_at,
  dac.latest_upload_filename,
  EXTRACT(DOW FROM dac.data_date) as day_of_week,
  EXTRACT(WEEK FROM dac.data_date) as week_number,
  EXTRACT(MONTH FROM dac.data_date) as month_number
FROM data_availability_calendar dac
JOIN data_source_registry dsr ON dac.source_key = dsr.source_key
WHERE dsr.is_active = TRUE
  AND dac.data_date >= CURRENT_DATE - INTERVAL '90 days' -- Last 90 days
ORDER BY dac.data_date DESC, dsr.display_name;

-- =====================================================
-- RLS POLICIES
-- =====================================================
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

-- Admins can manage data source registry
DO $$ BEGIN
  CREATE POLICY "Admins can manage data source registry" ON data_source_registry
    FOR ALL TO authenticated USING (
      EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager')
      )
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- INITIAL DATA POPULATION
-- =====================================================

-- Populate initial data availability calendar for existing data
DO $$
DECLARE
  source_record RECORD;
BEGIN
  FOR source_record IN 
    SELECT * FROM data_source_registry WHERE is_active = TRUE
  LOOP
    CASE source_record.source_key
      WHEN 'guardian_events' THEN
        -- Only if guardian_events table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guardian_events') THEN
          INSERT INTO data_availability_calendar (source_key, data_date, record_count, upload_count, latest_upload_at)
          SELECT 
            'guardian_events',
            detection_time::DATE,
            COUNT(*),
            1,
            MAX(created_at)
          FROM guardian_events
          WHERE detection_time >= CURRENT_DATE - INTERVAL '90 days'
          GROUP BY detection_time::DATE
          ON CONFLICT (source_key, data_date) DO NOTHING;
        END IF;
        
      WHEN 'captive_payments' THEN
        -- Only if captive_payment_records table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'captive_payment_records') THEN
          INSERT INTO data_availability_calendar (source_key, data_date, record_count, upload_count, latest_upload_at)
          SELECT 
            'captive_payments',
            delivery_date,
            COUNT(*),
            1,
            MAX(created_at)
          FROM captive_payment_records
          WHERE delivery_date >= CURRENT_DATE - INTERVAL '90 days'
          GROUP BY delivery_date
          ON CONFLICT (source_key, data_date) DO NOTHING;
        END IF;
        
      WHEN 'data_import' THEN
        -- Only if csv_upload_sessions table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'csv_upload_sessions') THEN
          INSERT INTO data_availability_calendar (source_key, data_date, record_count, upload_count, latest_upload_at, latest_upload_filename)
          SELECT 
            'data_import',
            created_at::DATE,
            COUNT(*),
            COUNT(*),
            MAX(created_at),
            (array_agg(original_filename ORDER BY created_at DESC))[1]
          FROM csv_upload_sessions
          WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
          GROUP BY created_at::DATE
          ON CONFLICT (source_key, data_date) DO NOTHING;
        END IF;
      ELSE
        -- Skip unknown source keys
        NULL;
    END CASE;
  END LOOP;
END $$;

-- Initial freshness refresh
SELECT refresh_data_freshness();

SELECT 'Complete data freshness tracking system created successfully' as result;