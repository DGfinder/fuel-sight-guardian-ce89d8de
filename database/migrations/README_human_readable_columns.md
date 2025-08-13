# Human-Readable Columns Migration

## Overview

This migration adds human-readable text columns to the permissions tables to make them easier to understand and debug. Instead of seeing only UUIDs, you'll now see actual user emails, names, and group names.

## Problem Solved

**Before**: Tables looked like this (confusing UUIDs)
```
user_id                              | group_id                             | created_at
f47ac10b-58cc-4372-a567-0e02b2c3d479 | 6ba7b810-9dad-11d1-80b4-00c04fd430c8 | 2024-01-01 10:00:00
```

**After**: Tables now also show human-readable data
```
user_id    | user_email        | user_name    | group_id   | group_name | created_at
f47ac...   | john@company.com  | John Smith   | 6ba7b8...  | Perth Depot| 2024-01-01 10:00:00
```

## Files Included

### Main Migration Scripts
- `add_human_readable_columns_to_user_group_permissions.sql` - Main migration for user_group_permissions table
- `add_human_readable_columns_to_user_subgroup_permissions.sql` - Migration for user_subgroup_permissions table

### Rollback Scripts (Safety)
- `rollback_human_readable_columns_user_group_permissions.sql` - Removes changes to user_group_permissions
- `rollback_human_readable_columns_user_subgroup_permissions.sql` - Removes changes to user_subgroup_permissions

## What's Added

### For `user_group_permissions` table:
- `user_email` - Email address from auth.users
- `user_name` - Full name from profiles table (falls back to email)
- `group_name` - Group name from tank_groups table
- `last_updated` - Timestamp when readable data was last updated

### For `user_subgroup_permissions` table:
- `user_email` - Email address from auth.users
- `user_name` - Full name from profiles table (falls back to email) 
- `group_name` - Group name from tank_groups table
- `last_updated` - Timestamp when readable data was last updated
- Note: `subgroup_name` was already human-readable (text, not UUID)

## Safety Features

✅ **Non-breaking**: New columns are nullable initially
✅ **Rollback ready**: Complete rollback scripts provided
✅ **Data integrity**: Original UUID relationships preserved
✅ **Performance**: Indexes added for new text columns
✅ **Automatic**: Triggers maintain data when UUIDs change

## How to Run

### Apply the Migration

```bash
# Connect to your database and run:
psql -f add_human_readable_columns_to_user_group_permissions.sql
psql -f add_human_readable_columns_to_user_subgroup_permissions.sql
```

### Test the Results

```sql
-- Check user_group_permissions table
SELECT user_email, user_name, group_name, created_at 
FROM user_group_permissions 
LIMIT 10;

-- Check user_subgroup_permissions table  
SELECT user_email, user_name, group_name, subgroup_name, created_at
FROM user_subgroup_permissions 
LIMIT 10;
```

### Rollback if Needed

```bash
# If you need to undo the changes:
psql -f rollback_human_readable_columns_user_group_permissions.sql
psql -f rollback_human_readable_columns_user_subgroup_permissions.sql
```

## Technical Details

### Automatic Data Population
- **Triggers**: Automatically populate readable data for new records
- **Functions**: Manually refresh data if needed
- **Fallbacks**: Handle missing data gracefully (unknown@example.com, Unknown User, etc.)

### Data Sources
- `user_email`: From `auth.users.email`
- `user_name`: From `profiles.full_name` (fallback to email)
- `group_name`: From `tank_groups.name`

### Performance Considerations
- Indexes added on new text columns for fast searches
- Triggers add minimal overhead (only on INSERT/UPDATE)
- Original UUID-based queries remain unchanged and fast

## Use Cases

### For Admins
```sql
-- See all permissions in human-readable format
SELECT user_name, user_email, group_name 
FROM user_group_permissions 
ORDER BY user_name;
```

### For Debugging
```sql
-- Find permissions for a specific user
SELECT * FROM user_group_permissions 
WHERE user_email = 'john.doe@company.com';

-- Find all users with access to a specific group
SELECT user_name, user_email 
FROM user_group_permissions 
WHERE group_name = 'Perth Depot';
```

### For Reports
```sql
-- Generate permission report
SELECT 
    group_name,
    COUNT(*) as user_count,
    STRING_AGG(user_name, ', ') as users
FROM user_group_permissions 
GROUP BY group_name
ORDER BY user_count DESC;
```

## Maintenance

The human-readable columns are automatically maintained by triggers, but you can manually refresh them if needed:

```sql
-- Refresh all readable data in user_group_permissions
SELECT populate_user_group_permissions_readable_data();

-- Refresh all readable data in user_subgroup_permissions  
SELECT populate_user_subgroup_permissions_readable_data();
```

## Notes

- Original UUID columns are never modified or removed
- All existing functionality continues to work unchanged
- New columns make the tables much more human-friendly for debugging and administration
- This is a purely additive change - it only makes things better, not different