-- =====================================================
-- DATA FRESHNESS SYSTEM - STEP 6: POPULATE DATA SOURCES
-- =====================================================
-- This populates the initial data source registry
-- =====================================================

-- Populate initial data sources
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

-- Initialize freshness data for each source
DO $$
DECLARE
  source_record RECORD;
BEGIN
  FOR source_record IN 
    SELECT source_key FROM data_source_registry WHERE is_active = TRUE
  LOOP
    PERFORM refresh_source_freshness(source_record.source_key);
  END LOOP;
END $$;

SELECT 'Data freshness sources populated successfully' as result;