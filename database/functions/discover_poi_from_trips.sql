-- POI Discovery Function using PostGIS ST_ClusterDBSCAN
-- Analyzes trip start and end points to automatically discover terminals and customer locations

CREATE OR REPLACE FUNCTION discover_poi_from_trips(
  p_epsilon_meters INTEGER DEFAULT 500,        -- Maximum distance for clustering (500m)
  p_min_points INTEGER DEFAULT 10,             -- Minimum trips to form a POI
  p_min_idle_minutes INTEGER DEFAULT 30,       -- Minimum idle time in minutes to consider a stop
  p_clear_existing BOOLEAN DEFAULT FALSE       -- Clear existing discoveries before running
)
RETURNS TABLE (
  poi_count INTEGER,
  start_poi_count INTEGER,
  end_poi_count INTEGER,
  total_trips_analyzed INTEGER,
  message TEXT
) AS $$
DECLARE
  v_start_poi_count INTEGER := 0;
  v_end_poi_count INTEGER := 0;
  v_total_trips INTEGER := 0;
  v_total_poi INTEGER := 0;
BEGIN
  -- Clear existing discovered POIs if requested
  IF p_clear_existing THEN
    DELETE FROM discovered_poi WHERE classification_status = 'discovered';
    RAISE NOTICE 'Cleared existing discovered POIs';
  END IF;

  -- Count total trips
  SELECT COUNT(*) INTO v_total_trips
  FROM mtdata_trip_history
  WHERE start_point IS NOT NULL OR end_point IS NOT NULL;

  -- Step 1: Cluster trip START points (terminals/depots)
  RAISE NOTICE 'Clustering trip start points...';

  WITH start_clusters AS (
    SELECT
      ST_ClusterDBSCAN(start_point::geometry, eps := p_epsilon_meters, minpoints := p_min_points) OVER () AS cluster_id,
      id,
      start_latitude,
      start_longitude,
      start_point,
      idling_time_hours
    FROM mtdata_trip_history
    WHERE start_point IS NOT NULL
      AND start_latitude IS NOT NULL
      AND start_longitude IS NOT NULL
      AND idling_time_hours >= (p_min_idle_minutes / 60.0)  -- Filter by minimum idle time
  ),
  cluster_stats AS (
    SELECT
      cluster_id,
      COUNT(*) AS trip_count,
      ST_Y(ST_Centroid(ST_Collect(start_point::geometry))) AS centroid_lat,
      ST_X(ST_Centroid(ST_Collect(start_point::geometry))) AS centroid_lon,
      AVG(idling_time_hours) AS avg_idle_time,
      SUM(idling_time_hours) AS total_idle_time,
      MIN(start_latitude) AS min_lat,
      MAX(start_latitude) AS max_lat,
      MIN(start_longitude) AS min_lon,
      MAX(start_longitude) AS max_lon,
      -- Calculate GPS accuracy (standard deviation of cluster points)
      STDDEV(start_latitude) * 111000 AS lat_std_meters,  -- Approx conversion to meters
      STDDEV(start_longitude) * 111000 * COS(RADIANS(AVG(start_latitude))) AS lon_std_meters
    FROM start_clusters
    WHERE cluster_id IS NOT NULL  -- Exclude noise points
    GROUP BY cluster_id
    HAVING COUNT(*) >= p_min_points
  )
  INSERT INTO discovered_poi (
    poi_type,
    classification_status,
    centroid_latitude,
    centroid_longitude,
    trip_count,
    start_point_count,
    end_point_count,
    avg_idle_time_hours,
    total_idle_time_hours,
    confidence_score,
    gps_accuracy_meters,
    cluster_id,
    suggested_name,
    service_radius_km,
    first_seen,
    last_seen
  )
  SELECT
    'unknown' AS poi_type,  -- User will manually classify
    'discovered' AS classification_status,
    cs.centroid_lat,
    cs.centroid_lon,
    cs.trip_count,
    cs.trip_count AS start_point_count,  -- All trips start here
    0 AS end_point_count,
    cs.avg_idle_time,
    cs.total_idle_time,
    -- Confidence score based on trip count and GPS accuracy
    LEAST(100, GREATEST(0,
      50 +  -- Base score
      (CASE WHEN cs.trip_count > 100 THEN 30 WHEN cs.trip_count > 50 THEN 20 WHEN cs.trip_count > 20 THEN 10 ELSE 0 END) +  -- Trip count bonus
      (CASE WHEN GREATEST(cs.lat_std_meters, cs.lon_std_meters) < 50 THEN 20 WHEN GREATEST(cs.lat_std_meters, cs.lon_std_meters) < 100 THEN 10 ELSE 0 END)  -- GPS accuracy bonus
    ))::INTEGER AS confidence_score,
    GREATEST(cs.lat_std_meters, cs.lon_std_meters) AS gps_accuracy_meters,
    cs.cluster_id,
    'Start Point Cluster #' || cs.cluster_id || ' (' || cs.trip_count || ' trips)' AS suggested_name,
    1 AS service_radius_km,
    NOW() - INTERVAL '30 days' AS first_seen,  -- Approximate
    NOW() AS last_seen
  FROM cluster_stats cs;

  GET DIAGNOSTICS v_start_poi_count = ROW_COUNT;
  RAISE NOTICE 'Discovered % POIs from trip start points', v_start_poi_count;

  -- Step 2: Cluster trip END points (customer locations)
  RAISE NOTICE 'Clustering trip end points...';

  WITH end_clusters AS (
    SELECT
      ST_ClusterDBSCAN(end_point::geometry, eps := p_epsilon_meters, minpoints := p_min_points) OVER () AS cluster_id,
      id,
      end_latitude,
      end_longitude,
      end_point,
      idling_time_hours
    FROM mtdata_trip_history
    WHERE end_point IS NOT NULL
      AND end_latitude IS NOT NULL
      AND end_longitude IS NOT NULL
      AND idling_time_hours >= (p_min_idle_minutes / 60.0)  -- Filter by minimum idle time
  ),
  cluster_stats AS (
    SELECT
      cluster_id,
      COUNT(*) AS trip_count,
      ST_Y(ST_Centroid(ST_Collect(end_point::geometry))) AS centroid_lat,
      ST_X(ST_Centroid(ST_Collect(end_point::geometry))) AS centroid_lon,
      AVG(idling_time_hours) AS avg_idle_time,
      SUM(idling_time_hours) AS total_idle_time,
      STDDEV(end_latitude) * 111000 AS lat_std_meters,
      STDDEV(end_longitude) * 111000 * COS(RADIANS(AVG(end_latitude))) AS lon_std_meters
    FROM end_clusters
    WHERE cluster_id IS NOT NULL
    GROUP BY cluster_id
    HAVING COUNT(*) >= p_min_points
  )
  INSERT INTO discovered_poi (
    poi_type,
    classification_status,
    centroid_latitude,
    centroid_longitude,
    trip_count,
    start_point_count,
    end_point_count,
    avg_idle_time_hours,
    total_idle_time_hours,
    confidence_score,
    gps_accuracy_meters,
    cluster_id,
    suggested_name,
    service_radius_km,
    first_seen,
    last_seen
  )
  SELECT
    'unknown' AS poi_type,  -- User will manually classify
    'discovered' AS classification_status,
    cs.centroid_lat,
    cs.centroid_lon,
    cs.trip_count,
    0 AS start_point_count,
    cs.trip_count AS end_point_count,  -- All trips end here
    cs.avg_idle_time,
    cs.total_idle_time,
    LEAST(100, GREATEST(0,
      50 +
      (CASE WHEN cs.trip_count > 100 THEN 30 WHEN cs.trip_count > 50 THEN 20 WHEN cs.trip_count > 20 THEN 10 ELSE 0 END) +
      (CASE WHEN GREATEST(cs.lat_std_meters, cs.lon_std_meters) < 50 THEN 20 WHEN GREATEST(cs.lat_std_meters, cs.lon_std_meters) < 100 THEN 10 ELSE 0 END)
    ))::INTEGER AS confidence_score,
    GREATEST(cs.lat_std_meters, cs.lon_std_meters) AS gps_accuracy_meters,
    cs.cluster_id + 10000 AS cluster_id,  -- Offset to avoid conflicts with start clusters
    'End Point Cluster #' || cs.cluster_id || ' (' || cs.trip_count || ' trips)' AS suggested_name,
    1 AS service_radius_km,
    NOW() - INTERVAL '30 days' AS first_seen,
    NOW() AS last_seen
  FROM cluster_stats cs;

  GET DIAGNOSTICS v_end_poi_count = ROW_COUNT;
  RAISE NOTICE 'Discovered % POIs from trip end points', v_end_poi_count;

  -- Step 3: Merge nearby POIs that appear in both start and end clusters
  -- This finds locations that are both origins and destinations (mixed use)
  RAISE NOTICE 'Merging overlapping POIs...';

  -- Create temporary table for poi pairs to use across multiple statements
  CREATE TEMP TABLE IF NOT EXISTS temp_poi_pairs (
    start_poi_id UUID,
    end_poi_id UUID,
    distance_meters DOUBLE PRECISION
  ) ON COMMIT DROP;

  -- Clear temp table in case it exists from previous run
  TRUNCATE temp_poi_pairs;

  -- Populate poi pairs
  INSERT INTO temp_poi_pairs (start_poi_id, end_poi_id, distance_meters)
  SELECT
    p1.id AS start_poi_id,
    p2.id AS end_poi_id,
    ST_Distance(p1.location_point::geography, p2.location_point::geography) AS distance_meters
  FROM discovered_poi p1
  CROSS JOIN discovered_poi p2
  WHERE p1.start_point_count > 0
    AND p1.end_point_count = 0
    AND p2.end_point_count > 0
    AND p2.start_point_count = 0
    AND p1.classification_status = 'discovered'
    AND p2.classification_status = 'discovered'
    AND ST_DWithin(p1.location_point::geography, p2.location_point::geography, p_epsilon_meters);

  -- Update start POIs with end point data
  UPDATE discovered_poi AS p1
  SET
    end_point_count = (
      SELECT p2.end_point_count
      FROM discovered_poi p2
      JOIN temp_poi_pairs pp ON pp.end_poi_id = p2.id
      WHERE pp.start_poi_id = p1.id
      LIMIT 1
    ),
    trip_count = trip_count + (
      SELECT p2.trip_count
      FROM discovered_poi p2
      JOIN temp_poi_pairs pp ON pp.end_poi_id = p2.id
      WHERE pp.start_poi_id = p1.id
      LIMIT 1
    ),
    suggested_name = 'Mixed Use Location (' ||
      (trip_count + COALESCE((
        SELECT p2.trip_count
        FROM discovered_poi p2
        JOIN temp_poi_pairs pp ON pp.end_poi_id = p2.id
        WHERE pp.start_poi_id = p1.id
        LIMIT 1
      ), 0)) || ' trips)',
    updated_at = NOW()
  WHERE p1.id IN (SELECT start_poi_id FROM temp_poi_pairs);

  -- Mark merged POIs as merged
  UPDATE discovered_poi
  SET classification_status = 'merged'
  WHERE id IN (SELECT end_poi_id FROM temp_poi_pairs);

  -- Clean up temporary table
  DROP TABLE IF EXISTS temp_poi_pairs;

  -- Terminal matching removed - user will manually classify and match POIs

  v_total_poi := v_start_poi_count + v_end_poi_count;

  -- Return summary
  RETURN QUERY SELECT
    v_total_poi,
    v_start_poi_count,
    v_end_poi_count,
    v_total_trips,
    'Successfully discovered ' || v_total_poi || ' POIs from ' || v_total_trips || ' trips';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION discover_poi_from_trips(INTEGER, INTEGER, INTEGER, BOOLEAN) TO authenticated;

-- Example usage:
-- SELECT * FROM discover_poi_from_trips();  -- Default: 500m radius, 10 trips, 30min idle, keep existing
-- SELECT * FROM discover_poi_from_trips(500, 10, 30, false);  -- Explicit defaults
-- SELECT * FROM discover_poi_from_trips(500, 10, 60, true);   -- 60min minimum idle, clear existing

COMMENT ON FUNCTION discover_poi_from_trips IS
'Discovers significant stop locations from trip data using ST_ClusterDBSCAN spatial clustering.
Only includes locations where trucks stopped for at least the minimum idle time.
User must manually classify each POI as terminal/depot/customer and match to captive payment names.
Parameters: epsilon_meters (cluster radius, default 500), min_points (minimum trips, default 10),
min_idle_minutes (minimum stop duration, default 30), clear_existing (reset discoveries, default false).';
