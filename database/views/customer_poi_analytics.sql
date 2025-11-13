-- Customer POI Analytics View
-- Links discovered POIs to customers and provides trip/billing analytics

CREATE OR REPLACE VIEW customer_poi_analytics AS
SELECT
  -- Customer Information
  cl.id AS customer_id,
  cl.customer_name,
  cl.bp_customer_id,
  cl.is_bp_customer,
  cl.address AS customer_address,
  cl.suburb AS customer_suburb,
  cl.state AS customer_state,

  -- POI Information
  dp.id AS poi_id,
  dp.actual_name AS poi_name,
  dp.poi_type,
  dp.confidence_score AS poi_confidence,
  dp.trip_count AS poi_trip_count,
  dp.gps_accuracy_meters,

  -- POI Assignment Metadata
  dp.customer_assignment_method,
  dp.customer_assignment_confidence,
  dp.customer_assigned_at,

  -- Location Data
  ST_Y(dp.location_point::geometry) AS poi_latitude,
  ST_X(dp.location_point::geometry) AS poi_longitude,
  ST_Y(cl.gps_location::geometry) AS customer_latitude,
  ST_X(cl.gps_location::geometry) AS customer_longitude,

  -- Distance between POI and customer record
  ST_Distance(
    dp.location_point::geography,
    cl.gps_location::geography
  ) / 1000 AS poi_customer_distance_km,

  -- Trip Statistics (where POI is destination)
  (
    SELECT COUNT(*)
    FROM mtdata_trip_history th
    WHERE ST_DWithin(
      th.end_point::geography,
      dp.location_point::geography,
      dp.service_radius_km * 1000
    )
  ) AS delivery_trip_count,

  (
    SELECT AVG(th.distance_km)
    FROM mtdata_trip_history th
    WHERE ST_DWithin(
      th.end_point::geography,
      dp.location_point::geography,
      dp.service_radius_km * 1000
    )
  ) AS avg_delivery_distance_km,

  (
    SELECT AVG(th.travel_time_hours)
    FROM mtdata_trip_history th
    WHERE ST_DWithin(
      th.end_point::geography,
      dp.location_point::geography,
      dp.service_radius_km * 1000
    )
  ) AS avg_delivery_time_hours,

  (
    SELECT AVG(th.idling_time_hours)
    FROM mtdata_trip_history th
    WHERE ST_DWithin(
      th.end_point::geography,
      dp.location_point::geography,
      dp.service_radius_km * 1000
    )
  ) AS avg_unloading_time_hours,

  -- Billing Potential (trips that could be matched to billing records)
  (
    SELECT COUNT(*)
    FROM captive_payment_records cpr
    WHERE cpr.customer_name ILIKE '%' || cl.customer_name || '%'
      OR cl.customer_name ILIKE '%' || cpr.customer_name || '%'
  ) AS potential_billing_records,

  -- Route Pattern Links
  (
    SELECT COUNT(*)
    FROM route_patterns rp
    WHERE rp.end_poi_id = dp.id
      AND rp.route_type = 'delivery'
  ) AS delivery_route_count,

  (
    SELECT STRING_AGG(DISTINCT rp.start_location || ' → ' || rp.end_location, ', ')
    FROM route_patterns rp
    WHERE rp.end_poi_id = dp.id
      AND rp.route_type = 'delivery'
    LIMIT 5
  ) AS common_delivery_routes,

  -- Terminal Associations
  (
    SELECT t.terminal_name
    FROM terminal_locations t
    WHERE t.id = dp.matched_terminal_id
  ) AS associated_terminal

FROM discovered_poi dp
LEFT JOIN customer_locations cl ON cl.id = dp.matched_customer_id

WHERE dp.poi_type = 'customer'  -- Only customer POIs

ORDER BY
  dp.matched_customer_id IS NOT NULL DESC,  -- Assigned customers first
  dp.trip_count DESC;  -- Then by trip frequency

-- Grant permissions
GRANT SELECT ON customer_poi_analytics TO authenticated;

-- Add helpful comment
COMMENT ON VIEW customer_poi_analytics IS
'Comprehensive analytics view linking discovered POIs to billing customers.
Provides trip statistics, billing potential, and route pattern information.
Use this view to understand operational activity at customer locations and
correlate trip data with billing records.';

-- Example queries:

-- 1. Get all customers with assigned POIs
-- SELECT * FROM customer_poi_analytics WHERE customer_id IS NOT NULL;

-- 2. Find high-activity customers without POI assignments
-- SELECT * FROM customer_poi_analytics
-- WHERE customer_id IS NULL AND poi_trip_count > 20
-- ORDER BY poi_trip_count DESC;

-- 3. Analyze delivery patterns for specific customer
-- SELECT * FROM customer_poi_analytics
-- WHERE customer_name ILIKE '%BHP%'
-- ORDER BY delivery_trip_count DESC;

-- 4. Find POI-customer matches that may need review (high distance)
-- SELECT * FROM customer_poi_analytics
-- WHERE customer_id IS NOT NULL
--   AND poi_customer_distance_km > 1.0
-- ORDER BY poi_customer_distance_km DESC;

-- 5. Get billing reconciliation candidates
-- SELECT
--   customer_name,
--   poi_name,
--   delivery_trip_count,
--   potential_billing_records,
--   common_delivery_routes
-- FROM customer_poi_analytics
-- WHERE customer_id IS NOT NULL
--   AND potential_billing_records > 0
-- ORDER BY delivery_trip_count DESC;
