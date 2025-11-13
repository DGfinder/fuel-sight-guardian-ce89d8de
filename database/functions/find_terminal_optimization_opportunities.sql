-- Find Terminal Optimization Opportunities
-- Identifies routes that could save distance/cost by using alternative terminals

CREATE OR REPLACE FUNCTION find_terminal_optimization_opportunities()
RETURNS TABLE (
  route_id UUID,
  current_route TEXT,
  current_terminal_id UUID,
  current_terminal_name TEXT,
  suggested_terminal_id UUID,
  suggested_terminal_name TEXT,
  destination_poi_id UUID,
  destination_name TEXT,
  current_distance_km DECIMAL,
  suggested_distance_km DECIMAL,
  distance_saved_km DECIMAL,
  potential_trips_affected INTEGER,
  annual_km_savings DECIMAL,
  annual_cost_savings DECIMAL,
  priority TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH delivery_routes AS (
    -- Get all delivery routes (terminal → customer)
    SELECT
      rp.id AS route_id,
      rp.start_location || ' → ' || rp.end_location AS current_route,
      rp.start_poi_id,
      start_poi.matched_terminal_id AS current_terminal_id,
      start_poi.actual_name AS current_terminal_name,
      rp.end_poi_id,
      end_poi.actual_name AS destination_name,
      end_poi.centroid_latitude AS dest_lat,
      end_poi.centroid_longitude AS dest_lon,
      rp.trip_count,
      rp.average_distance_km AS current_avg_distance
    FROM route_patterns rp
    JOIN discovered_poi start_poi ON start_poi.id = rp.start_poi_id
    JOIN discovered_poi end_poi ON end_poi.id = rp.end_poi_id
    WHERE rp.route_type = 'delivery'
      AND start_poi.matched_terminal_id IS NOT NULL
      AND rp.trip_count >= 10
      AND rp.data_quality_tier IN ('platinum', 'gold', 'silver')
  ),
  alternative_terminals AS (
    -- Find alternative terminals for each delivery route
    SELECT
      dr.route_id,
      dr.current_route,
      dr.current_terminal_id,
      dr.current_terminal_name,
      dr.end_poi_id AS destination_poi_id,
      dr.destination_name,
      dr.current_avg_distance,
      dr.trip_count,

      t.id AS alt_terminal_id,
      t.terminal_name AS alt_terminal_name,

      -- Calculate distance from alternative terminal to destination
      ST_Distance(
        t.location_point::geography,
        ST_SetSRID(ST_MakePoint(dr.dest_lon, dr.dest_lat), 4326)::geography
      ) / 1000 AS alt_distance_km

    FROM delivery_routes dr
    CROSS JOIN terminal_locations t
    WHERE t.active = true
      AND t.id != dr.current_terminal_id

      -- Only consider terminals within reasonable range of destination
      AND ST_DWithin(
        t.location_point::geography,
        ST_SetSRID(ST_MakePoint(dr.dest_lon, dr.dest_lat), 4326)::geography,
        t.service_radius_km * 1000 * 2.5  -- Within 2.5x service radius
      )
  ),
  best_alternatives AS (
    -- For each route, find the best alternative terminal
    SELECT DISTINCT ON (at.route_id)
      at.route_id,
      at.current_route,
      at.current_terminal_id,
      at.current_terminal_name,
      at.alt_terminal_id,
      at.alt_terminal_name,
      at.destination_poi_id,
      at.destination_name,
      at.current_avg_distance,
      at.alt_distance_km,
      at.trip_count
    FROM alternative_terminals at
    WHERE at.alt_distance_km < at.current_avg_distance  -- Only show improvements
    ORDER BY at.route_id, (at.current_avg_distance - at.alt_distance_km) DESC
  )
  SELECT
    ba.route_id,
    ba.current_route,
    ba.current_terminal_id,
    ba.current_terminal_name,
    ba.alt_terminal_id AS suggested_terminal_id,
    ba.alt_terminal_name AS suggested_terminal_name,
    ba.destination_poi_id,
    ba.destination_name,
    ba.current_avg_distance AS current_distance_km,
    ba.alt_distance_km AS suggested_distance_km,
    (ba.current_avg_distance - ba.alt_distance_km) AS distance_saved_km,
    ba.trip_count AS potential_trips_affected,

    -- Calculate annual savings (assuming weekly trips)
    (ba.current_avg_distance - ba.alt_distance_km) * ba.trip_count * 52 AS annual_km_savings,

    -- Estimate cost savings ($1.50 per km for fuel + wear)
    (ba.current_avg_distance - ba.alt_distance_km) * ba.trip_count * 52 * 1.50 AS annual_cost_savings,

    -- Assign priority based on potential impact
    CASE
      WHEN (ba.current_avg_distance - ba.alt_distance_km) > 100 AND ba.trip_count > 20 THEN 'Critical'
      WHEN (ba.current_avg_distance - ba.alt_distance_km) > 50 AND ba.trip_count > 10 THEN 'High'
      WHEN (ba.current_avg_distance - ba.alt_distance_km) > 20 THEN 'Medium'
      ELSE 'Low'
    END AS priority

  FROM best_alternatives ba
  WHERE (ba.current_avg_distance - ba.alt_distance_km) > 10  -- At least 10km savings
  ORDER BY (ba.current_avg_distance - ba.alt_distance_km) * ba.trip_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION find_terminal_optimization_opportunities() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION find_terminal_optimization_opportunities IS
'Identifies delivery routes that could save distance by using alternative terminals.
Analyzes terminal locations and destination POIs to recommend better terminal choices.
Calculates potential annual savings in kilometers and cost.
Prioritizes opportunities by impact (distance saved × trip frequency).';

-- Example usage:
-- SELECT * FROM find_terminal_optimization_opportunities();
-- SELECT * FROM find_terminal_optimization_opportunities() WHERE priority IN ('Critical', 'High');
