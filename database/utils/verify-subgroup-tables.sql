-- Quick verification queries to check if subgroup permissions system is deployed

-- 1. Check if user_subgroup_permissions table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'user_subgroup_permissions'
) as subgroup_table_exists;

-- 2. Check if required functions exist
SELECT COUNT(*) as function_count FROM information_schema.routines 
WHERE routine_name IN (
    'user_has_tank_access_with_subgroups', 
    'get_user_accessible_subgroups'
) AND routine_type = 'FUNCTION';

-- 3. Check if user_all_permissions view exists
SELECT EXISTS (
   SELECT FROM information_schema.views 
   WHERE table_schema = 'public' 
   AND table_name = 'user_all_permissions'
) as unified_view_exists;

-- 4. Show current permissions in the system
SELECT 
    'Group Permissions' as permission_type,
    COUNT(*) as count
FROM user_group_permissions
UNION ALL
SELECT 
    'Subgroup Permissions' as permission_type,
    COUNT(*) as count
FROM user_subgroup_permissions;

-- 5. List available subgroups in GSF Depots
SELECT DISTINCT 
    tg.name as group_name,
    ft.subgroup
FROM fuel_tanks ft
JOIN tank_groups tg ON ft.group_id = tg.id
WHERE tg.name = 'GSF Depots' 
AND ft.subgroup IS NOT NULL
ORDER BY ft.subgroup;

-- 6. Count tanks by subgroup in GSF Depots
SELECT 
    ft.subgroup,
    COUNT(*) as tank_count
FROM fuel_tanks ft
JOIN tank_groups tg ON ft.group_id = tg.id
WHERE tg.name = 'GSF Depots' 
AND ft.subgroup IS NOT NULL
GROUP BY ft.subgroup
ORDER BY ft.subgroup;