-- Migration: Create SmartFill Monitoring System Tables
-- This creates a system for SmartFill JSON-RPC API integration
-- Separate from AgBot system to avoid conflicts, following established patterns

-- SmartFill Customers table (API credentials)
CREATE TABLE IF NOT EXISTS smartfill_customers (
  id SERIAL PRIMARY KEY,
  api_reference TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SmartFill Locations table (Units in SmartFill terminology)
CREATE TABLE IF NOT EXISTS smartfill_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_guid TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  customer_guid TEXT,
  customer_id INTEGER REFERENCES smartfill_customers(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  description TEXT,
  timezone TEXT DEFAULT 'Australia/Perth',
  latest_volume DECIMAL(10,2),
  latest_volume_percent DECIMAL(5,2),
  latest_status TEXT,
  latest_update_time TIMESTAMPTZ,
  raw_data JSONB, -- Store complete API response for debugging
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SmartFill Tanks table (Individual tanks within units)
CREATE TABLE IF NOT EXISTS smartfill_tanks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES smartfill_locations(id) ON DELETE CASCADE,
  tank_guid TEXT UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES smartfill_customers(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  tank_number TEXT NOT NULL,
  description TEXT,
  capacity DECIMAL(10,2),
  safe_fill_level DECIMAL(10,2), -- Tank Safe Fill Level (SFL)
  latest_volume DECIMAL(10,2),
  latest_volume_percent DECIMAL(5,2),
  latest_status TEXT,
  latest_update_time TIMESTAMPTZ,
  raw_data JSONB, -- Store complete tank data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SmartFill Historical readings table for trend analysis
CREATE TABLE IF NOT EXISTS smartfill_readings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id UUID REFERENCES smartfill_tanks(id) ON DELETE CASCADE,
  volume DECIMAL(10,2),
  volume_percent DECIMAL(5,2),
  status TEXT,
  update_time TIMESTAMPTZ,
  timezone TEXT,
  capacity DECIMAL(10,2),
  safe_fill_level DECIMAL(10,2),
  ullage DECIMAL(10,2), -- Remaining capacity
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SmartFill API sync log table for monitoring
CREATE TABLE IF NOT EXISTS smartfill_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL, -- 'manual', 'scheduled', 'api_test'
  sync_status TEXT NOT NULL, -- 'success', 'partial', 'failed', 'running'
  locations_processed INT DEFAULT 0,
  tanks_processed INT DEFAULT 0,
  readings_processed INT DEFAULT 0,
  error_message TEXT,
  sync_duration_ms INT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_smartfill_customers_name ON smartfill_customers(name);
CREATE INDEX IF NOT EXISTS idx_smartfill_customers_active ON smartfill_customers(active);
CREATE INDEX IF NOT EXISTS idx_smartfill_locations_customer ON smartfill_locations(customer_id);
CREATE INDEX IF NOT EXISTS idx_smartfill_locations_unit ON smartfill_locations(unit_number);
CREATE INDEX IF NOT EXISTS idx_smartfill_tanks_location ON smartfill_tanks(location_id);
CREATE INDEX IF NOT EXISTS idx_smartfill_tanks_customer ON smartfill_tanks(customer_id);
CREATE INDEX IF NOT EXISTS idx_smartfill_tanks_unit_tank ON smartfill_tanks(unit_number, tank_number);
CREATE INDEX IF NOT EXISTS idx_smartfill_readings_tank_time ON smartfill_readings_history(tank_id, update_time DESC);
CREATE INDEX IF NOT EXISTS idx_smartfill_sync_logs_timestamp ON smartfill_sync_logs(started_at DESC);

-- RLS Policies (inherit group-based access from main system)
ALTER TABLE smartfill_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE smartfill_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE smartfill_tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE smartfill_readings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE smartfill_sync_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read SmartFill data
CREATE POLICY "Users can view smartfill customers" ON smartfill_customers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view smartfill locations" ON smartfill_locations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view smartfill tanks" ON smartfill_tanks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view smartfill readings history" ON smartfill_readings_history
  FOR SELECT TO authenticated USING (true);

-- Only admins can view sync logs
CREATE POLICY "Admins can view smartfill sync logs" ON smartfill_sync_logs
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Insert/Update policies for system operations
CREATE POLICY "System can manage smartfill customers" ON smartfill_customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage smartfill locations" ON smartfill_locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage smartfill tanks" ON smartfill_tanks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage smartfill readings" ON smartfill_readings_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage smartfill sync logs" ON smartfill_sync_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_smartfill_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER smartfill_customers_updated_at
  BEFORE UPDATE ON smartfill_customers
  FOR EACH ROW EXECUTE FUNCTION update_smartfill_updated_at();

CREATE TRIGGER smartfill_locations_updated_at
  BEFORE UPDATE ON smartfill_locations
  FOR EACH ROW EXECUTE FUNCTION update_smartfill_updated_at();

CREATE TRIGGER smartfill_tanks_updated_at
  BEFORE UPDATE ON smartfill_tanks
  FOR EACH ROW EXECUTE FUNCTION update_smartfill_updated_at();

-- Insert sample customer data for testing (replace with real credentials)
-- This is just for structure - replace with actual customer data
INSERT INTO smartfill_customers (api_reference, api_secret, name, active) VALUES
('SAMPLE_API_REF_1', 'SAMPLE_SECRET_1', 'Sample Customer 1', false),
('SAMPLE_API_REF_2', 'SAMPLE_SECRET_2', 'Sample Customer 2', false)
ON CONFLICT DO NOTHING;

-- Create a view for easy access to current tank status
CREATE OR REPLACE VIEW smartfill_current_status AS
SELECT 
  l.customer_name,
  l.unit_number,
  l.description as unit_description,
  t.tank_number,
  t.description as tank_description,
  t.capacity,
  t.safe_fill_level,
  t.latest_volume,
  t.latest_volume_percent,
  t.latest_status,
  t.latest_update_time,
  (t.safe_fill_level - t.latest_volume) as ullage,
  CASE 
    WHEN t.latest_volume_percent < 25 THEN 'Low'
    WHEN t.latest_volume_percent < 50 THEN 'Medium'
    ELSE 'Good'
  END as fuel_level_status,
  t.created_at,
  t.updated_at
FROM smartfill_locations l
JOIN smartfill_tanks t ON l.id = t.location_id
ORDER BY l.customer_name, l.unit_number, t.tank_number;

-- Create a view for system health monitoring
CREATE OR REPLACE VIEW smartfill_system_health AS
SELECT 
  COUNT(DISTINCT c.id) as total_customers,
  COUNT(DISTINCT c.id) FILTER (WHERE c.active = true) as active_customers,
  COUNT(DISTINCT l.id) as total_locations,
  COUNT(DISTINCT t.id) as total_tanks,
  COUNT(DISTINCT t.id) FILTER (WHERE t.latest_volume_percent < 25) as tanks_low_fuel,
  COUNT(DISTINCT t.id) FILTER (WHERE t.latest_update_time < NOW() - INTERVAL '24 hours') as tanks_stale_data,
  AVG(t.latest_volume_percent) as avg_fuel_level,
  MAX(sl.completed_at) as last_successful_sync
FROM smartfill_customers c
LEFT JOIN smartfill_locations l ON c.id = l.customer_id
LEFT JOIN smartfill_tanks t ON l.id = t.location_id
LEFT JOIN smartfill_sync_logs sl ON sl.sync_status = 'success';

SELECT 'SmartFill monitoring system tables created successfully' as result;