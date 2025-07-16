-- Fix Adam Panetta Access Script
-- This script specifically addresses Adam Panetta's access denied issue
-- after the RBAC migration

-- ============================================================================
-- STEP 1: Find Adam Panetta's user ID
-- ============================================================================

-- Look for Adam Panetta in the auth.users table
SELECT 
    id,
    email,
    created_at
FROM auth.users 
WHERE email ILIKE '%adam%' OR email ILIKE '%panetta%';

-- ============================================================================
-- STEP 2: Check current permissions for Adam Panetta
-- ============================================================================

-- Check if Adam has any roles assigned
SELECT 
    'user_roles' as table_name,
    ur.user_id,
    ur.role,
    u.email
FROM user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email ILIKE '%adam%' OR u.email ILIKE '%panetta%';

-- Check if Adam has any group permissions
SELECT 
    'user_group_permissions' as table_name,
    ugp.user_id,
    ugp.group_id,
    tg.name as group_name,
    u.email
FROM user_group_permissions ugp
JOIN auth.users u ON ugp.user_id = u.id
JOIN tank_groups tg ON ugp.group_id = tg.id
WHERE u.email ILIKE '%adam%' OR u.email ILIKE '%panetta%';

-- ============================================================================
-- STEP 3: Grant Adam Panetta proper access
-- ============================================================================

-- First, let's get Adam's user ID (replace with actual ID if found above)
DO $$
DECLARE
    adam_user_id UUID;
BEGIN
    -- Find Adam's user ID
    SELECT id INTO adam_user_id 
    FROM auth.users 
    WHERE email ILIKE '%adam%' OR email ILIKE '%panetta%'
    LIMIT 1;
    
    IF adam_user_id IS NULL THEN
        RAISE NOTICE 'Adam Panetta user not found. Please check the email address.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Found Adam Panetta with user_id: %', adam_user_id;
    
    -- Grant admin role to Adam
    INSERT INTO user_roles (user_id, role)
    VALUES (adam_user_id, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
    
    RAISE NOTICE 'Granted admin role to Adam Panetta';
    
    -- Grant access to all groups
    INSERT INTO user_group_permissions (user_id, group_id)
    SELECT adam_user_id, tg.id
    FROM tank_groups tg
    ON CONFLICT (user_id, group_id) DO NOTHING;
    
    RAISE NOTICE 'Granted access to all groups for Adam Panetta';
    
END $$;

-- ============================================================================
-- STEP 4: Verify the fix
-- ============================================================================

-- Check Adam's role
SELECT 
    'Role Check' as check_type,
    ur.role,
    u.email
FROM user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email ILIKE '%adam%' OR u.email ILIKE '%panetta%';

-- Check Adam's group permissions
SELECT 
    'Group Permissions Check' as check_type,
    COUNT(ugp.group_id) as group_count,
    STRING_AGG(tg.name, ', ') as accessible_groups,
    u.email
FROM user_group_permissions ugp
JOIN auth.users u ON ugp.user_id = u.id
JOIN tank_groups tg ON ugp.group_id = tg.id
WHERE u.email ILIKE '%adam%' OR u.email ILIKE '%panetta%'
GROUP BY u.email;

-- ============================================================================
-- STEP 5: Alternative - Grant specific access if admin is too broad
-- ============================================================================

-- If you want to grant specific group access instead of admin, uncomment and modify:

/*
DO $$
DECLARE
    adam_user_id UUID;
BEGIN
    -- Find Adam's user ID
    SELECT id INTO adam_user_id 
    FROM auth.users 
    WHERE email ILIKE '%adam%' OR email ILIKE '%panetta%'
    LIMIT 1;
    
    -- Grant specific role (modify as needed)
    INSERT INTO user_roles (user_id, role)
    VALUES (adam_user_id, 'swan_transit')  -- or 'gsfs_depots', 'kalgoorlie'
    ON CONFLICT (user_id) DO UPDATE SET role = 'swan_transit';
    
    -- Grant access to specific groups (modify group names as needed)
    INSERT INTO user_group_permissions (user_id, group_id)
    SELECT adam_user_id, tg.id
    FROM tank_groups tg
    WHERE tg.name IN ('Swan Transit', 'BGC')  -- modify group names as needed
    ON CONFLICT (user_id, group_id) DO NOTHING;
    
END $$;
*/

-- ============================================================================
-- STEP 6: Status report
-- ============================================================================

SELECT 'Adam Panetta access fix completed' as status;

-- Show final state
SELECT 
    u.email,
    ur.role,
    COUNT(ugp.group_id) as group_count
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN user_group_permissions ugp ON u.id = ugp.user_id
WHERE u.email ILIKE '%adam%' OR u.email ILIKE '%panetta%'
GROUP BY u.email, ur.role; 