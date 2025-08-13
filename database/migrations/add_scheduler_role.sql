-- Migration: Add scheduler role to user_roles table
-- Date: 2025-08-13
-- Description: Adds 'scheduler' role to the existing role constraint in user_roles table

-- Add scheduler role to the existing CHECK constraint
ALTER TABLE user_roles 
DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE user_roles 
ADD CONSTRAINT user_roles_role_check 
CHECK (role IN ('admin', 'manager', 'operator', 'viewer', 'scheduler'));

-- Verify the constraint was added correctly
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'user_roles'::regclass 
AND conname = 'user_roles_role_check';

SELECT 'Scheduler role successfully added to user_roles table' as result;