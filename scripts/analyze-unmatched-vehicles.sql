-- ============================================================================
-- ANALYZE UNMATCHED VEHICLES FROM MTDATA TRIP HISTORY
-- Identifies vehicles in trip data that are not present in the fleet database
-- ============================================================================

-- Summary of unmatched vehicles
SELECT 
  'Total unmatched trips' as metric,
  COUNT(*) as count
FROM mtdata_trip_history 
WHERE vehicle_id IS NULL

UNION ALL

SELECT 
  'Unique unmatched vehicles' as metric,
  COUNT(DISTINCT vehicle_registration) as count
FROM mtdata_trip_history 
WHERE vehicle_id IS NULL;

-- Detailed analysis of unmatched vehicles
SELECT 
  vehicle_registration,
  mtdata_vehicle_id,
  group_name,
  unit_serial_number,
  COUNT(*) as trip_count,
  MIN(start_time) as first_seen,
  MAX(start_time) as last_seen,
  ROUND(AVG(distance_km), 2) as avg_distance_km,
  ROUND(SUM(distance_km), 2) as total_distance_km,
  -- Find most common driver for this vehicle
  (
    SELECT driver_name 
    FROM mtdata_trip_history th2 
    WHERE th2.vehicle_registration = th.vehicle_registration 
      AND th2.vehicle_id IS NULL
      AND th2.driver_name IS NOT NULL
    GROUP BY driver_name 
    ORDER BY COUNT(*) DESC 
    LIMIT 1
  ) as most_common_driver,
  -- Count unique drivers for this vehicle
  (
    SELECT COUNT(DISTINCT driver_name)
    FROM mtdata_trip_history th3
    WHERE th3.vehicle_registration = th.vehicle_registration 
      AND th3.vehicle_id IS NULL
      AND th3.driver_name IS NOT NULL
  ) as unique_drivers
FROM mtdata_trip_history th
WHERE vehicle_id IS NULL
GROUP BY vehicle_registration, mtdata_vehicle_id, group_name, unit_serial_number
ORDER BY trip_count DESC;

-- Fleet assignment analysis
SELECT 
  group_name,
  COUNT(DISTINCT vehicle_registration) as unique_vehicles,
  COUNT(*) as total_trips,
  ROUND(AVG(distance_km), 2) as avg_trip_distance
FROM mtdata_trip_history 
WHERE vehicle_id IS NULL
GROUP BY group_name
ORDER BY unique_vehicles DESC;

-- Vehicle registration patterns analysis
SELECT 
  LENGTH(vehicle_registration) as reg_length,
  COUNT(DISTINCT vehicle_registration) as vehicle_count,
  STRING_AGG(DISTINCT vehicle_registration, ', ' ORDER BY vehicle_registration) as examples
FROM mtdata_trip_history 
WHERE vehicle_id IS NULL
GROUP BY LENGTH(vehicle_registration)
ORDER BY reg_length;

-- Unit serial number analysis (potential Guardian device correlation)
SELECT 
  CASE 
    WHEN unit_serial_number IS NULL THEN 'No Serial'
    WHEN unit_serial_number ~ '^[A-Z]{2}[0-9]+$' THEN 'Guardian Format'
    WHEN unit_serial_number ~ '^[0-9]+$' THEN 'Numeric Only'
    ELSE 'Other Format'
  END as serial_type,
  COUNT(DISTINCT vehicle_registration) as vehicle_count,
  COUNT(DISTINCT unit_serial_number) as unique_serials
FROM mtdata_trip_history 
WHERE vehicle_id IS NULL
GROUP BY 
  CASE 
    WHEN unit_serial_number IS NULL THEN 'No Serial'
    WHEN unit_serial_number ~ '^[A-Z]{2}[0-9]+$' THEN 'Guardian Format'
    WHEN unit_serial_number ~ '^[0-9]+$' THEN 'Numeric Only'
    ELSE 'Other Format'
  END
ORDER BY vehicle_count DESC;

-- Check for potential matches with existing vehicles
-- (registrations that might be formatting differences)
SELECT DISTINCT
  th.vehicle_registration as trip_registration,
  v.registration as db_registration,
  v.fleet,
  v.depot,
  -- Calculate similarity (simple approach)
  CASE 
    WHEN REPLACE(UPPER(th.vehicle_registration), ' ', '') = REPLACE(UPPER(v.registration), ' ', '') 
    THEN 'Exact Match (formatting diff)'
    WHEN UPPER(th.vehicle_registration) LIKE '%' || UPPER(v.registration) || '%' 
      OR UPPER(v.registration) LIKE '%' || UPPER(th.vehicle_registration) || '%'
    THEN 'Partial Match'
    ELSE 'No Match'
  END as match_type
FROM mtdata_trip_history th
CROSS JOIN vehicles v
WHERE th.vehicle_id IS NULL
  AND (
    REPLACE(UPPER(th.vehicle_registration), ' ', '') = REPLACE(UPPER(v.registration), ' ', '')
    OR UPPER(th.vehicle_registration) LIKE '%' || UPPER(v.registration) || '%'
    OR UPPER(v.registration) LIKE '%' || UPPER(th.vehicle_registration) || '%'
  )
ORDER BY trip_registration, match_type;

-- Time-based analysis to understand when these vehicles were active
SELECT 
  DATE_TRUNC('month', start_time) as month,
  COUNT(DISTINCT vehicle_registration) as active_vehicles,
  COUNT(*) as total_trips
FROM mtdata_trip_history 
WHERE vehicle_id IS NULL
GROUP BY DATE_TRUNC('month', start_time)
ORDER BY month;