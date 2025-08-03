-- Check current constraints on user_roles table
SELECT 
    constraint_name,
    constraint_type,
    table_name,
    column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'user_roles' 
AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY');

-- Check current user roles for the user
SELECT 
    ur.user_id,
    ur.role,
    ur.group_id,
    tg.name as group_name
FROM user_roles ur
LEFT JOIN tank_groups tg ON ur.group_id = tg.id
WHERE ur.user_id = '0799bae8-cd0e-4e5b-bd72-a3b2f0d98f3a';

-- Step 1: Drop ALL problematic unique constraints
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;

-- Step 2: Delete any existing roles for this user (to start fresh)
DELETE FROM user_roles WHERE user_id = '0799bae8-cd0e-4e5b-bd72-a3b2f0d98f3a';

-- Step 3: Add the user roles for both groups
INSERT INTO user_roles (user_id, role, group_id) VALUES
('0799bae8-cd0e-4e5b-bd72-a3b2f0d98f3a', 'admin', (SELECT id FROM tank_groups WHERE name = 'Swan Transit')),
('0799bae8-cd0e-4e5b-bd72-a3b2f0d98f3a', 'admin', (SELECT id FROM tank_groups WHERE name = 'BGC'));

-- Step 4: Verify the results
SELECT 
    ur.user_id,
    ur.role,
    ur.group_id,
    tg.name as group_name
FROM user_roles ur
LEFT JOIN tank_groups tg ON ur.group_id = tg.id
WHERE ur.user_id = '0799bae8-cd0e-4e5b-bd72-a3b2f0d98f3a'; 