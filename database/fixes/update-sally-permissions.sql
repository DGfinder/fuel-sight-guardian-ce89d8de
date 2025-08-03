-- Update Sally Moore's permissions to GSFS Narrogin only
-- User ID: c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b
-- Email: sally.moore@gsfs.com.au

-- Step 1: Check Sally's current permissions (informational)
SELECT 
    'Current Permissions for Sally Moore' as info,
    ur.role,
    tg.name as group_name,
    'FULL_GROUP' as permission_type
FROM user_roles ur
LEFT JOIN user_group_permissions ugp ON ur.user_id = ugp.user_id
LEFT JOIN tank_groups tg ON ugp.group_id = tg.id
WHERE ur.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b'

UNION ALL

SELECT 
    'Current Permissions for Sally Moore' as info,
    ur.role,
    tg.name as group_name,
    usp.subgroup_name as permission_type
FROM user_roles ur
LEFT JOIN user_subgroup_permissions usp ON ur.user_id = usp.user_id
LEFT JOIN tank_groups tg ON usp.group_id = tg.id
WHERE ur.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Step 2: Backup current permissions (create audit entry)
INSERT INTO user_permission_audit (user_id, email, action, details, timestamp)
VALUES (
    'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b',
    'sally.moore@gsfs.com.au',
    'BACKUP_BEFORE_NARROGIN_RESTRICTION',
    'Backing up permissions before restricting to GSFS Narrogin only',
    NOW()
);

-- Step 3: Remove existing group permissions (if any)
DELETE FROM user_group_permissions 
WHERE user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Step 4: Remove existing subgroup permissions (if any)
DELETE FROM user_subgroup_permissions 
WHERE user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Step 5: Ensure Sally has the manager role
INSERT INTO user_roles (user_id, role, created_at)
VALUES ('c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b', 'manager', NOW())
ON CONFLICT (user_id) 
DO UPDATE SET role = 'manager', updated_at = NOW();

-- Step 6: Get GSF Depots group ID
-- (We'll use this in the next step)

-- Step 7: Grant GSFS Narrogin subgroup access
INSERT INTO user_subgroup_permissions (user_id, group_id, subgroup_name, created_at)
SELECT 
    'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b' as user_id,
    tg.id as group_id,
    'GSFS Narrogin' as subgroup_name,
    NOW() as created_at
FROM tank_groups tg 
WHERE tg.name = 'GSF Depots';

-- Step 8: Create audit entry for the change
INSERT INTO user_permission_audit (user_id, email, action, details, timestamp)
VALUES (
    'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b',
    'sally.moore@gsfs.com.au',
    'GRANT_NARROGIN_SUBGROUP_ACCESS',
    'Granted access to GSFS Narrogin subgroup only in GSF Depots',
    NOW()
);

-- Step 9: Verify the changes
SELECT 
    'Updated Permissions for Sally Moore' as info,
    ur.role,
    tg.name as group_name,
    usp.subgroup_name,
    usp.created_at
FROM user_roles ur
JOIN user_subgroup_permissions usp ON ur.user_id = usp.user_id
JOIN tank_groups tg ON usp.group_id = tg.id
WHERE ur.user_id = 'c5e01ef9-6ae0-4dcf-b0cb-24593eb8904b';

-- Step 10: Show what tanks Sally should now be able to access
SELECT 
    'Tanks Sally can now access' as info,
    ft.tank_name,
    ft.subgroup,
    tg.name as group_name
FROM fuel_tanks ft
JOIN tank_groups tg ON ft.group_id = tg.id
WHERE tg.name = 'GSF Depots' 
AND ft.subgroup = 'GSFS Narrogin'
ORDER BY ft.tank_name;

-- Step 11: Show what tanks Sally should NOT be able to access
SELECT 
    'Tanks Sally should NOT see (other GSF Depots subgroups)' as info,
    ft.subgroup,
    COUNT(*) as tank_count
FROM fuel_tanks ft
JOIN tank_groups tg ON ft.group_id = tg.id
WHERE tg.name = 'GSF Depots' 
AND ft.subgroup IS NOT NULL
AND ft.subgroup != 'GSFS Narrogin'
GROUP BY ft.subgroup
ORDER BY ft.subgroup;