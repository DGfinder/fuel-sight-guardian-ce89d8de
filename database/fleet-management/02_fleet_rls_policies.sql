-- ============================================================================
-- FLEET MANAGEMENT RLS POLICIES
-- ============================================================================

-- Enable RLS on all fleet tables
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_compliance ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VEHICLES POLICIES
-- ============================================================================

-- All authenticated users can view vehicles
CREATE POLICY "vehicles_select_authenticated" ON vehicles
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins and managers can insert vehicles
CREATE POLICY "vehicles_insert_admin_manager" ON vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Only admins and managers can update vehicles
CREATE POLICY "vehicles_update_admin_manager" ON vehicles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Only admins can delete vehicles
CREATE POLICY "vehicles_delete_admin" ON vehicles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================================================
-- DRIVER ASSIGNMENTS POLICIES
-- ============================================================================

-- All authenticated users can view driver assignments
CREATE POLICY "driver_assignments_select_authenticated" ON driver_assignments
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins, managers, and operators can manage driver assignments
CREATE POLICY "driver_assignments_insert_staff" ON driver_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  );

CREATE POLICY "driver_assignments_update_staff" ON driver_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  );

-- ============================================================================
-- MAINTENANCE RECORDS POLICIES
-- ============================================================================

-- All authenticated users can view maintenance records
CREATE POLICY "maintenance_select_authenticated" ON maintenance_records
  FOR SELECT
  TO authenticated
  USING (true);

-- Staff can create maintenance records
CREATE POLICY "maintenance_insert_staff" ON maintenance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  );

-- Staff can update maintenance records
CREATE POLICY "maintenance_update_staff" ON maintenance_records
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  );

-- Only admins can delete maintenance records
CREATE POLICY "maintenance_delete_admin" ON maintenance_records
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================================================
-- VEHICLE EVENTS POLICIES
-- ============================================================================

-- All authenticated users can view vehicle events
CREATE POLICY "vehicle_events_select_authenticated" ON vehicle_events
  FOR SELECT
  TO authenticated
  USING (true);

-- System and staff can insert events
CREATE POLICY "vehicle_events_insert_staff" ON vehicle_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  );

-- Staff can update events (for verification)
CREATE POLICY "vehicle_events_update_staff" ON vehicle_events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  );

-- ============================================================================
-- ASSET COMPLIANCE POLICIES
-- ============================================================================

-- All authenticated users can view compliance records
CREATE POLICY "compliance_select_authenticated" ON asset_compliance
  FOR SELECT
  TO authenticated
  USING (true);

-- Staff can manage compliance records
CREATE POLICY "compliance_insert_staff" ON asset_compliance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  );

CREATE POLICY "compliance_update_staff" ON asset_compliance
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  );

CREATE POLICY "compliance_delete_admin" ON asset_compliance
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================================================
-- SERVICE ROLE POLICIES (for system operations)
-- ============================================================================

-- Grant service role full access to all fleet tables
GRANT ALL ON vehicles TO service_role;
GRANT ALL ON driver_assignments TO service_role;
GRANT ALL ON maintenance_records TO service_role;
GRANT ALL ON vehicle_events TO service_role;
GRANT ALL ON asset_compliance TO service_role;

-- Grant authenticated users read access
GRANT SELECT ON vehicles TO authenticated;
GRANT SELECT ON driver_assignments TO authenticated;
GRANT SELECT ON maintenance_records TO authenticated;
GRANT SELECT ON vehicle_events TO authenticated;
GRANT SELECT ON asset_compliance TO authenticated;

-- Grant write access for specific operations
GRANT INSERT, UPDATE ON vehicles TO authenticated;
GRANT INSERT, UPDATE ON driver_assignments TO authenticated;
GRANT INSERT, UPDATE ON maintenance_records TO authenticated;
GRANT INSERT, UPDATE ON vehicle_events TO authenticated;
GRANT INSERT, UPDATE ON asset_compliance TO authenticated;

-- Grant delete only where policies allow
GRANT DELETE ON vehicles TO authenticated;
GRANT DELETE ON maintenance_records TO authenticated;
GRANT DELETE ON asset_compliance TO authenticated;

SELECT 'Fleet management RLS policies created successfully' as result;