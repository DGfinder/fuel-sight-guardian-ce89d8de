-- ============================================================================
-- FIX RLS POLICIES FOR ta_* TABLES
-- Security Audit Remediation: Replace permissive USING(true) policies
-- with proper role-based and customer-based filtering
-- ============================================================================

-- ============================================================================
-- PHASE 1: Create Non-Recursive Helper Functions (SECURITY DEFINER)
-- These bypass RLS when checking permissions to avoid infinite recursion
-- ============================================================================

-- 1.1 Get user's role safely (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_role_safe()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM user_roles
    WHERE user_id = auth.uid()
    LIMIT 1;

    RETURN COALESCE(v_role, 'none');
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'none';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.2 Check if user is GSF staff (admin, scheduler, operator, viewer)
-- These roles can see ALL AgBot telemetry data. Tank visibility is controlled separately.
CREATE OR REPLACE FUNCTION is_gsf_staff_safe()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role_safe() IN ('admin', 'scheduler', 'operator', 'viewer');
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.3 Check if user is admin or scheduler (can modify data)
CREATE OR REPLACE FUNCTION is_admin_or_scheduler_safe()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role_safe() IN ('admin', 'scheduler');
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop the old function name (renamed from is_admin_or_manager_safe)
DROP FUNCTION IF EXISTS is_admin_or_manager_safe();

-- 1.4 Get customer account ID for current user (if they are a customer)
CREATE OR REPLACE FUNCTION get_customer_account_id_safe()
RETURNS UUID AS $$
DECLARE
    v_account_id UUID;
BEGIN
    SELECT id INTO v_account_id
    FROM customer_accounts
    WHERE user_id = auth.uid()
      AND is_active = true
    LIMIT 1;

    RETURN v_account_id;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.5 Check if customer can access a specific ta_agbot_location
CREATE OR REPLACE FUNCTION customer_can_access_location(p_location_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_customer_account_id UUID;
BEGIN
    v_customer_account_id := get_customer_account_id_safe();

    IF v_customer_account_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM customer_tank_access
        WHERE customer_account_id = v_customer_account_id
        AND agbot_location_id = p_location_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.6 Check if customer can access a specific ta_agbot_asset (via its location)
CREATE OR REPLACE FUNCTION customer_can_access_asset(p_asset_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_customer_account_id UUID;
BEGIN
    v_customer_account_id := get_customer_account_id_safe();

    IF v_customer_account_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM customer_tank_access cta
        JOIN ta_agbot_assets a ON a.location_id = cta.agbot_location_id
        WHERE cta.customer_account_id = v_customer_account_id
        AND a.id = p_asset_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.7 Check if user can access a ta_tank (via group/subgroup or customer assignment)
-- This matches the logic in ta_tanks_select policy
CREATE OR REPLACE FUNCTION can_access_ta_tank_safe(p_tank_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_group_id UUID;
    v_subgroup_id UUID;
    v_role TEXT;
    v_customer_account_id UUID;
BEGIN
    v_role := get_user_role_safe();

    -- Admin, scheduler can access all tanks
    IF v_role IN ('admin', 'scheduler') THEN
        RETURN TRUE;
    END IF;

    -- Get the tank's group_id AND subgroup_id
    SELECT group_id, subgroup_id INTO v_group_id, v_subgroup_id
    FROM ta_tanks
    WHERE id = p_tank_id;

    -- Operator/viewer: check subgroup and group permissions
    IF v_role IN ('operator', 'viewer') THEN
        -- Check specific subgroup permission first
        IF EXISTS (
            SELECT 1 FROM user_subgroup_permissions usp
            WHERE usp.user_id = auth.uid()
            AND usp.ta_subgroup_id = v_subgroup_id
        ) THEN
            RETURN TRUE;
        END IF;

        -- Check group permission (only if user has no subgroup restrictions for that group)
        IF EXISTS (
            SELECT 1 FROM user_group_permissions ugp
            WHERE ugp.user_id = auth.uid()
            AND ugp.ta_group_id = v_group_id
        ) AND NOT EXISTS (
            SELECT 1 FROM user_subgroup_permissions usp2
            WHERE usp2.user_id = auth.uid()
            AND usp2.ta_group_id = v_group_id
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- Customer: check via tank_sources -> agbot_asset -> location -> customer_tank_access
    v_customer_account_id := get_customer_account_id_safe();
    IF v_customer_account_id IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM ta_tank_sources ts
            JOIN ta_agbot_assets a ON ts.agbot_asset_id = a.id
            JOIN customer_tank_access cta ON cta.agbot_location_id = a.location_id
            WHERE ts.ta_tank_id = p_tank_id
            AND cta.customer_account_id = v_customer_account_id
        );
    END IF;

    RETURN FALSE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_role_safe TO authenticated;
GRANT EXECUTE ON FUNCTION is_gsf_staff_safe TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_or_scheduler_safe TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_account_id_safe TO authenticated;
GRANT EXECUTE ON FUNCTION customer_can_access_location TO authenticated;
GRANT EXECUTE ON FUNCTION customer_can_access_asset TO authenticated;
GRANT EXECUTE ON FUNCTION can_access_ta_tank_safe TO authenticated;

-- ============================================================================
-- PHASE 2: Drop Existing Permissive Policies on ta_agbot_* Tables
-- ============================================================================

-- ta_agbot_locations
DROP POLICY IF EXISTS "Users can view agbot locations" ON ta_agbot_locations;
DROP POLICY IF EXISTS "System can manage agbot locations" ON ta_agbot_locations;

-- ta_agbot_assets
DROP POLICY IF EXISTS "Users can view agbot assets" ON ta_agbot_assets;
DROP POLICY IF EXISTS "System can manage agbot assets" ON ta_agbot_assets;

-- ta_agbot_readings
DROP POLICY IF EXISTS "Users can view agbot readings" ON ta_agbot_readings;
DROP POLICY IF EXISTS "System can manage agbot readings" ON ta_agbot_readings;

-- ta_agbot_device_health
DROP POLICY IF EXISTS "Users can view agbot device health" ON ta_agbot_device_health;
DROP POLICY IF EXISTS "System can manage agbot device health" ON ta_agbot_device_health;

-- ta_agbot_alerts
DROP POLICY IF EXISTS "Users can view agbot alerts" ON ta_agbot_alerts;
DROP POLICY IF EXISTS "System can manage agbot alerts" ON ta_agbot_alerts;

-- ta_agbot_sync_log
DROP POLICY IF EXISTS "Admins can view sync logs" ON ta_agbot_sync_log;
DROP POLICY IF EXISTS "System can manage sync logs" ON ta_agbot_sync_log;

-- ta_tank_sources
DROP POLICY IF EXISTS "Users can view tank sources" ON ta_tank_sources;
DROP POLICY IF EXISTS "System can manage tank sources" ON ta_tank_sources;

-- ta_prediction_history
DROP POLICY IF EXISTS "Users can view predictions" ON ta_prediction_history;
DROP POLICY IF EXISTS "System can manage predictions" ON ta_prediction_history;

-- ta_anomaly_events
DROP POLICY IF EXISTS "Users can view anomalies" ON ta_anomaly_events;
DROP POLICY IF EXISTS "System can manage anomalies" ON ta_anomaly_events;

-- ta_fleet_snapshots
DROP POLICY IF EXISTS "Users can view fleet snapshots" ON ta_fleet_snapshots;
DROP POLICY IF EXISTS "System can manage fleet snapshots" ON ta_fleet_snapshots;

-- ============================================================================
-- PHASE 3: Create Restrictive RLS Policies for ta_agbot_* Tables
-- ============================================================================

-- 3.1 ta_agbot_locations
-- GSF staff see all, customers see only assigned locations
CREATE POLICY "ta_agbot_locations_select" ON ta_agbot_locations
FOR SELECT TO authenticated USING (
    is_gsf_staff_safe()
    OR customer_can_access_location(id)
);

-- Write: Only admin/manager
CREATE POLICY "ta_agbot_locations_insert" ON ta_agbot_locations
FOR INSERT TO authenticated WITH CHECK (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_agbot_locations_update" ON ta_agbot_locations
FOR UPDATE TO authenticated USING (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_agbot_locations_delete" ON ta_agbot_locations
FOR DELETE TO authenticated USING (
    get_user_role_safe() = 'admin'
);

-- 3.2 ta_agbot_assets
-- GSF staff see all, customers see assets at assigned locations
CREATE POLICY "ta_agbot_assets_select" ON ta_agbot_assets
FOR SELECT TO authenticated USING (
    is_gsf_staff_safe()
    OR customer_can_access_asset(id)
);

CREATE POLICY "ta_agbot_assets_insert" ON ta_agbot_assets
FOR INSERT TO authenticated WITH CHECK (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_agbot_assets_update" ON ta_agbot_assets
FOR UPDATE TO authenticated USING (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_agbot_assets_delete" ON ta_agbot_assets
FOR DELETE TO authenticated USING (
    get_user_role_safe() = 'admin'
);

-- 3.3 ta_agbot_readings
-- GSF staff see all, customers see their tanks' readings
CREATE POLICY "ta_agbot_readings_select" ON ta_agbot_readings
FOR SELECT TO authenticated USING (
    is_gsf_staff_safe()
    OR customer_can_access_asset(asset_id)
);

-- Write: Only admin/manager (automated sync uses service role)
CREATE POLICY "ta_agbot_readings_insert" ON ta_agbot_readings
FOR INSERT TO authenticated WITH CHECK (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_agbot_readings_update" ON ta_agbot_readings
FOR UPDATE TO authenticated USING (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_agbot_readings_delete" ON ta_agbot_readings
FOR DELETE TO authenticated USING (
    get_user_role_safe() = 'admin'
);

-- 3.4 ta_agbot_device_health
-- GSF staff only (internal monitoring data)
CREATE POLICY "ta_agbot_device_health_select" ON ta_agbot_device_health
FOR SELECT TO authenticated USING (
    is_gsf_staff_safe()
);

CREATE POLICY "ta_agbot_device_health_insert" ON ta_agbot_device_health
FOR INSERT TO authenticated WITH CHECK (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_agbot_device_health_update" ON ta_agbot_device_health
FOR UPDATE TO authenticated USING (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_agbot_device_health_delete" ON ta_agbot_device_health
FOR DELETE TO authenticated USING (
    get_user_role_safe() = 'admin'
);

-- 3.5 ta_agbot_alerts
-- GSF staff see all, customers see their tanks' alerts
CREATE POLICY "ta_agbot_alerts_select" ON ta_agbot_alerts
FOR SELECT TO authenticated USING (
    is_gsf_staff_safe()
    OR customer_can_access_asset(asset_id)
);

-- GSF staff can acknowledge/update
CREATE POLICY "ta_agbot_alerts_insert" ON ta_agbot_alerts
FOR INSERT TO authenticated WITH CHECK (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_agbot_alerts_update" ON ta_agbot_alerts
FOR UPDATE TO authenticated USING (
    is_gsf_staff_safe()
);

CREATE POLICY "ta_agbot_alerts_delete" ON ta_agbot_alerts
FOR DELETE TO authenticated USING (
    get_user_role_safe() = 'admin'
);

-- 3.6 ta_agbot_sync_log
-- Admin/manager only
CREATE POLICY "ta_agbot_sync_log_select" ON ta_agbot_sync_log
FOR SELECT TO authenticated USING (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_agbot_sync_log_insert" ON ta_agbot_sync_log
FOR INSERT TO authenticated WITH CHECK (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_agbot_sync_log_update" ON ta_agbot_sync_log
FOR UPDATE TO authenticated USING (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_agbot_sync_log_delete" ON ta_agbot_sync_log
FOR DELETE TO authenticated USING (
    get_user_role_safe() = 'admin'
);

-- ============================================================================
-- PHASE 4: Create RLS Policies for ta_tank_sources and Analytics Tables
-- ============================================================================

-- 4.1 ta_tank_sources
CREATE POLICY "ta_tank_sources_select" ON ta_tank_sources
FOR SELECT TO authenticated USING (
    is_gsf_staff_safe()
    OR can_access_ta_tank_safe(ta_tank_id)
);

CREATE POLICY "ta_tank_sources_insert" ON ta_tank_sources
FOR INSERT TO authenticated WITH CHECK (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_tank_sources_update" ON ta_tank_sources
FOR UPDATE TO authenticated USING (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_tank_sources_delete" ON ta_tank_sources
FOR DELETE TO authenticated USING (
    get_user_role_safe() = 'admin'
);

-- 4.2 ta_prediction_history
CREATE POLICY "ta_prediction_history_select" ON ta_prediction_history
FOR SELECT TO authenticated USING (
    is_gsf_staff_safe()
    OR can_access_ta_tank_safe(tank_id)
);

CREATE POLICY "ta_prediction_history_insert" ON ta_prediction_history
FOR INSERT TO authenticated WITH CHECK (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_prediction_history_update" ON ta_prediction_history
FOR UPDATE TO authenticated USING (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_prediction_history_delete" ON ta_prediction_history
FOR DELETE TO authenticated USING (
    get_user_role_safe() = 'admin'
);

-- 4.3 ta_anomaly_events
CREATE POLICY "ta_anomaly_events_select" ON ta_anomaly_events
FOR SELECT TO authenticated USING (
    is_gsf_staff_safe()
    OR can_access_ta_tank_safe(tank_id)
);

CREATE POLICY "ta_anomaly_events_insert" ON ta_anomaly_events
FOR INSERT TO authenticated WITH CHECK (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_anomaly_events_update" ON ta_anomaly_events
FOR UPDATE TO authenticated USING (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_anomaly_events_delete" ON ta_anomaly_events
FOR DELETE TO authenticated USING (
    get_user_role_safe() = 'admin'
);

-- 4.4 ta_fleet_snapshots
-- GSF staff only (aggregate business data)
CREATE POLICY "ta_fleet_snapshots_select" ON ta_fleet_snapshots
FOR SELECT TO authenticated USING (
    is_gsf_staff_safe()
);

CREATE POLICY "ta_fleet_snapshots_insert" ON ta_fleet_snapshots
FOR INSERT TO authenticated WITH CHECK (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_fleet_snapshots_update" ON ta_fleet_snapshots
FOR UPDATE TO authenticated USING (
    is_admin_or_scheduler_safe()
);

CREATE POLICY "ta_fleet_snapshots_delete" ON ta_fleet_snapshots
FOR DELETE TO authenticated USING (
    get_user_role_safe() = 'admin'
);

-- ============================================================================
-- PHASE 5: Fix ta_tanks Policy to Include Customer Access
-- The existing policy doesn't allow customers to see their assigned tanks
-- ============================================================================

-- Drop existing ta_tanks policies
DROP POLICY IF EXISTS "Users can view tanks in their groups" ON ta_tanks;
DROP POLICY IF EXISTS "System can manage all tanks" ON ta_tanks;

-- Create new SELECT policy that includes customer access
-- Admin/scheduler see all, operator/viewer use group/subgroup permissions
CREATE POLICY "ta_tanks_select" ON ta_tanks
FOR SELECT TO authenticated USING (
    -- Admin/scheduler with full access
    get_user_role_safe() IN ('admin', 'scheduler')
    OR
    -- Staff with group/subgroup permissions
    EXISTS (
        SELECT 1 FROM user_subgroup_permissions usp
        WHERE usp.user_id = auth.uid()
        AND usp.ta_subgroup_id = ta_tanks.subgroup_id
    )
    OR
    (
        EXISTS (
            SELECT 1 FROM user_group_permissions ugp
            WHERE ugp.user_id = auth.uid()
            AND ugp.ta_group_id = ta_tanks.group_id
        )
        AND NOT EXISTS (
            SELECT 1 FROM user_subgroup_permissions usp2
            WHERE usp2.user_id = auth.uid()
            AND usp2.ta_group_id = ta_tanks.group_id
        )
    )
    OR
    -- Customer access via tank_sources -> location -> customer_tank_access
    EXISTS (
        SELECT 1 FROM ta_tank_sources ts
        JOIN ta_agbot_assets a ON ts.agbot_asset_id = a.id
        JOIN customer_tank_access cta ON cta.agbot_location_id = a.location_id
        JOIN customer_accounts ca ON ca.id = cta.customer_account_id
        WHERE ts.ta_tank_id = ta_tanks.id
        AND ca.user_id = auth.uid()
        AND ca.is_active = true
    )
);

-- Write policy: Admin/manager only
CREATE POLICY "ta_tanks_modify" ON ta_tanks
FOR ALL TO authenticated USING (
    is_admin_or_scheduler_safe()
) WITH CHECK (
    is_admin_or_scheduler_safe()
);

-- ============================================================================
-- PHASE 6: Fix ta_tank_dips Policy to Include Customer Access
-- ============================================================================

-- Drop existing ta_tank_dips policies if they exist
DROP POLICY IF EXISTS "Users can view dips" ON ta_tank_dips;
DROP POLICY IF EXISTS "Users can manage dips" ON ta_tank_dips;
DROP POLICY IF EXISTS "ta_tank_dips_select" ON ta_tank_dips;
DROP POLICY IF EXISTS "ta_tank_dips_modify" ON ta_tank_dips;

-- Check if ta_tank_dips has RLS enabled, enable if not
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'ta_tank_dips'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE ta_tank_dips ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Create SELECT policy for ta_tank_dips
CREATE POLICY "ta_tank_dips_select" ON ta_tank_dips
FOR SELECT TO authenticated USING (
    is_gsf_staff_safe()
    OR can_access_ta_tank_safe(tank_id)
);

-- Admin/scheduler can insert any dip, operators only for their group's tanks
CREATE POLICY "ta_tank_dips_insert" ON ta_tank_dips
FOR INSERT TO authenticated WITH CHECK (
    is_admin_or_scheduler_safe()
    OR (get_user_role_safe() = 'operator' AND can_access_ta_tank_safe(tank_id))
);

-- Admin/scheduler can update any dip, operators only for their group's tanks
CREATE POLICY "ta_tank_dips_update" ON ta_tank_dips
FOR UPDATE TO authenticated USING (
    is_admin_or_scheduler_safe()
    OR (get_user_role_safe() = 'operator' AND can_access_ta_tank_safe(tank_id))
);

-- Admin can delete
CREATE POLICY "ta_tank_dips_delete" ON ta_tank_dips
FOR DELETE TO authenticated USING (
    get_user_role_safe() = 'admin'
);

-- ============================================================================
-- PHASE 7: Fix user_activity_log Insertion Policy
-- ============================================================================

-- Drop existing insert policy if it exists
DROP POLICY IF EXISTS "Users can insert own activity" ON user_activity_log;

-- Create tighter policy that requires valid user_id
CREATE POLICY "Users can insert own activity" ON user_activity_log
FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid()
);

-- ============================================================================
-- PHASE 8: Add Performance Indexes for RLS Policy Queries
-- ============================================================================

-- Index for customer tank access lookups
CREATE INDEX IF NOT EXISTS idx_customer_tank_access_lookup
ON customer_tank_access(customer_account_id, agbot_location_id);

-- Index for customer account user lookup
CREATE INDEX IF NOT EXISTS idx_customer_accounts_user_active
ON customer_accounts(user_id) WHERE is_active = true;

-- Index for user_roles lookup
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
ON user_roles(user_id, role);

-- Index for ta_tank_sources lookups
CREATE INDEX IF NOT EXISTS idx_ta_tank_sources_agbot_asset
ON ta_tank_sources(agbot_asset_id) WHERE agbot_asset_id IS NOT NULL;

-- Index for subgroup permission lookups (used by can_access_ta_tank_safe)
CREATE INDEX IF NOT EXISTS idx_user_subgroup_permissions_user_subgroup
ON user_subgroup_permissions(user_id, ta_subgroup_id);

CREATE INDEX IF NOT EXISTS idx_user_subgroup_permissions_user_group
ON user_subgroup_permissions(user_id, ta_group_id);

-- Index for group permission lookups
CREATE INDEX IF NOT EXISTS idx_user_group_permissions_user_group
ON user_group_permissions(user_id, ta_group_id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'RLS Policy Remediation Complete' as status;
SELECT 'Phase 1: Helper functions created' as step_1;
SELECT 'Phase 2-4: ta_agbot_* permissive policies replaced' as step_2;
SELECT 'Phase 5: ta_tanks customer access added' as step_3;
SELECT 'Phase 6: ta_tank_dips policies fixed' as step_4;
SELECT 'Phase 7: user_activity_log tightened' as step_5;
SELECT 'Phase 8: Performance indexes added' as step_6;

-- Show all affected policies
SELECT
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN (
    'ta_agbot_locations',
    'ta_agbot_assets',
    'ta_agbot_readings',
    'ta_agbot_device_health',
    'ta_agbot_alerts',
    'ta_agbot_sync_log',
    'ta_tank_sources',
    'ta_tanks',
    'ta_tank_dips',
    'ta_prediction_history',
    'ta_anomaly_events',
    'ta_fleet_snapshots',
    'user_activity_log'
)
ORDER BY tablename, policyname;
