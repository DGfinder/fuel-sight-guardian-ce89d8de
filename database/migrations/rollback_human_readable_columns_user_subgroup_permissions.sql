-- ============================================================================
-- ROLLBACK: Remove human-readable columns from user_subgroup_permissions table
-- ============================================================================
-- Purpose: Safely remove the human-readable columns if needed
-- Safety: Only removes the new columns, preserves original data integrity
-- ============================================================================

\echo '=== ROLLBACK SCRIPT FOR user_subgroup_permissions HUMAN-READABLE COLUMNS ==='

-- Show current table structure before rollback
\echo 'Current table structure (before rollback):'
\d user_subgroup_permissions

-- ============================================================================
-- STEP 1: Remove triggers and functions
-- ============================================================================

\echo '=== STEP 1: Removing triggers and functions ==='

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_update_user_subgroup_permissions_readable ON user_subgroup_permissions;
\echo 'Trigger removed: trigger_update_user_subgroup_permissions_readable'

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_user_subgroup_permissions_readable_data();
\echo 'Function removed: update_user_subgroup_permissions_readable_data()'

-- Drop the population function
DROP FUNCTION IF EXISTS populate_user_subgroup_permissions_readable_data();
\echo 'Function removed: populate_user_subgroup_permissions_readable_data()'

-- ============================================================================
-- STEP 2: Remove indexes
-- ============================================================================

\echo '=== STEP 2: Removing indexes ==='

DROP INDEX IF EXISTS idx_user_subgroup_permissions_user_email;
\echo 'Index removed: idx_user_subgroup_permissions_user_email'

DROP INDEX IF EXISTS idx_user_subgroup_permissions_group_name;
\echo 'Index removed: idx_user_subgroup_permissions_group_name'

DROP INDEX IF EXISTS idx_user_subgroup_permissions_subgroup_name;
\echo 'Index removed: idx_user_subgroup_permissions_subgroup_name'

-- ============================================================================
-- STEP 3: Remove the human-readable columns
-- ============================================================================

\echo '=== STEP 3: Removing human-readable columns ==='

-- Remove the new columns (this is safe as original data is preserved)
-- Note: We don't remove subgroup_name as it was already in the original table
ALTER TABLE user_subgroup_permissions 
DROP COLUMN IF EXISTS user_email,
DROP COLUMN IF EXISTS user_name,
DROP COLUMN IF EXISTS group_name,
DROP COLUMN IF EXISTS last_updated;

\echo 'Columns removed: user_email, user_name, group_name, last_updated'
\echo 'Note: subgroup_name was preserved (it was part of the original table)'

-- ============================================================================
-- STEP 4: Verification
-- ============================================================================

\echo '=== STEP 4: Verification ==='

-- Show final table structure
\echo 'Table structure after rollback:'
\d user_subgroup_permissions

-- Verify original data integrity
SELECT 
    COUNT(*) as total_records,
    COUNT(user_id) as user_id_count,
    COUNT(group_id) as group_id_count,
    COUNT(subgroup_name) as subgroup_name_count,
    COUNT(created_at) as created_at_count
FROM user_subgroup_permissions;

\echo '=== ROLLBACK COMPLETED SUCCESSFULLY ==='
\echo 'The user_subgroup_permissions table has been restored to its original structure.'
\echo 'All original data (UUIDs and relationships) has been preserved.'
\echo 'The table now contains only original columns:'
\echo '- id (primary key)'
\echo '- user_id (UUID reference to auth.users)'
\echo '- group_id (UUID reference to tank_groups)'
\echo '- subgroup_name (text - this was always human-readable)'
\echo '- created_at (timestamp)'