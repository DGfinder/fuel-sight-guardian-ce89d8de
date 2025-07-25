-- Migration: Create Agbot Monitoring System Tables
-- This creates a separate system for cellular agbot readings (percentage-based)
-- Completely separate from manual dip readings (liter-based) to avoid conflicts

-- Agbot Locations table (from Athara API locations)
CREATE TABLE IF NOT EXISTS agbot_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_guid TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  customer_guid TEXT,
  location_id TEXT,
  address1 TEXT,
  address2 TEXT,
  state TEXT,
  postcode TEXT,
  country TEXT,
  latest_calibrated_fill_percentage DECIMAL(5,2),
  installation_status INT,
  installation_status_label TEXT,
  location_status INT,
  location_status_label TEXT,
  latest_telemetry_epoch BIGINT,
  latest_telemetry TIMESTAMPTZ,
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  disabled BOOLEAN DEFAULT false,
  raw_data JSONB, -- Store complete API response for debugging
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agbot Assets/Devices table (from Athara API assets array)
CREATE TABLE IF NOT EXISTS agbot_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES agbot_locations(id) ON DELETE CASCADE,
  asset_guid TEXT UNIQUE NOT NULL,
  asset_serial_number TEXT,
  asset_disabled BOOLEAN DEFAULT false,
  asset_profile_guid TEXT,
  asset_profile_name TEXT,
  device_guid TEXT,
  device_serial_number TEXT,
  device_id TEXT,
  device_sku_guid TEXT,
  device_sku_model INT,
  device_sku_name TEXT,
  device_model_label TEXT,
  device_model INT,
  device_online BOOLEAN DEFAULT false,
  device_activation_date TIMESTAMPTZ,
  device_activation_epoch BIGINT,
  latest_calibrated_fill_percentage DECIMAL(5,2),
  latest_raw_fill_percentage DECIMAL(5,2),
  latest_telemetry_event_timestamp TIMESTAMPTZ,
  latest_telemetry_event_epoch BIGINT,
  latest_reported_lat DECIMAL(10,8),
  latest_reported_lng DECIMAL(11,8),
  subscription_id TEXT,
  raw_data JSONB, -- Store complete asset data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historical readings table for trend analysis
CREATE TABLE IF NOT EXISTS agbot_readings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES agbot_assets(id) ON DELETE CASCADE,
  calibrated_fill_percentage DECIMAL(5,2),
  raw_fill_percentage DECIMAL(5,2),
  reading_timestamp TIMESTAMPTZ,
  device_online BOOLEAN,
  telemetry_epoch BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API sync log table for monitoring
CREATE TABLE IF NOT EXISTS agbot_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL, -- 'full', 'incremental', 'manual'
  sync_status TEXT NOT NULL, -- 'success', 'partial', 'failed'
  locations_processed INT DEFAULT 0,
  assets_processed INT DEFAULT 0,
  readings_processed INT DEFAULT 0,
  error_message TEXT,
  sync_duration_ms INT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agbot_locations_customer ON agbot_locations(customer_guid);
CREATE INDEX IF NOT EXISTS idx_agbot_locations_status ON agbot_locations(location_status);
CREATE INDEX IF NOT EXISTS idx_agbot_assets_location ON agbot_assets(location_id);
CREATE INDEX IF NOT EXISTS idx_agbot_assets_device_serial ON agbot_assets(device_serial_number);
CREATE INDEX IF NOT EXISTS idx_agbot_assets_online ON agbot_assets(device_online);
CREATE INDEX IF NOT EXISTS idx_agbot_readings_asset_timestamp ON agbot_readings_history(asset_id, reading_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agbot_sync_logs_timestamp ON agbot_sync_logs(started_at DESC);

-- RLS Policies (inherit group-based access from main system)
ALTER TABLE agbot_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agbot_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE agbot_readings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agbot_sync_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read agbot data (can be refined later)
CREATE POLICY "Users can view agbot locations" ON agbot_locations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view agbot assets" ON agbot_assets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view agbot readings history" ON agbot_readings_history
  FOR SELECT TO authenticated USING (true);

-- Only admins can view sync logs
CREATE POLICY "Admins can view agbot sync logs" ON agbot_sync_logs
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Insert/Update policies for system operations
CREATE POLICY "System can manage agbot locations" ON agbot_locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage agbot assets" ON agbot_assets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage agbot readings" ON agbot_readings_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage agbot sync logs" ON agbot_sync_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_agbot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agbot_locations_updated_at
  BEFORE UPDATE ON agbot_locations
  FOR EACH ROW EXECUTE FUNCTION update_agbot_updated_at();

CREATE TRIGGER agbot_assets_updated_at
  BEFORE UPDATE ON agbot_assets
  FOR EACH ROW EXECUTE FUNCTION update_agbot_updated_at();

SELECT 'Agbot monitoring system tables created successfully' as result;