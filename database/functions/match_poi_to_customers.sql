-- Match POIs to Customers (Captive Payments)
-- Uses spatial proximity and fuzzy name matching to link discovered POIs to billing customers

CREATE OR REPLACE FUNCTION match_poi_to_customers(
  p_poi_id UUID DEFAULT NULL,                  -- Specific POI to match (NULL = all unmatched)
  p_max_distance_km DECIMAL DEFAULT 2.0,       -- Maximum distance for spatial matching
  p_min_name_similarity INTEGER DEFAULT 70,    -- Minimum similarity score (0-100) for name matching
  p_auto_assign BOOLEAN DEFAULT FALSE,         -- Auto-assign matches or just return suggestions
  p_assigned_by UUID DEFAULT NULL              -- User ID for manual assignments
)
RETURNS TABLE (
  poi_id UUID,
  poi_name TEXT,
  customer_id UUID,
  customer_name TEXT,
  customer_bp_id TEXT,
  match_method TEXT,
  confidence_score INTEGER,
  distance_km DECIMAL,
  name_similarity INTEGER,
  recommendation TEXT
) AS $$
BEGIN
  -- If auto-assign is true, perform the assignment
  IF p_auto_assign THEN
    RAISE NOTICE 'Auto-assigning POIs to customers...';

    -- Update POIs with best customer matches
    WITH customer_matches AS (
      SELECT
        dp.id AS poi_id,
        cl.id AS customer_id,

        -- Calculate spatial match score (closer = higher score)
        CASE
          WHEN ST_Distance(dp.location_point::geography, cl.gps_location::geography) / 1000 <= 0.5 THEN 100
          WHEN ST_Distance(dp.location_point::geography, cl.gps_location::geography) / 1000 <= 1.0 THEN 90
          WHEN ST_Distance(dp.location_point::geography, cl.gps_location::geography) / 1000 <= 2.0 THEN 75
          ELSE 50
        END AS spatial_score,

        -- Calculate name similarity score
        GREATEST(
          -- Direct similarity
          similarity(LOWER(dp.actual_name), LOWER(cl.customer_name)) * 100,
          -- Partial matches (e.g., "BHP Port Hedland" vs "BHP")
          similarity(LOWER(dp.actual_name), LOWER(SPLIT_PART(cl.customer_name, ' ', 1))) * 100
        )::INTEGER AS name_score,

        ST_Distance(dp.location_point::geography, cl.gps_location::geography) / 1000 AS distance_km

      FROM discovered_poi dp
      CROSS JOIN customer_locations cl

      WHERE dp.poi_type = 'customer'  -- Only match customer POIs
        AND (p_poi_id IS NULL OR dp.id = p_poi_id)  -- Specific POI or all
        AND dp.matched_customer_id IS NULL  -- Not already matched

        -- Must be within max distance OR have good name match
        AND (
          ST_DWithin(
            dp.location_point::geography,
            cl.gps_location::geography,
            p_max_distance_km * 1000
          )
          OR similarity(LOWER(dp.actual_name), LOWER(cl.customer_name)) * 100 >= p_min_name_similarity
        )
    ),

    best_matches AS (
      -- Select best match for each POI
      SELECT DISTINCT ON (cm.poi_id)
        cm.poi_id,
        cm.customer_id,

        -- Combined confidence score (weighted: 60% spatial, 40% name)
        ((cm.spatial_score * 0.6) + (cm.name_score * 0.4))::INTEGER AS combined_score,

        -- Determine match method
        CASE
          WHEN cm.spatial_score >= 90 AND cm.name_score >= 80 THEN 'auto_combined'
          WHEN cm.spatial_score >= 90 THEN 'auto_spatial'
          WHEN cm.name_score >= 80 THEN 'auto_name_match'
          ELSE 'auto_combined'
        END AS match_method,

        cm.distance_km

      FROM customer_matches cm
      WHERE (cm.spatial_score * 0.6) + (cm.name_score * 0.4) >= 60  -- Minimum combined score

      -- Prefer matches with both good spatial AND name scores
      ORDER BY cm.poi_id,
               (cm.spatial_score * 0.6) + (cm.name_score * 0.4) DESC,
               cm.distance_km ASC
    )

    UPDATE discovered_poi dp
    SET
      matched_customer_id = bm.customer_id,
      customer_assignment_method = bm.match_method,
      customer_assignment_confidence = bm.combined_score,
      customer_assigned_at = NOW(),
      customer_assigned_by = p_assigned_by
    FROM best_matches bm
    WHERE dp.id = bm.poi_id;

  END IF;

  -- Return match suggestions (whether or not auto-assign was used)
  RETURN QUERY
  WITH customer_matches AS (
    SELECT
      dp.id AS poi_id,
      dp.actual_name AS poi_name,
      cl.id AS customer_id,
      cl.customer_name,
      cl.bp_customer_id AS customer_bp_id,

      -- Calculate scores
      CASE
        WHEN ST_Distance(dp.location_point::geography, cl.gps_location::geography) / 1000 <= 0.5 THEN 100
        WHEN ST_Distance(dp.location_point::geography, cl.gps_location::geography) / 1000 <= 1.0 THEN 90
        WHEN ST_Distance(dp.location_point::geography, cl.gps_location::geography) / 1000 <= 2.0 THEN 75
        ELSE 50
      END AS spatial_score,

      GREATEST(
        similarity(LOWER(dp.actual_name), LOWER(cl.customer_name)) * 100,
        similarity(LOWER(dp.actual_name), LOWER(SPLIT_PART(cl.customer_name, ' ', 1))) * 100
      )::INTEGER AS name_score,

      ST_Distance(dp.location_point::geography, cl.gps_location::geography) / 1000 AS distance_km

    FROM discovered_poi dp
    CROSS JOIN customer_locations cl

    WHERE dp.poi_type = 'customer'
      AND (p_poi_id IS NULL OR dp.id = p_poi_id)
      AND (
        p_auto_assign = FALSE  -- Show all if not auto-assigning
        OR dp.matched_customer_id IS NULL  -- Show unmatched if auto-assigning
      )
      AND (
        ST_DWithin(
          dp.location_point::geography,
          cl.gps_location::geography,
          p_max_distance_km * 1000
        )
        OR similarity(LOWER(dp.actual_name), LOWER(cl.customer_name)) * 100 >= p_min_name_similarity
      )
  ),

  ranked_matches AS (
    SELECT
      cm.poi_id,
      cm.poi_name,
      cm.customer_id,
      cm.customer_name,
      cm.customer_bp_id,

      -- Combined score
      ((cm.spatial_score * 0.6) + (cm.name_score * 0.4))::INTEGER AS combined_score,

      -- Match method
      CASE
        WHEN cm.spatial_score >= 90 AND cm.name_score >= 80 THEN 'auto_combined'
        WHEN cm.spatial_score >= 90 THEN 'auto_spatial'
        WHEN cm.name_score >= 80 THEN 'auto_name_match'
        ELSE 'auto_combined'
      END AS match_method,

      cm.distance_km,
      cm.name_score,

      -- Recommendation
      CASE
        WHEN (cm.spatial_score * 0.6) + (cm.name_score * 0.4) >= 90 THEN 'High Confidence - Auto-assign recommended'
        WHEN (cm.spatial_score * 0.6) + (cm.name_score * 0.4) >= 75 THEN 'Good Match - Review recommended'
        WHEN (cm.spatial_score * 0.6) + (cm.name_score * 0.4) >= 60 THEN 'Possible Match - Manual verification needed'
        ELSE 'Low Confidence - Not recommended'
      END AS recommendation,

      -- Rank matches for each POI
      ROW_NUMBER() OVER (
        PARTITION BY cm.poi_id
        ORDER BY (cm.spatial_score * 0.6) + (cm.name_score * 0.4) DESC, cm.distance_km ASC
      ) AS match_rank

    FROM customer_matches cm
    WHERE (cm.spatial_score * 0.6) + (cm.name_score * 0.4) >= 50  -- Show all potential matches
  )

  SELECT
    rm.poi_id,
    rm.poi_name,
    rm.customer_id,
    rm.customer_name,
    rm.customer_bp_id,
    rm.match_method,
    rm.combined_score AS confidence_score,
    rm.distance_km,
    rm.name_score AS name_similarity,
    rm.recommendation
  FROM ranked_matches rm
  WHERE rm.match_rank <= 5  -- Show top 5 matches per POI
  ORDER BY rm.poi_id, rm.combined_score DESC, rm.distance_km ASC;

END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION match_poi_to_customers(UUID, DECIMAL, INTEGER, BOOLEAN, UUID) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION match_poi_to_customers IS
'Matches discovered POIs to billing customers using spatial proximity and fuzzy name matching.
Parameters:
- p_poi_id: Specific POI to match (NULL = all unmatched customer POIs)
- p_max_distance_km: Maximum distance for spatial matching (default 2km)
- p_min_name_similarity: Minimum name similarity score 0-100 (default 70)
- p_auto_assign: Auto-assign matches with high confidence (default FALSE)
- p_assigned_by: User ID for audit trail

Returns ranked match suggestions with confidence scores and recommendations.
Confidence scoring: 60% spatial proximity + 40% name similarity';

-- Example usage:

-- 1. Get match suggestions for all unmatched POIs (no auto-assign)
-- SELECT * FROM match_poi_to_customers();

-- 2. Get matches for specific POI with custom thresholds
-- SELECT * FROM match_poi_to_customers(
--   p_poi_id := '123e4567-e89b-12d3-a456-426614174000',
--   p_max_distance_km := 1.5,
--   p_min_name_similarity := 80
-- );

-- 3. Auto-assign all high-confidence matches
-- SELECT * FROM match_poi_to_customers(
--   p_auto_assign := TRUE,
--   p_assigned_by := auth.uid()
-- );

-- 4. Auto-assign specific POI
-- SELECT * FROM match_poi_to_customers(
--   p_poi_id := '123e4567-e89b-12d3-a456-426614174000',
--   p_auto_assign := TRUE,
--   p_assigned_by := auth.uid()
-- );
