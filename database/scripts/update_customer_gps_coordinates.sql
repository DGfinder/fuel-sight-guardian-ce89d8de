-- ============================================================================
-- UPDATE CUSTOMER GPS COORDINATES
-- Simple script to add GPS coordinates for customers as you find exact tank locations
-- ============================================================================

-- Function to update GPS coordinates for a customer
CREATE OR REPLACE FUNCTION update_customer_gps(
  customer_name_input TEXT,
  new_latitude DECIMAL(10, 8),
  new_longitude DECIMAL(11, 8),
  location_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  updated_customer TEXT
) AS $$
DECLARE
  customer_id UUID;
  old_lat DECIMAL(10, 8);
  old_lng DECIMAL(11, 8);
BEGIN
  -- Find the customer
  SELECT id, latitude, longitude 
  INTO customer_id, old_lat, old_lng
  FROM customer_locations 
  WHERE LOWER(customer_name) = LOWER(customer_name_input);
  
  IF customer_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Customer not found: ' || customer_name_input, customer_name_input;
    RETURN;
  END IF;
  
  -- Update coordinates
  UPDATE customer_locations 
  SET 
    latitude = new_latitude,
    longitude = new_longitude,
    notes = CASE 
      WHEN location_notes IS NOT NULL THEN 
        COALESCE(notes || ' | ', '') || 'GPS updated: ' || location_notes || ' (' || NOW()::DATE || ')'
      ELSE 
        COALESCE(notes || ' | ', '') || 'GPS coordinates updated (' || NOW()::DATE || ')'
    END,
    updated_at = NOW()
  WHERE id = customer_id;
  
  RETURN QUERY SELECT 
    TRUE, 
    'Updated GPS for ' || customer_name_input || 
    CASE 
      WHEN old_lat IS NOT NULL THEN ' (was: ' || old_lat || ', ' || old_lng || ')'
      ELSE ' (no previous coordinates)'
    END,
    customer_name_input;
END;
$$ LANGUAGE plpgsql;

-- Grant permission
GRANT EXECUTE ON FUNCTION update_customer_gps(TEXT, DECIMAL, DECIMAL, TEXT) TO authenticated;

-- ============================================================================
-- EXAMPLE USAGE
-- ============================================================================

-- To update a customer's GPS coordinates, use this format:
-- SELECT * FROM update_customer_gps('CUSTOMER NAME', latitude, longitude, 'Tank location notes');

-- Examples:
-- SELECT * FROM update_customer_gps('BP CARNARVON', -24.862947, 113.712818, 'Tank farm behind main station');
-- SELECT * FROM update_customer_gps('KCGM FIMISTON EX KEWDALE', -30.761841, 121.503301, 'Main fuel storage area');

-- ============================================================================
-- UTILITY QUERIES
-- ============================================================================

-- Show customers without GPS coordinates
COMMENT ON FUNCTION update_customer_gps(TEXT, DECIMAL, DECIMAL, TEXT) IS 'Update GPS coordinates for a customer by name';

-- Query to see customers without GPS that have captive payment matches
/*
SELECT 
  csv_customer_name,
  captive_matches,
  best_captive_match,
  confidence_score
FROM validate_customer_captive_matching()
WHERE has_gps = FALSE 
  AND captive_matches > 0
ORDER BY captive_matches DESC;
*/

-- Query to see all customers with their current GPS status
/*
SELECT 
  customer_name,
  CASE 
    WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 'Has GPS'
    ELSE 'Needs GPS'
  END as gps_status,
  is_bp_customer,
  latitude,
  longitude
FROM customer_locations
ORDER BY is_bp_customer DESC, customer_name;
*/