-- =====================================================
-- DATA FRESHNESS SYSTEM - STEP 2: CREATE TABLES
-- =====================================================
-- This creates the core tables without complex operations
-- =====================================================

-- Central registry of all data sources in the system
CREATE TABLE IF NOT EXISTS data_source_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  source_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  
  -- Database information
  table_name TEXT NOT NULL,
  timestamp_column TEXT NOT NULL DEFAULT 'created_at',
  
  -- Freshness expectations (in hours)
  fresh_threshold_hours INTEGER DEFAULT 24,
  stale_threshold_hours INTEGER DEFAULT 72,
  critical_threshold_hours INTEGER DEFAULT 168,
  
  -- Source configuration
  source_type data_source_type NOT NULL DEFAULT 'csv_upload',
  route_path TEXT,
  icon_name TEXT,
  color_class TEXT,
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tracks the freshness status of each data source
CREATE TABLE IF NOT EXISTS data_freshness_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source reference
  source_key TEXT NOT NULL,
  
  -- Freshness data
  last_updated_at TIMESTAMPTZ NOT NULL,
  record_count BIGINT DEFAULT 0,
  total_records BIGINT DEFAULT 0,
  
  -- Status and metrics
  freshness_status freshness_status NOT NULL,
  hours_since_update DECIMAL(10, 2),
  
  -- Source information
  last_upload_user_id UUID,
  last_upload_session_id UUID,
  last_upload_filename TEXT,
  
  -- Metadata
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tracks which dates have data for each source (for calendar widget)
CREATE TABLE IF NOT EXISTS data_availability_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source and date
  source_key TEXT NOT NULL,
  data_date DATE NOT NULL,
  
  -- Availability metrics
  record_count INTEGER DEFAULT 0,
  upload_count INTEGER DEFAULT 0,
  
  -- Latest upload info for this date
  latest_upload_at TIMESTAMPTZ,
  latest_upload_user_id UUID,
  latest_upload_filename TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one record per source per date
  UNIQUE(source_key, data_date)
);

SELECT 'Data freshness tables created successfully' as result;