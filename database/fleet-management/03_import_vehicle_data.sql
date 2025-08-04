-- ============================================================================
-- IMPORT VEHICLE DATA FROM CSV
-- ============================================================================

-- First, let's create a temporary table to stage the CSV data
CREATE TEMP TABLE vehicle_import_staging (
  registration TEXT,
  fleet TEXT,
  depot TEXT
);

-- Import the CSV data (this will be done via a script)
-- For now, we'll insert the data directly

-- Clean up any duplicate registrations first (some have spaces)
-- We'll normalize by removing spaces from registrations

-- Insert all vehicles from the CSV
INSERT INTO vehicles (registration, fleet, depot, status)
VALUES
  -- Stevemacs vehicles
  ('1BMU188', 'Stevemacs', 'Kewdale', 'Available'),
  ('1CAY022', 'Stevemacs', 'Kewdale', 'Available'),
  ('1CCL525', 'Stevemacs', 'Kewdale', 'Available'),
  ('1CKR091', 'Stevemacs', 'Kewdale', 'Available'),
  ('1CKR093', 'Stevemacs', 'Kewdale', 'Available'),
  ('1CKR094', 'Stevemacs', 'Kewdale', 'Available'),
  ('1CLR315', 'Stevemacs', 'Kewdale', 'Available'),
  ('1CTU865', 'Stevemacs', 'Kewdale', 'Available'),
  ('1CTV349', 'Stevemacs', 'Kewdale', 'Available'),
  ('1CVU378', 'Stevemacs', 'Kewdale', 'Available'),
  ('1CWB354', 'Stevemacs', 'Kewdale', 'Available'),
  ('1DFI259', 'Stevemacs', 'Kewdale', 'Available'),
  ('1DVN300', 'Stevemacs', 'Kewdale', 'Available'),
  ('1ECH116', 'Stevemacs', 'Kewdale', 'Available'),
  ('1EEF849', 'Stevemacs', 'Kewdale', 'Available'),
  ('1EGV055', 'Stevemacs', 'Kewdale', 'Available'),
  ('1EIG970', 'Stevemacs', 'Kewdale', 'Available'),
  ('1EMF490', 'Stevemacs', 'Kewdale', 'Available'),
  ('1EMH430', 'Stevemacs', 'Kewdale', 'Available'),
  ('1ETF335', 'Stevemacs', 'Kewdale', 'Available'),
  ('1ETM780', 'Stevemacs', 'Kewdale', 'Available'),
  ('1FMR444', 'Stevemacs', 'Kewdale', 'Available'),
  ('1FUM930', 'Stevemacs', 'Kewdale', 'Available'),
  ('1FYJ488', 'Stevemacs', 'Kewdale', 'Available'),
  ('1GGN485', 'Stevemacs', 'Kewdale', 'Available'),
  ('1GMB930', 'Stevemacs', 'Kewdale', 'Available'),
  ('1GMC310', 'Stevemacs', 'Kewdale', 'Available'),
  ('1GSF140', 'Stevemacs', 'Kewdale', 'Available'),
  ('1GXN230', 'Stevemacs', 'Kewdale', 'Available'),
  ('1HED970', 'Stevemacs', 'Kewdale', 'Available'),
  ('1HEW810', 'Stevemacs', 'Kewdale', 'Available'),
  ('1HGG620', 'Stevemacs', 'Kewdale', 'Available'),
  ('1HGT160', 'Stevemacs', 'Kewdale', 'Available'),
  ('1HKR380', 'Stevemacs', 'Kewdale', 'Available'),
  ('1HVZ440', 'Stevemacs', 'Kewdale', 'Available'),
  ('1ICD250', 'Stevemacs', 'Kewdale', 'Available'),
  ('1ICK660', 'Stevemacs', 'Kewdale', 'Available'),
  ('1IFJ910', 'Stevemacs', 'Kewdale', 'Available'),
  ('1IFK780', 'Stevemacs', 'Kewdale', 'Available'),
  ('1IFW870', 'Stevemacs', 'Kewdale', 'Available'),
  ('1IGG260', 'Stevemacs', 'Kewdale', 'Available'),
  ('1IGN580', 'Stevemacs', 'Kewdale', 'Available'),
  ('1IHJ530', 'Stevemacs', 'Kewdale', 'Available'),
  ('1IIJ460', 'Stevemacs', 'Kewdale', 'Available'),
  ('1IJO250', 'Stevemacs', 'Kewdale', 'Available'),
  ('1ILI310', 'Stevemacs', 'Kewdale', 'Available'),
  ('1IMN840', 'Stevemacs', 'Kewdale', 'Available'),
  ('1INE810', 'Stevemacs', 'Kewdale', 'Available'),
  ('1IQL210', 'Stevemacs', 'Kewdale', 'Available'),
  ('1IRG670', 'Stevemacs', 'Kewdale', 'Available'),
  ('1IRM160', 'Stevemacs', 'Kewdale', 'Available'),
  ('1ISJ070', 'Stevemacs', 'Kewdale', 'Available'),
  ('1ITZ350', 'Stevemacs', 'Kewdale', 'Available'),
  ('1IYT260', 'Stevemacs', 'Kewdale', 'Available'),
  ('1IZT310', 'Stevemacs', 'Kewdale', 'Available'),
  ('1JAU240', 'Stevemacs', 'Kewdale', 'Available'),
  ('1JBD660', 'Stevemacs', 'Kewdale', 'Available'),
  ('1JBF990', 'Stevemacs', 'Kewdale', 'Available'),
  ('1JBI430', 'Stevemacs', 'Kewdale', 'Available'),
  ('1JEU310', 'Stevemacs', 'Kewdale', 'Available'),
  ('1JFB700', 'Stevemacs', 'Kewdale', 'Available'),
  ('1JMZ680', 'Stevemacs', 'Kewdale', 'Available'),
  ('1JNO920', 'Stevemacs', 'Kewdale', 'Available'),
  ('1JQA170', 'Stevemacs', 'Kewdale', 'Available'),
  ('1JSS640', 'Stevemacs', 'Kewdale', 'Available'),
  ('1JTC530', 'Stevemacs', 'Kewdale', 'Available'),
  ('1JYQ860', 'Stevemacs', 'Kewdale', 'Available'),
  ('1KAM740', 'Stevemacs', 'Kewdale', 'Available'),
  ('D5038AB', 'Stevemacs', 'Kewdale', 'Available'),
  
  -- Great Southern Fuels vehicles
  ('1CKC133', 'Great Southern Fuels', 'Kellerberrin', 'Available'),
  ('1CKR092', 'Great Southern Fuels', 'Kalgoorlie', 'Available'),
  ('1CLS334', 'Great Southern Fuels', 'Quairading', 'Available'),
  ('1CMC714', 'Great Southern Fuels', 'Katanning', 'Available'),
  ('1CVU039', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1CWZ133', 'Great Southern Fuels', 'Wongan Hills', 'Available'),
  ('1CYD754', 'Great Southern Fuels', 'Narrogin', 'Available'),
  ('1CYP064', 'Great Southern Fuels', 'Merredin', 'Available'),
  ('1CZD562', 'Great Southern Fuels', 'Merredin', 'Available'),
  ('1DAV322', 'Great Southern Fuels', 'Narrogin', 'Available'),
  ('1DBC759', 'Great Southern Fuels', 'Narrogin', 'Available'),
  ('1DBC760', 'Great Southern Fuels', 'Quairading', 'Available'),
  ('1DBV178', 'Great Southern Fuels', 'Narrogin', 'Available'),
  ('1DCG936', 'Great Southern Fuels', 'Koorda', 'Available'),
  ('1DFO817', 'Great Southern Fuels', 'Geraldton', 'Available'),
  ('1DIU556', 'Great Southern Fuels', 'Albany', 'Available'),
  ('1DIU566', 'Great Southern Fuels', 'Albany', 'Available'),
  ('1DJL008', 'Great Southern Fuels', 'Albany', 'Available'),
  ('1DUK447', 'Great Southern Fuels', 'Albany', 'Available'),
  ('1ECE505', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1ECE506', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1ECE507', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1ECE508', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1ECE509', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1ECE510', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1EHW741', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1EIN800', 'Great Southern Fuels', 'Merredin', 'Available'),
  ('1EJU050', 'Great Southern Fuels', 'Narrogin', 'Available'),
  ('1EMI620', 'Great Southern Fuels', 'Geraldton', 'Available'),
  ('1EQB180', 'Great Southern Fuels', 'Geraldton', 'Available'),
  ('1EQF670', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1EQP780', 'Great Southern Fuels', 'Geraldton', 'Available'),
  ('1ESW670', 'Great Southern Fuels', 'Geraldton', 'Available'),
  ('1ETP130', 'Great Southern Fuels', 'Geraldton', 'Available'),
  ('1FHT170', 'Great Southern Fuels', 'Katanning', 'Available'),
  ('1FNW940', 'Great Southern Fuels', 'Geraldton', 'Available'),
  ('1FUC220', 'Great Southern Fuels', 'Albany', 'Available'),
  ('1FWB150', 'Great Southern Fuels', 'Geraldton', 'Available'),
  ('1FWU380', 'Great Southern Fuels', 'Kellerberrin', 'Available'),
  ('1GAL810', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1GBS120', 'Great Southern Fuels', 'Kalgoorlie', 'Available'),
  ('1GCC810', 'Great Southern Fuels', 'Corrigin', 'Available'),
  ('1GEN890', 'Great Southern Fuels', 'Geraldton', 'Available'),
  ('1GEQ810', 'Great Southern Fuels', 'Dongara', 'Available'),
  ('1GHV570', 'Great Southern Fuels', 'Narrogin', 'Available'),
  ('1GLD510', 'Great Southern Fuels', 'Geraldton', 'Available'),
  ('1GMB290', 'Great Southern Fuels', 'Broomehill', 'Available'),
  ('1GSF147', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1GSF227', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1GSF248', 'Great Southern Fuels', 'Kalgoorlie', 'Available'),
  ('1GSF251', 'Great Southern Fuels', 'Albany', 'Available'),
  ('1GSF405', 'Great Southern Fuels', 'Katanning', 'Available'),
  ('1GSF665', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1GSF666', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1GSF975', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1HDD610', 'Great Southern Fuels', 'Albany', 'Available'),
  ('1HED960', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1HEW570', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1HGT170', 'Great Southern Fuels', 'Katanning', 'Available'),
  ('1HKR390', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1HOL200', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1HOV070', 'Great Southern Fuels', 'Albany', 'Available'),
  ('1HSA200', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1HSI010', 'Great Southern Fuels', 'Geraldton', 'Available'),
  ('1HUT976', 'Great Southern Fuels', 'Geraldton', 'Available'),
  ('1HVX890', 'Great Southern Fuels', 'Geraldton', 'Available'),
  ('1HWK350', 'Great Southern Fuels', 'Wongan Hills', 'Available'),
  ('1HXL240', 'Great Southern Fuels', 'Northam', 'Available'),
  ('1ILQ540', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1JAF540', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1JBU260', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1JFE690', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1JGH940', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1JVB870', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1KAC580', 'Great Southern Fuels', 'Kewdale', 'Available'),
  ('1NME810', 'Great Southern Fuels', 'Narrogin', 'Available')
ON CONFLICT (registration) DO NOTHING;

-- Update some vehicles to have realistic status and assignments
UPDATE vehicles SET status = 'Active' WHERE registration IN ('1BMU188', '1GLD510', '1ILI310', '1GSF248', '1HUT976');
UPDATE vehicles SET status = 'Maintenance' WHERE registration IN ('1GSF248', '1CKR093');

-- Add some sample driver assignments for active vehicles
INSERT INTO driver_assignments (vehicle_id, driver_name)
SELECT id, 'Brad Cameron' FROM vehicles WHERE registration = '1BMU188'
UNION ALL
SELECT id, 'Andrew Buchanan' FROM vehicles WHERE registration = '1GLD510'
UNION ALL
SELECT id, 'Matthew Ahearn' FROM vehicles WHERE registration = '1HUT976';

-- Set some Guardian and Lytx device associations
UPDATE vehicles SET 
  guardian_unit = CASE 
    WHEN registration = '1BMU188' THEN 'P1002260-S00002698'
    WHEN registration = '1GLD510' THEN 'P04025-S00013423'
    WHEN registration = '1GSF248' THEN 'P1002260-S00010668'
    WHEN registration = '1ILI310' THEN 'P1002260-S00010798'
    ELSE NULL
  END,
  lytx_device = CASE
    WHEN registration = '1BMU188' THEN 'QM40999887'
    WHEN registration = '1GLD510' THEN 'MV00252104'
    WHEN registration = '1GSF248' THEN 'QM40025388'
    WHEN registration = '1ILI310' THEN 'QM40999887'
    ELSE NULL
  END
WHERE registration IN ('1BMU188', '1GLD510', '1GSF248', '1ILI310');

-- Add some initial compliance dates for a few vehicles
INSERT INTO asset_compliance (vehicle_id, compliance_type, due_date, status)
SELECT id, 'registration', '2025-12-15'::DATE, 'Pending' FROM vehicles WHERE registration = '1BMU188'
UNION ALL
SELECT id, 'insurance', '2025-11-20'::DATE, 'Pending' FROM vehicles WHERE registration = '1BMU188'
UNION ALL
SELECT id, 'inspection', '2025-09-30'::DATE, 'Due Soon' FROM vehicles WHERE registration = '1BMU188'
UNION ALL
SELECT id, 'registration', '2026-03-10'::DATE, 'Pending' FROM vehicles WHERE registration = '1GLD510'
UNION ALL
SELECT id, 'insurance', '2025-10-15'::DATE, 'Due Soon' FROM vehicles WHERE registration = '1GLD510'
UNION ALL
SELECT id, 'inspection', '2025-08-25'::DATE, 'Due Soon' FROM vehicles WHERE registration = '1GLD510';

-- Count imported vehicles
SELECT 
  COUNT(*) as total_vehicles,
  COUNT(CASE WHEN fleet = 'Stevemacs' THEN 1 END) as stevemacs_count,
  COUNT(CASE WHEN fleet = 'Great Southern Fuels' THEN 1 END) as gsf_count
FROM vehicles;

SELECT 'Vehicle data imported successfully' as result;