-- Migration: Create Guardian Events System for Guardian CSV Import
-- This creates comprehensive tables and indexes for Guardian safety event data
-- Based on Guardian CSV export format with columns: event_id, vehicle_id, vehicle, driver, detection_time, etc.

-- Drop existing guardian_events table if it exists (for fresh migration)
DROP TABLE IF EXISTS guardian_events CASCADE;

-- Create enhanced guardian_events table matching Guardian CSV export structure
CREATE TABLE guardian_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core Event Identification
  external_event_id TEXT NOT NULL, -- Guardian's event_id
  vehicle_id TEXT, -- Guardian's internal vehicle_id
  vehicle_registration TEXT NOT NULL, -- Guardian's vehicle field
  driver_name TEXT, -- Guardian's driver field
  
  -- Event Timing and Location
  detection_time TIMESTAMPTZ NOT NULL, -- Guardian's detection_time converted to timestamptz
  utc_offset INTEGER, -- Guardian's utc_offset in minutes
  timezone TEXT, -- Guardian's timezone
  latitude DECIMAL(10, 8), -- Guardian's latitude
  longitude DECIMAL(11, 8), -- Guardian's longitude
  
  -- Event Classification
  event_type TEXT NOT NULL, -- Guardian's event_type
  detected_event_type TEXT, -- Guardian's detected_event_type
  confirmation TEXT, -- Guardian's confirmation (verified, criteria not met, etc.)
  confirmation_time TIMESTAMPTZ, -- Guardian's confirmation_time
  classification TEXT, -- Guardian's classification field
  
  -- Event Metrics
  duration_seconds DECIMAL(10, 2), -- Guardian's duration_seconds
  speed_kph DECIMAL(6, 2), -- Guardian's speed_kph
  travel_metres DECIMAL(10, 2), -- Guardian's travel_metres
  
  -- Trip Context
  trip_distance_metres DECIMAL(12, 2), -- Guardian's trip_distance_metres
  trip_time_seconds INTEGER, -- Guardian's trip_time_seconds
  
  -- Alert Configuration
  audio_alert BOOLEAN DEFAULT FALSE, -- Guardian's audio_alert (yes/no -> boolean)
  vibration_alert BOOLEAN DEFAULT FALSE, -- Guardian's vibration_alert (yes/no -> boolean)
  
  -- Fleet and Organization
  fleet TEXT NOT NULL, -- Guardian's fleet field or mapped value
  account TEXT, -- Guardian's account
  service_provider TEXT, -- Guardian's service_provider
  shift_info TEXT, -- Guardian's shift field
  crew TEXT, -- Guardian's crew field
  
  -- Technical Details  
  guardian_unit TEXT, -- Guardian's guardian_unit
  software_version TEXT, -- Guardian's software_version
  tags TEXT, -- Guardian's tags field
  
  -- System Fields for Fuel Sight
  severity TEXT NOT NULL DEFAULT 'Low' CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  verified BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Active',
  depot TEXT, -- Inferred from location or vehicle
  
  -- Audit Fields
  raw_data JSONB, -- Complete original Guardian data
  import_batch_id TEXT, -- Reference to data_import_batches
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT guardian_events_external_event_id_unique UNIQUE (external_event_id),
  CONSTRAINT guardian_events_speed_positive CHECK (speed_kph IS NULL OR speed_kph >= 0),
  CONSTRAINT guardian_events_duration_positive CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  CONSTRAINT guardian_events_coordinates_valid CHECK (
    (latitude IS NULL AND longitude IS NULL) OR 
    (latitude IS NOT NULL AND longitude IS NOT NULL AND 
     latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  )
);

-- Performance Indexes
CREATE INDEX idx_guardian_events_vehicle_registration ON guardian_events(vehicle_registration);
CREATE INDEX idx_guardian_events_detection_time ON guardian_events(detection_time DESC);
CREATE INDEX idx_guardian_events_event_type ON guardian_events(event_type);
CREATE INDEX idx_guardian_events_fleet ON guardian_events(fleet);
CREATE INDEX idx_guardian_events_severity ON guardian_events(severity);
CREATE INDEX idx_guardian_events_verified ON guardian_events(verified);
CREATE INDEX idx_guardian_events_status ON guardian_events(status);
CREATE INDEX idx_guardian_events_depot ON guardian_events(depot);
CREATE INDEX idx_guardian_events_confirmation ON guardian_events(confirmation);
CREATE INDEX idx_guardian_events_external_event_id ON guardian_events(external_event_id);
CREATE INDEX idx_guardian_events_import_batch ON guardian_events(import_batch_id);

-- Composite indexes for common queries
CREATE INDEX idx_guardian_events_fleet_detection_time ON guardian_events(fleet, detection_time DESC);
CREATE INDEX idx_guardian_events_vehicle_detection_time ON guardian_events(vehicle_registration, detection_time DESC);
CREATE INDEX idx_guardian_events_severity_detection_time ON guardian_events(severity, detection_time DESC) WHERE severity IN ('High', 'Critical');
CREATE INDEX idx_guardian_events_unverified ON guardian_events(verified, severity, detection_time DESC) WHERE NOT verified;

-- Full-text search index for event types and classifications
CREATE INDEX idx_guardian_events_search ON guardian_events USING gin(to_tsvector('english', coalesce(event_type, '') || ' ' || coalesce(classification, '') || ' ' || coalesce(confirmation, '')));

-- Geographic index for location-based queries
CREATE INDEX idx_guardian_events_location ON guardian_events USING gist(point(longitude, latitude)) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- RLS Policies
ALTER TABLE guardian_events ENABLE ROW LEVEL SECURITY;

-- Users can view events based on their group permissions
CREATE POLICY "Users can view Guardian events for their permitted groups" ON guardian_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_group_permissions ugp
      JOIN tank_groups tg ON ugp.group_id = tg.id
      WHERE ugp.user_id = auth.uid()
      AND (
        (tg.name = 'Stevemacs' AND guardian_events.fleet ILIKE '%stevemacs%') OR
        (tg.name = 'Great Southern Fuels' AND guardian_events.fleet ILIKE '%great southern%')
      )
    ) OR
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

-- System/API can manage all Guardian events
CREATE POLICY "System can manage all Guardian events" ON guardian_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admins can manage all Guardian events
CREATE POLICY "Admins can manage Guardian events" ON guardian_events
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_guardian_events_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guardian_events_updated_at_trigger
  BEFORE UPDATE ON guardian_events
  FOR EACH ROW EXECUTE FUNCTION update_guardian_events_timestamp();

-- Enhanced analytics view for Guardian events
CREATE OR REPLACE VIEW guardian_events_analytics AS
SELECT 
  fleet,
  depot,
  DATE_TRUNC('month', detection_time) as month,
  EXTRACT(year FROM DATE_TRUNC('month', detection_time)) as year,
  EXTRACT(month FROM DATE_TRUNC('month', detection_time)) as month_num,
  event_type,
  severity,
  confirmation,
  COUNT(*) as event_count,
  COUNT(DISTINCT vehicle_registration) as unique_vehicles,
  COUNT(DISTINCT driver_name) as unique_drivers,
  COUNT(*) FILTER (WHERE verified) as verified_events,
  COUNT(*) FILTER (WHERE confirmation = 'verified') as guardian_verified_events,
  COUNT(*) FILTER (WHERE confirmation = 'criteria not met') as criteria_not_met_events,
  COUNT(*) FILTER (WHERE severity IN ('High', 'Critical')) as high_severity_events,
  AVG(duration_seconds) as avg_duration_seconds,
  AVG(speed_kph) as avg_speed_kph,
  MIN(detection_time) as earliest_event,
  MAX(detection_time) as latest_event
FROM guardian_events
WHERE detection_time >= CURRENT_DATE - INTERVAL '2 years'
GROUP BY fleet, depot, DATE_TRUNC('month', detection_time), event_type, severity, confirmation
ORDER BY EXTRACT(year FROM DATE_TRUNC('month', detection_time)) DESC, 
         EXTRACT(month FROM DATE_TRUNC('month', detection_time)) DESC, 
         event_count DESC;

-- View for events requiring attention
CREATE OR REPLACE VIEW guardian_events_requiring_attention AS
SELECT 
  id,
  external_event_id,
  vehicle_registration,
  driver_name,
  detection_time,
  event_type,
  severity,
  confirmation,
  classification,
  fleet,
  depot,
  duration_seconds,
  speed_kph,
  verified,
  status,
  created_at
FROM guardian_events
WHERE 
  (NOT verified AND severity IN ('High', 'Critical'))
  OR (confirmation IS NULL)
  OR (status = 'Active' AND severity = 'Critical')
ORDER BY 
  CASE severity 
    WHEN 'Critical' THEN 1
    WHEN 'High' THEN 2
    WHEN 'Medium' THEN 3
    ELSE 4
  END,
  detection_time DESC;

-- View for daily Guardian event summary
CREATE OR REPLACE VIEW guardian_daily_summary AS
SELECT 
  DATE(detection_time) as event_date,
  fleet,
  depot,
  COUNT(*) as total_events,
  COUNT(DISTINCT vehicle_registration) as vehicles_with_events,
  COUNT(DISTINCT driver_name) FILTER (WHERE driver_name IS NOT NULL AND driver_name != '') as drivers_with_events,
  COUNT(*) FILTER (WHERE severity = 'Critical') as critical_events,
  COUNT(*) FILTER (WHERE severity = 'High') as high_events,
  COUNT(*) FILTER (WHERE event_type ILIKE '%distraction%') as distraction_events,
  COUNT(*) FILTER (WHERE event_type ILIKE '%fatigue%') as fatigue_events,
  COUNT(*) FILTER (WHERE event_type ILIKE '%fov%' OR event_type ILIKE '%field of view%') as fov_events,
  COUNT(*) FILTER (WHERE confirmation = 'verified') as verified_events,
  COUNT(*) FILTER (WHERE confirmation = 'criteria not met') as criteria_not_met_events,
  ROUND(AVG(duration_seconds), 2) as avg_event_duration,
  ROUND(AVG(speed_kph), 2) as avg_event_speed
FROM guardian_events
WHERE detection_time >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(detection_time), fleet, depot
ORDER BY event_date DESC, fleet, depot;

-- Update data_import_batches to include Guardian events if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'data_import_batches_source_type_check'
    AND check_clause LIKE '%guardian_events%'
  ) THEN
    ALTER TABLE data_import_batches 
    DROP CONSTRAINT IF EXISTS data_import_batches_source_type_check;
    
    ALTER TABLE data_import_batches 
    ADD CONSTRAINT data_import_batches_source_type_check 
    CHECK (source_type IN ('captive_payments', 'lytx_events', 'guardian_events', 'driver_data'));
  END IF;
END $$;

-- Function to clean up old Guardian events (optional - for data retention)
CREATE OR REPLACE FUNCTION cleanup_old_guardian_events(retention_months INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM guardian_events 
  WHERE detection_time < CURRENT_DATE - INTERVAL '1 month' * retention_months
  AND status NOT IN ('Verified', 'Under Investigation');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON guardian_events TO authenticated;
GRANT SELECT ON guardian_events_analytics TO authenticated;
GRANT SELECT ON guardian_events_requiring_attention TO authenticated;
GRANT SELECT ON guardian_daily_summary TO authenticated;

-- Success message
SELECT 'Guardian Events system created successfully' as result,
       'Created table: guardian_events' as table_created,
       'Created views: guardian_events_analytics, guardian_events_requiring_attention, guardian_daily_summary' as views_created,
       'Applied RLS policies for group-based access' as security_applied;