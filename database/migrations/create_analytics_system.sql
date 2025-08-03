-- Multi-Source Analytics Platform Database Schema
-- Supports LYTX Safety, Guardian Events, MYOB Deliveries, and cross-source analytics

-- Data source management for flexible multi-source integration
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL, -- 'lytx_safety', 'guardian_distraction', 'guardian_fatigue', 'myob_smb', 'myob_gsf'
  type TEXT NOT NULL, -- 'daily_api', 'monthly_upload', 'csv_import', 'webhook'
  description TEXT,
  upload_frequency TEXT, -- 'daily', 'monthly', 'on_demand'
  file_format TEXT[], -- ['xlsx', 'csv', 'json']
  schema_definition JSONB, -- Expected columns and data types
  connection_config JSONB, -- API endpoints, authentication, etc.
  last_sync TIMESTAMP,
  sync_status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Upload batch tracking for monthly CFO uploads and file imports
CREATE TABLE IF NOT EXISTS upload_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID REFERENCES data_sources(id),
  filename TEXT,
  upload_type TEXT, -- 'monthly_cfo', 'historical_import', 'api_sync'
  file_size BIGINT,
  record_count INTEGER,
  duplicate_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id),
  upload_status TEXT DEFAULT 'processing', -- 'processing', 'completed', 'error'
  processing_notes TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Guardian events (distraction and fatigue monitoring)
CREATE TABLE IF NOT EXISTS guardian_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT UNIQUE NOT NULL, -- Guardian system event ID
  vehicle_id INTEGER,
  vehicle TEXT,
  driver TEXT,
  detection_time TIMESTAMP NOT NULL,
  utc_offset INTEGER,
  event_type TEXT NOT NULL, -- 'distraction' or 'fatigue'
  detected_event_type TEXT,
  duration_seconds DECIMAL,
  speed_kph INTEGER,
  travel_metres INTEGER,
  latitude DECIMAL,
  longitude DECIMAL,
  audio_alert BOOLEAN DEFAULT FALSE,
  vibration_alert BOOLEAN DEFAULT FALSE,
  trip_distance_metres INTEGER,
  trip_time_seconds INTEGER,
  
  -- Verification workflow
  confirmation TEXT, -- 'verified', 'normal driving', 'criteria not met', 'system error'
  confirmation_time TIMESTAMP,
  classification TEXT, -- 'distracted driving', 'cell phone use', 'yawning', 'acceptable driving'
  
  -- Fleet and system info
  fleet TEXT,
  timezone TEXT,
  account TEXT,
  service_provider TEXT,
  guardian_unit TEXT,
  software_version TEXT,
  labels TEXT,
  
  -- Internal tracking
  monthly_period DATE, -- For compliance reporting (YYYY-MM-01)
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP,
  upload_batch_id UUID REFERENCES upload_batches(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- MYOB carrier delivery data (SMB and GSF)
CREATE TABLE IF NOT EXISTS carrier_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier TEXT NOT NULL, -- 'SMB' (Stevemacs) or 'GSF' (Great Southern Fuels)
  delivery_date DATE NOT NULL,
  bill_of_lading TEXT,
  location TEXT,
  customer TEXT,
  product TEXT,
  volume_litres DECIMAL,
  
  -- Data management
  is_adjustment BOOLEAN DEFAULT FALSE, -- Track negative volume entries
  net_volume_litres DECIMAL, -- Calculated net after adjustments
  monthly_period DATE, -- For monthly reporting (YYYY-MM-01)
  upload_batch_id UUID REFERENCES upload_batches(id),
  data_checksum TEXT, -- Prevent duplicates during monthly uploads
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- LYTX safety events (enhanced from existing CSV structure)
CREATE TABLE IF NOT EXISTS lytx_safety_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL, -- LYTX event ID (e.g., EYKP77802)
  driver_name TEXT,
  employee_id TEXT,
  group_location TEXT,
  vehicle TEXT,
  device TEXT,
  event_date DATE,
  event_time TIME,
  timezone TEXT,
  safety_score INTEGER,
  status TEXT, -- 'Resolved', 'Face-To-Face'
  trigger_type TEXT, -- 'No Seat Belt', 'Braking', 'Food or Drink', etc.
  behaviors TEXT[], -- Array of behavior descriptions
  
  -- Driver assignment workflow
  assigned_driver_id UUID REFERENCES auth.users(id),
  assignment_status TEXT DEFAULT 'unassigned', -- 'unassigned', 'assigned', 'reviewed'
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP,
  
  -- Review workflow
  video_reviewed BOOLEAN DEFAULT FALSE,
  video_url TEXT,
  coaching_required BOOLEAN DEFAULT FALSE,
  coaching_completed BOOLEAN DEFAULT FALSE,
  tags TEXT[],
  
  -- Data management
  monthly_period DATE,
  upload_batch_id UUID REFERENCES upload_batches(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Driver performance aggregations and analytics
CREATE TABLE IF NOT EXISTS driver_performance_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_name TEXT NOT NULL,
  employee_id TEXT,
  month_year DATE NOT NULL, -- First day of month (YYYY-MM-01)
  
  -- LYTX Safety Metrics
  lytx_total_events INTEGER DEFAULT 0,
  lytx_avg_safety_score DECIMAL,
  lytx_severe_events INTEGER DEFAULT 0, -- Score 0-3
  lytx_coaching_sessions INTEGER DEFAULT 0,
  
  -- Guardian Metrics
  guardian_distraction_total INTEGER DEFAULT 0,
  guardian_distraction_verified INTEGER DEFAULT 0,
  guardian_fatigue_total INTEGER DEFAULT 0,
  guardian_fatigue_verified INTEGER DEFAULT 0,
  guardian_verification_rate DECIMAL,
  
  -- MYOB Delivery Metrics
  deliveries_completed INTEGER DEFAULT 0,
  total_volume_delivered DECIMAL DEFAULT 0,
  delivery_efficiency_score DECIMAL,
  
  -- Composite Metrics
  overall_safety_score DECIMAL,
  risk_category TEXT, -- 'low', 'medium', 'high', 'critical'
  performance_trend TEXT, -- 'improving', 'stable', 'declining'
  
  -- Metadata
  calculated_at TIMESTAMP DEFAULT NOW(),
  calculation_version TEXT DEFAULT '1.0',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(driver_name, month_year)
);

-- Monthly compliance reports for Guardian events
CREATE TABLE IF NOT EXISTS guardian_compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year DATE NOT NULL, -- First day of month
  
  -- Distraction Summary
  distraction_total_events INTEGER DEFAULT 0,
  distraction_verified_events INTEGER DEFAULT 0,
  distraction_verification_rate DECIMAL,
  distraction_false_positives INTEGER DEFAULT 0,
  distraction_system_errors INTEGER DEFAULT 0,
  
  -- Fatigue Summary  
  fatigue_total_events INTEGER DEFAULT 0,
  fatigue_verified_events INTEGER DEFAULT 0,
  fatigue_verification_rate DECIMAL,
  fatigue_false_positives INTEGER DEFAULT 0,
  fatigue_system_errors INTEGER DEFAULT 0,
  
  -- Trends and Analysis
  month_over_month_change DECIMAL,
  year_over_year_change DECIMAL,
  top_risk_vehicles TEXT[],
  calibration_issues TEXT[],
  
  -- Metadata
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMP DEFAULT NOW(),
  report_status TEXT DEFAULT 'draft', -- 'draft', 'final', 'sent'
  sent_to_compliance_manager BOOLEAN DEFAULT FALSE,
  
  UNIQUE(month_year)
);

-- Data quality and duplicate prevention
CREATE TABLE IF NOT EXISTS data_checksums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID REFERENCES data_sources(id),
  record_type TEXT, -- 'guardian_event', 'carrier_delivery', 'lytx_event'
  checksum TEXT NOT NULL,
  original_record_id TEXT,
  upload_batch_id UUID REFERENCES upload_batches(id),
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(data_source_id, record_type, checksum)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_guardian_events_monthly_period ON guardian_events(monthly_period);
CREATE INDEX IF NOT EXISTS idx_guardian_events_event_type ON guardian_events(event_type);
CREATE INDEX IF NOT EXISTS idx_guardian_events_confirmation ON guardian_events(confirmation);
CREATE INDEX IF NOT EXISTS idx_guardian_events_vehicle ON guardian_events(vehicle);
CREATE INDEX IF NOT EXISTS idx_guardian_events_detection_time ON guardian_events(detection_time);

CREATE INDEX IF NOT EXISTS idx_carrier_deliveries_monthly_period ON carrier_deliveries(monthly_period);
CREATE INDEX IF NOT EXISTS idx_carrier_deliveries_carrier ON carrier_deliveries(carrier);
CREATE INDEX IF NOT EXISTS idx_carrier_deliveries_delivery_date ON carrier_deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_carrier_deliveries_customer ON carrier_deliveries(customer);

CREATE INDEX IF NOT EXISTS idx_lytx_events_monthly_period ON lytx_safety_events(monthly_period);
CREATE INDEX IF NOT EXISTS idx_lytx_events_assignment_status ON lytx_safety_events(assignment_status);
CREATE INDEX IF NOT EXISTS idx_lytx_events_safety_score ON lytx_safety_events(safety_score);
CREATE INDEX IF NOT EXISTS idx_lytx_events_driver_name ON lytx_safety_events(driver_name);

CREATE INDEX IF NOT EXISTS idx_driver_performance_month_year ON driver_performance_monthly(month_year);
CREATE INDEX IF NOT EXISTS idx_driver_performance_driver_name ON driver_performance_monthly(driver_name);
CREATE INDEX IF NOT EXISTS idx_driver_performance_risk_category ON driver_performance_monthly(risk_category);

-- Row Level Security policies (inherit from existing system)
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE lytx_safety_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_performance_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_compliance_reports ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (will be enhanced with existing permission system)
CREATE POLICY IF NOT EXISTS "Analytics data is accessible to authenticated users" ON data_sources
  FOR ALL TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Upload batches are accessible to authenticated users" ON upload_batches
  FOR ALL TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Guardian events are accessible to authenticated users" ON guardian_events
  FOR ALL TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Carrier deliveries are accessible to authenticated users" ON carrier_deliveries
  FOR ALL TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "LYTX events are accessible to authenticated users" ON lytx_safety_events
  FOR ALL TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Driver performance is accessible to authenticated users" ON driver_performance_monthly
  FOR ALL TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Compliance reports are accessible to authenticated users" ON guardian_compliance_reports
  FOR ALL TO authenticated USING (true);

-- Initial data sources configuration
INSERT INTO data_sources (name, type, description, upload_frequency, file_format, schema_definition) VALUES
('lytx_safety', 'csv_import', 'LYTX DriveCam safety events with driver performance data', 'daily', ARRAY['csv'], '{"columns": ["event_id", "driver", "employee_id", "group", "vehicle", "device", "date", "time", "timezone", "score", "status", "trigger", "behaviors"]}'),
('guardian_distraction', 'csv_import', 'Guardian distraction monitoring events', 'daily', ARRAY['csv'], '{"columns": ["event_id", "vehicle_id", "vehicle", "driver", "detection_time", "event_type", "confirmation", "classification"]}'),
('guardian_fatigue', 'csv_import', 'Guardian fatigue monitoring events', 'daily', ARRAY['csv'], '{"columns": ["event_id", "vehicle_id", "vehicle", "driver", "detection_time", "event_type", "confirmation", "classification"]}'),
('myob_smb', 'monthly_upload', 'MYOB delivery data for SMB (Stevemacs) carrier', 'monthly', ARRAY['xlsx', 'csv'], '{"columns": ["date", "bill_of_lading", "location", "customer", "product", "volume"]}'),
('myob_gsf', 'monthly_upload', 'MYOB delivery data for GSF (Great Southern Fuels) carrier', 'monthly', ARRAY['xlsx', 'csv'], '{"columns": ["date", "bill_of_lading", "location", "customer", "product", "volume"]}')
ON CONFLICT (name) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE data_sources IS 'Configuration and metadata for all analytics data sources';
COMMENT ON TABLE guardian_events IS 'Guardian distraction and fatigue monitoring events with verification workflow';
COMMENT ON TABLE carrier_deliveries IS 'MYOB delivery data for SMB and GSF carriers with monthly upload workflow';
COMMENT ON TABLE lytx_safety_events IS 'LYTX DriveCam safety events with driver assignment and review workflow';
COMMENT ON TABLE driver_performance_monthly IS 'Monthly aggregated driver performance metrics across all data sources';
COMMENT ON TABLE guardian_compliance_reports IS 'Monthly Guardian compliance reports for management';
COMMENT ON TABLE upload_batches IS 'Tracking for file uploads and data import batches';
COMMENT ON TABLE data_checksums IS 'Duplicate prevention and data quality tracking';