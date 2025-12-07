-- Farming Intelligence Tables Migration
-- Adds proactive delivery recommendations and operation learning for WA farmers

-- =====================================================
-- Table 1: farm_operation_events
-- Tracks predicted vs actual farming operations for learning
-- =====================================================
CREATE TABLE IF NOT EXISTS farm_operation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  tank_id UUID NOT NULL,

  -- Operation identification
  operation_type TEXT NOT NULL CHECK (operation_type IN ('harvest', 'seeding', 'spraying', 'livestock')),
  season_year INTEGER NOT NULL,

  -- Prediction data (from weather-based predictor)
  predicted_start_date DATE,
  predicted_end_date DATE,
  predicted_daily_consumption_liters NUMERIC(10,2),
  prediction_confidence INTEGER CHECK (prediction_confidence >= 0 AND prediction_confidence <= 100),
  prediction_source TEXT DEFAULT 'weather' CHECK (prediction_source IN ('weather', 'historical', 'manual')),

  -- Actual data (detected from consumption patterns)
  actual_start_date DATE,
  actual_end_date DATE,
  actual_daily_consumption_liters NUMERIC(10,2),
  actual_total_consumption_liters NUMERIC(10,2),
  detection_method TEXT CHECK (detection_method IN ('consumption_spike', 'manual', 'delivery_pattern')),

  -- Learning metrics
  prediction_accuracy_days INTEGER, -- Days difference between predicted and actual start
  consumption_accuracy_pct NUMERIC(5,2), -- % accuracy of consumption prediction

  -- Status
  status TEXT DEFAULT 'predicted' CHECK (status IN ('predicted', 'active', 'completed', 'cancelled')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One record per operation per tank per season
  UNIQUE(customer_account_id, tank_id, operation_type, season_year)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_foe_customer ON farm_operation_events(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_foe_tank ON farm_operation_events(tank_id);
CREATE INDEX IF NOT EXISTS idx_foe_status ON farm_operation_events(status);
CREATE INDEX IF NOT EXISTS idx_foe_dates ON farm_operation_events(predicted_start_date, actual_start_date);
CREATE INDEX IF NOT EXISTS idx_foe_season ON farm_operation_events(season_year, operation_type);

-- =====================================================
-- Table 2: delivery_recommendations
-- Stores calculated delivery recommendations for display
-- =====================================================
CREATE TABLE IF NOT EXISTS delivery_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  tank_id UUID NOT NULL,

  -- Recommendation details
  urgency_level TEXT NOT NULL CHECK (urgency_level IN ('critical', 'warning', 'normal', 'good')),
  order_by_date DATE NOT NULL,
  reason TEXT NOT NULL,

  -- Calculation inputs (for audit/debugging)
  current_level_pct NUMERIC(5,2),
  current_level_liters NUMERIC(10,2),
  daily_consumption_liters NUMERIC(10,2),
  target_level_pct NUMERIC(5,2) DEFAULT 70,
  operation_type TEXT CHECK (operation_type IN ('harvest', 'seeding', 'spraying', 'livestock', NULL)),
  operation_start_date DATE,
  delivery_lead_time_days INTEGER DEFAULT 3,

  -- Buffer calculations
  days_of_buffer INTEGER,
  liters_needed NUMERIC(10,2),

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  delivery_requested BOOLEAN DEFAULT false,
  delivery_request_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dr_customer ON delivery_recommendations(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_dr_tank ON delivery_recommendations(tank_id);
CREATE INDEX IF NOT EXISTS idx_dr_urgency ON delivery_recommendations(urgency_level) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_dr_order_by ON delivery_recommendations(order_by_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_dr_active ON delivery_recommendations(customer_account_id, tank_id) WHERE is_active = true;

-- =====================================================
-- Table 3: consumption_baselines
-- Learned baseline consumption rates per customer/tank
-- =====================================================
CREATE TABLE IF NOT EXISTS consumption_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  tank_id UUID NOT NULL,

  -- Baseline metrics
  baseline_pct_per_day NUMERIC(5,2) NOT NULL,
  baseline_liters_per_day NUMERIC(10,2),

  -- Statistical bounds for spike detection
  std_deviation_pct NUMERIC(5,2),
  spike_threshold_pct NUMERIC(5,2), -- Consumption > this = spike (typically 2x baseline)

  -- Learned operation-specific multipliers
  harvest_multiplier NUMERIC(4,2) DEFAULT 2.5,
  seeding_multiplier NUMERIC(4,2) DEFAULT 1.8,
  spraying_multiplier NUMERIC(4,2) DEFAULT 1.3,
  livestock_multiplier NUMERIC(4,2) DEFAULT 1.5,

  -- Calculation metadata
  data_points_used INTEGER,
  calculation_period_days INTEGER DEFAULT 90,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Primary key on customer+tank
  UNIQUE(customer_account_id, tank_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cb_customer ON consumption_baselines(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_cb_tank ON consumption_baselines(tank_id);

-- =====================================================
-- Extension: customer_accounts delivery settings
-- Configurable settings per customer
-- =====================================================
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS
  delivery_settings JSONB DEFAULT '{
    "lead_time_days": 3,
    "target_level_pct": 70,
    "spike_threshold_multiplier": 2.0
  }';

COMMENT ON COLUMN customer_accounts.delivery_settings IS 'Configurable delivery recommendation settings: lead_time_days (default 3), target_level_pct (default 70), spike_threshold_multiplier (default 2.0)';

-- =====================================================
-- RLS Policies
-- =====================================================

-- Farm Operation Events
ALTER TABLE farm_operation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own operation events" ON farm_operation_events
  FOR SELECT TO authenticated USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "GSF staff view all operation events" ON farm_operation_events
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'scheduler')
    )
  );

-- Delivery Recommendations
ALTER TABLE delivery_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own recommendations" ON delivery_recommendations
  FOR SELECT TO authenticated USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Customers update own recommendations" ON delivery_recommendations
  FOR UPDATE TO authenticated USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "GSF staff manage all recommendations" ON delivery_recommendations
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'scheduler')
    )
  );

-- Consumption Baselines
ALTER TABLE consumption_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own baselines" ON consumption_baselines
  FOR SELECT TO authenticated USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "GSF staff manage all baselines" ON consumption_baselines
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'scheduler')
    )
  );

-- =====================================================
-- Trigger for updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_farm_operation_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER farm_operation_events_updated_at
  BEFORE UPDATE ON farm_operation_events
  FOR EACH ROW
  EXECUTE FUNCTION update_farm_operation_events_updated_at();

-- =====================================================
-- Helpful view: Active delivery alerts by urgency
-- =====================================================
CREATE OR REPLACE VIEW active_delivery_alerts AS
SELECT
  dr.*,
  ca.customer_name,
  ca.company_name,
  ca.industry_type
FROM delivery_recommendations dr
JOIN customer_accounts ca ON ca.id = dr.customer_account_id
WHERE dr.is_active = true
  AND dr.urgency_level IN ('critical', 'warning')
ORDER BY
  CASE dr.urgency_level
    WHEN 'critical' THEN 1
    WHEN 'warning' THEN 2
    ELSE 3
  END,
  dr.order_by_date;

COMMENT ON VIEW active_delivery_alerts IS 'View of critical and warning delivery alerts for GSF operations team';
