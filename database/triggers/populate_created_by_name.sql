-- Database trigger to automatically populate created_by_name field
-- This ensures consistency even if frontend doesn't populate the field

-- Function to populate created_by_name from profiles table
CREATE OR REPLACE FUNCTION populate_created_by_name()
RETURNS TRIGGER AS $$
BEGIN
  -- If created_by_name is not provided or empty, lookup from profiles
  IF NEW.created_by_name IS NULL OR NEW.created_by_name = '' THEN
    SELECT profiles.full_name 
    INTO NEW.created_by_name
    FROM profiles 
    WHERE profiles.id = NEW.recorded_by;
    
    -- If no full_name found, set to 'Unknown User'
    IF NEW.created_by_name IS NULL OR NEW.created_by_name = '' THEN
      NEW.created_by_name := 'Unknown User';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on dip_readings table
DROP TRIGGER IF EXISTS trigger_populate_created_by_name ON dip_readings;

CREATE TRIGGER trigger_populate_created_by_name
  BEFORE INSERT ON dip_readings
  FOR EACH ROW
  EXECUTE FUNCTION populate_created_by_name();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION populate_created_by_name() TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION populate_created_by_name() IS 'Automatically populates created_by_name field from profiles table when a dip reading is inserted';
COMMENT ON TRIGGER trigger_populate_created_by_name ON dip_readings IS 'Ensures dip readings always have a user name for display purposes';