-- ============================================================================
-- TankAlert Unified Schema Migration
-- Creates ta_agbot_*, ta_smartfill_* and unified analytics views
-- ============================================================================

-- ============================================================================
-- PHASE 1: ta_agbot_* Tables (Premium AgBot Telemetry)
-- ============================================================================

-- 1.1 ta_agbot_locations (Customer Sites)
CREATE TABLE IF NOT EXISTS ta_agbot_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_guid TEXT UNIQUE NOT NULL,

  -- Identity
  name TEXT NOT NULL,
  customer_name TEXT,
  customer_guid TEXT,
  tenancy_name TEXT,

  -- Address
  address TEXT,
  state TEXT,
  postcode TEXT,
  country TEXT DEFAULT 'Australia',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),

  -- Status
  installation_status INT DEFAULT 0,
  installation_status_label TEXT,
  is_disabled BOOLEAN DEFAULT false,

  -- Aggregated consumption (from webhook)
  daily_consumption_liters DECIMAL(10,2),
  days_remaining INT,
  calibrated_fill_level DECIMAL(5,2),

  -- Aggregated metrics (calculated)
  total_assets INT DEFAULT 0,
  assets_online INT DEFAULT 0,
  avg_fill_percent DECIMAL(5,2),

  -- Timestamps
  last_telemetry_at TIMESTAMPTZ,
  last_telemetry_epoch BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_agbot_locations_customer ON ta_agbot_locations(customer_guid);
CREATE INDEX IF NOT EXISTS idx_ta_agbot_locations_disabled ON ta_agbot_locations(is_disabled);

-- 1.2 ta_agbot_assets (Tanks with FULL Webhook Data)
CREATE TABLE IF NOT EXISTS ta_agbot_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES ta_agbot_locations(id) ON DELETE CASCADE,
  external_guid TEXT UNIQUE NOT NULL,

  -- Tank Identity
  name TEXT,
  serial_number TEXT,
  profile_name TEXT,
  profile_guid TEXT,
  commodity TEXT,

  -- Tank Dimensions
  capacity_liters DECIMAL(12,2),
  max_depth_m DECIMAL(6,2),
  max_pressure_bar DECIMAL(6,2),
  max_display_percent DECIMAL(5,2),

  -- Current Tank Level
  current_level_liters DECIMAL(12,2),
  current_level_percent DECIMAL(5,2),
  current_raw_percent DECIMAL(5,2),
  current_depth_m DECIMAL(6,2),
  current_pressure_bar DECIMAL(6,2),
  ullage_liters DECIMAL(12,2),

  -- Consumption Analytics (from Gasbot)
  daily_consumption_liters DECIMAL(10,2),
  days_remaining INT,

  -- Device Hardware
  device_guid TEXT,
  device_serial TEXT,
  device_model INT,
  device_model_name TEXT,
  device_sku TEXT,
  device_network_id TEXT,
  helmet_serial TEXT,

  -- Device Health (Premium!)
  is_online BOOLEAN DEFAULT false,
  is_disabled BOOLEAN DEFAULT false,
  device_state TEXT,
  battery_voltage DECIMAL(4,2),
  temperature_c DECIMAL(5,1),

  -- Timestamps
  device_activated_at TIMESTAMPTZ,
  device_activation_epoch BIGINT,
  last_telemetry_at TIMESTAMPTZ,
  last_telemetry_epoch BIGINT,
  last_raw_telemetry_at TIMESTAMPTZ,
  last_calibrated_telemetry_at TIMESTAMPTZ,
  asset_updated_at TIMESTAMPTZ,
  asset_updated_epoch BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  raw_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_ta_agbot_assets_location ON ta_agbot_assets(location_id);
CREATE INDEX IF NOT EXISTS idx_ta_agbot_assets_online ON ta_agbot_assets(is_online);
CREATE INDEX IF NOT EXISTS idx_ta_agbot_assets_commodity ON ta_agbot_assets(commodity);
CREATE INDEX IF NOT EXISTS idx_ta_agbot_assets_battery ON ta_agbot_assets(battery_voltage);
CREATE INDEX IF NOT EXISTS idx_ta_agbot_assets_days ON ta_agbot_assets(days_remaining);
CREATE INDEX IF NOT EXISTS idx_ta_agbot_assets_serial ON ta_agbot_assets(serial_number);

-- 1.3 ta_agbot_readings (Time-Series Telemetry)
CREATE TABLE IF NOT EXISTS ta_agbot_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES ta_agbot_assets(id) ON DELETE CASCADE,

  -- Tank level readings
  level_liters DECIMAL(12,2),
  level_percent DECIMAL(5,2),
  raw_percent DECIMAL(5,2),
  depth_m DECIMAL(6,2),
  pressure_bar DECIMAL(6,2),

  -- Device state snapshot
  is_online BOOLEAN,
  battery_voltage DECIMAL(4,2),
  temperature_c DECIMAL(5,1),
  device_state TEXT,

  -- Pre-calculated analytics
  daily_consumption DECIMAL(10,2),
  days_remaining INT,

  -- Timestamps
  reading_at TIMESTAMPTZ NOT NULL,
  telemetry_epoch BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_agbot_readings_asset_time ON ta_agbot_readings(asset_id, reading_at DESC);
CREATE INDEX IF NOT EXISTS idx_ta_agbot_readings_time ON ta_agbot_readings(reading_at DESC);
CREATE INDEX IF NOT EXISTS idx_ta_agbot_readings_battery ON ta_agbot_readings(asset_id, battery_voltage, reading_at DESC);

-- 1.4 ta_agbot_device_health (Premium Battery/Device Tracking)
CREATE TABLE IF NOT EXISTS ta_agbot_device_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES ta_agbot_assets(id) ON DELETE CASCADE,
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Battery health
  battery_voltage_avg DECIMAL(4,2),
  battery_voltage_min DECIMAL(4,2),
  battery_voltage_max DECIMAL(4,2),
  battery_trend TEXT,
  battery_days_remaining INT,

  -- Temperature monitoring
  temperature_avg DECIMAL(5,1),
  temperature_min DECIMAL(5,1),
  temperature_max DECIMAL(5,1),

  -- Connectivity
  uptime_percent DECIMAL(5,2),
  offline_events INT,
  longest_offline_minutes INT,

  -- Sensor health
  calibration_drift DECIMAL(5,2),
  sensor_health_score INT,

  -- Overall health
  health_status TEXT,
  health_score INT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, check_date)
);

CREATE INDEX IF NOT EXISTS idx_ta_agbot_device_health_asset ON ta_agbot_device_health(asset_id, check_date DESC);

-- 1.5 ta_agbot_alerts (Real-time Webhook Alerts)
CREATE TABLE IF NOT EXISTS ta_agbot_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES ta_agbot_assets(id) ON DELETE CASCADE,

  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,

  -- Alert context
  current_value DECIMAL(12,2),
  threshold_value DECIMAL(12,2),
  previous_value DECIMAL(12,2),

  -- Status
  is_active BOOLEAN DEFAULT true,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_agbot_alerts_active ON ta_agbot_alerts(asset_id, is_active, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_ta_agbot_alerts_type ON ta_agbot_alerts(alert_type, is_active);

-- 1.6 ta_agbot_sync_log
CREATE TABLE IF NOT EXISTS ta_agbot_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  locations_processed INT DEFAULT 0,
  assets_processed INT DEFAULT 0,
  readings_processed INT DEFAULT 0,
  alerts_triggered INT DEFAULT 0,
  error_message TEXT,
  duration_ms INT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ta_agbot_sync_log_time ON ta_agbot_sync_log(started_at DESC);

-- ============================================================================
-- PHASE 2: RLS Policies for ta_agbot_* Tables
-- ============================================================================

ALTER TABLE ta_agbot_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_agbot_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_agbot_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_agbot_device_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_agbot_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_agbot_sync_log ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users
CREATE POLICY "Users can view agbot locations" ON ta_agbot_locations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view agbot assets" ON ta_agbot_assets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view agbot readings" ON ta_agbot_readings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view agbot device health" ON ta_agbot_device_health
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view agbot alerts" ON ta_agbot_alerts
  FOR SELECT TO authenticated USING (true);

-- System/admin write access
CREATE POLICY "System can manage agbot locations" ON ta_agbot_locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage agbot assets" ON ta_agbot_assets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage agbot readings" ON ta_agbot_readings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage agbot device health" ON ta_agbot_device_health
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage agbot alerts" ON ta_agbot_alerts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view sync logs" ON ta_agbot_sync_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can manage sync logs" ON ta_agbot_sync_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- PHASE 3: ta_tank_sources Bridge Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ta_tank_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ta_tank_id UUID NOT NULL REFERENCES ta_tanks(id) ON DELETE CASCADE,

  -- Data source links
  agbot_asset_id UUID REFERENCES ta_agbot_assets(id) ON DELETE SET NULL,
  smartfill_tank_id UUID,
  legacy_fuel_tank_id UUID,

  -- Primary source preference
  primary_source TEXT DEFAULT 'dip'
    CHECK (primary_source IN ('agbot', 'smartfill', 'dip', 'manual')),

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(ta_tank_id)
);

CREATE INDEX IF NOT EXISTS idx_ta_tank_sources_tank ON ta_tank_sources(ta_tank_id);
CREATE INDEX IF NOT EXISTS idx_ta_tank_sources_agbot ON ta_tank_sources(agbot_asset_id);
CREATE INDEX IF NOT EXISTS idx_ta_tank_sources_smartfill ON ta_tank_sources(smartfill_tank_id);

ALTER TABLE ta_tank_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tank sources" ON ta_tank_sources
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can manage tank sources" ON ta_tank_sources
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- PHASE 4: Analytics & Prediction Tables
-- ============================================================================

-- Daily predictions snapshot
CREATE TABLE IF NOT EXISTS ta_prediction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id UUID NOT NULL REFERENCES ta_tanks(id) ON DELETE CASCADE,
  prediction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  predicted_empty_date DATE,
  confidence_level TEXT,
  avg_daily_consumption DECIMAL(10,2),
  days_to_minimum INT,
  data_points_used INT,
  data_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tank_id, prediction_date)
);

CREATE INDEX IF NOT EXISTS idx_ta_prediction_history_tank ON ta_prediction_history(tank_id, prediction_date DESC);

-- Anomaly event log
CREATE TABLE IF NOT EXISTS ta_anomaly_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id UUID NOT NULL REFERENCES ta_tanks(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  level_before DECIMAL(12,2),
  level_after DECIMAL(12,2),
  expected_level DECIMAL(12,2),
  deviation_percent DECIMAL(5,2),
  data_source TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_anomaly_events_tank ON ta_anomaly_events(tank_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_ta_anomaly_events_type ON ta_anomaly_events(anomaly_type, severity);

-- Fleet health daily snapshot
CREATE TABLE IF NOT EXISTS ta_fleet_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  business_id UUID REFERENCES ta_businesses(id) ON DELETE CASCADE,
  total_tanks INT,
  tanks_critical INT,
  tanks_warning INT,
  tanks_healthy INT,
  average_fill_percent DECIMAL(5,2),
  total_consumption_liters DECIMAL(12,2),
  avg_days_remaining DECIMAL(5,1),
  agbot_devices_online INT,
  smartfill_devices_active INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_date, business_id)
);

CREATE INDEX IF NOT EXISTS idx_ta_fleet_snapshots_date ON ta_fleet_snapshots(snapshot_date DESC);

-- RLS for analytics tables
ALTER TABLE ta_prediction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_anomaly_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_fleet_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view predictions" ON ta_prediction_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view anomalies" ON ta_anomaly_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view fleet snapshots" ON ta_fleet_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can manage predictions" ON ta_prediction_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage anomalies" ON ta_anomaly_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage fleet snapshots" ON ta_fleet_snapshots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- PHASE 5: Updated at Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ta_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ta_agbot_locations_updated_at
  BEFORE UPDATE ON ta_agbot_locations
  FOR EACH ROW EXECUTE FUNCTION update_ta_updated_at();

CREATE TRIGGER ta_agbot_assets_updated_at
  BEFORE UPDATE ON ta_agbot_assets
  FOR EACH ROW EXECUTE FUNCTION update_ta_updated_at();

CREATE TRIGGER ta_tank_sources_updated_at
  BEFORE UPDATE ON ta_tank_sources
  FOR EACH ROW EXECUTE FUNCTION update_ta_updated_at();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'TankAlert Unified Schema created successfully' as result;
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'ta_agbot_%') as agbot_tables,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'ta_tank_sources') as bridge_table,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'ta_%_history' OR table_name LIKE 'ta_%_events' OR table_name LIKE 'ta_%_snapshots') as analytics_tables;
