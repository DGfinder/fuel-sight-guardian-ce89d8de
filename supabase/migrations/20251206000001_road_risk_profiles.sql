-- Road risk profiles for tank locations
CREATE TABLE road_risk_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agbot_location_id uuid REFERENCES ta_agbot_locations(id) ON DELETE CASCADE,

  -- Road characteristics
  access_road_type text CHECK (access_road_type IN ('sealed', 'gravel', 'unsealed', 'unknown')),
  road_condition text, -- 'good', 'fair', 'poor'

  -- Closure risk thresholds
  closure_threshold_mm float DEFAULT 40, -- rainfall that triggers closure
  typical_closure_duration_days int DEFAULT 3,

  -- Historical data
  historical_closures jsonb DEFAULT '[]'::jsonb,
  -- Example: [{"date": "2024-06-15", "rainfall_mm": 45, "closed_days": 4}]

  -- Alternative access
  alternative_route_available boolean DEFAULT false,
  alternative_route_notes text,

  -- Metadata
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),

  UNIQUE(agbot_location_id)
);

-- Index for fast lookups
CREATE INDEX idx_road_risk_location ON road_risk_profiles(agbot_location_id);

-- RLS policies
ALTER TABLE road_risk_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all road risk profiles"
  ON road_risk_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Staff can manage road risk profiles"
  ON road_risk_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'staff')
    )
  );

COMMENT ON TABLE road_risk_profiles IS 'Road closure risk assessment data for tank access roads';
