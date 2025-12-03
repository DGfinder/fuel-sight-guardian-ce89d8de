-- System Configuration Management
-- Enables runtime configuration of system parameters without deployments
-- Created: 2025-12-03
-- Part of: Phase 2 - Configuration System

-- Create system_config table
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
  category TEXT NOT NULL,
  description TEXT,
  is_secret BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE system_config IS 'Runtime system configuration - allows admins to modify settings without deployments';

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);

-- Create index for is_secret filtering (for UI display)
CREATE INDEX IF NOT EXISTS idx_system_config_secret ON system_config(is_secret);

-- Create audit log table for config changes
CREATE TABLE IF NOT EXISTS system_config_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  change_reason TEXT
);

-- Add comment
COMMENT ON TABLE system_config_audit IS 'Audit trail for system configuration changes';

-- Create index for audit queries
CREATE INDEX IF NOT EXISTS idx_system_config_audit_key ON system_config_audit(config_key, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_config_audit_user ON system_config_audit(changed_by, changed_at DESC);

-- Create trigger to log config changes
CREATE OR REPLACE FUNCTION log_system_config_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO system_config_audit (config_key, old_value, new_value, changed_by, change_reason)
  VALUES (
    NEW.key,
    OLD.value,
    NEW.value,
    NEW.updated_by,
    'Updated via system'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_system_config_change
  AFTER UPDATE ON system_config
  FOR EACH ROW
  WHEN (OLD.value IS DISTINCT FROM NEW.value)
  EXECUTE FUNCTION log_system_config_change();

-- Seed with current hard-coded values from the application
INSERT INTO system_config (key, value, data_type, category, description) VALUES
  -- Email Configuration
  ('email.batch_size', '50', 'number', 'email', 'Number of emails to send per batch'),
  ('email.batch_delay_ms', '2000', 'number', 'email', 'Milliseconds to wait between batches'),
  ('email.use_enhanced_template', 'true', 'boolean', 'email', 'Use enhanced template (v2) vs legacy'),
  ('email.from_email', 'alert@tankalert.greatsouthernfuels.com.au', 'string', 'email', 'Sender email address'),
  ('email.from_name', 'Tank Alert', 'string', 'email', 'Sender display name'),
  ('email.reply_to', 'hayden@stevemacs.com.au', 'string', 'email', 'Reply-to email address'),
  ('email.support_email', 'support@greatsouthernfuel.com.au', 'string', 'email', 'Support email shown in footer'),
  ('email.retry_max_attempts', '3', 'number', 'email', 'Maximum retry attempts for failed email sends'),
  ('email.retry_base_delay_ms', '1000', 'number', 'email', 'Base delay for exponential backoff (1s, 2s, 4s)'),

  -- Alert Thresholds
  ('thresholds.low_fuel_pct', '30', 'number', 'alerts', 'Low fuel alert threshold (percentage)'),
  ('thresholds.critical_pct', '15', 'number', 'alerts', 'Critical fuel alert threshold (percentage)'),
  ('thresholds.days_remaining_critical', '3', 'number', 'alerts', 'Critical alert when days remaining <= this value'),

  -- Branding
  ('branding.logo_url', 'https://www.greatsouthernfuels.com.au/wp-content/uploads/2024/08/9d8131_1317ed20e5274adc9fd15fe2196d2cb8mv2.webp', 'string', 'branding', 'Company logo URL for emails'),
  ('branding.primary_color', '#059669', 'string', 'branding', 'Primary brand color (hex code)'),
  ('branding.company_name', 'Great Southern Fuel Supplies', 'string', 'branding', 'Company name displayed in emails'),

  -- Performance & Limits
  ('performance.max_locations_per_email', '100', 'number', 'performance', 'Maximum tanks to include in a single email'),
  ('performance.analytics_cache_ttl_minutes', '60', 'number', 'performance', 'How long to cache analytics calculations'),

  -- Features
  ('features.enable_analytics', 'true', 'boolean', 'features', 'Enable consumption analytics in reports'),
  ('features.enable_charts', 'true', 'boolean', 'features', 'Enable QuickChart visualizations'),
  ('features.enable_weekly_reports', 'true', 'boolean', 'features', 'Enable weekly report frequency'),
  ('features.enable_monthly_reports', 'true', 'boolean', 'features', 'Enable monthly report frequency')
ON CONFLICT (key) DO NOTHING;

-- Row-Level Security Policies
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config_audit ENABLE ROW LEVEL SECURITY;

-- Admins can view all config (including secrets)
CREATE POLICY "Admins can view system config"
  ON system_config FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'admin'
    )
  );

-- Managers can view non-secret config
CREATE POLICY "Managers can view non-secret config"
  ON system_config FOR SELECT
  USING (
    NOT is_secret AND
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager')
    )
  );

-- Only admins can update config
CREATE POLICY "Admins can update system config"
  ON system_config FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'admin'
    )
  );

-- Admins and managers can view audit trail
CREATE POLICY "Admins and managers can view config audit"
  ON system_config_audit FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager')
    )
  );

-- System can insert audit logs
CREATE POLICY "System can insert config audit logs"
  ON system_config_audit FOR INSERT
  WITH CHECK (true);

-- Grant appropriate permissions
GRANT SELECT ON system_config TO authenticated;
GRANT SELECT, UPDATE ON system_config TO service_role;
GRANT SELECT ON system_config_audit TO authenticated;
GRANT ALL ON system_config_audit TO service_role;

-- Create helper function to get config values (used by API)
CREATE OR REPLACE FUNCTION get_system_config(
  p_key TEXT,
  p_default TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT value INTO v_value
  FROM system_config
  WHERE key = p_key;

  RETURN COALESCE(v_value, p_default);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on helper function
GRANT EXECUTE ON FUNCTION get_system_config(TEXT, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION get_system_config IS 'Helper function to retrieve system configuration values with optional default';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'System configuration tables created successfully';
  RAISE NOTICE 'Seeded % configuration keys', (SELECT COUNT(*) FROM system_config);
END $$;
