-- ============================================================================
-- ADD HUMAN-READABLE COLUMNS TO user_subgroup_permissions TABLE
-- ============================================================================
-- Purpose: Add human-readable text columns to make the table less confusing
-- Safety: Non-breaking changes with rollback capability
-- Note: This table uses subgroup_name (text) not subgroup_id (UUID)
-- ============================================================================

-- Show current table structure before migration
\echo '=== BEFORE MIGRATION ==='
\echo 'Current user_subgroup_permissions table structure:'
\d user_subgroup_permissions

-- ============================================================================
-- PHASE 1: Add new human-readable columns (nullable, safe)
-- ============================================================================

\echo '=== PHASE 1: Adding new columns ==='

-- Add user identification columns
ALTER TABLE user_subgroup_permissions 
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS group_name TEXT;
-- Note: subgroup_name is already human-readable text, no need for subgroup_readable

-- Add helpful metadata
ALTER TABLE user_subgroup_permissions 
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW();

\echo 'New columns added successfully!'

-- ============================================================================
-- PHASE 2: Create function to populate human-readable data
-- ============================================================================

\echo '=== PHASE 2: Creating population function ==='

CREATE OR REPLACE FUNCTION populate_user_subgroup_permissions_readable_data()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    -- Update all rows with human-readable data
    UPDATE user_subgroup_permissions 
    SET 
        user_email = COALESCE(au.email, 'unknown@example.com'),
        user_name = COALESCE(p.full_name, au.email, 'Unknown User'),
        group_name = COALESCE(tg.name, 'Unknown Group'),
        last_updated = NOW()
    FROM auth.users au
    LEFT JOIN profiles p ON au.id = p.id
    LEFT JOIN tank_groups tg ON user_subgroup_permissions.group_id = tg.id
    WHERE user_subgroup_permissions.user_id = au.id
    AND (
        user_subgroup_permissions.user_email IS NULL OR
        user_subgroup_permissions.user_name IS NULL OR
        user_subgroup_permissions.group_name IS NULL
    );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

\echo 'Population function created successfully!'

-- ============================================================================
-- PHASE 3: Populate existing data
-- ============================================================================

\echo '=== PHASE 3: Populating existing data ==='

-- Execute the population function
DO $$
DECLARE
    updated_rows INTEGER;
BEGIN
    SELECT populate_user_subgroup_permissions_readable_data() INTO updated_rows;
    RAISE NOTICE 'Updated % rows with human-readable data', updated_rows;
END $$;

-- ============================================================================
-- PHASE 4: Create triggers for automatic updates (optional)
-- ============================================================================

\echo '=== PHASE 4: Creating triggers ==='

-- Function to handle updates
CREATE OR REPLACE FUNCTION update_user_subgroup_permissions_readable_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Populate readable data for new/updated records
    SELECT 
        COALESCE(au.email, 'unknown@example.com'),
        COALESCE(p.full_name, au.email, 'Unknown User'),
        COALESCE(tg.name, 'Unknown Group')
    INTO 
        NEW.user_email,
        NEW.user_name, 
        NEW.group_name
    FROM auth.users au
    LEFT JOIN profiles p ON au.id = p.id
    LEFT JOIN tank_groups tg ON NEW.group_id = tg.id
    WHERE au.id = NEW.user_id;
    
    NEW.last_updated = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_update_user_subgroup_permissions_readable ON user_subgroup_permissions;
CREATE TRIGGER trigger_update_user_subgroup_permissions_readable
    BEFORE INSERT OR UPDATE ON user_subgroup_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_subgroup_permissions_readable_data();

\echo 'Triggers created successfully!'

-- ============================================================================
-- PHASE 5: Validation and verification
-- ============================================================================

\echo '=== PHASE 5: Validation ==='

-- Show updated table structure
\echo 'Updated table structure:'
\d user_subgroup_permissions

-- Show sample data with readable columns
\echo 'Sample data with human-readable columns:'
SELECT 
    user_id,
    user_email,
    user_name,
    group_id,
    group_name,
    subgroup_name, -- This was already human-readable
    created_at,
    last_updated
FROM user_subgroup_permissions 
LIMIT 10;

-- Count of records with populated readable data
SELECT 
    COUNT(*) as total_records,
    COUNT(user_email) as records_with_email,
    COUNT(user_name) as records_with_name,
    COUNT(group_name) as records_with_group_name,
    COUNT(subgroup_name) as records_with_subgroup_name
FROM user_subgroup_permissions;

-- ============================================================================
-- PHASE 6: Create indexes for performance (optional)
-- ============================================================================

\echo '=== PHASE 6: Creating indexes ==='

-- Create indexes on the new text columns for faster searches
CREATE INDEX IF NOT EXISTS idx_user_subgroup_permissions_user_email 
ON user_subgroup_permissions(user_email);

CREATE INDEX IF NOT EXISTS idx_user_subgroup_permissions_group_name 
ON user_subgroup_permissions(group_name);

-- Index on subgroup_name for better performance (it's already human-readable)
CREATE INDEX IF NOT EXISTS idx_user_subgroup_permissions_subgroup_name 
ON user_subgroup_permissions(subgroup_name);

\echo 'Indexes created successfully!'

\echo '=== MIGRATION COMPLETED SUCCESSFULLY ==='
\echo 'The user_subgroup_permissions table now has human-readable columns:'
\echo '- user_email: Shows the user email instead of UUID'
\echo '- user_name: Shows the full name or email as fallback'
\echo '- group_name: Shows the group name instead of UUID'
\echo '- subgroup_name: Already human-readable (was not changed)'
\echo '- last_updated: Tracks when readable data was last updated'
\echo ''
\echo 'These columns are automatically maintained by triggers.'
\echo 'Original UUID columns are preserved for data integrity.'