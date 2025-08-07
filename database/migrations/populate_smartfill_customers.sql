-- Migration: Populate Production SmartFill Customers
-- This populates the smartfill_customers table with real production customer data
-- Run this after create_smartfill_system.sql
-- NOTE: Requires api_reference column to have UNIQUE constraint for ON CONFLICT to work

-- First, deactivate any existing test/sample customers
UPDATE smartfill_customers SET active = false WHERE name LIKE '%test%' OR name LIKE '%sample%' OR name LIKE '%demo%';

-- Insert production SmartFill customers with API credentials
-- Based on data provided: customer reference and API secret pairs
INSERT INTO smartfill_customers (api_reference, api_secret, name, active, created_at, updated_at) VALUES
('Stevemac103', '8193cf95cd4e4fa3', 'Stevemac103', true, NOW(), NOW()),
('Ashburto2756', '69eaeb635d20011a', 'Ashburto2756', true, NOW(), NOW()),
('SwanTowi299', 'f295f202965f566d', 'Swan Towing 299', true, NOW(), NOW()),
('GreatSou1877', '55f44b0ba9224526', 'Great Southern 1877', true, NOW(), NOW()),
('ShireofN4241', '48ef5ab59aad60fc', 'Shire of Northam 4241', true, NOW(), NOW()),
('greatsut4123', 'd89e4d89263e8dfa', 'Great Southern 4123', true, NOW(), NOW()),
('MIDWESTL4066', '8e7d71ab6de024ba', 'Midwest Logistics 4066', true, NOW(), NOW()),
('ALTONAfm4309', 'f3c5316db0610cdb', 'Altona Farms 4309', true, NOW(), NOW()),
('MIOCEVIC4072', 'e8acc3ab6f5f89d4', 'Miocevic 4072', true, NOW(), NOW()),
('Northern1385', 'b2a88ada876baa10', 'Northern 1385', true, NOW(), NOW()),
('NACAPGSF2975', '667df7c0c1a92762', 'NACAP GSF 2975', true, NOW(), NOW()),
('Richgrof3579', 'ef099f1bf2b7a09a', 'Rich Grove Farms 3579', true, NOW(), NOW()),
('MDHTrans3241', 'b104dfb72707e702', 'MDH Transport 3241', true, NOW(), NOW()),
('MaticGro1948', '38f97069bc643336', 'Matic Grove 1948', true, NOW(), NOW()),
('GreatSou2453', 'edd192ebf75af577', 'Great Southern 2453', true, NOW(), NOW()),
('Warakirr3250', 'f23035a06647b7f9', 'Warakirri 3250', true, NOW(), NOW()),
('TeeCeeTr3035', '69e328dfa647ca7e', 'Tee Cee Transport 3035', true, NOW(), NOW()),
('Fremantl2319', '876829026554c16f', 'Fremantle 2319', true, NOW(), NOW()),
('CityofSw2413', '2f82fa7e63b5ea68', 'City of Swan 2413', true, NOW(), NOW()),
('PennsCar3497', 'de44999ebd17a880', 'Penns Cartage 3497', true, NOW(), NOW()),
('PennyOpe2660', 'e14a9bfab9e4daa4', 'Penny Operations 2660', true, NOW(), NOW()),
('Campbell1683', 'fb2b9d373d6d785b', 'Campbell 1683', true, NOW(), NOW()),
('BrillyCo2325', '492cb8b4c17bead9', 'Brilly Co 2325', true, NOW(), NOW()),
('Apachefm4317', '169a077382d3920e', 'Apache Farms 4317', true, NOW(), NOW()),
('Merredin2182', '3d4b2fc78ceb574b', 'Merredin 2182', true, NOW(), NOW()),
('Mitchell637', '6627dafb095a6dfd', 'Mitchell 637', true, NOW(), NOW()),
('WesternA1933', 'e5f9dd6863ee9916', 'Western Australia 1933', true, NOW(), NOW()),
('OlympicC1675', '552c760b963b52b3', 'Olympic Cartage 1675', true, NOW(), NOW()),
('TSMConsu1564', '07167e180295ca89', 'TSM Consulting 1564', true, NOW(), NOW()),
('Merkanoo3508', '301776e63e6d1d7a', 'Merkanoo 3508', true, NOW(), NOW()),
('SALTLAKE205', '36c3335b6ea3c4b2', 'Salt Lake 205', true, NOW(), NOW()),
('TytecLog1344', '7f5eecafe62c77aa', 'Tytec Logistics 1344', true, NOW(), NOW()),
('BigBellG263', '6253ae18cce44e34', 'Big Bell Group 263', true, NOW(), NOW())
ON CONFLICT (api_reference) DO UPDATE SET
  api_secret = EXCLUDED.api_secret,
  name = EXCLUDED.name,
  active = true,
  updated_at = NOW();

-- Create indexes for better performance (api_reference index created automatically by UNIQUE constraint)
CREATE INDEX IF NOT EXISTS idx_smartfill_customers_active ON smartfill_customers(active) WHERE active = true;

-- Create a view for active customers only
CREATE OR REPLACE VIEW smartfill_active_customers AS
SELECT 
  id,
  api_reference,
  api_secret,
  name,
  created_at,
  updated_at
FROM smartfill_customers
WHERE active = true
ORDER BY name;

-- Update triggers for updated_at timestamp
CREATE OR REPLACE FUNCTION update_smartfill_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_smartfill_customers_updated_at_trigger
  BEFORE UPDATE ON smartfill_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_smartfill_customers_updated_at();

-- Log the migration
INSERT INTO smartfill_sync_logs (sync_type, sync_status, started_at, completed_at, locations_processed, assets_processed, sync_duration_ms, error_message)
VALUES (
  'customer_migration', 
  'success', 
  NOW(), 
  NOW(), 
  0,  -- Will be populated during data sync
  33, -- 33 customers added
  0,  -- Quick migration
  'Successfully migrated 33 production SmartFill customers'
);

-- Display summary
SELECT 
  COUNT(*) as total_customers,
  COUNT(*) FILTER (WHERE active = true) as active_customers,
  COUNT(*) FILTER (WHERE active = false) as inactive_customers
FROM smartfill_customers;

-- Display the newly added customers
SELECT 
  id,
  api_reference,
  name,
  active,
  created_at
FROM smartfill_customers 
WHERE active = true 
ORDER BY name;