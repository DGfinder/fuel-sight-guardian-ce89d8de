-- ============================================================================
-- FIX: RBAC Subgroup ID Mapping V3
-- Migrates user_subgroup_permissions to use ta_subgroups IDs
-- Run this in Supabase SQL Editor
-- ============================================================================

-- PROBLEM:
-- user_subgroup_permissions uses:
--   - group_id: LEGACY tank_groups IDs
--   - subgroup_name: TEXT (not UUID)
-- ta_tanks uses:
--   - group_id: NEW ta_groups IDs
--   - subgroup_id: ta_subgroups UUIDs
-- NO MAPPING EXISTS between subgroup_name → ta_subgroups.id

-- SOLUTION:
-- 1. Add ta_group_id and ta_subgroup_id columns to user_subgroup_permissions
-- 2. Map legacy group IDs → ta_groups IDs
-- 3. Map subgroup_name TEXT → ta_subgroups.id UUID
-- 4. Update RLS policy to check subgroup-level access
-- 5. Update user_ta_group_permissions view

-- ============================================================================
-- STEP 1: Add ta_group_id and ta_subgroup_id columns
-- ============================================================================

ALTER TABLE user_subgroup_permissions
ADD COLUMN IF NOT EXISTS ta_group_id UUID,
ADD COLUMN IF NOT EXISTS ta_subgroup_id UUID;

-- ============================================================================
-- STEP 2: Create temporary mapping for groups (legacy → new)
-- ============================================================================

CREATE TEMP TABLE group_mapping AS
SELECT
    tg.id as legacy_id,
    tag.id as new_id,
    tg.name as group_name
FROM tank_groups tg
INNER JOIN ta_groups tag ON LOWER(TRIM(tg.name)) = LOWER(TRIM(tag.name));

-- Verify group mapping
SELECT * FROM group_mapping ORDER BY group_name;

-- ============================================================================
-- STEP 3: Populate ta_group_id in user_subgroup_permissions
-- ============================================================================

UPDATE user_subgroup_permissions usp
SET ta_group_id = gm.new_id
FROM group_mapping gm
WHERE usp.group_id = gm.legacy_id;

-- Verify group ID migration
SELECT
    COUNT(*) FILTER (WHERE ta_group_id IS NOT NULL) as groups_mapped,
    COUNT(*) FILTER (WHERE ta_group_id IS NULL) as groups_unmapped,
    COUNT(*) as total
FROM user_subgroup_permissions;

-- ============================================================================
-- STEP 4: Populate ta_subgroup_id by matching subgroup_name to ta_subgroups.name
-- ============================================================================

UPDATE user_subgroup_permissions usp
SET ta_subgroup_id = ts.id
FROM ta_subgroups ts
WHERE usp.ta_group_id = ts.group_id
  AND LOWER(TRIM(usp.subgroup_name)) = LOWER(TRIM(ts.name));

-- Verify subgroup mapping
SELECT
    COUNT(*) FILTER (WHERE ta_subgroup_id IS NOT NULL) as subgroups_mapped,
    COUNT(*) FILTER (WHERE ta_subgroup_id IS NULL) as subgroups_unmapped,
    COUNT(*) as total
FROM user_subgroup_permissions;

-- Show unmapped subgroups (need manual attention)
SELECT
    usp.user_id,
    ur.email,
    usp.subgroup_name,
    usp.ta_group_id,
    'UNMAPPED - subgroup name not found in ta_subgroups' as status
FROM user_subgroup_permissions usp
LEFT JOIN user_roles ur ON usp.user_id = ur.user_id
WHERE usp.ta_subgroup_id IS NULL;

-- ============================================================================
-- STEP 5: Update RLS policy on ta_tanks to check BOTH group and subgroup
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view tanks in their groups" ON ta_tanks;

-- Create comprehensive RBAC policy
CREATE POLICY "Users can view tanks in their groups" ON ta_tanks
FOR SELECT USING (
    -- Admin/manager/scheduler can see all tanks
    (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'manager', 'scheduler')
    OR
    -- Users with SUBGROUP permissions: only see tanks in those specific subgroups
    EXISTS (
        SELECT 1 FROM user_subgroup_permissions usp
        WHERE usp.user_id = auth.uid()
        AND usp.ta_subgroup_id = ta_tanks.subgroup_id
    )
    OR
    -- Users with GROUP-only permissions (no subgroup entry for that group): see all tanks in group
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
);

-- ============================================================================
-- STEP 6: Update user_ta_group_permissions view to include subgroup info
-- ============================================================================

DROP VIEW IF EXISTS user_ta_group_permissions;

CREATE OR REPLACE VIEW user_ta_group_permissions AS
-- Group-level permissions (no subgroup restriction)
SELECT
    ugp.user_id,
    ugp.ta_group_id as group_id,
    tg.name as group_name,
    NULL::uuid as subgroup_id,
    NULL::text as subgroup_name,
    'group'::text as permission_level
FROM user_group_permissions ugp
LEFT JOIN ta_groups tg ON ugp.ta_group_id = tg.id
WHERE ugp.ta_group_id IS NOT NULL

UNION ALL

-- Subgroup-level permissions (restricted to specific subgroups)
SELECT
    usp.user_id,
    usp.ta_group_id as group_id,
    tg.name as group_name,
    usp.ta_subgroup_id as subgroup_id,
    ts.name as subgroup_name,
    'subgroup'::text as permission_level
FROM user_subgroup_permissions usp
LEFT JOIN ta_groups tg ON usp.ta_group_id = tg.id
LEFT JOIN ta_subgroups ts ON usp.ta_subgroup_id = ts.id
WHERE usp.ta_subgroup_id IS NOT NULL;

-- Grant access to authenticated users
GRANT SELECT ON user_ta_group_permissions TO authenticated;

-- ============================================================================
-- STEP 7: Verification
-- ============================================================================

SELECT 'Subgroup RBAC Migration V3 Complete!' as result;

-- Show Sally's permissions (should show GSFS Narrogin subgroup)
SELECT
    ur.email,
    ur.role,
    utp.group_name,
    utp.subgroup_name,
    utp.permission_level
FROM user_ta_group_permissions utp
JOIN user_roles ur ON utp.user_id = ur.user_id
WHERE ur.email = 'sally.moore@gsfs.com.au';

-- Show all operators with subgroup permissions
SELECT
    ur.email,
    ur.role,
    utp.group_name,
    utp.subgroup_name,
    utp.permission_level
FROM user_ta_group_permissions utp
JOIN user_roles ur ON utp.user_id = ur.user_id
WHERE ur.role = 'operator'
  AND utp.permission_level = 'subgroup'
ORDER BY ur.email, utp.group_name, utp.subgroup_name;

-- Count tanks Sally should be able to see
SELECT
    ts.name as subgroup_name,
    COUNT(t.id) as tank_count
FROM ta_tanks t
JOIN ta_subgroups ts ON t.subgroup_id = ts.id
WHERE ts.name = 'GSFS Narrogin'
GROUP BY ts.name;

-- ============================================================================
-- NEXT STEPS after running this migration:
-- 1. Verify Sally can only see GSFS Narrogin tanks
-- 2. Test other operators with subgroup permissions
-- 3. Ensure managers/admins still see all tanks
-- ============================================================================
