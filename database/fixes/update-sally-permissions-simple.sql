-- Update Sally Moore's permissions to GSFS Narrogin only
-- User ID: c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b
-- Email: sally.moore@gsfs.com.au

-- Step 1: Check Sally's current permissions
SELECT 
    'CURRENT PERMISSIONS FOR SALLY MOORE' as status;

SELECT 
    'Role' as permission_type,
    ur.role as value,
    ur.created_at
FROM user_roles ur
WHERE ur.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

SELECT 
    'Full Group Access' as permission_type,
    tg.name as value,
    ugp.created_at
FROM user_group_permissions ugp
JOIN tank_groups tg ON ugp.group_id = tg.id
WHERE ugp.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

SELECT 
    'Subgroup Access' as permission_type,
    CONCAT(tg.name, ' > ', usp.subgroup_name) as value,
    usp.created_at
FROM user_subgroup_permissions usp
JOIN tank_groups tg ON usp.group_id = tg.id
WHERE usp.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Step 2: Remove existing group permissions (if any)
DELETE FROM user_group_permissions 
WHERE user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Step 3: Remove existing subgroup permissions (if any)  
DELETE FROM user_subgroup_permissions 
WHERE user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Step 4: Ensure Sally has the manager role
INSERT INTO user_roles (user_id, role, created_at)
VALUES ('c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b', 'manager', NOW())
ON CONFLICT (user_id) 
DO UPDATE SET role = 'manager';

-- Step 5: Grant GSFS Narrogin subgroup access
INSERT INTO user_subgroup_permissions (user_id, group_id, subgroup_name, created_at)
SELECT 
    'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b' as user_id,
    tg.id as group_id,
    'GSFS Narrogin' as subgroup_name,
    NOW() as created_at
FROM tank_groups tg 
WHERE tg.name = 'GSF Depots';

-- Step 6: Verify the changes
SELECT 
    'NEW PERMISSIONS FOR SALLY MOORE' as status;

SELECT 
    'Role' as permission_type,
    ur.role as value,
    'Updated' as status
FROM user_roles ur
WHERE ur.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

SELECT 
    'Subgroup Access' as permission_type,
    CONCAT(tg.name, ' > ', usp.subgroup_name) as value,
    'Granted' as status
FROM user_subgroup_permissions usp
JOIN tank_groups tg ON usp.group_id = tg.id
WHERE usp.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Step 7: Show tanks Sally can now access
SELECT 
    'TANKS SALLY CAN ACCESS' as status;

SELECT 
    ft.tank_name,
    ft.subgroup,
    tg.name as group_name,
    'Accessible' as access_status
FROM fuel_tanks ft
JOIN tank_groups tg ON ft.group_id = tg.id
WHERE tg.name = 'GSF Depots' 
AND ft.subgroup = 'GSFS Narrogin'
ORDER BY ft.tank_name;

-- Step 8: Show other GSF Depots subgroups Sally should NOT see
SELECT 
    'OTHER GSF DEPOTS SUBGROUPS (SHOULD BE BLOCKED)' as status;

SELECT 
    ft.subgroup,
    COUNT(*) as tank_count,
    'Blocked' as access_status
FROM fuel_tanks ft
JOIN tank_groups tg ON ft.group_id = tg.id
WHERE tg.name = 'GSF Depots' 
AND ft.subgroup IS NOT NULL
AND ft.subgroup != 'GSFS Narrogin'
GROUP BY ft.subgroup
ORDER BY ft.subgroup;