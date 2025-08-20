-- =====================================================
-- DATA FRESHNESS SYSTEM - STEP 4: CREATE FUNCTIONS
-- =====================================================
-- This creates the core functions
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

-- Simplified function to refresh freshness tracking for a specific source
CREATE OR REPLACE FUNCTION refresh_source_freshness(source_key_param TEXT)
RETURNS VOID AS $$
DECLARE
  source_config RECORD;
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

  -- For now, just set a default freshness (we'll improve this later)
  hours_since := 1.0;
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
    NOW() - INTERVAL '1 hour',
    0,
    0,
    freshness_status_val,
    hours_since,
    NOW()
  );
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

SELECT 'Data freshness functions created successfully' as result;