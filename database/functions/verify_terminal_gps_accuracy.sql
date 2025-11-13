-- Function to verify terminal GPS accuracy by analyzing actual trip data
-- Compares recorded terminal GPS coordinates against the centroid of actual trip start/end points

CREATE OR REPLACE FUNCTION verify_terminal_gps_accuracy(
  p_terminal_id UUID DEFAULT NULL
)
RETURNS TABLE (
  terminal_id UUID,
  terminal_name TEXT,
  recorded_latitude DECIMAL(10, 8),
  recorded_longitude DECIMAL(11, 8),
  actual_centroid_lat DECIMAL(10, 8),
  actual_centroid_lon DECIMAL(11, 8),
  drift_meters DECIMAL(10, 2),
  trip_count INTEGER,
  start_point_count INTEGER,
  end_point_count INTEGER,
  confidence_score INTEGER,
  status TEXT,
  recommendations TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH terminal_trips AS (
    -- Find all trips that start near this terminal
    SELECT
      t.id AS terminal_id,
      t.terminal_name,
      t.latitude AS recorded_lat,
      t.longitude AS recorded_lon,
      t.location_point AS recorded_point,
      t.service_radius_km,
      mt.start_latitude,
      mt.start_longitude,
      mt.start_point,
      mt.end_latitude,
      mt.end_longitude,
      mt.end_point,
      'start' AS point_type
    FROM terminal_locations t
    LEFT JOIN mtdata_trip_history mt ON
      ST_DWithin(
        t.location_point::geography,
        mt.start_point::geography,
        t.service_radius_km * 1000  -- Convert km to meters
      )
    WHERE
      (p_terminal_id IS NULL OR t.id = p_terminal_id)
      AND mt.start_point IS NOT NULL

    UNION ALL

    -- Find all trips that end near this terminal
    SELECT
      t.id AS terminal_id,
      t.terminal_name,
      t.latitude AS recorded_lat,
      t.longitude AS recorded_lon,
      t.location_point AS recorded_point,
      t.service_radius_km,
      mt.start_latitude,
      mt.start_longitude,
      mt.start_point,
      mt.end_latitude,
      mt.end_longitude,
      mt.end_point,
      'end' AS point_type
    FROM terminal_locations t
    LEFT JOIN mtdata_trip_history mt ON
      ST_DWithin(
        t.location_point::geography,
        mt.end_point::geography,
        t.service_radius_km * 1000
      )
    WHERE
      (p_terminal_id IS NULL OR t.id = p_terminal_id)
      AND mt.end_point IS NOT NULL
  ),
  terminal_analysis AS (
    SELECT
      tt.terminal_id,
      tt.terminal_name,
      tt.recorded_lat,
      tt.recorded_lon,
      tt.recorded_point,
      -- Calculate centroid from actual trip points
      ST_Y(
        ST_Centroid(
          ST_Collect(
            CASE
              WHEN tt.point_type = 'start' THEN tt.start_point::geometry
              ELSE tt.end_point::geometry
            END
          )
        )::geography
      ) AS actual_centroid_lat,
      ST_X(
        ST_Centroid(
          ST_Collect(
            CASE
              WHEN tt.point_type = 'start' THEN tt.start_point::geometry
              ELSE tt.end_point::geometry
            END
          )
        )::geography
      ) AS actual_centroid_lon,
      COUNT(*) AS trip_count,
      COUNT(*) FILTER (WHERE tt.point_type = 'start') AS start_point_count,
      COUNT(*) FILTER (WHERE tt.point_type = 'end') AS end_point_count
    FROM terminal_trips tt
    GROUP BY
      tt.terminal_id,
      tt.terminal_name,
      tt.recorded_lat,
      tt.recorded_lon,
      tt.recorded_point
  )
  SELECT
    ta.terminal_id,
    ta.terminal_name,
    ta.recorded_lat AS recorded_latitude,
    ta.recorded_lon AS recorded_longitude,
    ta.actual_centroid_lat,
    ta.actual_centroid_lon,
    -- Calculate drift distance in meters
    ROUND(
      ST_Distance(
        ta.recorded_point::geography,
        ST_SetSRID(ST_MakePoint(ta.actual_centroid_lon, ta.actual_centroid_lat), 4326)::geography
      )::numeric,
      2
    ) AS drift_meters,
    ta.trip_count::INTEGER,
    ta.start_point_count::INTEGER,
    ta.end_point_count::INTEGER,
    -- Calculate confidence score (0-100)
    CASE
      WHEN ta.trip_count = 0 THEN 0
      WHEN ST_Distance(
        ta.recorded_point::geography,
        ST_SetSRID(ST_MakePoint(ta.actual_centroid_lon, ta.actual_centroid_lat), 4326)::geography
      ) < 50 THEN 95
      WHEN ST_Distance(
        ta.recorded_point::geography,
        ST_SetSRID(ST_MakePoint(ta.actual_centroid_lon, ta.actual_centroid_lat), 4326)::geography
      ) < 100 THEN 85
      WHEN ST_Distance(
        ta.recorded_point::geography,
        ST_SetSRID(ST_MakePoint(ta.actual_centroid_lon, ta.actual_centroid_lat), 4326)::geography
      ) < 500 THEN 70
      WHEN ST_Distance(
        ta.recorded_point::geography,
        ST_SetSRID(ST_MakePoint(ta.actual_centroid_lon, ta.actual_centroid_lat), 4326)::geography
      ) < 1000 THEN 50
      ELSE 25
    END AS confidence_score,
    -- Determine status
    CASE
      WHEN ta.trip_count = 0 THEN 'NO_DATA'
      WHEN ST_Distance(
        ta.recorded_point::geography,
        ST_SetSRID(ST_MakePoint(ta.actual_centroid_lon, ta.actual_centroid_lat), 4326)::geography
      ) < 50 THEN 'VERIFIED'
      WHEN ST_Distance(
        ta.recorded_point::geography,
        ST_SetSRID(ST_MakePoint(ta.actual_centroid_lon, ta.actual_centroid_lat), 4326)::geography
      ) < 100 THEN 'GOOD'
      WHEN ST_Distance(
        ta.recorded_point::geography,
        ST_SetSRID(ST_MakePoint(ta.actual_centroid_lon, ta.actual_centroid_lat), 4326)::geography
      ) < 500 THEN 'NEEDS_REVIEW'
      ELSE 'INACCURATE'
    END AS status,
    -- Provide recommendations
    CASE
      WHEN ta.trip_count = 0 THEN
        'No trip data found within service radius. GPS coordinates cannot be verified.'
      WHEN ST_Distance(
        ta.recorded_point::geography,
        ST_SetSRID(ST_MakePoint(ta.actual_centroid_lon, ta.actual_centroid_lat), 4326)::geography
      ) < 50 THEN
        'GPS coordinates are accurate. No action needed.'
      WHEN ST_Distance(
        ta.recorded_point::geography,
        ST_SetSRID(ST_MakePoint(ta.actual_centroid_lon, ta.actual_centroid_lat), 4326)::geography
      ) < 100 THEN
        'GPS coordinates are reasonably accurate but could be improved.'
      WHEN ST_Distance(
        ta.recorded_point::geography,
        ST_SetSRID(ST_MakePoint(ta.actual_centroid_lon, ta.actual_centroid_lat), 4326)::geography
      ) < 500 THEN
        'GPS coordinates need review. Consider updating to actual centroid.'
      ELSE
        'GPS coordinates are significantly inaccurate. Update recommended based on ' ||
        ta.trip_count || ' trip samples.'
    END AS recommendations
  FROM terminal_analysis ta
  ORDER BY
    CASE
      WHEN ta.trip_count = 0 THEN 999999
      ELSE ST_Distance(
        ta.recorded_point::geography,
        ST_SetSRID(ST_MakePoint(ta.actual_centroid_lon, ta.actual_centroid_lat), 4326)::geography
      )
    END DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION verify_terminal_gps_accuracy(UUID) TO authenticated;

-- Example usage:
-- SELECT * FROM verify_terminal_gps_accuracy(NULL); -- Verify all terminals
-- SELECT * FROM verify_terminal_gps_accuracy('terminal-uuid-here'); -- Verify specific terminal

COMMENT ON FUNCTION verify_terminal_gps_accuracy IS
'Analyzes trip data to verify terminal GPS accuracy. Compares recorded coordinates
against the centroid of actual trip start/end points. Returns drift distance,
confidence score, and recommendations for each terminal.';
