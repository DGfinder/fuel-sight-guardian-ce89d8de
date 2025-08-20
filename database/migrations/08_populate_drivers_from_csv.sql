-- ============================================================================
-- POPULATE DRIVERS FROM CSV DATA
-- Import driver data from the CSV file into the drivers and driver_name_mappings tables
-- ============================================================================

-- First, let's create a temporary table to hold the CSV data
CREATE TEMP TABLE temp_driver_import (
  fleet TEXT,
  standard_driver_name TEXT,
  driver_hours_driver_name TEXT,
  myob_driver_name TEXT,
  myob_driver_name_2 TEXT,
  mtdata_name TEXT,
  fuel_usage_smartfuel_name TEXT,
  lytx_driver_name TEXT,
  depot TEXT
);

-- Insert the CSV data (this will be populated by the application)
-- For now, we'll insert a few sample records to test the structure

-- Insert sample drivers for testing
INSERT INTO drivers (first_name, last_name, fleet, depot, status, employee_id) VALUES
('Adrian', 'Field', 'Great Southern Fuels', 'Geraldton', 'Active', 'ADRIAN001'),
('Alan', 'Hicks', 'Great Southern Fuels', 'Narrogin', 'Active', 'ALAN001'),
('Alan', 'King', 'Great Southern Fuels', 'Kewdale', 'Active', 'ALAN002'),
('Alex', 'Cuckovic', 'Great Southern Fuels', 'GSFS Kewdale', 'Active', 'ALEX001'),
('Andrew', 'Buchanan', 'Great Southern Fuels', 'Geraldton', 'Active', 'ANDREW001'),
('Brad', 'Cameron', 'Stevemacs', 'Kewdale', 'Active', 'BRAD001'),
('Cameron', 'Gillespie', 'Stevemacs', 'Kewdale', 'Active', 'CAMERON001'),
('Christopher', 'Doyle', 'Stevemacs', 'Kewdale', 'Active', 'CHRIS001'),
('Craig', 'Bean', 'Stevemacs', 'Kewdale', 'Active', 'CRAIG001'),
('Daljit', 'Khehra', 'Stevemacs', 'Kewdale', 'Active', 'DALJIT001');

-- Now insert the corresponding name mappings
INSERT INTO driver_name_mappings (driver_id, system_name, mapped_name, is_primary, confidence_score)
SELECT 
  d.id,
  'Standard',
  d.first_name || ' ' || d.last_name,
  true,
  1.0
FROM drivers d
WHERE d.employee_id IN ('ADRIAN001', 'ALAN001', 'ALAN002', 'ALEX001', 'ANDREW001', 'BRAD001', 'CAMERON001', 'CHRIS001', 'CRAIG001', 'DALJIT001');

-- Insert MtData name mappings
INSERT INTO driver_name_mappings (driver_id, system_name, mapped_name, is_primary, confidence_score)
SELECT 
  d.id,
  'MtData',
  CASE 
    WHEN d.employee_id = 'ADRIAN001' THEN 'Adrian Field'
    WHEN d.employee_id = 'ALAN001' THEN 'Alan Hicks'
    WHEN d.employee_id = 'ALAN002' THEN 'Alan King'
    WHEN d.employee_id = 'ALEX001' THEN 'Alex Cuckovic'
    WHEN d.employee_id = 'ANDREW001' THEN 'Andrew Buchanan'
    WHEN d.employee_id = 'BRAD001' THEN 'Brad Cameron'
    WHEN d.employee_id = 'CAMERON001' THEN 'Cameron Gillespie-Sasse'
    WHEN d.employee_id = 'CHRIS001' THEN 'Chris Doyle'
    WHEN d.employee_id = 'CRAIG001' THEN 'Craig Bean'
    WHEN d.employee_id = 'DALJIT001' THEN 'Daljit Khehra'
  END,
  false,
  0.9
FROM drivers d
WHERE d.employee_id IN ('ADRIAN001', 'ALAN001', 'ALAN002', 'ALEX001', 'ANDREW001', 'BRAD001', 'CAMERON001', 'CHRIS001', 'CRAIG001', 'DALJIT001');

-- Insert LYTX name mappings
INSERT INTO driver_name_mappings (driver_id, system_name, mapped_name, is_primary, confidence_score)
SELECT 
  d.id,
  'LYTX',
  CASE 
    WHEN d.employee_id = 'ADRIAN001' THEN 'Adrian Field'
    WHEN d.employee_id = 'ALAN001' THEN 'Alan Hicks'
    WHEN d.employee_id = 'ALAN002' THEN 'Allan King'
    WHEN d.employee_id = 'ALEX001' THEN 'Alex Cuckovic'
    WHEN d.employee_id = 'ANDREW001' THEN 'Andrew Buchanan'
    WHEN d.employee_id = 'BRAD001' THEN 'Brad Cameron'
    WHEN d.employee_id = 'CAMERON001' THEN 'Cameron Gillespie-Sasse'
    WHEN d.employee_id = 'CHRIS001' THEN 'Chris Doyle'
    WHEN d.employee_id = 'CRAIG001' THEN 'Craig Bean'
    WHEN d.employee_id = 'DALJIT001' THEN 'Daljit Khehra'
  END,
  false,
  0.9
FROM drivers d
WHERE d.employee_id IN ('ADRIAN001', 'ALAN001', 'ALAN002', 'ALEX001', 'ANDREW001', 'BRAD001', 'CAMERON001', 'CHRIS001', 'CRAIG001', 'DALJIT001');

-- Insert Guardian name mappings
INSERT INTO driver_name_mappings (driver_id, system_name, mapped_name, is_primary, confidence_score)
SELECT 
  d.id,
  'Guardian',
  CASE 
    WHEN d.employee_id = 'ADRIAN001' THEN 'Adrian Field'
    WHEN d.employee_id = 'ALAN001' THEN 'Alan Hicks'
    WHEN d.employee_id = 'ALAN002' THEN 'Allan King'
    WHEN d.employee_id = 'ALEX001' THEN 'Alex Cuckovic'
    WHEN d.employee_id = 'ANDREW001' THEN 'Andrew Buchanan'
    WHEN d.employee_id = 'BRAD001' THEN 'Brad Cameron'
    WHEN d.employee_id = 'CAMERON001' THEN 'Cameron Gillespie-Sasse'
    WHEN d.employee_id = 'CHRIS001' THEN 'Chris Doyle'
    WHEN d.employee_id = 'CRAIG001' THEN 'Craig Bean'
    WHEN d.employee_id = 'DALJIT001' THEN 'Daljit Khehra'
  END,
  false,
  0.9
FROM drivers d
WHERE d.employee_id IN ('ADRIAN001', 'ALAN001', 'ALAN002', 'ALEX001', 'ANDREW001', 'BRAD001', 'CAMERON001', 'CHRIS001', 'CRAIG001', 'DALJIT001');

-- Insert SmartFuel name mappings
INSERT INTO driver_name_mappings (driver_id, system_name, mapped_name, is_primary, confidence_score)
SELECT 
  d.id,
  'SmartFuel',
  CASE 
    WHEN d.employee_id = 'ADRIAN001' THEN 'Adrian Field'
    WHEN d.employee_id = 'ALAN001' THEN 'Alan Hicks'
    WHEN d.employee_id = 'ALAN002' THEN 'Allan King'
    WHEN d.employee_id = 'ALEX001' THEN 'Alex Cuckovic'
    WHEN d.employee_id = 'ANDREW001' THEN 'Andrew Buchanan'
    WHEN d.employee_id = 'BRAD001' THEN 'Brad Cameron'
    WHEN d.employee_id = 'CAMERON001' THEN 'Cameron Gillespie-Sasse'
    WHEN d.employee_id = 'CHRIS001' THEN 'Chris Doyle'
    WHEN d.employee_id = 'CRAIG001' THEN 'Craig Bean'
    WHEN d.employee_id = 'DALJIT001' THEN 'Daljit Khehra'
  END,
  false,
  0.9
FROM drivers d
WHERE d.employee_id IN ('ADRIAN001', 'ALAN001', 'ALAN002', 'ALEX001', 'ANDREW001', 'BRAD001', 'CAMERON001', 'CHRIS001', 'CRAIG001', 'DALJIT001');

-- Insert MYOB name mappings where available
INSERT INTO driver_name_mappings (driver_id, system_name, mapped_name, is_primary, confidence_score)
SELECT 
  d.id,
  'MYOB',
  CASE 
    WHEN d.employee_id = 'ALAN002' THEN 'King, Alan'
    WHEN d.employee_id = 'BRAD001' THEN 'Cameron, Bradley Charles'
    WHEN d.employee_id = 'CAMERON001' THEN 'Gillespie-Sasse, Cameron'
    WHEN d.employee_id = 'CHRIS001' THEN 'Doyle, Christopher'
    WHEN d.employee_id = 'CRAIG001' THEN 'Bean, Craig Maurice'
    WHEN d.employee_id = 'DALJIT001' THEN 'Khehra, Daljit Singh'
  END,
  false,
  0.8
FROM drivers d
WHERE d.employee_id IN ('ALAN002', 'BRAD001', 'CAMERON001', 'CHRIS001', 'CRAIG001', 'DALJIT001');

-- Insert Driver Hours name mappings
INSERT INTO driver_name_mappings (driver_id, system_name, mapped_name, is_primary, confidence_score)
SELECT 
  d.id,
  'Hours',
  d.first_name || ' ' || d.last_name,
  false,
  0.9
FROM drivers d
WHERE d.employee_id IN ('ADRIAN001', 'ALAN001', 'ALAN002', 'ALEX001', 'ANDREW001', 'BRAD001', 'CAMERON001', 'CHRIS001', 'CRAIG001', 'DALJIT001');

-- Create a function to import the full CSV data
CREATE OR REPLACE FUNCTION import_drivers_from_csv()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  csv_file_path TEXT := '/path/to/your/csv/file.csv'; -- This will be set by the application
  result TEXT;
BEGIN
  -- This function would be called by the application to import the full CSV
  -- For now, we'll just return a success message
  result := 'Sample drivers imported successfully. Use the application to import the full CSV.';
  
  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION import_drivers_from_csv() TO authenticated;

-- Verify the data was inserted
SELECT 
  'Drivers imported successfully' as result,
  COUNT(*) as total_drivers,
  COUNT(DISTINCT d.fleet) as total_fleets
FROM drivers d;

-- Show sample of imported data
SELECT 
  d.first_name,
  d.last_name,
  d.fleet,
  d.depot,
  d.employee_id,
  COUNT(dnm.id) as name_mappings_count
FROM drivers d
LEFT JOIN driver_name_mappings dnm ON d.id = dnm.driver_id
GROUP BY d.id, d.first_name, d.last_name, d.fleet, d.depot, d.employee_id
ORDER BY d.fleet, d.last_name
LIMIT 10;
