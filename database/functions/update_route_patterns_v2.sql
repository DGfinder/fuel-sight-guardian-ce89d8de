-- Enhanced Route Pattern Generation with POI Spatial Intelligence
-- Uses discovered POIs to consolidate routes and add classification/quality metrics

CREATE OR REPLACE FUNCTION update_route_patterns_v2()
RETURNS TABLE (
  routes_created INTEGER,
  routes_updated INTEGER,
  routes_consolidated INTEGER,
  message TEXT
) AS $$
DECLARE
  v_routes_created INTEGER := 0;
  v_routes_updated INTEGER := 0;
  v_routes_consolidated INTEGER := 0;
  v_old_pattern_count INTEGER := 0;
BEGIN
  -- Count existing patterns for comparison
  SELECT COUNT(*) INTO v_old_pattern_count FROM route_patterns;

  RAISE NOTICE 'Starting enhanced route pattern generation with POI spatial matching...';

  -- Clear existing patterns (will be regenerated with POI links)
  DELETE FROM route_patterns;

  -- Step 1: Match trips to discovered POIs using spatial joins
  RAISE NOTICE 'Matching trips to POIs...';

  WITH trip_poi_matches AS (
    SELECT
      th.id AS trip_id,
      th.start_location AS raw_start,
      th.end_location AS raw_end,
      th.start_point,
      th.end_point,
      th.distance_km,
      th.travel_time_hours,
      th.idling_time_hours,
      th.vehicle_registration,
      th.driver_name,
      th.trip_start_time,

      -- Match start point to POI (use closest within service radius)
      (
        SELECT poi.id
        FROM discovered_poi poi
        WHERE ST_DWithin(
          th.start_point::geography,
          poi.location_point::geography,
          poi.service_radius_km * 1000
        )
        AND poi.classification_status = 'classified'
        AND poi.confidence_score >= 70
        ORDER BY ST_Distance(th.start_point::geography, poi.location_point::geography)
        LIMIT 1
      ) AS start_poi_id,

      -- Match end point to POI (use closest within service radius)
      (
        SELECT poi.id
        FROM discovered_poi poi
        WHERE ST_DWithin(
          th.end_point::geography,
          poi.location_point::geography,
          poi.service_radius_km * 1000
        )
        AND poi.classification_status = 'classified'
        AND poi.confidence_score >= 70
        ORDER BY ST_Distance(th.end_point::geography, poi.location_point::geography)
        LIMIT 1
      ) AS end_poi_id

    FROM mtdata_trip_history th
    WHERE th.start_point IS NOT NULL
      AND th.end_point IS NOT NULL
      AND th.distance_km > 0
      AND th.travel_time_hours > 0
  ),

  -- Step 2: Aggregate trips by POI pairs with enhanced metrics
  poi_route_aggregates AS (
    SELECT
      tpm.start_poi_id,
      tpm.end_poi_id,

      -- Get POI details for naming and classification
      start_poi.actual_name AS start_poi_name,
      start_poi.poi_type AS start_poi_type,
      start_poi.confidence_score AS start_confidence,
      start_poi.gps_accuracy_meters AS start_gps_accuracy,
      start_poi.avg_idle_time_hours AS start_idle_time,

      end_poi.actual_name AS end_poi_name,
      end_poi.poi_type AS end_poi_type,
      end_poi.confidence_score AS end_confidence,
      end_poi.gps_accuracy_meters AS end_gps_accuracy,
      end_poi.avg_idle_time_hours AS end_idle_time,

      -- Calculate straight-line distance for deviation analysis
      ST_Distance(
        start_poi.location_point::geography,
        end_poi.location_point::geography
      ) / 1000 AS straight_line_km,

      -- Standard route metrics
      COUNT(*) AS trip_count,
      AVG(tpm.distance_km) AS avg_distance_km,
      AVG(tpm.travel_time_hours) AS avg_travel_time_hours,
      MIN(tpm.distance_km) AS min_distance_km,
      MAX(tpm.distance_km) AS max_distance_km,
      MIN(tpm.travel_time_hours) AS min_travel_time_hours,
      MAX(tpm.travel_time_hours) AS max_travel_time_hours,
      STDDEV(tpm.travel_time_hours) AS time_variability,

      -- GPS quality metrics
      AVG(start_poi.gps_accuracy_meters) AS avg_start_gps_accuracy,
      AVG(end_poi.gps_accuracy_meters) AS avg_end_gps_accuracy,

      -- Driver and vehicle info
      MODE() WITHIN GROUP (ORDER BY tpm.vehicle_registration) AS most_common_vehicle,
      MODE() WITHIN GROUP (ORDER BY tpm.driver_name) AS most_common_driver,

      -- Timing patterns
      MIN(tpm.trip_start_time) AS first_trip_date,
      MAX(tpm.trip_start_time) AS last_trip_date

    FROM trip_poi_matches tpm
    JOIN discovered_poi start_poi ON start_poi.id = tpm.start_poi_id
    JOIN discovered_poi end_poi ON end_poi.id = tpm.end_poi_id

    WHERE tpm.start_poi_id IS NOT NULL
      AND tpm.end_poi_id IS NOT NULL
      AND tpm.start_poi_id != tpm.end_poi_id  -- Exclude same-location trips

    GROUP BY
      tpm.start_poi_id,
      tpm.end_poi_id,
      start_poi.actual_name,
      start_poi.poi_type,
      start_poi.confidence_score,
      start_poi.gps_accuracy_meters,
      start_poi.avg_idle_time_hours,
      start_poi.location_point,
      end_poi.actual_name,
      end_poi.poi_type,
      end_poi.confidence_score,
      end_poi.gps_accuracy_meters,
      end_poi.avg_idle_time_hours,
      end_poi.location_point

    HAVING COUNT(*) >= 10  -- Higher threshold for POI-based routes
  )

  -- Step 3: Insert consolidated route patterns with classification
  INSERT INTO route_patterns (
    route_hash,
    start_location,
    end_location,
    start_poi_id,
    end_poi_id,
    route_type,
    data_quality_tier,
    trip_count,
    average_distance_km,
    average_travel_time_hours,
    best_time_hours,
    worst_time_hours,
    time_variability,
    efficiency_rating,
    most_common_vehicle,
    most_common_driver,
    first_trip_date,
    last_trip_date,
    straight_line_distance_km,
    route_deviation_ratio,
    avg_gps_accuracy_meters,
    avg_loading_time_hours,
    avg_delivery_time_hours,
    start_poi_confidence,
    end_poi_confidence
  )
  SELECT
    -- Use POI IDs for hash instead of strings
    MD5(pra.start_poi_id::text || '|' || pra.end_poi_id::text) AS route_hash,

    -- Use POI names instead of raw location strings
    COALESCE(pra.start_poi_name, 'Unknown Start') AS start_location,
    COALESCE(pra.end_poi_name, 'Unknown End') AS end_location,

    pra.start_poi_id,
    pra.end_poi_id,

    -- Classify route type based on POI types
    CASE
      WHEN pra.start_poi_type = 'terminal' AND pra.end_poi_type = 'customer' THEN 'delivery'
      WHEN pra.start_poi_type = 'customer' AND pra.end_poi_type = 'terminal' THEN 'return'
      WHEN pra.start_poi_type = 'terminal' AND pra.end_poi_type = 'terminal' THEN 'transfer'
      WHEN pra.start_poi_type = 'depot' THEN 'positioning'
      WHEN pra.start_poi_type = 'customer' AND pra.end_poi_type = 'customer' THEN 'customer_to_customer'
      ELSE 'unknown'
    END AS route_type,

    -- Calculate data quality tier
    CASE
      WHEN pra.start_confidence >= 90
        AND pra.end_confidence >= 90
        AND pra.avg_start_gps_accuracy < 30
        AND pra.avg_end_gps_accuracy < 30
        AND pra.trip_count >= 50 THEN 'platinum'
      WHEN pra.start_confidence >= 80
        AND pra.end_confidence >= 80
        AND pra.avg_start_gps_accuracy < 50
        AND pra.avg_end_gps_accuracy < 50
        AND pra.trip_count >= 20 THEN 'gold'
      WHEN pra.start_confidence >= 70
        AND pra.end_confidence >= 70
        AND pra.avg_start_gps_accuracy < 100
        AND pra.avg_end_gps_accuracy < 100
        AND pra.trip_count >= 10 THEN 'silver'
      ELSE 'bronze'
    END AS data_quality_tier,

    pra.trip_count,
    pra.avg_distance_km,
    pra.avg_travel_time_hours,
    pra.min_travel_time_hours AS best_time_hours,
    pra.max_travel_time_hours AS worst_time_hours,
    pra.time_variability,

    -- Calculate efficiency rating
    CASE
      WHEN pra.time_variability / NULLIF(pra.avg_travel_time_hours, 0) < 0.15 THEN 95.0
      WHEN pra.time_variability / NULLIF(pra.avg_travel_time_hours, 0) < 0.25 THEN 85.0
      WHEN pra.time_variability / NULLIF(pra.avg_travel_time_hours, 0) < 0.35 THEN 75.0
      ELSE 65.0
    END AS efficiency_rating,

    pra.most_common_vehicle,
    pra.most_common_driver,
    pra.first_trip_date,
    pra.last_trip_date,
    pra.straight_line_km AS straight_line_distance_km,

    -- Calculate route deviation ratio (actual / straight-line * 100)
    CASE
      WHEN pra.straight_line_km > 0
      THEN (pra.avg_distance_km / pra.straight_line_km * 100)
      ELSE NULL
    END AS route_deviation_ratio,

    (pra.avg_start_gps_accuracy + pra.avg_end_gps_accuracy) / 2 AS avg_gps_accuracy_meters,
    pra.start_idle_time AS avg_loading_time_hours,
    pra.end_idle_time AS avg_delivery_time_hours,
    pra.start_confidence::INTEGER AS start_poi_confidence,
    pra.end_confidence::INTEGER AS end_poi_confidence

  FROM poi_route_aggregates pra;

  GET DIAGNOSTICS v_routes_created = ROW_COUNT;

  -- Step 4: Mark routes that have return routes
  RAISE NOTICE 'Identifying return routes...';

  UPDATE route_patterns rp1
  SET has_return_route = TRUE
  WHERE EXISTS (
    SELECT 1
    FROM route_patterns rp2
    WHERE rp2.start_poi_id = rp1.end_poi_id
      AND rp2.end_poi_id = rp1.start_poi_id
  );

  v_routes_consolidated := v_old_pattern_count - v_routes_created;

  -- Return summary
  RETURN QUERY SELECT
    v_routes_created,
    0 AS routes_updated,
    v_routes_consolidated,
    'Generated ' || v_routes_created || ' POI-based routes from ' || v_old_pattern_count ||
    ' string-based patterns. Consolidated ' || v_routes_consolidated || ' duplicate routes.' AS message;

  RAISE NOTICE 'Route pattern generation complete!';
  RAISE NOTICE '  Old patterns (string-based): %', v_old_pattern_count;
  RAISE NOTICE '  New patterns (POI-based): %', v_routes_created;
  RAISE NOTICE '  Consolidation: % routes merged', v_routes_consolidated;

END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_route_patterns_v2() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION update_route_patterns_v2 IS
'Enhanced route pattern generation using POI spatial intelligence.
Replaces string-based route matching with GPS clustering via discovered_poi.
Automatically classifies routes (delivery/return/transfer) and assigns quality tiers.
Consolidates duplicate routes and adds optimization metrics.';

-- Example usage:
-- SELECT * FROM update_route_patterns_v2();
