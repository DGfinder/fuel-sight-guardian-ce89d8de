-- =====================================================
-- DATA FRESHNESS SYSTEM - STEP 3: CREATE INDEXES
-- =====================================================
-- This creates indexes for performance
-- =====================================================

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_freshness_tracking_source_key ON data_freshness_tracking(source_key);
CREATE INDEX IF NOT EXISTS idx_data_freshness_tracking_last_updated ON data_freshness_tracking(last_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_freshness_tracking_status ON data_freshness_tracking(freshness_status);

CREATE INDEX IF NOT EXISTS idx_data_availability_calendar_source_date ON data_availability_calendar(source_key, data_date DESC);
CREATE INDEX IF NOT EXISTS idx_data_availability_calendar_date ON data_availability_calendar(data_date DESC);

SELECT 'Data freshness indexes created successfully' as result;