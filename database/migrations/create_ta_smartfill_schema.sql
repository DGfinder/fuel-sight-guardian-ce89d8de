-- ============================================================================
-- TankAlert SmartFill Schema Migration
-- Creates ta_smartfill_* tables following the unified ta_ pattern
-- Multi-tenant ready for any company using SmartFill JSON-RPC API
-- Date: 2024-12-06
-- ============================================================================

-- ============================================================================
-- PHASE 1: ta_smartfill_* Core Tables
-- ============================================================================

-- 1.1 ta_smartfill_providers (API Provider Configuration)
-- Allows multiple SmartFill API endpoints for different regions/companies
CREATE TABLE IF NOT EXISTS ta_smartfill_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider Identity
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL, -- e.g., 'smartfill_au', 'smartfill_nz'
  description TEXT,

  -- API Configuration
  api_base_url TEXT NOT NULL DEFAULT 'https://www.fmtdata.com/API/api.php',
  api_version TEXT DEFAULT '2.0',
  api_method TEXT DEFAULT 'Tank:Level',

  -- Rate Limiting
  requests_per_hour INT DEFAULT 60,
  request_timeout_ms INT DEFAULT 30000,
  max_retries INT DEFAULT 3,
  retry_delay_ms INT DEFAULT 1000,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_health_check TIMESTAMPTZ,
  health_status TEXT DEFAULT 'unknown',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_smartfill_providers_code ON ta_smartfill_providers(code);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_providers_active ON ta_smartfill_providers(is_active);

-- 1.2 ta_smartfill_customers (Customer API Credentials)
-- Links to business for multi-tenant support
CREATE TABLE IF NOT EXISTS ta_smartfill_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES ta_smartfill_providers(id) ON DELETE SET NULL,
  business_id UUID REFERENCES ta_businesses(id) ON DELETE SET NULL, -- Multi-tenant link

  -- API Credentials
  api_reference TEXT NOT NULL,
  api_secret TEXT NOT NULL,

  -- Customer Identity
  name TEXT NOT NULL,
  code TEXT, -- Short customer code
  external_id TEXT, -- ID in external system

  -- Contact Info (optional)
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,

  -- Sync Configuration
  sync_enabled BOOLEAN DEFAULT true,
  sync_priority INT DEFAULT 50, -- 1-100, higher = sync first
  sync_interval_minutes INT DEFAULT 60,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  consecutive_failures INT DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(provider_id, api_reference)
);

CREATE INDEX IF NOT EXISTS idx_ta_smartfill_customers_provider ON ta_smartfill_customers(provider_id);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_customers_business ON ta_smartfill_customers(business_id);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_customers_active ON ta_smartfill_customers(is_active, sync_enabled);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_customers_sync ON ta_smartfill_customers(last_sync_at);

-- 1.3 ta_smartfill_locations (Units/Sites)
CREATE TABLE IF NOT EXISTS ta_smartfill_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES ta_smartfill_customers(id) ON DELETE CASCADE,

  -- External Identity
  external_guid TEXT NOT NULL, -- Constructed from customer + unit
  unit_number TEXT NOT NULL,

  -- Location Details
  name TEXT,
  description TEXT,
  timezone TEXT DEFAULT 'Australia/Perth',

  -- Address/GPS
  address TEXT,
  state TEXT,
  postcode TEXT,
  country TEXT DEFAULT 'Australia',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),

  -- Aggregated Metrics (calculated from tanks)
  total_tanks INT DEFAULT 0,
  total_capacity DECIMAL(12,2),
  total_volume DECIMAL(12,2),
  avg_fill_percent DECIMAL(5,2),
  critical_tanks INT DEFAULT 0, -- <20%
  warning_tanks INT DEFAULT 0, -- 20-40%

  -- Latest Status
  latest_status TEXT,
  latest_update_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Raw API data for debugging
  raw_data JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_id, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_ta_smartfill_locations_customer ON ta_smartfill_locations(customer_id);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_locations_unit ON ta_smartfill_locations(unit_number);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_locations_guid ON ta_smartfill_locations(external_guid);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_locations_coords ON ta_smartfill_locations(latitude, longitude) WHERE latitude IS NOT NULL;

-- 1.4 ta_smartfill_tanks (Individual Tanks)
CREATE TABLE IF NOT EXISTS ta_smartfill_tanks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES ta_smartfill_locations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES ta_smartfill_customers(id) ON DELETE CASCADE,

  -- External Identity
  external_guid TEXT UNIQUE NOT NULL, -- Constructed from customer + unit + tank
  unit_number TEXT NOT NULL,
  tank_number TEXT NOT NULL,

  -- Tank Details
  name TEXT,
  description TEXT,
  commodity TEXT, -- Fuel type if known

  -- Tank Dimensions
  capacity DECIMAL(12,2),
  safe_fill_level DECIMAL(12,2), -- Tank SFL from API
  min_level DECIMAL(12,2), -- Custom minimum threshold
  reorder_level DECIMAL(12,2), -- Level to trigger reorder

  -- Current State (from latest reading)
  current_volume DECIMAL(12,2),
  current_volume_percent DECIMAL(5,2),
  current_status TEXT,
  current_ullage DECIMAL(12,2), -- Remaining capacity

  -- Consumption Analytics (calculated)
  avg_daily_consumption DECIMAL(10,2),
  days_remaining INT,
  estimated_empty_date DATE,
  consumption_trend TEXT, -- 'increasing', 'stable', 'decreasing'

  -- Device/Sensor Info (if available)
  sensor_type TEXT,
  sensor_serial TEXT,

  -- Health Tracking
  health_score INT, -- 0-100
  health_status TEXT, -- 'healthy', 'warning', 'critical', 'offline'
  last_reading_at TIMESTAMPTZ,
  readings_today INT DEFAULT 0,
  stale_data_hours DECIMAL(6,1),

  -- Alert Configuration
  alert_low_fuel_enabled BOOLEAN DEFAULT true,
  alert_low_fuel_threshold DECIMAL(5,2) DEFAULT 20.0,
  alert_stale_data_enabled BOOLEAN DEFAULT true,
  alert_stale_data_hours INT DEFAULT 24,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_monitored BOOLEAN DEFAULT true, -- Include in dashboards

  -- Raw API data for debugging
  raw_data JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_smartfill_tanks_location ON ta_smartfill_tanks(location_id);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_tanks_customer ON ta_smartfill_tanks(customer_id);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_tanks_guid ON ta_smartfill_tanks(external_guid);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_tanks_unit_tank ON ta_smartfill_tanks(unit_number, tank_number);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_tanks_volume ON ta_smartfill_tanks(current_volume_percent);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_tanks_health ON ta_smartfill_tanks(health_status);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_tanks_days ON ta_smartfill_tanks(days_remaining);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_tanks_active ON ta_smartfill_tanks(is_active, is_monitored);

-- 1.5 ta_smartfill_readings (Time-Series Data)
CREATE TABLE IF NOT EXISTS ta_smartfill_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id UUID NOT NULL REFERENCES ta_smartfill_tanks(id) ON DELETE CASCADE,

  -- Reading Values
  volume DECIMAL(12,2),
  volume_percent DECIMAL(5,2),
  status TEXT,

  -- Tank context at time of reading
  capacity DECIMAL(12,2),
  safe_fill_level DECIMAL(12,2),
  ullage DECIMAL(12,2),

  -- Calculated Consumption (delta from previous reading)
  volume_change DECIMAL(12,2), -- Positive = consumption, negative = refill
  is_refill BOOLEAN DEFAULT false, -- Detected refill event

  -- Timestamps
  reading_at TIMESTAMPTZ NOT NULL,
  api_timestamp TEXT, -- Original timestamp from API
  timezone TEXT,

  -- Source tracking
  sync_id UUID, -- Link to sync log

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_smartfill_readings_tank_time ON ta_smartfill_readings(tank_id, reading_at DESC);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_readings_time ON ta_smartfill_readings(reading_at DESC);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_readings_refill ON ta_smartfill_readings(tank_id, is_refill) WHERE is_refill = true;
-- Note: Date-based queries should use reading_at directly with range conditions
-- e.g., WHERE reading_at >= '2024-01-01' AND reading_at < '2024-01-02'

-- 1.6 ta_smartfill_sync_logs (Sync Operation Audit)
CREATE TABLE IF NOT EXISTS ta_smartfill_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sync Context
  sync_type TEXT NOT NULL, -- 'scheduled', 'manual', 'api_test', 'single_customer'
  trigger_source TEXT, -- 'cron', 'user', 'api', 'webhook'
  triggered_by UUID, -- User ID if manual

  -- Scope
  provider_id UUID REFERENCES ta_smartfill_providers(id),
  customer_id UUID REFERENCES ta_smartfill_customers(id), -- If single customer sync

  -- Results
  sync_status TEXT NOT NULL, -- 'running', 'success', 'partial', 'failed'

  -- Counters
  customers_attempted INT DEFAULT 0,
  customers_success INT DEFAULT 0,
  customers_failed INT DEFAULT 0,
  locations_processed INT DEFAULT 0,
  tanks_processed INT DEFAULT 0,
  readings_stored INT DEFAULT 0,
  alerts_generated INT DEFAULT 0,

  -- Error Tracking
  error_message TEXT,
  error_details JSONB, -- Detailed error info per customer

  -- Performance
  duration_ms INT,
  avg_api_response_ms INT,

  -- Customer-level results
  customer_results JSONB, -- Array of {customer_id, status, tanks, duration, error}

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ta_smartfill_sync_logs_time ON ta_smartfill_sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_sync_logs_status ON ta_smartfill_sync_logs(sync_status);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_sync_logs_type ON ta_smartfill_sync_logs(sync_type);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_sync_logs_customer ON ta_smartfill_sync_logs(customer_id) WHERE customer_id IS NOT NULL;

-- 1.7 ta_smartfill_alerts (Tank Alerts)
CREATE TABLE IF NOT EXISTS ta_smartfill_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id UUID NOT NULL REFERENCES ta_smartfill_tanks(id) ON DELETE CASCADE,

  -- Alert Details
  alert_type TEXT NOT NULL, -- 'low_fuel', 'critical_fuel', 'stale_data', 'offline', 'refill_detected', 'consumption_spike'
  severity TEXT NOT NULL, -- 'info', 'warning', 'critical'
  title TEXT NOT NULL,
  message TEXT,

  -- Alert Context
  current_value DECIMAL(12,2),
  threshold_value DECIMAL(12,2),
  previous_value DECIMAL(12,2),

  -- Status
  is_active BOOLEAN DEFAULT true,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  auto_resolved BOOLEAN DEFAULT false,
  resolution_notes TEXT,

  -- Notification Tracking
  notifications_sent JSONB, -- [{channel, sent_at, recipient}]

  -- Timestamps
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_smartfill_alerts_tank ON ta_smartfill_alerts(tank_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_alerts_active ON ta_smartfill_alerts(is_active, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_ta_smartfill_alerts_type ON ta_smartfill_alerts(alert_type, severity);

-- ============================================================================
-- PHASE 2: Analytics Views
-- ============================================================================

-- 2.1 Daily Consumption Summary View
CREATE OR REPLACE VIEW ta_smartfill_consumption_daily AS
SELECT
  r.tank_id,
  t.customer_id,
  c.name as customer_name,
  t.unit_number,
  t.tank_number,
  t.capacity,
  DATE(r.reading_at AT TIME ZONE COALESCE(r.timezone, 'Australia/Perth')) as reading_date,
  COUNT(*) as reading_count,
  MAX(r.volume) as max_volume,
  MIN(r.volume) as min_volume,
  GREATEST(0, MAX(r.volume) - MIN(r.volume)) as daily_consumption,
  AVG(r.volume_percent) as avg_fill_percent,
  MAX(r.volume_percent) as max_fill_percent,
  MIN(r.volume_percent) as min_fill_percent,
  BOOL_OR(r.is_refill) as had_refill
FROM ta_smartfill_readings r
JOIN ta_smartfill_tanks t ON r.tank_id = t.id
JOIN ta_smartfill_customers c ON t.customer_id = c.id
WHERE r.reading_at IS NOT NULL
GROUP BY
  r.tank_id,
  t.customer_id,
  c.name,
  t.unit_number,
  t.tank_number,
  t.capacity,
  DATE(r.reading_at AT TIME ZONE COALESCE(r.timezone, 'Australia/Perth'));

-- 2.2 Customer Fleet Summary View
CREATE OR REPLACE VIEW ta_smartfill_customer_summary AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  c.business_id,
  c.is_active,
  c.sync_enabled,
  c.last_sync_at,
  c.last_sync_status,
  c.consecutive_failures,
  COUNT(DISTINCT l.id) as location_count,
  COUNT(DISTINCT t.id) as tank_count,
  ROUND(AVG(t.current_volume_percent)::numeric, 1) as avg_fill_percent,
  SUM(CASE WHEN t.current_volume_percent < 20 THEN 1 ELSE 0 END) as critical_tanks,
  SUM(CASE WHEN t.current_volume_percent >= 20 AND t.current_volume_percent < 40 THEN 1 ELSE 0 END) as warning_tanks,
  SUM(CASE WHEN t.current_volume_percent >= 40 THEN 1 ELSE 0 END) as healthy_tanks,
  SUM(t.capacity) as total_capacity,
  SUM(t.current_volume) as total_volume,
  ROUND((SUM(t.current_volume) / NULLIF(SUM(t.capacity), 0) * 100)::numeric, 1) as fleet_fill_percent,
  MIN(t.last_reading_at) as oldest_reading,
  MAX(t.last_reading_at) as newest_reading,
  ROUND(AVG(t.days_remaining)::numeric, 0) as avg_days_remaining,
  -- Health score: 100 = all tanks healthy, 0 = all critical
  ROUND(
    (SUM(CASE
      WHEN t.current_volume_percent >= 40 THEN 100
      WHEN t.current_volume_percent >= 20 THEN 50
      ELSE 0
    END) / NULLIF(COUNT(t.id), 0))::numeric, 0
  ) as health_score
FROM ta_smartfill_customers c
LEFT JOIN ta_smartfill_locations l ON l.customer_id = c.id AND l.is_active = true
LEFT JOIN ta_smartfill_tanks t ON t.customer_id = c.id AND t.is_active = true AND t.is_monitored = true
GROUP BY c.id, c.name, c.business_id, c.is_active, c.sync_enabled, c.last_sync_at, c.last_sync_status, c.consecutive_failures
ORDER BY c.name;

-- 2.3 Tank Trends View (Last 30 Days)
CREATE OR REPLACE VIEW ta_smartfill_tank_trends AS
SELECT
  t.id as tank_id,
  c.name as customer_name,
  t.unit_number,
  t.tank_number,
  t.description,
  t.capacity,
  t.safe_fill_level,
  r.volume,
  r.volume_percent,
  r.status,
  r.volume_change,
  r.is_refill,
  r.reading_at,
  r.reading_at AT TIME ZONE COALESCE(r.timezone, 'Australia/Perth') as local_time,
  LAG(r.volume) OVER (PARTITION BY t.id ORDER BY r.reading_at) as prev_volume,
  LAG(r.reading_at) OVER (PARTITION BY t.id ORDER BY r.reading_at) as prev_reading_at
FROM ta_smartfill_tanks t
JOIN ta_smartfill_customers c ON t.customer_id = c.id
JOIN ta_smartfill_readings r ON r.tank_id = t.id
WHERE r.reading_at > NOW() - INTERVAL '30 days'
  AND t.is_active = true
ORDER BY t.id, r.reading_at DESC;

-- 2.4 Sync Performance View
CREATE OR REPLACE VIEW ta_smartfill_sync_analytics AS
SELECT
  DATE(started_at) as sync_date,
  COUNT(*) as total_syncs,
  SUM(CASE WHEN sync_status = 'success' THEN 1 ELSE 0 END) as successful_syncs,
  SUM(CASE WHEN sync_status = 'partial' THEN 1 ELSE 0 END) as partial_syncs,
  SUM(CASE WHEN sync_status = 'failed' THEN 1 ELSE 0 END) as failed_syncs,
  ROUND(AVG(duration_ms)::numeric, 0) as avg_duration_ms,
  ROUND(AVG(avg_api_response_ms)::numeric, 0) as avg_api_response_ms,
  SUM(customers_success) as total_customers_synced,
  SUM(tanks_processed) as total_tanks_synced,
  SUM(readings_stored) as total_readings_stored,
  ROUND(
    (SUM(CASE WHEN sync_status = 'success' THEN 1 ELSE 0 END)::numeric /
     NULLIF(COUNT(*), 0) * 100), 1
  ) as success_rate
FROM ta_smartfill_sync_logs
WHERE started_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(started_at)
ORDER BY sync_date DESC;

-- 2.5 Active Alerts View
CREATE OR REPLACE VIEW ta_smartfill_active_alerts AS
SELECT
  a.id,
  a.tank_id,
  c.name as customer_name,
  t.unit_number,
  t.tank_number,
  t.description as tank_description,
  a.alert_type,
  a.severity,
  a.title,
  a.message,
  a.current_value,
  a.threshold_value,
  a.triggered_at,
  EXTRACT(EPOCH FROM (NOW() - a.triggered_at)) / 3600 as hours_active,
  t.current_volume_percent,
  t.days_remaining
FROM ta_smartfill_alerts a
JOIN ta_smartfill_tanks t ON a.tank_id = t.id
JOIN ta_smartfill_customers c ON t.customer_id = c.id
WHERE a.is_active = true
ORDER BY
  CASE a.severity
    WHEN 'critical' THEN 1
    WHEN 'warning' THEN 2
    ELSE 3
  END,
  a.triggered_at DESC;

-- 2.6 Fleet Overview View (for dashboard)
CREATE OR REPLACE VIEW ta_smartfill_fleet_overview AS
SELECT
  COUNT(DISTINCT c.id) as total_customers,
  COUNT(DISTINCT c.id) FILTER (WHERE c.is_active AND c.sync_enabled) as active_customers,
  COUNT(DISTINCT l.id) as total_locations,
  COUNT(DISTINCT t.id) as total_tanks,
  COUNT(DISTINCT t.id) FILTER (WHERE t.current_volume_percent < 20) as critical_tanks,
  COUNT(DISTINCT t.id) FILTER (WHERE t.current_volume_percent >= 20 AND t.current_volume_percent < 40) as warning_tanks,
  COUNT(DISTINCT t.id) FILTER (WHERE t.current_volume_percent >= 40) as healthy_tanks,
  COUNT(DISTINCT t.id) FILTER (WHERE t.last_reading_at < NOW() - INTERVAL '24 hours') as stale_tanks,
  ROUND(AVG(t.current_volume_percent)::numeric, 1) as avg_fill_percent,
  ROUND(SUM(t.capacity)::numeric, 0) as total_capacity,
  ROUND(SUM(t.current_volume)::numeric, 0) as total_volume,
  ROUND(AVG(t.days_remaining)::numeric, 0) as avg_days_remaining,
  (SELECT MAX(completed_at) FROM ta_smartfill_sync_logs WHERE sync_status IN ('success', 'partial')) as last_successful_sync,
  (SELECT COUNT(*) FROM ta_smartfill_alerts WHERE is_active = true) as active_alerts
FROM ta_smartfill_customers c
LEFT JOIN ta_smartfill_locations l ON l.customer_id = c.id AND l.is_active = true
LEFT JOIN ta_smartfill_tanks t ON t.customer_id = c.id AND t.is_active = true AND t.is_monitored = true
WHERE c.is_active = true;

-- ============================================================================
-- PHASE 3: RLS Policies
-- ============================================================================

ALTER TABLE ta_smartfill_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_smartfill_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_smartfill_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_smartfill_tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_smartfill_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_smartfill_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_smartfill_alerts ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users
CREATE POLICY "Users can view smartfill providers" ON ta_smartfill_providers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view smartfill customers" ON ta_smartfill_customers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view smartfill locations" ON ta_smartfill_locations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view smartfill tanks" ON ta_smartfill_tanks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view smartfill readings" ON ta_smartfill_readings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view smartfill alerts" ON ta_smartfill_alerts
  FOR SELECT TO authenticated USING (true);

-- Admins can view sync logs
CREATE POLICY "Admins can view smartfill sync logs" ON ta_smartfill_sync_logs
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- System write access
CREATE POLICY "System can manage smartfill providers" ON ta_smartfill_providers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage smartfill customers" ON ta_smartfill_customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage smartfill locations" ON ta_smartfill_locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage smartfill tanks" ON ta_smartfill_tanks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage smartfill readings" ON ta_smartfill_readings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage smartfill sync logs" ON ta_smartfill_sync_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can manage smartfill alerts" ON ta_smartfill_alerts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- PHASE 4: Functions
-- ============================================================================

-- 4.1 Calculate Days Until Empty
CREATE OR REPLACE FUNCTION ta_smartfill_calc_days_remaining(p_tank_id UUID)
RETURNS TABLE (
  tank_id UUID,
  current_volume NUMERIC,
  avg_daily_consumption NUMERIC,
  estimated_days_remaining INT,
  confidence TEXT,
  data_points INT
) AS $$
DECLARE
  v_consumption NUMERIC;
  v_reading_count INT;
  v_current_volume NUMERIC;
BEGIN
  -- Get current volume
  SELECT current_volume INTO v_current_volume
  FROM ta_smartfill_tanks WHERE id = p_tank_id;

  -- Calculate average daily consumption from last 14 days
  SELECT
    AVG(daily_consumption),
    COUNT(*)
  INTO v_consumption, v_reading_count
  FROM ta_smartfill_consumption_daily
  WHERE ta_smartfill_consumption_daily.tank_id = p_tank_id
    AND reading_date > CURRENT_DATE - INTERVAL '14 days'
    AND daily_consumption > 0;

  RETURN QUERY
  SELECT
    p_tank_id,
    v_current_volume,
    COALESCE(v_consumption, 0),
    CASE
      WHEN COALESCE(v_consumption, 0) > 0 THEN ROUND(v_current_volume / v_consumption)::INT
      ELSE NULL
    END,
    CASE
      WHEN v_reading_count >= 10 THEN 'HIGH'
      WHEN v_reading_count >= 5 THEN 'MEDIUM'
      WHEN v_reading_count >= 2 THEN 'LOW'
      ELSE 'INSUFFICIENT_DATA'
    END::TEXT,
    v_reading_count;
END;
$$ LANGUAGE plpgsql;

-- 4.2 Update Location Aggregates
CREATE OR REPLACE FUNCTION ta_smartfill_update_location_aggregates(p_location_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE ta_smartfill_locations l
  SET
    total_tanks = (SELECT COUNT(*) FROM ta_smartfill_tanks t WHERE t.location_id = p_location_id AND t.is_active),
    total_capacity = (SELECT COALESCE(SUM(capacity), 0) FROM ta_smartfill_tanks t WHERE t.location_id = p_location_id AND t.is_active),
    total_volume = (SELECT COALESCE(SUM(current_volume), 0) FROM ta_smartfill_tanks t WHERE t.location_id = p_location_id AND t.is_active),
    avg_fill_percent = (SELECT AVG(current_volume_percent) FROM ta_smartfill_tanks t WHERE t.location_id = p_location_id AND t.is_active),
    critical_tanks = (SELECT COUNT(*) FROM ta_smartfill_tanks t WHERE t.location_id = p_location_id AND t.is_active AND t.current_volume_percent < 20),
    warning_tanks = (SELECT COUNT(*) FROM ta_smartfill_tanks t WHERE t.location_id = p_location_id AND t.is_active AND t.current_volume_percent >= 20 AND t.current_volume_percent < 40),
    latest_update_at = (SELECT MAX(last_reading_at) FROM ta_smartfill_tanks t WHERE t.location_id = p_location_id),
    updated_at = NOW()
  WHERE l.id = p_location_id;
END;
$$ LANGUAGE plpgsql;

-- 4.3 Detect and Log Refill Events
CREATE OR REPLACE FUNCTION ta_smartfill_detect_refill()
RETURNS TRIGGER AS $$
DECLARE
  v_prev_volume NUMERIC;
  v_refill_threshold NUMERIC := 50; -- Minimum volume increase to count as refill
BEGIN
  -- Get previous reading volume
  SELECT volume INTO v_prev_volume
  FROM ta_smartfill_readings
  WHERE tank_id = NEW.tank_id AND reading_at < NEW.reading_at
  ORDER BY reading_at DESC
  LIMIT 1;

  -- Calculate volume change
  IF v_prev_volume IS NOT NULL THEN
    NEW.volume_change := NEW.volume - v_prev_volume;
    NEW.is_refill := NEW.volume_change > v_refill_threshold;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ta_smartfill_readings_detect_refill
  BEFORE INSERT ON ta_smartfill_readings
  FOR EACH ROW EXECUTE FUNCTION ta_smartfill_detect_refill();

-- ============================================================================
-- PHASE 5: Update Triggers
-- ============================================================================

CREATE TRIGGER ta_smartfill_providers_updated_at
  BEFORE UPDATE ON ta_smartfill_providers
  FOR EACH ROW EXECUTE FUNCTION update_ta_updated_at();

CREATE TRIGGER ta_smartfill_customers_updated_at
  BEFORE UPDATE ON ta_smartfill_customers
  FOR EACH ROW EXECUTE FUNCTION update_ta_updated_at();

CREATE TRIGGER ta_smartfill_locations_updated_at
  BEFORE UPDATE ON ta_smartfill_locations
  FOR EACH ROW EXECUTE FUNCTION update_ta_updated_at();

CREATE TRIGGER ta_smartfill_tanks_updated_at
  BEFORE UPDATE ON ta_smartfill_tanks
  FOR EACH ROW EXECUTE FUNCTION update_ta_updated_at();

-- ============================================================================
-- PHASE 6: Link to ta_tank_sources Bridge Table
-- ============================================================================

-- Add smartfill_tank_id reference if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ta_tank_sources' AND column_name = 'smartfill_tank_id'
  ) THEN
    ALTER TABLE ta_tank_sources
    ADD COLUMN smartfill_tank_id UUID REFERENCES ta_smartfill_tanks(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_ta_tank_sources_smartfill ON ta_tank_sources(smartfill_tank_id);
  END IF;
END $$;

-- ============================================================================
-- PHASE 7: Data Migration from Legacy Tables
-- ============================================================================

-- Insert default provider
INSERT INTO ta_smartfill_providers (name, code, description)
VALUES ('SmartFill Australia', 'smartfill_au', 'Default SmartFill provider for Australian customers')
ON CONFLICT (code) DO NOTHING;

-- Migrate existing customers from smartfill_customers to ta_smartfill_customers
INSERT INTO ta_smartfill_customers (
  provider_id,
  api_reference,
  api_secret,
  name,
  is_active,
  sync_enabled,
  created_at,
  updated_at
)
SELECT
  (SELECT id FROM ta_smartfill_providers WHERE code = 'smartfill_au'),
  sc.api_reference,
  sc.api_secret,
  sc.name,
  sc.active,
  sc.active,
  sc.created_at,
  sc.updated_at
FROM smartfill_customers sc
WHERE NOT EXISTS (
  SELECT 1 FROM ta_smartfill_customers tc
  WHERE tc.api_reference = sc.api_reference
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PHASE 8: Grant View Access
-- ============================================================================

GRANT SELECT ON ta_smartfill_consumption_daily TO authenticated;
GRANT SELECT ON ta_smartfill_customer_summary TO authenticated;
GRANT SELECT ON ta_smartfill_tank_trends TO authenticated;
GRANT SELECT ON ta_smartfill_sync_analytics TO authenticated;
GRANT SELECT ON ta_smartfill_active_alerts TO authenticated;
GRANT SELECT ON ta_smartfill_fleet_overview TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'TankAlert SmartFill Schema created successfully' as result;
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'ta_smartfill_%') as smartfill_tables,
  (SELECT COUNT(*) FROM information_schema.views WHERE table_name LIKE 'ta_smartfill_%') as smartfill_views,
  (SELECT COUNT(*) FROM ta_smartfill_providers) as providers,
  (SELECT COUNT(*) FROM ta_smartfill_customers) as customers_migrated;
