-- 🔗 GASBOT SIMPLE READINGS TABLE
-- Purpose: Store tank readings from simplified webhook in the simplest possible format
-- Design: Single table with essential fields only

-- Drop table if exists (for development)
DROP TABLE IF EXISTS gasbot_simple_readings;

-- Create simple readings table
CREATE TABLE gasbot_simple_readings (
  id SERIAL PRIMARY KEY,
  
  -- Essential tank identification
  location_name VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  device_serial VARCHAR(100),
  
  -- Core fuel data
  fuel_level_percent DECIMAL(5,2) DEFAULT 0,  -- e.g., 75.50%
  raw_fuel_level DECIMAL(5,2),               -- raw sensor reading
  volume_litres DECIMAL(10,2) DEFAULT 0,     -- current volume in litres
  
  -- Device status
  device_online BOOLEAN DEFAULT true,
  battery_voltage DECIMAL(5,2),
  
  -- Timestamps
  last_reading TIMESTAMP WITH TIME ZONE,     -- when tank was read
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- when webhook received
  
  -- Store complete original data for reference
  raw_data JSONB,
  
  -- Indexes for performance
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_gasbot_simple_location ON gasbot_simple_readings(location_name);
CREATE INDEX idx_gasbot_simple_customer ON gasbot_simple_readings(customer_name);
CREATE INDEX idx_gasbot_simple_serial ON gasbot_simple_readings(device_serial);
CREATE INDEX idx_gasbot_simple_received ON gasbot_simple_readings(received_at DESC);
CREATE INDEX idx_gasbot_simple_fuel_level ON gasbot_simple_readings(fuel_level_percent);

-- Create view for latest readings per location
CREATE OR REPLACE VIEW gasbot_latest_readings AS
SELECT DISTINCT ON (location_name) 
  location_name,
  customer_name,
  device_serial,
  fuel_level_percent,
  volume_litres,
  device_online,
  battery_voltage,
  last_reading,
  received_at,
  id
FROM gasbot_simple_readings
ORDER BY location_name, received_at DESC;

-- Enable Row Level Security (but allow all access for simplicity)
ALTER TABLE gasbot_simple_readings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (simplest approach)
CREATE POLICY "Allow all gasbot operations" ON gasbot_simple_readings
FOR ALL USING (true);

-- Grant permissions to anon role
GRANT ALL ON gasbot_simple_readings TO anon;
GRANT ALL ON gasbot_simple_readings TO authenticated;
GRANT USAGE ON SEQUENCE gasbot_simple_readings_id_seq TO anon;
GRANT USAGE ON SEQUENCE gasbot_simple_readings_id_seq TO authenticated;

-- Sample data for testing
INSERT INTO gasbot_simple_readings (
  location_name, 
  customer_name, 
  device_serial, 
  fuel_level_percent, 
  volume_litres, 
  device_online,
  last_reading,
  raw_data
) VALUES 
('Demo Tank A', 'Test Customer', 'DEMO-001', 75.50, 3020.00, true, NOW() - interval '1 hour', '{"demo": true}'),
('Demo Tank B', 'Test Customer', 'DEMO-002', 45.20, 1808.00, true, NOW() - interval '2 hours', '{"demo": true}'),
('Demo Tank C', 'Another Customer', 'DEMO-003', 22.10, 884.00, false, NOW() - interval '1 day', '{"demo": true}');

-- Success message
SELECT 'gasbot_simple_readings table created successfully! 🚀' as status;