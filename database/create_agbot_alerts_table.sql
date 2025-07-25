-- Create agbot_alerts table to support Agbot device alert functionality
-- This table stores alerts for Agbot devices, similar to tank_alerts but for Agbot assets

CREATE TABLE IF NOT EXISTS agbot_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agbot_asset_id VARCHAR(255) NOT NULL, -- Agbot asset ID (string format from Athara API)
  alert_type TEXT NOT NULL CHECK (alert_type IN ('device_offline', 'signal_issue', 'data_stale', 'maintenance')),
  message TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient querying of active alerts
CREATE INDEX IF NOT EXISTS idx_agbot_alerts_active ON agbot_alerts(agbot_asset_id, acknowledged_at, snoozed_until);
CREATE INDEX IF NOT EXISTS idx_agbot_alerts_created_at ON agbot_alerts(created_at);

-- Add RLS policies for agbot_alerts (matching existing security pattern)
ALTER TABLE agbot_alerts ENABLE ROW LEVEL SECURITY;

-- Policy for viewing agbot alerts - users can see alerts for agbot devices in their accessible groups
CREATE POLICY "Users can view agbot alerts for accessible groups" ON agbot_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
    )
  );

-- Policy for creating agbot alerts - allow system to create alerts
CREATE POLICY "System can create agbot alerts" ON agbot_alerts
  FOR INSERT WITH CHECK (true);

-- Policy for updating agbot alerts - users can acknowledge/snooze alerts they can view
CREATE POLICY "Users can update agbot alerts they can view" ON agbot_alerts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON agbot_alerts TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;