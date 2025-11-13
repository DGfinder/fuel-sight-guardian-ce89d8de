-- Create discovered_poi table for auto-discovered Points of Interest
-- Uses PostGIS ST_ClusterDBSCAN to find terminals and customer locations from trip data

CREATE TABLE IF NOT EXISTS discovered_poi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Classification
  poi_type TEXT CHECK (poi_type IN ('terminal', 'customer', 'rest_area', 'depot', 'unknown')) DEFAULT 'unknown',
  classification_status TEXT CHECK (classification_status IN ('discovered', 'classified', 'ignored', 'merged')) DEFAULT 'discovered',

  -- Location (PostGIS)
  centroid_latitude DECIMAL(10, 8) NOT NULL,
  centroid_longitude DECIMAL(11, 8) NOT NULL,
  location_point GEOGRAPHY(POINT, 4326),
  service_area GEOGRAPHY(POLYGON, 4326),

  -- Statistics from trip data
  trip_count INTEGER DEFAULT 0,
  start_point_count INTEGER DEFAULT 0, -- Trips starting here (depot/terminal indicator)
  end_point_count INTEGER DEFAULT 0,   -- Trips ending here (customer indicator)
  avg_idle_time_hours DECIMAL(8, 2),   -- Average idle time from trips
  total_idle_time_hours DECIMAL(10, 2), -- Total idle time across all trips

  -- Confidence and quality
  confidence_score INTEGER DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  gps_accuracy_meters DECIMAL(8, 2),   -- Standard deviation of clustered points

  -- Naming
  suggested_name TEXT,                 -- Auto-generated from trip data
  actual_name TEXT,                    -- User-provided name after classification
  address TEXT,                        -- Optional address

  -- Matching to existing data
  matched_terminal_id UUID REFERENCES terminal_locations(id) ON DELETE SET NULL,
  matched_customer_id UUID,            -- Future: link to customer_locations table

  -- Discovery metadata
  cluster_id INTEGER,                  -- Original DBSCAN cluster ID
  service_radius_km INTEGER DEFAULT 1, -- Radius for this POI
  first_seen TIMESTAMPTZ,              -- First trip date
  last_seen TIMESTAMPTZ,               -- Most recent trip date

  -- User notes and actions
  notes TEXT,
  classified_by TEXT,                  -- User who classified this POI
  classified_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_discovered_poi_type ON discovered_poi(poi_type);
CREATE INDEX IF NOT EXISTS idx_discovered_poi_status ON discovered_poi(classification_status);
CREATE INDEX IF NOT EXISTS idx_discovered_poi_trip_count ON discovered_poi(trip_count DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_poi_confidence ON discovered_poi(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_poi_terminal_match ON discovered_poi(matched_terminal_id);

-- PostGIS spatial index (GIST)
CREATE INDEX IF NOT EXISTS idx_discovered_poi_location ON discovered_poi USING GIST(location_point);
CREATE INDEX IF NOT EXISTS idx_discovered_poi_service_area ON discovered_poi USING GIST(service_area);

-- Trigger to auto-populate geography fields from lat/lon
CREATE OR REPLACE FUNCTION update_discovered_poi_geography()
RETURNS TRIGGER AS $$
BEGIN
  -- Create point from coordinates
  NEW.location_point := ST_SetSRID(ST_MakePoint(NEW.centroid_longitude, NEW.centroid_latitude), 4326)::geography;

  -- Create circular service area polygon
  IF NEW.service_radius_km IS NOT NULL AND NEW.service_radius_km > 0 THEN
    NEW.service_area := ST_Buffer(
      NEW.location_point,
      NEW.service_radius_km * 1000  -- Convert km to meters
    )::geography;
  END IF;

  -- Update timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_discovered_poi_geography ON discovered_poi;
CREATE TRIGGER trigger_update_discovered_poi_geography
  BEFORE INSERT OR UPDATE OF centroid_latitude, centroid_longitude, service_radius_km
  ON discovered_poi
  FOR EACH ROW
  EXECUTE FUNCTION update_discovered_poi_geography();

-- Add helpful comments
COMMENT ON TABLE discovered_poi IS
'Auto-discovered Points of Interest from trip data clustering. Uses ST_ClusterDBSCAN
to find terminals, customer locations, and rest areas from trip start/end points.';

COMMENT ON COLUMN discovered_poi.poi_type IS
'Type of POI: terminal (fuel loading), customer (delivery site), rest_area (driver break),
depot (vehicle storage), unknown (needs classification)';

COMMENT ON COLUMN discovered_poi.classification_status IS
'Discovery workflow status: discovered (new), classified (user reviewed),
ignored (not relevant), merged (combined with another POI)';

COMMENT ON COLUMN discovered_poi.start_point_count IS
'Number of trips starting at this location. High count suggests terminal/depot.';

COMMENT ON COLUMN discovered_poi.end_point_count IS
'Number of trips ending at this location. High count suggests customer site.';

COMMENT ON COLUMN discovered_poi.confidence_score IS
'Confidence in POI accuracy (0-100): Based on trip count, GPS accuracy, and clustering quality.';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON discovered_poi TO authenticated;

-- Create view for unclassified POIs
CREATE OR REPLACE VIEW unclassified_poi AS
SELECT
  *,
  CASE
    WHEN start_point_count > end_point_count * 2 THEN 'Likely Terminal/Depot'
    WHEN end_point_count > start_point_count * 2 THEN 'Likely Customer'
    WHEN start_point_count > 0 AND end_point_count > 0 THEN 'Mixed Use'
    ELSE 'Unknown'
  END AS suggested_type
FROM discovered_poi
WHERE classification_status = 'discovered'
ORDER BY trip_count DESC, confidence_score DESC;

GRANT SELECT ON unclassified_poi TO authenticated;

COMMENT ON VIEW unclassified_poi IS
'View of unclassified POIs with suggested type based on start/end point ratio.';
