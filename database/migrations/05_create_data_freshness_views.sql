-- =====================================================
-- DATA FRESHNESS SYSTEM - STEP 5: CREATE VIEWS
-- =====================================================
-- This creates the views for easy querying
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
  AND dac.data_date >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY dac.data_date DESC, dsr.display_name;

SELECT 'Data freshness views created successfully' as result;