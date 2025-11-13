-- Add POI to Customer Linkage
-- Enables discovered POIs to be assigned to billing customers from captive payments

-- Step 1: Add foreign key constraint to link POIs to customers
ALTER TABLE discovered_poi
DROP CONSTRAINT IF EXISTS fk_discovered_poi_customer;

ALTER TABLE discovered_poi
ADD CONSTRAINT fk_discovered_poi_customer
FOREIGN KEY (matched_customer_id)
REFERENCES customer_locations(id)
ON DELETE SET NULL;

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_discovered_poi_customer
ON discovered_poi(matched_customer_id);

-- Step 3: Add metadata columns for tracking assignment
ALTER TABLE discovered_poi
ADD COLUMN IF NOT EXISTS customer_assignment_method TEXT CHECK (customer_assignment_method IN (
  'manual',           -- Manually assigned via UI
  'auto_spatial',     -- Auto-assigned by GPS proximity
  'auto_name_match',  -- Auto-assigned by name matching
  'auto_combined'     -- Auto-assigned by combined spatial + name
)),
ADD COLUMN IF NOT EXISTS customer_assignment_confidence INTEGER CHECK (customer_assignment_confidence BETWEEN 0 AND 100),
ADD COLUMN IF NOT EXISTS customer_assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_assigned_by UUID REFERENCES auth.users(id);

-- Add helpful comments
COMMENT ON COLUMN discovered_poi.matched_customer_id IS
'Link to customer from billing system. Enables trip data to be associated with billing records.';

COMMENT ON COLUMN discovered_poi.customer_assignment_method IS
'How the customer was assigned: manual (user selected), auto_spatial (GPS proximity),
auto_name_match (fuzzy name matching), auto_combined (both spatial and name)';

COMMENT ON COLUMN discovered_poi.customer_assignment_confidence IS
'Confidence score (0-100) for auto-assignments. Higher scores indicate stronger matches.';

COMMENT ON COLUMN discovered_poi.customer_assigned_at IS
'Timestamp when customer assignment was made';

COMMENT ON COLUMN discovered_poi.customer_assigned_by IS
'User who made the assignment (NULL for auto-assignments)';

-- Grant permissions
GRANT SELECT ON customer_locations TO authenticated;
GRANT UPDATE (matched_customer_id, customer_assignment_method, customer_assignment_confidence,
              customer_assigned_at, customer_assigned_by) ON discovered_poi TO authenticated;
