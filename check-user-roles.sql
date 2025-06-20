-- Check current user roles for adam.panetta@gsfs.com.au
SELECT 
    ur.user_id,
    ur.role,
    ur.group_id,
    tg.name as group_name
FROM user_roles ur
LEFT JOIN tank_groups tg ON ur.group_id = tg.id
WHERE ur.user_id = '0799bae8-cd0e-4e5b-bd72-a3b2f0d98f3a';

-- Check available groups
SELECT id, name FROM tank_groups WHERE name IN ('Swan Transit', 'BGC');

-- Check the unique constraint
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'user_roles' 
AND constraint_type = 'UNIQUE'; 