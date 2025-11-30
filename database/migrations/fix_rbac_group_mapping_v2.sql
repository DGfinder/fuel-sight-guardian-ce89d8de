-- ============================================================================
-- FIX: RBAC Group ID Mapping V2 - NO LEGACY DEPENDENCY
-- Migrates user_group_permissions to use ta_groups IDs directly
-- Run this in Supabase SQL Editor
-- ============================================================================

-- PROBLEM:
-- user_group_permissions uses legacy tank_groups IDs
-- ta_tanks uses new ta_groups IDs
-- When we remove legacy tables, RBAC breaks!

-- SOLUTION:
-- 1. Create mapping between legacy and new group IDs
-- 2. Migrate user_group_permissions to use ta_groups IDs
-- 3. Create RLS policies that don't depend on legacy tables

-- ============================================================================
-- STEP 1: Create temporary mapping table
-- ============================================================================

CREATE TEMP TABLE group_id_mapping AS
SELECT
    tg.id as legacy_id,
    ta.id as new_id,
    tg.name as group_name
FROM tank_groups tg
INNER JOIN ta_groups ta ON LOWER(TRIM(tg.name)) = LOWER(TRIM(ta.name));

-- Verify mapping
SELECT * FROM group_id_mapping ORDER BY group_name;

-- ============================================================================
-- STEP 2: Add ta_group_id column to user_group_permissions
-- ============================================================================

ALTER TABLE user_group_permissions
ADD COLUMN IF NOT EXISTS ta_group_id UUID;

-- ============================================================================
-- STEP 3: Populate ta_group_id from mapping
-- ============================================================================

UPDATE user_group_permissions ugp
SET ta_group_id = m.new_id
FROM group_id_mapping m
WHERE ugp.group_id = m.legacy_id;

-- Verify update
SELECT
    COUNT(*) FILTER (WHERE ta_group_id IS NOT NULL) as migrated,
    COUNT(*) FILTER (WHERE ta_group_id IS NULL) as unmapped,
    COUNT(*) as total
FROM user_group_permissions;

-- ============================================================================
-- STEP 4: Create RLS policies on ta_tanks using ta_group_id
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE ta_tanks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view tanks in their groups" ON ta_tanks;
DROP POLICY IF EXISTS "System can manage all tanks" ON ta_tanks;
DROP POLICY IF EXISTS "Users can view all tanks" ON ta_tanks;

-- Create proper RBAC policy using ta_group_id
CREATE POLICY "Users can view tanks in their groups" ON ta_tanks
FOR SELECT USING (
    -- Admin/manager/scheduler can see all
    (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'manager', 'scheduler')
    OR
    -- Regular users can only see tanks in their permitted groups
    EXISTS (
        SELECT 1 FROM user_group_permissions ugp
        WHERE ugp.user_id = auth.uid()
        AND ugp.ta_group_id = ta_tanks.group_id
    )
);

-- System write access (for edge functions, etc.)
CREATE POLICY "System can manage all tanks" ON ta_tanks
FOR ALL USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'manager')
);

-- ============================================================================
-- STEP 5: Update ta_tank_full_status view (CORRECT column names)
-- Note: ta_tank_dashboard already has rolling_avg_liters_per_day and days_to_min_level
-- ============================================================================

DROP VIEW IF EXISTS ta_tank_full_status CASCADE;

CREATE OR REPLACE VIEW ta_tank_full_status AS
SELECT
    d.*,
    -- Only add columns NOT already in ta_tank_dashboard
    COALESCE(a.avg_daily_consumption_liters, d.rolling_avg_liters_per_day, 0) as avg_daily_consumption_liters,
    COALESCE(a.estimated_days_until_empty, 999) as estimated_days_until_empty,
    a.estimated_empty_date,
    COALESCE(a.previous_day_use, 0) as previous_day_use,
    COALESCE(a.readings_in_period, 0) as readings_in_period,
    a.calculated_at as analytics_updated_at,
    -- Urgency scoring
    CASE
        WHEN d.fill_percent <= 10 THEN 'critical'
        WHEN d.fill_percent <= 20 THEN 'urgent'
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 3 THEN 'urgent'
        WHEN d.fill_percent <= 30 THEN 'warning'
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 7 THEN 'warning'
        WHEN d.current_level_liters <= d.min_level_liters THEN 'warning'
        ELSE 'ok'
    END as urgency_status,
    -- Priority score
    CASE
        WHEN d.fill_percent <= 10 THEN 1
        WHEN d.fill_percent <= 20 THEN 2
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 3 THEN 2
        WHEN d.fill_percent <= 30 THEN 3
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 7 THEN 3
        ELSE 4
    END as priority_score
FROM ta_tank_dashboard d
LEFT JOIN ta_tank_analytics a ON d.id = a.tank_id;

-- ============================================================================
-- STEP 6: Update useUserPermissions to load ta_group_id
-- This is done in frontend code, but we can also create a helper view
-- ============================================================================

CREATE OR REPLACE VIEW user_ta_group_permissions AS
SELECT
    ugp.user_id,
    ugp.ta_group_id as group_id,
    tg.name as group_name,
    ugp.subgroup_id,
    ts.name as subgroup_name
FROM user_group_permissions ugp
LEFT JOIN ta_groups tg ON ugp.ta_group_id = tg.id
LEFT JOIN ta_subgroups ts ON ugp.subgroup_id = ts.id
WHERE ugp.ta_group_id IS NOT NULL;

-- Grant access
GRANT SELECT ON user_ta_group_permissions TO authenticated;

-- ============================================================================
-- STEP 7: Update ta_unified_map_locations view
-- ============================================================================

DROP VIEW IF EXISTS ta_unified_map_locations CASCADE;

CREATE OR REPLACE VIEW ta_unified_map_locations AS
-- Manual dip tanks
SELECT
    t.id,
    t.name as location,
    g.name as group_name,
    sg.name as subgroup,
    loc.address,
    loc.latitude,
    loc.longitude,
    CASE
        WHEN COALESCE(t.safe_level_liters, 0) > 0
        THEN ROUND((COALESCE(t.current_level_liters, 0) / t.safe_level_liters * 100)::numeric, 1)
        ELSE NULL
    END as current_level_percent,
    t.current_level_liters as current_level,
    COALESCE(a.avg_daily_consumption_liters, 0) as rolling_avg,
    a.days_until_min_level as days_to_min_level,
    p.name as product_type,
    t.current_level_datetime::text as latest_dip_date,
    t.safe_level_liters as safe_level,
    t.min_level_liters as min_level,
    t.capacity_liters,
    'dip'::text as data_source,
    'manual'::text as source,
    t.current_level_datetime as latest_reading_at,
    -- Urgency
    CASE
        WHEN COALESCE(t.current_level_liters, 0) <= COALESCE(t.critical_level_liters, t.min_level_liters * 0.5, 0) THEN 'critical'
        WHEN a.days_until_min_level IS NOT NULL AND a.days_until_min_level <= 3 THEN 'critical'
        WHEN a.days_until_min_level IS NOT NULL AND a.days_until_min_level <= 7 THEN 'urgent'
        WHEN COALESCE(t.safe_level_liters, 0) > 0
             AND (COALESCE(t.current_level_liters, 0) / t.safe_level_liters * 100) <= 25 THEN 'warning'
        ELSE 'ok'
    END as urgency_status,
    -- AgBot specific fields (null for dip tanks)
    NULL::boolean as device_online,
    NULL::text as customer_name,
    NULL::integer as total_assets,
    NULL::integer as assets_online,
    NULL::decimal as current_level_liters,
    NULL::integer as days_to_min,
    NULL::text as subgroup_name
FROM ta_tanks t
LEFT JOIN ta_groups g ON t.group_id = g.id
LEFT JOIN ta_subgroups sg ON t.subgroup_id = sg.id
LEFT JOIN ta_locations loc ON t.location_id = loc.id
LEFT JOIN ta_products p ON t.product_id = p.id
LEFT JOIN ta_tank_analytics a ON t.id = a.tank_id
WHERE t.archived_at IS NULL
  AND t.status != 'archived'
  AND loc.latitude IS NOT NULL
  AND loc.longitude IS NOT NULL

UNION ALL

-- AgBot locations
SELECT
    l.id,
    l.name as location,
    l.customer_name as group_name,
    l.tenancy_name as subgroup,
    l.address,
    l.latitude,
    l.longitude,
    l.avg_fill_percent as current_level_percent,
    NULL as current_level,
    l.daily_consumption_liters as rolling_avg,
    l.days_remaining as days_to_min_level,
    'Diesel' as product_type,
    l.last_telemetry_at::text as latest_dip_date,
    NULL as safe_level,
    NULL as min_level,
    NULL as capacity_liters,
    'agbot'::text as data_source,
    'agbot'::text as source,
    l.last_telemetry_at as latest_reading_at,
    -- Urgency
    CASE
        WHEN l.avg_fill_percent IS NOT NULL AND l.avg_fill_percent <= 10 THEN 'critical'
        WHEN l.days_remaining IS NOT NULL AND l.days_remaining <= 3 THEN 'critical'
        WHEN l.days_remaining IS NOT NULL AND l.days_remaining <= 7 THEN 'urgent'
        WHEN l.avg_fill_percent IS NOT NULL AND l.avg_fill_percent <= 25 THEN 'warning'
        ELSE 'ok'
    END as urgency_status,
    -- AgBot specific
    (l.assets_online > 0) as device_online,
    l.customer_name,
    l.total_assets,
    l.assets_online,
    NULL as current_level_liters,
    l.days_remaining as days_to_min,
    l.tenancy_name as subgroup_name
FROM ta_agbot_locations l
WHERE l.is_disabled = false
  AND l.latitude IS NOT NULL
  AND l.longitude IS NOT NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'RBAC Migration V2 Complete!' as result;

-- Show user permissions with ta_group_ids
SELECT
    ur.email,
    ur.role,
    COUNT(ugp.ta_group_id) as ta_groups_count
FROM user_roles ur
LEFT JOIN user_group_permissions ugp ON ur.user_id = ugp.user_id
GROUP BY ur.email, ur.role
ORDER BY ur.role, ur.email;

-- Show unmapped permissions (need manual fix)
SELECT
    ugp.user_id,
    ugp.group_id as legacy_group_id,
    tg.name as legacy_group_name,
    'UNMAPPED - no ta_group_id' as status
FROM user_group_permissions ugp
LEFT JOIN tank_groups tg ON ugp.group_id = tg.id
WHERE ugp.ta_group_id IS NULL;

-- ============================================================================
-- NEXT STEPS after running this migration:
-- 1. Verify all users have ta_group_id populated
-- 2. Update frontend useUserPermissions to use user_ta_group_permissions view
-- 3. Test RBAC by logging in as non-admin user
-- 4. Once verified, can safely remove tank_groups dependency
-- ============================================================================
