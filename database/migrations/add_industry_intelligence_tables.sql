-- Industry Intelligence Tables for Mining & General Customers
-- Adds consumption anomaly tracking, cost budgeting, and extends preferences

-- ============================================================================
-- Table 1: consumption_anomaly_logs
-- Tracks detected consumption anomalies for alerting and history
-- ============================================================================
CREATE TABLE IF NOT EXISTS consumption_anomaly_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agbot_location_id UUID REFERENCES ta_agbot_locations(id) ON DELETE CASCADE,
  customer_account_id UUID REFERENCES customer_accounts(id) ON DELETE CASCADE,

  -- Anomaly classification
  anomaly_type VARCHAR(50) NOT NULL CHECK (anomaly_type IN ('spike', 'drop', 'pattern_change')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'alert')),

  -- Deviation details
  deviation_percent DECIMAL(6,2) NOT NULL,
  baseline_consumption DECIMAL(10,2),
  actual_consumption DECIMAL(10,2),

  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),

  -- Context
  possible_causes JSONB DEFAULT '[]'::jsonb,
  notes TEXT,

  -- Constraints
  CONSTRAINT valid_deviation CHECK (deviation_percent >= -100 AND deviation_percent <= 1000)
);

-- Indexes for consumption_anomaly_logs
CREATE INDEX IF NOT EXISTS idx_consumption_anomaly_location
  ON consumption_anomaly_logs(agbot_location_id);
CREATE INDEX IF NOT EXISTS idx_consumption_anomaly_account
  ON consumption_anomaly_logs(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_consumption_anomaly_detected
  ON consumption_anomaly_logs(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_consumption_anomaly_unacknowledged
  ON consumption_anomaly_logs(customer_account_id)
  WHERE acknowledged_at IS NULL;

-- ============================================================================
-- Table 2: customer_budgets
-- Stores fuel cost budgets for customers
-- ============================================================================
CREATE TABLE IF NOT EXISTS customer_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,

  -- Budget configuration
  budget_period VARCHAR(20) NOT NULL CHECK (budget_period IN ('weekly', 'monthly', 'quarterly')),
  budget_amount DECIMAL(12,2) NOT NULL CHECK (budget_amount > 0),
  fuel_price_per_liter DECIMAL(6,4) CHECK (fuel_price_per_liter > 0),

  -- Validity
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Only one active budget per period type per customer
  CONSTRAINT unique_active_budget UNIQUE (customer_account_id, budget_period, is_active)
    DEFERRABLE INITIALLY DEFERRED
);

-- Indexes for customer_budgets
CREATE INDEX IF NOT EXISTS idx_customer_budgets_account
  ON customer_budgets(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_customer_budgets_active
  ON customer_budgets(customer_account_id)
  WHERE is_active = true;

-- ============================================================================
-- Extend customer_account_preferences with intelligence settings
-- ============================================================================
ALTER TABLE customer_account_preferences
  ADD COLUMN IF NOT EXISTS fuel_cost_tracking_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_fuel_price_per_liter DECIMAL(6,4) DEFAULT 1.80,
  ADD COLUMN IF NOT EXISTS anomaly_alert_threshold_percent INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS extreme_weather_alerts_enabled BOOLEAN DEFAULT true;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- consumption_anomaly_logs policies
ALTER TABLE consumption_anomaly_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own anomaly logs"
  ON consumption_anomaly_logs FOR SELECT
  USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can acknowledge their own anomaly logs"
  ON consumption_anomaly_logs FOR UPDATE
  USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE user_id = auth.uid()
    )
  );

-- GSF staff can view all anomaly logs
CREATE POLICY "GSF staff view all anomaly logs"
  ON consumption_anomaly_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- customer_budgets policies
ALTER TABLE customer_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own budgets"
  ON customer_budgets FOR SELECT
  USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own budgets"
  ON customer_budgets FOR ALL
  USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE user_id = auth.uid()
    )
  );

-- GSF staff can view all budgets
CREATE POLICY "GSF staff view all budgets"
  ON customer_budgets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE consumption_anomaly_logs IS 'Tracks detected fuel consumption anomalies for alerting and historical analysis';
COMMENT ON TABLE customer_budgets IS 'Customer fuel cost budgets for tracking and projections';
COMMENT ON COLUMN customer_account_preferences.fuel_cost_tracking_enabled IS 'Enable fuel cost tracking and projections';
COMMENT ON COLUMN customer_account_preferences.default_fuel_price_per_liter IS 'Default fuel price in AUD per liter';
COMMENT ON COLUMN customer_account_preferences.anomaly_alert_threshold_percent IS 'Threshold percentage for anomaly detection (default 30%)';
COMMENT ON COLUMN customer_account_preferences.extreme_weather_alerts_enabled IS 'Enable extreme weather alerts (heat, storms, cyclones)';
