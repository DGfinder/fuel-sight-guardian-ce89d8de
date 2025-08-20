-- ============================================================================
-- CUSTOMER LOCATIONS SYSTEM
-- GPS-based customer location tracking for trip distance analytics
-- Supports BP contract tracking and delivery performance measurement
-- ============================================================================

-- Enable PostGIS extension for spatial data
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For fuzzy text matching

-- Drop existing objects if they exist (development safe)
DROP MATERIALIZED VIEW IF EXISTS customer_analytics_summary CASCADE;
DROP VIEW IF EXISTS bp_customer_performance CASCADE;
DROP VIEW IF EXISTS customer_distance_analytics CASCADE;
DROP TABLE IF EXISTS customer_delivery_correlations CASCADE;
DROP TABLE IF EXISTS customer_locations CASCADE;
DROP TYPE IF EXISTS customer_type_enum CASCADE;
DROP TYPE IF EXISTS contract_type_enum CASCADE;

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

CREATE TYPE customer_type_enum AS ENUM (
  'mining_site',           -- Mining operations and facilities
  'fuel_station',          -- BP, Shell, etc. fuel retail
  'transport_company',     -- Logistics and transport operators
  'industrial_facility',   -- Manufacturing, refineries, etc.
  'government_agency',     -- Government departments and services
  'agricultural_facility', -- Farms, agricultural operations
  'airport',              -- Airports and aviation facilities
  'port_facility',        -- Ports, maritime facilities
  'utility_company',      -- Power, water, utilities
  'other'                 -- Miscellaneous customers
);

CREATE TYPE contract_type_enum AS ENUM (
  'bp_retail',            -- BP branded fuel stations
  'bp_commercial',        -- BP commercial contracts
  'bp_mining',           -- BP mining industry contracts
  'bp_aviation',         -- BP aviation fuel contracts
  'non_bp',              -- Non-BP customers
  'unknown'              -- Contract type not determined
);

-- ============================================================================
-- CUSTOMER LOCATIONS TABLE
-- ============================================================================

CREATE TABLE customer_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Customer identification
  customer_name TEXT NOT NULL UNIQUE,
  normalized_customer_name TEXT, -- Cleaned/standardized name for matching
  location_name TEXT, -- Descriptive location name if different from customer
  customer_code TEXT, -- Optional customer reference code
  
  -- Geographic data
  latitude DECIMAL(10, 8), -- Allow NULL for customers without known coordinates
  longitude DECIMAL(11, 8), -- Allow NULL for customers without known coordinates
  location_point GEOGRAPHY(POINT, 4326), -- PostGIS point for spatial queries
  
  -- Service area for delivery matching
  delivery_radius_km INTEGER DEFAULT 5, -- Default 5km radius for deliveries
  service_area GEOGRAPHY(POLYGON, 4326), -- Circular delivery area polygon
  
  -- Customer classification
  customer_type customer_type_enum NOT NULL DEFAULT 'other',
  contract_type contract_type_enum NOT NULL DEFAULT 'unknown',
  is_bp_customer BOOLEAN DEFAULT FALSE,
  is_active_customer BOOLEAN DEFAULT TRUE,
  
  -- Business metrics from CSV import
  transaction_count INTEGER DEFAULT 0, -- Historical transaction volume
  avg_monthly_volume_litres NUMERIC, -- Estimated monthly fuel volume
  priority_level INTEGER DEFAULT 5, -- 1-10 priority ranking
  
  -- Geographic region classification
  region TEXT, -- e.g., 'Perth Metro', 'Goldfields', 'Pilbara'
  state TEXT DEFAULT 'WA',
  postcode TEXT,
  address_line TEXT,
  
  -- Operational metadata
  primary_carrier TEXT, -- SMB, GSF, Combined
  preferred_delivery_days TEXT[], -- Array of preferred delivery days
  operating_hours_start TIME,
  operating_hours_end TIME,
  special_instructions TEXT,
  
  -- Data management
  data_source TEXT DEFAULT 'CSV Import',
  data_quality_score DECIMAL(3,2), -- 0-1 quality score
  geocoding_accuracy TEXT, -- 'exact', 'approximate', 'manual'
  import_batch_id UUID, -- Link to import batch
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_delivery_date DATE,
  notes TEXT,
  
  -- Constraints
  CONSTRAINT valid_location CHECK (
    (latitude IS NULL AND longitude IS NULL) OR 
    (latitude BETWEEN -45 AND -10 AND longitude BETWEEN 110 AND 155)
  ), -- Australian bounds or NULL
  CONSTRAINT valid_delivery_radius CHECK (delivery_radius_km BETWEEN 1 AND 100),
  CONSTRAINT valid_priority CHECK (priority_level BETWEEN 1 AND 10)
);

-- ============================================================================
-- CUSTOMER DELIVERY CORRELATIONS TABLE
-- ============================================================================

CREATE TABLE customer_delivery_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Trip reference
  mtdata_trip_id UUID NOT NULL REFERENCES mtdata_trip_history(id) ON DELETE CASCADE,
  trip_external_id TEXT,
  trip_date DATE NOT NULL,
  
  -- Customer reference
  customer_location_id UUID NOT NULL REFERENCES customer_locations(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  
  -- Delivery correlation details
  matched_trip_point TEXT, -- 'start', 'end', 'both', 'route'
  distance_to_customer_km DECIMAL(8,2) NOT NULL,
  within_delivery_radius BOOLEAN DEFAULT FALSE,
  
  -- Correlation confidence
  confidence_score DECIMAL(5,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  match_type TEXT NOT NULL, -- 'geographic', 'customer_name', 'hybrid'
  correlation_algorithm TEXT DEFAULT 'v1.0',
  
  -- Trip efficiency metrics
  trip_distance_km DECIMAL(8,2), -- Total trip distance
  customer_distance_percentage DECIMAL(5,2), -- % of trip distance to reach customer
  delivery_efficiency_score DECIMAL(5,2), -- Efficiency rating for this delivery
  
  -- Contract and business metrics
  contract_type contract_type_enum,
  is_bp_delivery BOOLEAN DEFAULT FALSE,
  estimated_delivery_volume_litres NUMERIC,
  revenue_attribution DECIMAL(10,2), -- Estimated revenue for this delivery
  
  -- Quality and verification
  verified_delivery BOOLEAN DEFAULT FALSE,
  verification_method TEXT, -- 'automatic', 'manual', 'gps_tracking'
  quality_flags TEXT[], -- Array of quality concerns
  requires_review BOOLEAN DEFAULT FALSE,
  
  -- Analysis metadata
  analysis_run_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  
  -- Constraints
  CONSTRAINT valid_distance CHECK (distance_to_customer_km >= 0),
  CONSTRAINT valid_confidence CHECK (confidence_score BETWEEN 0 AND 100),
  CONSTRAINT valid_efficiency CHECK (delivery_efficiency_score IS NULL OR delivery_efficiency_score BETWEEN 0 AND 100)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Customer locations indexes
CREATE INDEX idx_customer_locations_name ON customer_locations(customer_name);
CREATE INDEX idx_customer_locations_normalized_name ON customer_locations(normalized_customer_name);
CREATE INDEX idx_customer_locations_customer_type ON customer_locations(customer_type);
CREATE INDEX idx_customer_locations_contract_type ON customer_locations(contract_type);
CREATE INDEX idx_customer_locations_bp_customer ON customer_locations(is_bp_customer) WHERE is_bp_customer = TRUE;
CREATE INDEX idx_customer_locations_region ON customer_locations(region);
CREATE INDEX idx_customer_locations_carrier ON customer_locations(primary_carrier);
CREATE INDEX idx_customer_locations_active ON customer_locations(is_active_customer) WHERE is_active_customer = TRUE;

-- Spatial indexes
CREATE INDEX idx_customer_locations_point ON customer_locations USING GIST(location_point);
CREATE INDEX idx_customer_locations_service_area ON customer_locations USING GIST(service_area);

-- Customer delivery correlations indexes
CREATE INDEX idx_customer_correlations_trip_id ON customer_delivery_correlations(mtdata_trip_id);
CREATE INDEX idx_customer_correlations_customer_id ON customer_delivery_correlations(customer_location_id);
CREATE INDEX idx_customer_correlations_date ON customer_delivery_correlations(trip_date DESC);
CREATE INDEX idx_customer_correlations_confidence ON customer_delivery_correlations(confidence_score DESC);
CREATE INDEX idx_customer_correlations_bp_delivery ON customer_delivery_correlations(is_bp_delivery) WHERE is_bp_delivery = TRUE;
CREATE INDEX idx_customer_correlations_contract_type ON customer_delivery_correlations(contract_type);
CREATE INDEX idx_customer_correlations_distance ON customer_delivery_correlations(distance_to_customer_km);

-- Composite indexes for common queries
CREATE INDEX idx_customer_correlations_bp_date ON customer_delivery_correlations(is_bp_delivery, trip_date DESC) WHERE is_bp_delivery = TRUE;
CREATE INDEX idx_customer_correlations_customer_date ON customer_delivery_correlations(customer_location_id, trip_date DESC);

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to update customer geography fields
CREATE OR REPLACE FUNCTION update_customer_geography()
RETURNS TRIGGER AS $$
BEGIN
  -- Create PostGIS point from coordinates (only if both lat/lng are not NULL)
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location_point = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    
    -- Create circular service area polygon
    NEW.service_area = ST_Buffer(NEW.location_point, NEW.delivery_radius_km * 1000); -- Convert km to meters
  ELSE
    -- Set to NULL if coordinates are missing
    NEW.location_point = NULL;
    NEW.service_area = NULL;
  END IF;
  
  -- Note: BP customer identification is now handled separately via captive payments data
  -- Do not auto-detect based on name patterns as this can be incorrect
  -- Use the identify_bp_customers_from_captive_payments() function instead
  
  -- Normalize customer name for matching
  NEW.normalized_customer_name = UPPER(TRIM(REGEXP_REPLACE(NEW.customer_name, '[^A-Za-z0-9\s]', '', 'g')));
  
  -- Auto-classify customer type based on name patterns
  IF NEW.customer_type = 'other' THEN
    CASE 
      WHEN LOWER(NEW.customer_name) LIKE '%mine%' OR LOWER(NEW.customer_name) LIKE '%mining%' 
           OR LOWER(NEW.customer_name) LIKE '%gold%' OR LOWER(NEW.customer_name) LIKE '%iron%'
           OR LOWER(NEW.customer_name) LIKE '%nickel%' OR LOWER(NEW.customer_name) LIKE '%bhp%'
           OR LOWER(NEW.customer_name) LIKE '%south32%' OR LOWER(NEW.customer_name) LIKE '%kcgm%' THEN
        NEW.customer_type = 'mining_site';
      WHEN LOWER(NEW.customer_name) LIKE '%bp %' OR LOWER(NEW.customer_name) LIKE 'bp %'
           OR LOWER(NEW.customer_name) LIKE '%shell%' OR LOWER(NEW.customer_name) LIKE '%caltex%' THEN
        NEW.customer_type = 'fuel_station';
      WHEN LOWER(NEW.customer_name) LIKE '%transport%' OR LOWER(NEW.customer_name) LIKE '%logistics%'
           OR LOWER(NEW.customer_name) LIKE '%freight%' OR LOWER(NEW.customer_name) LIKE '%haulage%' THEN
        NEW.customer_type = 'transport_company';
      WHEN LOWER(NEW.customer_name) LIKE '%airport%' OR LOWER(NEW.customer_name) LIKE '%airpt%' THEN
        NEW.customer_type = 'airport';
      WHEN LOWER(NEW.customer_name) LIKE '%port%' OR LOWER(NEW.customer_name) LIKE '%qube%' THEN
        NEW.customer_type = 'port_facility';
      WHEN LOWER(NEW.customer_name) LIKE '%city of%' OR LOWER(NEW.customer_name) LIKE '%dept%'
           OR LOWER(NEW.customer_name) LIKE '%government%' OR LOWER(NEW.customer_name) LIKE '%council%' THEN
        NEW.customer_type = 'government_agency';
      WHEN LOWER(NEW.customer_name) LIKE '%power%' OR LOWER(NEW.customer_name) LIKE '%energy%'
           OR LOWER(NEW.customer_name) LIKE '%synergy%' OR LOWER(NEW.customer_name) LIKE '%western power%' THEN
        NEW.customer_type = 'utility_company';
      ELSE
        NEW.customer_type = 'industrial_facility';
    END CASE;
  END IF;
  
  -- Set regional classification based on coordinates
  IF NEW.region IS NULL THEN
    CASE 
      WHEN NEW.latitude BETWEEN -32.5 AND -31.2 AND NEW.longitude BETWEEN 115.5 AND 116.5 THEN
        NEW.region = 'Perth Metro';
      WHEN NEW.latitude BETWEEN -31.5 AND -30.2 AND NEW.longitude BETWEEN 121.0 AND 122.0 THEN
        NEW.region = 'Goldfields';
      WHEN NEW.latitude BETWEEN -23.0 AND -20.0 AND NEW.longitude BETWEEN 116.0 AND 120.0 THEN
        NEW.region = 'Pilbara';
      WHEN NEW.latitude BETWEEN -29.5 AND -27.5 AND NEW.longitude BETWEEN 114.0 AND 115.5 THEN
        NEW.region = 'Mid West';
      WHEN NEW.latitude BETWEEN -35.5 AND -33.0 AND NEW.longitude BETWEEN 115.0 AND 118.0 THEN
        NEW.region = 'South West';
      ELSE
        NEW.region = 'Other';
    END CASE;
  END IF;
  
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for customer geography updates
CREATE TRIGGER trigger_update_customer_geography
  BEFORE INSERT OR UPDATE ON customer_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_geography();

-- Function to calculate delivery correlation metrics
CREATE OR REPLACE FUNCTION calculate_delivery_correlation_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate customer distance percentage of total trip
  IF NEW.trip_distance_km > 0 THEN
    NEW.customer_distance_percentage = (NEW.distance_to_customer_km / NEW.trip_distance_km) * 100;
  END IF;
  
  -- Calculate delivery efficiency score (lower distance = higher efficiency)
  CASE 
    WHEN NEW.distance_to_customer_km <= 5 THEN NEW.delivery_efficiency_score = 95;
    WHEN NEW.distance_to_customer_km <= 10 THEN NEW.delivery_efficiency_score = 85;
    WHEN NEW.distance_to_customer_km <= 20 THEN NEW.delivery_efficiency_score = 70;
    WHEN NEW.distance_to_customer_km <= 50 THEN NEW.delivery_efficiency_score = 55;
    ELSE NEW.delivery_efficiency_score = 30;
  END CASE;
  
  -- Adjust efficiency based on confidence
  IF NEW.confidence_score < 70 THEN
    NEW.delivery_efficiency_score = NEW.delivery_efficiency_score * 0.8;
  END IF;
  
  -- Set quality flags
  NEW.quality_flags = ARRAY[]::TEXT[];
  
  IF NEW.distance_to_customer_km > 50 THEN
    NEW.quality_flags = array_append(NEW.quality_flags, 'long_distance');
  END IF;
  
  IF NEW.confidence_score < 60 THEN
    NEW.quality_flags = array_append(NEW.quality_flags, 'low_confidence');
    NEW.requires_review = TRUE;
  END IF;
  
  IF NEW.customer_distance_percentage > 80 THEN
    NEW.quality_flags = array_append(NEW.quality_flags, 'high_trip_percentage');
  END IF;
  
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for correlation metrics calculation
CREATE TRIGGER trigger_calculate_delivery_correlation_metrics
  BEFORE INSERT OR UPDATE ON customer_delivery_correlations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_delivery_correlation_metrics();

-- ============================================================================
-- CUSTOMER LOCATION UTILITY FUNCTIONS
-- ============================================================================

-- Function to find customers near a GPS point
CREATE OR REPLACE FUNCTION find_customers_near_point(
  input_latitude DECIMAL(10, 8),
  input_longitude DECIMAL(11, 8),
  max_distance_km INTEGER DEFAULT 20
)
RETURNS TABLE (
  customer_name TEXT,
  distance_km DECIMAL(8,2),
  customer_type customer_type_enum,
  contract_type contract_type_enum,
  is_bp_customer BOOLEAN,
  within_delivery_radius BOOLEAN,
  transaction_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.customer_name,
    (ST_Distance(
      cl.location_point,
      ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography
    ) / 1000)::DECIMAL(8,2) AS distance_km,
    cl.customer_type,
    cl.contract_type,
    cl.is_bp_customer,
    ST_Within(
      ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography,
      cl.service_area
    ) AS within_delivery_radius,
    cl.transaction_count
  FROM customer_locations cl
  WHERE cl.is_active_customer = TRUE
    AND ST_DWithin(
      cl.location_point,
      ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography,
      max_distance_km * 1000 -- Convert km to meters
    )
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to find nearest customer to a point
CREATE OR REPLACE FUNCTION find_nearest_customer(
  input_latitude DECIMAL(10, 8),
  input_longitude DECIMAL(11, 8)
)
RETURNS TABLE (
  customer_name TEXT,
  distance_km DECIMAL(8,2),
  customer_type customer_type_enum,
  is_bp_customer BOOLEAN,
  within_delivery_radius BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.customer_name,
    (ST_Distance(
      cl.location_point,
      ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography
    ) / 1000)::DECIMAL(8,2) AS distance_km,
    cl.customer_type,
    cl.is_bp_customer,
    ST_Within(
      ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography,
      cl.service_area
    ) AS within_delivery_radius
  FROM customer_locations cl
  WHERE cl.is_active_customer = TRUE
  ORDER BY cl.location_point <-> ST_SetSRID(ST_MakePoint(input_longitude, input_latitude), 4326)::geography
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to match customer by fuzzy name
CREATE OR REPLACE FUNCTION match_customer_by_name(
  input_name TEXT,
  min_similarity REAL DEFAULT 0.3
)
RETURNS TABLE (
  customer_name TEXT,
  similarity_score REAL,
  exact_match BOOLEAN,
  customer_type customer_type_enum,
  is_bp_customer BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH customer_matches AS (
    SELECT 
      cl.customer_name,
      similarity(LOWER(cl.customer_name), LOWER(input_name)) as sim_score,
      LOWER(cl.customer_name) = LOWER(input_name) as is_exact,
      cl.customer_type,
      cl.is_bp_customer
    FROM customer_locations cl
    WHERE cl.is_active_customer = TRUE
  )
  SELECT 
    cm.customer_name,
    cm.sim_score,
    cm.is_exact,
    cm.customer_type,
    cm.is_bp_customer
  FROM customer_matches cm
  WHERE cm.sim_score > min_similarity OR cm.is_exact
  ORDER BY cm.is_exact DESC, cm.sim_score DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CUSTOMER ANALYTICS VIEWS
-- ============================================================================

-- Customer distance analytics view
CREATE VIEW customer_distance_analytics AS
SELECT 
  cl.customer_name,
  cl.customer_type,
  cl.contract_type,
  cl.is_bp_customer,
  cl.region,
  cl.transaction_count,
  
  -- Distance metrics
  COUNT(cdc.id) as total_correlated_trips,
  AVG(cdc.distance_to_customer_km) as avg_distance_km,
  SUM(cdc.trip_distance_km) as total_trip_distance_km,
  SUM(cdc.distance_to_customer_km) as total_customer_distance_km,
  
  -- Efficiency metrics
  AVG(cdc.delivery_efficiency_score) as avg_delivery_efficiency,
  AVG(cdc.customer_distance_percentage) as avg_distance_percentage,
  COUNT(*) FILTER (WHERE cdc.within_delivery_radius = TRUE) as deliveries_within_radius,
  
  -- Quality metrics
  AVG(cdc.confidence_score) as avg_confidence_score,
  COUNT(*) FILTER (WHERE cdc.verified_delivery = TRUE) as verified_deliveries,
  COUNT(*) FILTER (WHERE cdc.requires_review = TRUE) as needs_review,
  
  -- Volume and revenue
  SUM(cdc.estimated_delivery_volume_litres) as total_estimated_volume,
  SUM(cdc.revenue_attribution) as total_estimated_revenue,
  
  -- Time analysis
  MIN(cdc.trip_date) as first_delivery_date,
  MAX(cdc.trip_date) as last_delivery_date,
  
  -- Last 30 days metrics
  COUNT(*) FILTER (WHERE cdc.trip_date >= CURRENT_DATE - INTERVAL '30 days') as deliveries_last_30_days,
  AVG(cdc.distance_to_customer_km) FILTER (WHERE cdc.trip_date >= CURRENT_DATE - INTERVAL '30 days') as avg_distance_last_30_days

FROM customer_locations cl
LEFT JOIN customer_delivery_correlations cdc ON cl.id = cdc.customer_location_id
WHERE cl.is_active_customer = TRUE
GROUP BY cl.id, cl.customer_name, cl.customer_type, cl.contract_type, 
         cl.is_bp_customer, cl.region, cl.transaction_count
ORDER BY total_correlated_trips DESC NULLS LAST;

-- BP customer performance view
CREATE VIEW bp_customer_performance AS
SELECT 
  cda.*,
  
  -- BP-specific metrics
  CASE 
    WHEN cda.contract_type = 'bp_retail' THEN 'BP Retail'
    WHEN cda.contract_type = 'bp_commercial' THEN 'BP Commercial'
    WHEN cda.contract_type = 'bp_mining' THEN 'BP Mining'
    WHEN cda.contract_type = 'bp_aviation' THEN 'BP Aviation'
    ELSE 'BP Other'
  END as bp_contract_category,
  
  -- Performance ranking within BP customers
  RANK() OVER (
    PARTITION BY cda.contract_type 
    ORDER BY cda.total_trip_distance_km DESC NULLS LAST
  ) as distance_rank_within_contract_type,
  
  RANK() OVER (
    PARTITION BY cda.region 
    ORDER BY cda.total_correlated_trips DESC NULLS LAST
  ) as trip_rank_within_region

FROM customer_distance_analytics cda
WHERE cda.is_bp_customer = TRUE
ORDER BY cda.total_trip_distance_km DESC NULLS LAST;

-- Customer analytics summary (materialized for performance)
CREATE MATERIALIZED VIEW customer_analytics_summary AS
SELECT 
  DATE_TRUNC('month', cdc.trip_date) as month,
  cl.region,
  cl.customer_type,
  cl.contract_type,
  cdc.is_bp_delivery,
  
  -- Customer counts
  COUNT(DISTINCT cl.id) as unique_customers,
  COUNT(DISTINCT cdc.mtdata_trip_id) as unique_trips,
  
  -- Distance aggregates
  SUM(cdc.distance_to_customer_km) as total_customer_distance_km,
  SUM(cdc.trip_distance_km) as total_trip_distance_km,
  AVG(cdc.distance_to_customer_km) as avg_customer_distance_km,
  
  -- Efficiency metrics
  AVG(cdc.delivery_efficiency_score) as avg_delivery_efficiency,
  COUNT(*) FILTER (WHERE cdc.within_delivery_radius = TRUE) as deliveries_within_radius,
  COUNT(*) FILTER (WHERE cdc.confidence_score >= 80) as high_confidence_deliveries,
  
  -- Volume and revenue
  SUM(cdc.estimated_delivery_volume_litres) as total_estimated_volume,
  SUM(cdc.revenue_attribution) as total_estimated_revenue

FROM customer_delivery_correlations cdc
JOIN customer_locations cl ON cdc.customer_location_id = cl.id
WHERE cl.is_active_customer = TRUE
GROUP BY DATE_TRUNC('month', cdc.trip_date), cl.region, cl.customer_type, 
         cl.contract_type, cdc.is_bp_delivery
ORDER BY month DESC, cl.region, cl.customer_type;

-- Create unique index on materialized view
CREATE UNIQUE INDEX idx_customer_analytics_summary_key 
ON customer_analytics_summary (month, region, customer_type, contract_type, is_bp_delivery);

-- ============================================================================
-- BP CUSTOMER IDENTIFICATION FUNCTIONS
-- ============================================================================

-- Function to identify BP customers based on captive payments data
CREATE OR REPLACE FUNCTION identify_bp_customers_from_captive_payments()
RETURNS TABLE (
  customer_location_id UUID,
  customer_name TEXT,
  matched_captive_customer TEXT,
  confidence_score DECIMAL(5,2),
  match_method TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH customer_matches AS (
    SELECT 
      cl.id as customer_location_id,
      cl.customer_name,
      cp.customer as matched_captive_customer,
      -- Calculate similarity score for name matching
      GREATEST(
        similarity(LOWER(cl.customer_name), LOWER(cp.customer)),
        similarity(LOWER(cl.normalized_customer_name), LOWER(cp.customer)),
        similarity(LOWER(cl.location_name), LOWER(cp.customer))
      ) as sim_score,
      CASE 
        WHEN LOWER(cl.customer_name) = LOWER(cp.customer) THEN 'exact_match'
        WHEN LOWER(cl.normalized_customer_name) = LOWER(cp.customer) THEN 'normalized_match'
        WHEN LOWER(cl.location_name) = LOWER(cp.customer) THEN 'location_name_match'
        ELSE 'fuzzy_match'
      END as match_method
    FROM customer_locations cl
    CROSS JOIN (
      SELECT DISTINCT customer 
      FROM captive_payment_records 
      WHERE customer IS NOT NULL 
        AND customer != ''
    ) cp
    WHERE 
      -- Exact matches
      LOWER(cl.customer_name) = LOWER(cp.customer)
      OR LOWER(cl.normalized_customer_name) = LOWER(cp.customer)
      OR LOWER(cl.location_name) = LOWER(cp.customer)
      -- Fuzzy matches with high similarity
      OR similarity(LOWER(cl.customer_name), LOWER(cp.customer)) > 0.7
      OR similarity(LOWER(cl.normalized_customer_name), LOWER(cp.customer)) > 0.7
      OR similarity(LOWER(cl.location_name), LOWER(cp.customer)) > 0.7
  ),
  best_matches AS (
    SELECT 
      cm.*,
      ROW_NUMBER() OVER (
        PARTITION BY cm.customer_location_id 
        ORDER BY cm.sim_score DESC, 
                 CASE cm.match_method 
                   WHEN 'exact_match' THEN 1
                   WHEN 'normalized_match' THEN 2
                   WHEN 'location_name_match' THEN 3
                   ELSE 4
                 END
      ) as rn
    FROM customer_matches cm
  )
  SELECT 
    bm.customer_location_id,
    bm.customer_name,
    bm.matched_captive_customer,
    (bm.sim_score * 100)::DECIMAL(5,2) as confidence_score,
    bm.match_method
  FROM best_matches bm
  WHERE bm.rn = 1
    AND bm.sim_score > 0.6; -- Only return matches with >60% confidence
END;
$$ LANGUAGE plpgsql;

-- Function to update BP customer flags based on captive payments
CREATE OR REPLACE FUNCTION update_bp_customer_flags()
RETURNS TABLE (
  updated_customers INTEGER,
  bp_customers_found INTEGER,
  total_captive_customers INTEGER
) AS $$
DECLARE
  updated_count INTEGER := 0;
  bp_count INTEGER := 0;
  captive_count INTEGER;
BEGIN
  -- Get count of unique captive payment customers
  SELECT COUNT(DISTINCT customer) INTO captive_count
  FROM captive_payment_records 
  WHERE customer IS NOT NULL AND customer != '';
  
  -- Reset all BP flags first
  UPDATE customer_locations 
  SET 
    is_bp_customer = FALSE,
    contract_type = 'unknown',
    updated_at = NOW();
  
  -- Update customers found in captive payments
  WITH bp_matches AS (
    SELECT * FROM identify_bp_customers_from_captive_payments()
  )
  UPDATE customer_locations cl
  SET 
    is_bp_customer = TRUE,
    contract_type = CASE 
      WHEN LOWER(bm.matched_captive_customer) LIKE '%aviation%' 
           OR LOWER(bm.matched_captive_customer) LIKE '%airport%' 
           OR LOWER(bm.matched_captive_customer) LIKE '%airpt%' THEN 'bp_aviation'
      WHEN LOWER(bm.matched_captive_customer) LIKE '%mine%' 
           OR LOWER(bm.matched_captive_customer) LIKE '%mining%' THEN 'bp_mining'
      ELSE 'bp_commercial'
    END,
    notes = COALESCE(cl.notes || ' | ', '') || 
            'BP customer identified from captive payments: ' || bm.matched_captive_customer ||
            ' (confidence: ' || bm.confidence_score || '%, method: ' || bm.match_method || ')',
    updated_at = NOW()
  FROM bp_matches bm
  WHERE cl.id = bm.customer_location_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Count BP customers found
  SELECT COUNT(*) INTO bp_count
  FROM customer_locations 
  WHERE is_bp_customer = TRUE;
  
  RETURN QUERY SELECT updated_count, bp_count, captive_count;
END;
$$ LANGUAGE plpgsql;

-- Function to validate customer name matching
CREATE OR REPLACE FUNCTION validate_customer_captive_matching()
RETURNS TABLE (
  csv_customer_name TEXT,
  has_gps BOOLEAN,
  captive_matches INTEGER,
  best_captive_match TEXT,
  confidence_score DECIMAL(5,2),
  match_method TEXT,
  is_bp_customer BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH captive_customer_counts AS (
    SELECT 
      customer,
      COUNT(*) as delivery_count
    FROM captive_payment_records 
    WHERE customer IS NOT NULL AND customer != ''
    GROUP BY customer
  ),
  customer_analysis AS (
    SELECT 
      cl.customer_name as csv_customer_name,
      (cl.latitude IS NOT NULL AND cl.longitude IS NOT NULL) as has_gps,
      cl.is_bp_customer,
      bm.matched_captive_customer as best_captive_match,
      bm.confidence_score,
      bm.match_method,
      COALESCE(ccc.delivery_count, 0) as captive_matches
    FROM customer_locations cl
    LEFT JOIN identify_bp_customers_from_captive_payments() bm ON cl.id = bm.customer_location_id
    LEFT JOIN captive_customer_counts ccc ON ccc.customer = bm.matched_captive_customer
  )
  SELECT 
    ca.csv_customer_name,
    ca.has_gps,
    ca.captive_matches,
    ca.best_captive_match,
    ca.confidence_score,
    ca.match_method,
    ca.is_bp_customer
  FROM customer_analysis ca
  ORDER BY ca.captive_matches DESC NULLS LAST, ca.confidence_score DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to refresh customer analytics
CREATE OR REPLACE FUNCTION refresh_customer_analytics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW customer_analytics_summary;
  
  -- Update last delivery dates
  UPDATE customer_locations cl
  SET last_delivery_date = (
    SELECT MAX(cdc.trip_date)
    FROM customer_delivery_correlations cdc
    WHERE cdc.customer_location_id = cl.id
  )
  WHERE EXISTS (
    SELECT 1 FROM customer_delivery_correlations cdc
    WHERE cdc.customer_location_id = cl.id
  );
  
  -- Update statistics
  ANALYZE customer_locations;
  ANALYZE customer_delivery_correlations;
  
  RAISE NOTICE 'Customer analytics refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to calculate customer delivery distance for a trip
CREATE OR REPLACE FUNCTION calculate_customer_delivery_distance(
  trip_id UUID,
  max_search_radius_km INTEGER DEFAULT 50
)
RETURNS TABLE (
  customer_location_id UUID,
  customer_name TEXT,
  distance_km DECIMAL(8,2),
  match_type TEXT,
  confidence_score DECIMAL(5,2)
) AS $$
DECLARE
  trip_rec RECORD;
BEGIN
  -- Get trip details
  SELECT th.start_latitude, th.start_longitude, th.end_latitude, th.end_longitude,
         th.start_location, th.end_location, th.distance_km
  INTO trip_rec
  FROM mtdata_trip_history th
  WHERE th.id = trip_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Find customers near trip end point (primary)
  RETURN QUERY
  SELECT 
    cl.id as customer_location_id,
    cl.customer_name,
    (ST_Distance(
      cl.location_point,
      ST_SetSRID(ST_MakePoint(trip_rec.end_longitude, trip_rec.end_latitude), 4326)::geography
    ) / 1000)::DECIMAL(8,2) AS distance_km,
    'geographic_end_point'::TEXT as match_type,
    CASE 
      WHEN ST_Distance(
        cl.location_point,
        ST_SetSRID(ST_MakePoint(trip_rec.end_longitude, trip_rec.end_latitude), 4326)::geography
      ) / 1000 <= 5 THEN 95.0
      WHEN ST_Distance(
        cl.location_point,
        ST_SetSRID(ST_MakePoint(trip_rec.end_longitude, trip_rec.end_latitude), 4326)::geography
      ) / 1000 <= 10 THEN 85.0
      WHEN ST_Distance(
        cl.location_point,
        ST_SetSRID(ST_MakePoint(trip_rec.end_longitude, trip_rec.end_latitude), 4326)::geography
      ) / 1000 <= 20 THEN 70.0
      ELSE 50.0
    END::DECIMAL(5,2) as confidence_score
  FROM customer_locations cl
  WHERE cl.is_active_customer = TRUE
    AND ST_DWithin(
      cl.location_point,
      ST_SetSRID(ST_MakePoint(trip_rec.end_longitude, trip_rec.end_latitude), 4326)::geography,
      max_search_radius_km * 1000
    )
  ORDER BY distance_km ASC
  LIMIT 10;
  
END;
$$ LANGUAGE plpgsql;

-- Function to calculate customer delivery distance for multiple trips (batch processing)
CREATE OR REPLACE FUNCTION calculate_customer_delivery_distance_batch(
  date_from DATE DEFAULT NULL,
  date_to DATE DEFAULT NULL,
  max_trips INTEGER DEFAULT 100,
  max_search_radius_km INTEGER DEFAULT 50
)
RETURNS TABLE (
  trips_processed INTEGER,
  correlations_created INTEGER,
  processing_time_seconds DECIMAL(8,2)
) AS $$
DECLARE
  start_time TIMESTAMP := clock_timestamp();
  trip_count INTEGER := 0;
  correlation_count INTEGER := 0;
  trip_rec RECORD;
BEGIN
  -- Set default date range if not provided
  IF date_from IS NULL THEN
    date_from := CURRENT_DATE - INTERVAL '7 days';
  END IF;
  IF date_to IS NULL THEN
    date_to := CURRENT_DATE;
  END IF;
  
  -- Process trips in the date range
  FOR trip_rec IN 
    SELECT th.id, th.external_id, th.start_time::DATE as trip_date,
           th.end_latitude, th.end_longitude, th.distance_km
    FROM mtdata_trip_history th
    WHERE th.start_time::DATE BETWEEN date_from AND date_to
      AND th.end_latitude IS NOT NULL 
      AND th.end_longitude IS NOT NULL
    ORDER BY th.start_time DESC
    LIMIT max_trips
  LOOP
    trip_count := trip_count + 1;
    
    -- Find customer matches for this trip
    INSERT INTO customer_delivery_correlations (
      mtdata_trip_id,
      trip_external_id,
      trip_date,
      customer_location_id,
      customer_name,
      matched_trip_point,
      distance_to_customer_km,
      within_delivery_radius,
      confidence_score,
      match_type,
      trip_distance_km,
      is_bp_delivery,
      contract_type,
      correlation_algorithm,
      analysis_run_id
    )
    SELECT 
      trip_rec.id,
      trip_rec.external_id,
      trip_rec.trip_date,
      cd.customer_location_id,
      cd.customer_name,
      'end_point',
      cd.distance_km,
      cd.distance_km <= 10, -- Within 10km considered delivery radius
      cd.confidence_score,
      cd.match_type,
      trip_rec.distance_km,
      cl.is_bp_customer,
      cl.contract_type,
      'batch_v1.0',
      gen_random_uuid()
    FROM calculate_customer_delivery_distance(trip_rec.id, max_search_radius_km) cd
    JOIN customer_locations cl ON cl.id = cd.customer_location_id
    WHERE cd.confidence_score >= 60 -- Only store high-confidence matches
    LIMIT 3; -- Max 3 correlations per trip
    
    correlation_count := correlation_count + COALESCE((
      SELECT COUNT(*) FROM calculate_customer_delivery_distance(trip_rec.id, max_search_radius_km) cd
      WHERE cd.confidence_score >= 60
    ), 0);
  END LOOP;
  
  RETURN QUERY SELECT 
    trip_count,
    correlation_count,
    EXTRACT(EPOCH FROM (clock_timestamp() - start_time))::DECIMAL(8,2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PERMISSIONS AND COMMENTS
-- ============================================================================

-- Grant permissions
GRANT SELECT ON customer_locations TO authenticated;
GRANT INSERT, UPDATE ON customer_locations TO authenticated;
GRANT SELECT ON customer_delivery_correlations TO authenticated;
GRANT INSERT, UPDATE ON customer_delivery_correlations TO authenticated;
GRANT SELECT ON customer_distance_analytics TO authenticated;
GRANT SELECT ON bp_customer_performance TO authenticated;
GRANT SELECT ON customer_analytics_summary TO authenticated;

-- Function permissions
GRANT EXECUTE ON FUNCTION find_customers_near_point(DECIMAL, DECIMAL, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION find_nearest_customer(DECIMAL, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION match_customer_by_name(TEXT, REAL) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_customer_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_customer_delivery_distance(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION identify_bp_customers_from_captive_payments() TO authenticated;
GRANT EXECUTE ON FUNCTION update_bp_customer_flags() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_customer_captive_matching() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_customer_delivery_distance_batch(DATE, DATE, INTEGER, INTEGER) TO authenticated;

-- Add comments
COMMENT ON TABLE customer_locations IS 'GPS-based customer location database for delivery distance tracking and BP contract analytics';
COMMENT ON TABLE customer_delivery_correlations IS 'Links MTdata trips to specific customer delivery locations with distance metrics';
COMMENT ON VIEW customer_distance_analytics IS 'Comprehensive customer delivery analytics with distance and efficiency metrics';
COMMENT ON VIEW bp_customer_performance IS 'BP customer-specific performance analytics and contract tracking';
COMMENT ON MATERIALIZED VIEW customer_analytics_summary IS 'Pre-aggregated customer analytics by time period and customer type';

-- Initialize materialized view
SELECT refresh_customer_analytics();

SELECT 'Customer locations system created successfully' as result;