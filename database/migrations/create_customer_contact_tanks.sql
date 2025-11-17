-- Migration: Create Customer Contact Tanks Junction Table
-- This allows per-contact tank assignment for email notifications
-- Many-to-many relationship: one contact can have multiple tanks, one tank can be sent to multiple contacts

-- Junction table for assigning specific tanks to customer contacts
CREATE TABLE IF NOT EXISTS customer_contact_tanks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_contact_id UUID NOT NULL REFERENCES customer_contacts(id) ON DELETE CASCADE,
  agbot_location_id UUID NOT NULL REFERENCES agbot_locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,
  -- Prevent duplicate assignments
  UNIQUE(customer_contact_id, agbot_location_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_tanks_contact_id ON customer_contact_tanks(customer_contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tanks_location_id ON customer_contact_tanks(agbot_location_id);
CREATE INDEX IF NOT EXISTS idx_contact_tanks_created_at ON customer_contact_tanks(created_at DESC);

-- RLS Policies
ALTER TABLE customer_contact_tanks ENABLE ROW LEVEL SECURITY;

-- Admins and managers can view tank assignments
CREATE POLICY "Admins can view contact tank assignments" ON customer_contact_tanks
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Admins and managers can manage tank assignments
CREATE POLICY "Admins can manage contact tank assignments" ON customer_contact_tanks
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Helper view: Contact with assigned tank count
CREATE OR REPLACE VIEW customer_contacts_with_tank_count AS
SELECT
  cc.*,
  COUNT(cct.agbot_location_id) as assigned_tank_count,
  (
    SELECT COUNT(*)
    FROM agbot_locations al
    WHERE al.customer_name = cc.customer_name
    AND al.disabled = false
  ) as total_available_tanks
FROM customer_contacts cc
LEFT JOIN customer_contact_tanks cct ON cc.id = cct.customer_contact_id
GROUP BY cc.id;

-- Grant access to view
GRANT SELECT ON customer_contacts_with_tank_count TO authenticated;

-- Add helpful comment
COMMENT ON TABLE customer_contact_tanks IS 'Junction table linking customer contacts to specific AgBot tanks for email notifications. If no tanks assigned for a contact, email will include all tanks for that customer (backward compatible).';

SELECT 'Customer contact tanks junction table created successfully' as result;
