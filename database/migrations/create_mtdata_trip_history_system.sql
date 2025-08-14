-- ============================================================================
-- MTDATA TRIP HISTORY SYSTEM
-- Comprehensive trip tracking and analytics from MtData fleet management system
-- ============================================================================

-- Enable PostGIS extension for spatial data if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Drop existing tables if they exist (development/testing safe)
-- This ensures clean slate and prevents "column specified more than once" errors
-- Order matters: drop dependent tables first
DO $$
BEGIN
  RAISE NOTICE 'Starting MtData trip history system migration...';
  
  -- Drop dependent tables first
  DROP TABLE IF EXISTS mtdata_trip_analytics_daily CASCADE;
  RAISE NOTICE 'Dropped mtdata_trip_analytics_daily table';
  
  DROP TABLE IF EXISTS route_patterns CASCADE;
  RAISE NOTICE 'Dropped route_patterns table';
  
  DROP TABLE IF EXISTS mtdata_trip_history CASCADE;
  RAISE NOTICE 'Dropped mtdata_trip_history table';
  
  RAISE NOTICE 'All existing tables dropped successfully';
END $$;

-- Trip history table - Raw trip data from MtData extracts
CREATE TABLE mtdata_trip_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Trip identification
  trip_external_id TEXT, -- Combination of VehicleID + TripNo for uniqueness
  trip_number INTEGER NOT NULL,
  
  -- Vehicle and driver information
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  vehicle_registration TEXT NOT NULL, -- From Rego field
  mtdata_vehicle_id TEXT NOT NULL, -- VehicleID from MtData
  unit_serial_number TEXT, -- UnitSerialNumber for device correlation
  group_name TEXT NOT NULL, -- GroupName (fleet assignment)
  driver_name TEXT, -- DriverName from MtData
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL, -- Linked after name resolution
  
  -- Trip timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  travel_time_hours DECIMAL(8,6) NOT NULL, -- TravelTime converted to hours
  
  -- Trip locations
  start_location TEXT,
  start_latitude DECIMAL(10, 8),
  start_longitude DECIMAL(11, 8),
  start_point GEOGRAPHY(POINT, 4326), -- PostGIS point for spatial queries
  end_location TEXT,
  end_latitude DECIMAL(10, 8),
  end_longitude DECIMAL(11, 8),
  end_point GEOGRAPHY(POINT, 4326), -- PostGIS point for spatial queries
  
  -- Trip metrics
  distance_km DECIMAL(8,2) NOT NULL, -- Kms field
  odometer_reading DECIMAL(10,2), -- Odometer field
  idling_time_hours DECIMAL(8,6) DEFAULT 0, -- IdlingTime converted to hours
  idling_periods INTEGER DEFAULT 0, -- IdlingPeriods
  
  -- Calculated metrics (computed from data)
  average_speed_kph DECIMAL(6,2), -- distance_km / travel_time_hours
  route_efficiency_score DECIMAL(5,2), -- Calculated efficiency metric
  
  -- Date column for indexing (populated by trigger to avoid immutable function issues)
  trip_date_computed DATE,
  
  -- Data management
  upload_batch_id UUID, -- Link to CSV upload batch
  data_source TEXT DEFAULT 'MtData' NOT NULL,
  data_checksum TEXT, -- For duplicate detection
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  -- Ensure unique trip identification
  UNIQUE(mtdata_vehicle_id, trip_number, start_time)
);

-- Trip analytics aggregation table - Pre-computed analytics for performance
CREATE TABLE mtdata_trip_analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Aggregation keys
  date DATE NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  
  -- Daily aggregates
  total_trips INTEGER DEFAULT 0,
  total_distance_km DECIMAL(10,2) DEFAULT 0,
  total_travel_time_hours DECIMAL(8,2) DEFAULT 0,
  total_idling_time_hours DECIMAL(8,2) DEFAULT 0,
  
  -- Efficiency metrics
  average_speed_kph DECIMAL(6,2),
  idling_percentage DECIMAL(5,2), -- idling_time / travel_time * 100
  trip_efficiency_score DECIMAL(5,2), -- Composite efficiency metric
  
  -- Route patterns
  unique_locations INTEGER, -- Count of unique start/end locations
  longest_trip_km DECIMAL(8,2),
  shortest_trip_km DECIMAL(8,2),
  
  -- Operational patterns
  first_trip_start TIMESTAMPTZ,
  last_trip_end TIMESTAMPTZ,
  operational_hours DECIMAL(6,2), -- Hours between first and last trip
  
  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculation_version TEXT DEFAULT 'v1.0',
  
  -- Ensure unique date-vehicle combinations
  UNIQUE(date, vehicle_id)
);

-- Route efficiency patterns table - Identify commonly used routes
CREATE TABLE route_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Route identification
  route_hash TEXT NOT NULL, -- Hash of start/end location pair
  start_location TEXT NOT NULL,
  end_location TEXT NOT NULL,
  start_area TEXT, -- Geocoded area/suburb
  end_area TEXT, -- Geocoded area/suburb
  
  -- Route metrics aggregates
  trip_count INTEGER DEFAULT 0,
  average_distance_km DECIMAL(8,2),
  average_travel_time_hours DECIMAL(8,2),
  best_time_hours DECIMAL(8,2), -- Fastest completion time
  worst_time_hours DECIMAL(8,2), -- Slowest completion time
  
  -- Efficiency analysis
  expected_distance_km DECIMAL(8,2), -- Straight-line or optimal distance
  efficiency_rating DECIMAL(5,2), -- actual vs expected distance ratio
  time_variability DECIMAL(5,2), -- Standard deviation of travel times
  
  -- Usage patterns
  most_common_vehicles TEXT[], -- Array of vehicle registrations
  most_common_drivers TEXT[], -- Array of driver names
  peak_usage_hours INTEGER[], -- Array of hours (0-23) when route is most used
  
  -- Geographic data
  route_line GEOGRAPHY(LINESTRING, 4326), -- Approximate route line
  route_bounds GEOGRAPHY(POLYGON, 4326), -- Bounding box for the route
  
  -- Metadata
  first_seen DATE,
  last_used DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique route combinations
  UNIQUE(route_hash)
);

-- ============================================================================
-- ENHANCE EXISTING TABLES FOR TRIP CORRELATION
-- ============================================================================

-- Add trip correlation to guardian_events if tables exist and column doesn't exist
DO $$ 
BEGIN
  -- Check if guardian_events table exists before trying to alter it
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guardian_events') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'guardian_events' AND column_name = 'mtdata_trip_id'
    ) THEN
      ALTER TABLE guardian_events ADD COLUMN mtdata_trip_id UUID REFERENCES mtdata_trip_history(id) ON DELETE SET NULL;
      RAISE NOTICE 'Added mtdata_trip_id column to guardian_events table';
    END IF;
  ELSE
    RAISE NOTICE 'guardian_events table does not exist, skipping mtdata_trip_id column addition';
  END IF;
END $$;

-- Add trip correlation to lytx_safety_events if tables exist and column doesn't exist
DO $$ 
BEGIN
  -- Check if lytx_safety_events table exists before trying to alter it
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lytx_safety_events') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'lytx_safety_events' AND column_name = 'mtdata_trip_id'
    ) THEN
      ALTER TABLE lytx_safety_events ADD COLUMN mtdata_trip_id UUID REFERENCES mtdata_trip_history(id) ON DELETE SET NULL;
      RAISE NOTICE 'Added mtdata_trip_id column to lytx_safety_events table';
    END IF;
  ELSE
    RAISE NOTICE 'lytx_safety_events table does not exist, skipping mtdata_trip_id column addition';
  END IF;
END $$;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Trip history indexes
CREATE INDEX IF NOT EXISTS idx_mtdata_trip_history_vehicle_id ON mtdata_trip_history(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_mtdata_trip_history_driver_id ON mtdata_trip_history(driver_id);
CREATE INDEX IF NOT EXISTS idx_mtdata_trip_history_start_time ON mtdata_trip_history(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_mtdata_trip_history_vehicle_date ON mtdata_trip_history(vehicle_id, trip_date_computed);
CREATE INDEX IF NOT EXISTS idx_mtdata_trip_history_registration ON mtdata_trip_history(vehicle_registration);
CREATE INDEX IF NOT EXISTS idx_mtdata_trip_history_unit_serial ON mtdata_trip_history(unit_serial_number);
CREATE INDEX IF NOT EXISTS idx_mtdata_trip_history_external_id ON mtdata_trip_history(trip_external_id);
CREATE INDEX IF NOT EXISTS idx_mtdata_trip_history_batch ON mtdata_trip_history(upload_batch_id);

-- Spatial indexes for geographic queries
CREATE INDEX IF NOT EXISTS idx_mtdata_trip_history_start_point ON mtdata_trip_history USING GIST(start_point);
CREATE INDEX IF NOT EXISTS idx_mtdata_trip_history_end_point ON mtdata_trip_history USING GIST(end_point);

-- Trip analytics indexes
CREATE INDEX IF NOT EXISTS idx_mtdata_trip_analytics_date ON mtdata_trip_analytics_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_mtdata_trip_analytics_vehicle ON mtdata_trip_analytics_daily(vehicle_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_mtdata_trip_analytics_driver ON mtdata_trip_analytics_daily(driver_id, date DESC);

-- Route patterns indexes
CREATE INDEX IF NOT EXISTS idx_route_patterns_hash ON route_patterns(route_hash);
CREATE INDEX IF NOT EXISTS idx_route_patterns_start_location ON route_patterns(start_location);
CREATE INDEX IF NOT EXISTS idx_route_patterns_end_location ON route_patterns(end_location);
CREATE INDEX IF NOT EXISTS idx_route_patterns_efficiency ON route_patterns(efficiency_rating DESC);
CREATE INDEX IF NOT EXISTS idx_route_patterns_usage ON route_patterns(trip_count DESC);

-- Safety event correlation indexes (only if tables exist)
DO $$
BEGIN
  -- Create index on guardian_events if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guardian_events') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guardian_events' AND column_name = 'mtdata_trip_id') THEN
      CREATE INDEX IF NOT EXISTS idx_guardian_events_mtdata_trip_id ON guardian_events(mtdata_trip_id) WHERE mtdata_trip_id IS NOT NULL;
      RAISE NOTICE 'Created index on guardian_events.mtdata_trip_id';
    END IF;
  END IF;
  
  -- Create index on lytx_safety_events if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lytx_safety_events') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lytx_safety_events' AND column_name = 'mtdata_trip_id') THEN
      CREATE INDEX IF NOT EXISTS idx_lytx_safety_events_mtdata_trip_id ON lytx_safety_events(mtdata_trip_id) WHERE mtdata_trip_id IS NOT NULL;
      RAISE NOTICE 'Created index on lytx_safety_events.mtdata_trip_id';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to calculate trip metrics
CREATE OR REPLACE FUNCTION calculate_trip_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Set trip_date_computed from start_time
  IF NEW.start_time IS NOT NULL THEN
    NEW.trip_date_computed = NEW.start_time::DATE;
  END IF;
  
  -- Calculate average speed if not provided
  IF NEW.average_speed_kph IS NULL AND NEW.travel_time_hours > 0 THEN
    NEW.average_speed_kph = NEW.distance_km / NEW.travel_time_hours;
  END IF;
  
  -- Create spatial points from coordinates
  IF NEW.start_latitude IS NOT NULL AND NEW.start_longitude IS NOT NULL THEN
    NEW.start_point = ST_SetSRID(ST_MakePoint(NEW.start_longitude, NEW.start_latitude), 4326)::geography;
  END IF;
  
  IF NEW.end_latitude IS NOT NULL AND NEW.end_longitude IS NOT NULL THEN
    NEW.end_point = ST_SetSRID(ST_MakePoint(NEW.end_longitude, NEW.end_latitude), 4326)::geography;
  END IF;
  
  -- Calculate route efficiency score (basic implementation)
  IF NEW.start_point IS NOT NULL AND NEW.end_point IS NOT NULL THEN
    DECLARE
      straight_line_distance DECIMAL(8,2);
    BEGIN
      straight_line_distance = ST_Distance(NEW.start_point, NEW.end_point) / 1000; -- Convert to km
      IF straight_line_distance > 0 THEN
        NEW.route_efficiency_score = (straight_line_distance / NEW.distance_km) * 100;
      END IF;
    END;
  END IF;
  
  -- Generate external ID if not provided
  IF NEW.trip_external_id IS NULL THEN
    NEW.trip_external_id = NEW.mtdata_vehicle_id || '_' || NEW.trip_number::TEXT;
  END IF;
  
  -- Update timestamp
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for trip metrics calculation
CREATE TRIGGER calculate_trip_metrics_trigger
  BEFORE INSERT OR UPDATE ON mtdata_trip_history
  FOR EACH ROW
  EXECUTE FUNCTION calculate_trip_metrics();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update triggers for updated_at
CREATE TRIGGER update_mtdata_trip_analytics_updated_at 
  BEFORE UPDATE ON mtdata_trip_analytics_daily 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_route_patterns_updated_at 
  BEFORE UPDATE ON route_patterns 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR ANALYTICS AND REPORTING
-- ============================================================================

-- Trip performance view with vehicle and driver details
CREATE OR REPLACE VIEW mtdata_trip_performance_view AS
SELECT 
  th.*,
  v.fleet,
  v.depot,
  v.make,
  v.model,
  v.guardian_unit,
  v.lytx_device,
  d.first_name as driver_first_name,
  d.last_name as driver_last_name,
  d.employee_id as driver_employee_id,
  
  -- Calculated fields
  EXTRACT(EPOCH FROM (th.end_time - th.start_time)) / 3600 as calculated_travel_hours,
  (th.idling_time_hours / NULLIF(th.travel_time_hours, 0)) * 100 as idling_percentage,
  
  -- Date groupings for analytics
  th.trip_date_computed as trip_date,
  EXTRACT(HOUR FROM th.start_time) as start_hour,
  EXTRACT(DOW FROM th.start_time) as day_of_week,
  TO_CHAR(th.start_time, 'YYYY-MM') as month_year,
  
  -- Safety event correlations
  (SELECT COUNT(*) FROM guardian_events ge WHERE ge.mtdata_trip_id = th.id) as guardian_events_count,
  (SELECT COUNT(*) FROM lytx_safety_events lse WHERE lse.mtdata_trip_id = th.id) as lytx_events_count

FROM mtdata_trip_history th
LEFT JOIN vehicles v ON th.vehicle_id = v.id
LEFT JOIN drivers d ON th.driver_id = d.id;

-- Daily fleet performance summary
CREATE OR REPLACE VIEW mtdata_daily_fleet_performance AS
SELECT 
  trip_date,
  fleet,
  depot,
  COUNT(*) as total_trips,
  COUNT(DISTINCT vehicle_id) as active_vehicles,
  COUNT(DISTINCT driver_id) as active_drivers,
  
  -- Distance and time aggregates
  SUM(distance_km) as total_distance_km,
  SUM(travel_time_hours) as total_travel_hours,
  SUM(idling_time_hours) as total_idling_hours,
  AVG(distance_km) as avg_trip_distance,
  AVG(travel_time_hours) as avg_trip_duration,
  
  -- Efficiency metrics
  AVG(average_speed_kph) as avg_speed_kph,
  AVG(idling_percentage) as avg_idling_percentage,
  AVG(route_efficiency_score) as avg_route_efficiency,
  
  -- Safety correlations
  SUM(guardian_events_count) as total_guardian_events,
  SUM(lytx_events_count) as total_lytx_events,
  
  -- Operational hours
  MIN(start_time) as first_trip_start,
  MAX(end_time) as last_trip_end

FROM mtdata_trip_performance_view
WHERE trip_date >= CURRENT_DATE - INTERVAL '90 days' -- Last 90 days for performance
GROUP BY trip_date, fleet, depot
ORDER BY trip_date DESC, fleet, depot;

-- Driver efficiency rankings
CREATE OR REPLACE VIEW mtdata_driver_efficiency_rankings AS
SELECT 
  driver_id,
  driver_first_name,
  driver_last_name,
  driver_employee_id,
  fleet,
  depot,
  
  -- 30-day metrics
  COUNT(*) as trips_count,
  SUM(distance_km) as total_distance,
  AVG(average_speed_kph) as avg_speed,
  AVG(idling_percentage) as avg_idling_percentage,
  AVG(route_efficiency_score) as avg_route_efficiency,
  
  -- Safety correlations
  SUM(guardian_events_count) as total_guardian_events,
  SUM(lytx_events_count) as total_lytx_events,
  
  -- Efficiency rankings within fleet
  RANK() OVER (PARTITION BY fleet ORDER BY AVG(route_efficiency_score) DESC) as efficiency_rank,
  RANK() OVER (PARTITION BY fleet ORDER BY AVG(idling_percentage) ASC) as idling_rank,
  RANK() OVER (PARTITION BY fleet ORDER BY AVG(average_speed_kph) DESC) as speed_rank

FROM mtdata_trip_performance_view
WHERE trip_date >= CURRENT_DATE - INTERVAL '30 days'
  AND driver_id IS NOT NULL
GROUP BY driver_id, driver_first_name, driver_last_name, driver_employee_id, fleet, depot
HAVING COUNT(*) >= 5 -- Minimum 5 trips for meaningful ranking
ORDER BY fleet, efficiency_rank;

-- Route optimization opportunities
CREATE OR REPLACE VIEW route_optimization_opportunities AS
SELECT 
  rp.*,
  
  -- Efficiency analysis
  CASE 
    WHEN rp.efficiency_rating < 80 THEN 'High Priority'
    WHEN rp.efficiency_rating < 90 THEN 'Medium Priority'
    ELSE 'Low Priority'
  END as optimization_priority,
  
  -- Time savings potential
  (rp.worst_time_hours - rp.best_time_hours) as time_variability_hours,
  (rp.average_travel_time_hours - rp.best_time_hours) as potential_time_savings,
  
  -- Usage frequency analysis
  CASE 
    WHEN rp.trip_count >= 50 THEN 'High Frequency'
    WHEN rp.trip_count >= 20 THEN 'Medium Frequency'
    ELSE 'Low Frequency'
  END as usage_frequency

FROM route_patterns rp
WHERE rp.trip_count >= 10 -- Routes with at least 10 trips
ORDER BY 
  CASE WHEN rp.efficiency_rating < 80 THEN 1
       WHEN rp.efficiency_rating < 90 THEN 2
       ELSE 3 END,
  rp.trip_count DESC;

-- ============================================================================
-- ANALYTICS GENERATION FUNCTIONS
-- ============================================================================

-- Function to generate daily trip analytics for a date range
CREATE OR REPLACE FUNCTION generate_trip_analytics_for_date_range(
  start_date DATE,
  end_date DATE
)
RETURNS VOID AS $$
BEGIN
  -- Insert or update daily analytics for the specified date range
  INSERT INTO mtdata_trip_analytics_daily (
    date,
    vehicle_id,
    driver_id,
    total_trips,
    total_distance_km,
    total_travel_time_hours,
    total_idling_time_hours,
    average_speed_kph,
    idling_percentage,
    trip_efficiency_score,
    unique_locations,
    longest_trip_km,
    shortest_trip_km,
    first_trip_start,
    last_trip_end,
    operational_hours
  )
  SELECT 
    DATE(th.start_time) as date,
    th.vehicle_id,
    th.driver_id,
    COUNT(*) as total_trips,
    SUM(th.distance_km) as total_distance_km,
    SUM(th.travel_time_hours) as total_travel_time_hours,
    SUM(th.idling_time_hours) as total_idling_time_hours,
    AVG(th.average_speed_kph) as average_speed_kph,
    
    -- Calculate idling percentage
    CASE 
      WHEN SUM(th.travel_time_hours) > 0 
      THEN (SUM(th.idling_time_hours) / SUM(th.travel_time_hours)) * 100
      ELSE 0
    END as idling_percentage,
    
    AVG(th.route_efficiency_score) as trip_efficiency_score,
    
    -- Count unique locations (start + end)
    COUNT(DISTINCT COALESCE(th.start_location, '') || '|' || COALESCE(th.end_location, '')) as unique_locations,
    
    MAX(th.distance_km) as longest_trip_km,
    MIN(th.distance_km) as shortest_trip_km,
    MIN(th.start_time) as first_trip_start,
    MAX(th.end_time) as last_trip_end,
    
    -- Calculate operational hours (time between first and last trip)
    EXTRACT(EPOCH FROM (MAX(th.end_time) - MIN(th.start_time))) / 3600 as operational_hours
    
  FROM mtdata_trip_history th
  WHERE th.trip_date_computed BETWEEN start_date AND end_date
    AND th.vehicle_id IS NOT NULL
  GROUP BY th.trip_date_computed, th.vehicle_id, th.driver_id
  
  -- Handle conflicts by updating existing records
  ON CONFLICT (date, vehicle_id) 
  DO UPDATE SET
    driver_id = EXCLUDED.driver_id,
    total_trips = EXCLUDED.total_trips,
    total_distance_km = EXCLUDED.total_distance_km,
    total_travel_time_hours = EXCLUDED.total_travel_time_hours,
    total_idling_time_hours = EXCLUDED.total_idling_time_hours,
    average_speed_kph = EXCLUDED.average_speed_kph,
    idling_percentage = EXCLUDED.idling_percentage,
    trip_efficiency_score = EXCLUDED.trip_efficiency_score,
    unique_locations = EXCLUDED.unique_locations,
    longest_trip_km = EXCLUDED.longest_trip_km,
    shortest_trip_km = EXCLUDED.shortest_trip_km,
    first_trip_start = EXCLUDED.first_trip_start,
    last_trip_end = EXCLUDED.last_trip_end,
    operational_hours = EXCLUDED.operational_hours,
    calculated_at = NOW();

  RAISE NOTICE 'Generated trip analytics for % to %', start_date, end_date;
END;
$$ LANGUAGE plpgsql;

-- Function to update route patterns
CREATE OR REPLACE FUNCTION update_route_patterns()
RETURNS VOID AS $$
BEGIN
  -- Insert or update route patterns based on trip history
  INSERT INTO route_patterns (
    route_hash,
    start_location,
    end_location,
    trip_count,
    average_distance_km,
    average_travel_time_hours,
    best_time_hours,
    worst_time_hours,
    efficiency_rating,
    time_variability,
    most_common_vehicles,
    most_common_drivers,
    first_seen,
    last_used
  )
  SELECT 
    MD5(COALESCE(start_location, '') || '|' || COALESCE(end_location, '')) as route_hash,
    start_location,
    end_location,
    COUNT(*) as trip_count,
    AVG(distance_km) as average_distance_km,
    AVG(travel_time_hours) as average_travel_time_hours,
    MIN(travel_time_hours) as best_time_hours,
    MAX(travel_time_hours) as worst_time_hours,
    
    -- Basic efficiency rating (can be enhanced)
    AVG(route_efficiency_score) as efficiency_rating,
    
    -- Time variability (standard deviation)
    STDDEV(travel_time_hours) as time_variability,
    
    -- Most common vehicles (top 5)
    ARRAY(
      SELECT vehicle_registration 
      FROM mtdata_trip_history th2 
      WHERE COALESCE(th2.start_location, '') = COALESCE(th.start_location, '')
        AND COALESCE(th2.end_location, '') = COALESCE(th.end_location, '')
      GROUP BY vehicle_registration 
      ORDER BY COUNT(*) DESC 
      LIMIT 5
    ) as most_common_vehicles,
    
    -- Most common drivers (top 5)
    ARRAY(
      SELECT driver_name 
      FROM mtdata_trip_history th2 
      WHERE COALESCE(th2.start_location, '') = COALESCE(th.start_location, '')
        AND COALESCE(th2.end_location, '') = COALESCE(th.end_location, '')
        AND driver_name IS NOT NULL
      GROUP BY driver_name 
      ORDER BY COUNT(*) DESC 
      LIMIT 5
    ) as most_common_drivers,
    
    MIN(th.trip_date_computed) as first_seen,
    MAX(th.trip_date_computed) as last_used
    
  FROM mtdata_trip_history th
  WHERE start_location IS NOT NULL 
    AND end_location IS NOT NULL
    AND start_location != end_location
  GROUP BY start_location, end_location
  HAVING COUNT(*) >= 3  -- Only routes with at least 3 trips
  
  -- Handle conflicts by updating existing records
  ON CONFLICT (route_hash)
  DO UPDATE SET
    trip_count = EXCLUDED.trip_count,
    average_distance_km = EXCLUDED.average_distance_km,
    average_travel_time_hours = EXCLUDED.average_travel_time_hours,
    best_time_hours = EXCLUDED.best_time_hours,
    worst_time_hours = EXCLUDED.worst_time_hours,
    efficiency_rating = EXCLUDED.efficiency_rating,
    time_variability = EXCLUDED.time_variability,
    most_common_vehicles = EXCLUDED.most_common_vehicles,
    most_common_drivers = EXCLUDED.most_common_drivers,
    last_used = EXCLUDED.last_used,
    updated_at = NOW();

  RAISE NOTICE 'Updated route patterns';
END;
$$ LANGUAGE plpgsql;

SELECT 'MtData trip history system created successfully' as result;