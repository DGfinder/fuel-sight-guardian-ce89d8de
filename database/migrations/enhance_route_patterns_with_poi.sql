-- Enhance route_patterns table with POI and Terminal intelligence
-- This migration adds spatial intelligence to route analysis by linking to discovered POIs

-- Add POI relationship columns
ALTER TABLE route_patterns
ADD COLUMN IF NOT EXISTS start_poi_id UUID REFERENCES discovered_poi(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS end_poi_id UUID REFERENCES discovered_poi(id) ON DELETE SET NULL;

-- Add route classification and quality columns
ALTER TABLE route_patterns
ADD COLUMN IF NOT EXISTS route_type TEXT CHECK (route_type IN (
  'delivery',              -- Terminal → Customer
  'return',                -- Customer → Terminal
  'transfer',              -- Terminal → Terminal
  'positioning',           -- Depot → Terminal/Customer
  'customer_to_customer',  -- Customer → Customer
  'unknown'
)),
ADD COLUMN IF NOT EXISTS data_quality_tier TEXT CHECK (data_quality_tier IN (
  'platinum',  -- >90% confidence, <30m GPS accuracy, >50 trips
  'gold',      -- >80% confidence, <50m GPS accuracy, >20 trips
  'silver',    -- >70% confidence, <100m GPS accuracy, >10 trips
  'bronze'     -- Lower quality data
));

-- Add enhanced metrics
ALTER TABLE route_patterns
ADD COLUMN IF NOT EXISTS avg_gps_accuracy_meters DECIMAL(8, 2),
ADD COLUMN IF NOT EXISTS route_deviation_ratio DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS straight_line_distance_km DECIMAL(8, 2),
ADD COLUMN IF NOT EXISTS has_return_route BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS avg_loading_time_hours DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS avg_delivery_time_hours DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS start_poi_confidence INTEGER,
ADD COLUMN IF NOT EXISTS end_poi_confidence INTEGER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_route_patterns_start_poi ON route_patterns(start_poi_id);
CREATE INDEX IF NOT EXISTS idx_route_patterns_end_poi ON route_patterns(end_poi_id);
CREATE INDEX IF NOT EXISTS idx_route_patterns_type ON route_patterns(route_type);
CREATE INDEX IF NOT EXISTS idx_route_patterns_quality ON route_patterns(data_quality_tier);
CREATE INDEX IF NOT EXISTS idx_route_patterns_poi_composite ON route_patterns(start_poi_id, end_poi_id);

-- Add helpful comments
COMMENT ON COLUMN route_patterns.start_poi_id IS
'Link to discovered POI at route start. Enables spatial matching instead of string matching.';

COMMENT ON COLUMN route_patterns.end_poi_id IS
'Link to discovered POI at route end. Enables spatial matching instead of string matching.';

COMMENT ON COLUMN route_patterns.route_type IS
'Classification based on POI types: delivery (terminal→customer), return (customer→terminal),
transfer (terminal→terminal), positioning (depot movement), customer_to_customer';

COMMENT ON COLUMN route_patterns.data_quality_tier IS
'Quality tier based on POI confidence scores and GPS accuracy:
platinum (best), gold (good), silver (acceptable), bronze (needs review)';

COMMENT ON COLUMN route_patterns.route_deviation_ratio IS
'Ratio of actual route distance to straight-line distance. High values indicate circuitous routes.';

COMMENT ON COLUMN route_patterns.has_return_route IS
'Whether a matching return route exists (reverse start/end POIs)';

-- Grant permissions
GRANT SELECT ON route_patterns TO authenticated;
