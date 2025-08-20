-- ============================================================================
-- FIX CUSTOMER LOCATIONS TABLE FOR NULL COORDINATES
-- Updates existing table to allow customers without GPS coordinates
-- ============================================================================

BEGIN;

-- Check if table exists and has the NOT NULL constraints
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_locations') THEN
    RAISE NOTICE 'Customer locations table exists - updating to allow NULL coordinates';
    
    -- Remove NOT NULL constraints on latitude and longitude
    BEGIN
      ALTER TABLE customer_locations ALTER COLUMN latitude DROP NOT NULL;
      RAISE NOTICE 'Removed NOT NULL constraint from latitude';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Latitude constraint already allows NULL or error: %', SQLERRM;
    END;
    
    BEGIN
      ALTER TABLE customer_locations ALTER COLUMN longitude DROP NOT NULL;
      RAISE NOTICE 'Removed NOT NULL constraint from longitude';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Longitude constraint already allows NULL or error: %', SQLERRM;
    END;
    
    -- Update the location constraint to allow NULL coordinates
    BEGIN
      ALTER TABLE customer_locations DROP CONSTRAINT IF EXISTS valid_location;
      ALTER TABLE customer_locations ADD CONSTRAINT valid_location CHECK (
        (latitude IS NULL AND longitude IS NULL) OR 
        (latitude BETWEEN -45 AND -10 AND longitude BETWEEN 110 AND 155)
      );
      RAISE NOTICE 'Updated location constraint to allow NULL coordinates';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Error updating location constraint: %', SQLERRM;
    END;
    
    -- Update the geography function to handle NULL coordinates
    CREATE OR REPLACE FUNCTION update_customer_geography()
    RETURNS TRIGGER AS $func$
    BEGIN
      -- Create PostGIS point from coordinates (only if both lat/lng are not NULL)
      IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location_point = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
        
        -- Create circular service area polygon
        NEW.service_area = ST_Buffer(NEW.location_point, NEW.delivery_radius_km * 1000); -- Convert km to meters
      ELSE
        -- Set to NULL if coordinates are missing
        NEW.location_point = NULL;
        NEW.service_area = NULL;
      END IF;
      
      -- Note: BP customer identification is now handled separately via captive payments data
      -- Do not auto-detect based on name patterns as this can be incorrect
      -- Use the identify_bp_customers_from_captive_payments() function instead
      
      -- Normalize customer name for matching
      NEW.normalized_customer_name = UPPER(TRIM(REGEXP_REPLACE(NEW.customer_name, '[^A-Za-z0-9\s]', '', 'g')));
      
      -- Auto-classify customer type based on name patterns
      IF NEW.customer_type = 'other' THEN
        CASE 
          WHEN LOWER(NEW.customer_name) LIKE '%mine%' OR LOWER(NEW.customer_name) LIKE '%mining%' 
               OR LOWER(NEW.customer_name) LIKE '%gold%' OR LOWER(NEW.customer_name) LIKE '%iron%'
               OR LOWER(NEW.customer_name) LIKE '%nickel%' OR LOWER(NEW.customer_name) LIKE '%bhp%'
               OR LOWER(NEW.customer_name) LIKE '%south32%' OR LOWER(NEW.customer_name) LIKE '%kcgm%' THEN
            NEW.customer_type = 'mining_site';
          WHEN LOWER(NEW.customer_name) LIKE '%bp %' OR LOWER(NEW.customer_name) LIKE 'bp %'
               OR LOWER(NEW.customer_name) LIKE '%shell%' OR LOWER(NEW.customer_name) LIKE '%caltex%' THEN
            NEW.customer_type = 'fuel_station';
          WHEN LOWER(NEW.customer_name) LIKE '%transport%' OR LOWER(NEW.customer_name) LIKE '%logistics%'
               OR LOWER(NEW.customer_name) LIKE '%freight%' OR LOWER(NEW.customer_name) LIKE '%haulage%' THEN
            NEW.customer_type = 'transport_company';
          WHEN LOWER(NEW.customer_name) LIKE '%airport%' OR LOWER(NEW.customer_name) LIKE '%airpt%' THEN
            NEW.customer_type = 'airport';
          WHEN LOWER(NEW.customer_name) LIKE '%port%' OR LOWER(NEW.customer_name) LIKE '%qube%' THEN
            NEW.customer_type = 'port_facility';
          WHEN LOWER(NEW.customer_name) LIKE '%city of%' OR LOWER(NEW.customer_name) LIKE '%dept%'
               OR LOWER(NEW.customer_name) LIKE '%government%' OR LOWER(NEW.customer_name) LIKE '%council%' THEN
            NEW.customer_type = 'government_agency';
          WHEN LOWER(NEW.customer_name) LIKE '%power%' OR LOWER(NEW.customer_name) LIKE '%energy%'
               OR LOWER(NEW.customer_name) LIKE '%synergy%' OR LOWER(NEW.customer_name) LIKE '%western power%' THEN
            NEW.customer_type = 'utility_company';
          ELSE
            NEW.customer_type = 'industrial_facility';
        END CASE;
      END IF;
      
      -- Set regional classification based on coordinates (only if available)
      IF NEW.region IS NULL AND NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        CASE 
          WHEN NEW.latitude BETWEEN -32.5 AND -31.2 AND NEW.longitude BETWEEN 115.5 AND 116.5 THEN
            NEW.region = 'Perth Metro';
          WHEN NEW.latitude BETWEEN -31.5 AND -30.2 AND NEW.longitude BETWEEN 121.0 AND 122.0 THEN
            NEW.region = 'Goldfields';
          WHEN NEW.latitude BETWEEN -23.0 AND -20.0 AND NEW.longitude BETWEEN 116.0 AND 120.0 THEN
            NEW.region = 'Pilbara';
          WHEN NEW.latitude BETWEEN -29.5 AND -27.5 AND NEW.longitude BETWEEN 114.0 AND 115.5 THEN
            NEW.region = 'Mid West';
          WHEN NEW.latitude BETWEEN -35.5 AND -33.0 AND NEW.longitude BETWEEN 115.0 AND 118.0 THEN
            NEW.region = 'South West';
          ELSE
            NEW.region = 'Other';
        END CASE;
      ELSIF NEW.region IS NULL THEN
        NEW.region = 'Unknown'; -- Set default region for customers without coordinates
      END IF;
      
      NEW.updated_at = NOW();
      
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
    
    RAISE NOTICE 'Updated geography trigger function to handle NULL coordinates';
    
    RAISE NOTICE 'Customer locations table successfully updated to allow NULL coordinates';
    RAISE NOTICE 'You can now re-run the import script to import all customers';
    
  ELSE
    RAISE NOTICE 'Customer locations table does not exist - run create_customer_locations_system.sql first';
  END IF;
END $$;

COMMIT;

-- Display summary
SELECT 
  'Table fixed - ready for import' as status,
  COUNT(*) as current_customer_count
FROM customer_locations;