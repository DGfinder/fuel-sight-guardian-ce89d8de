# Subgroup Permissions System Guide

## Overview

This guide explains how to implement and use the new subgroup permissions system in Fuel Sight Guardian. The system allows you to grant users access to specific subgroups within a group, rather than the entire group.

## Problem Solved

**Before**: Users could only be granted access to entire groups (e.g., all of "GSF Depots")
**After**: Users can be granted access to specific subgroups (e.g., only "Narrogin" within "GSF Depots")

## Implementation Steps

### Step 1: Run the Database Migration

Execute the `subgroup_permissions_migration.sql` script on your database:

```sql
-- Run this script to add subgroup permissions to your database
-- This will create the new table and update RLS policies
```

### Step 2: Verify Migration

Check that the migration was successful:

```sql
-- Check that the new table exists
SELECT count(*) FROM user_subgroup_permissions;

-- Check that the new functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('user_has_tank_access_with_subgroups', 'get_user_accessible_subgroups');
```

## Usage Examples

### 1. Grant GSFS Narrogin-Only Access

To grant a user access only to the "GSFS Narrogin" subgroup in "GSF Depots":

```typescript
import { updateUserSubgroupPermissions } from './src/scripts/manage-user-roles';

await updateUserSubgroupPermissions(
  userId,
  'manager', // User role
  [
    {
      groupName: 'GSF Depots',
      subgroups: ['GSFS Narrogin'] // Only GSFS Narrogin subgroup
    }
  ]
);
```

### 2. Grant Multiple Subgroup Access

To grant access to multiple subgroups:

```typescript
await updateUserSubgroupPermissions(
  userId,
  'manager',
  [
    {
      groupName: 'GSF Depots',
      subgroups: ['GSFS Narrogin', 'GSFS Kalgoorlie'] // Multiple subgroups
    }
  ]
);
```

### 3. Assign Different Managers to Different Subgroups

To assign different managers to their respective subgroups:

```typescript
// Manager 1: Only GSFS Narrogin
await updateUserSubgroupPermissions(
  narroginManagerId,
  'manager',
  [{ groupName: 'GSF Depots', subgroups: ['GSFS Narrogin'] }]
);

// Manager 2: Only GSFS Kalgoorlie  
await updateUserSubgroupPermissions(
  kalgoorlieManagerId,
  'manager',
  [{ groupName: 'GSF Depots', subgroups: ['GSFS Kalgoorlie'] }]
);

// Manager 3: Only GSFS Geraldton
await updateUserSubgroupPermissions(
  geraldtonManagerId,
  'manager',
  [{ groupName: 'GSF Depots', subgroups: ['GSFS Geraldton'] }]
);
```

### 4. Upgrade to Full Group Access

To upgrade a user from subgroup access to full group access:

```typescript
import { updateUserRoles } from './src/scripts/manage-user-roles';

await updateUserRoles(
  userId,
  'manager',
  ['GSF Depots'] // Full access to entire group
);
```

### 5. Check User Permissions

To see what permissions a user currently has:

```typescript
import { getUserRoles } from './src/scripts/manage-user-roles';

const permissions = await getUserRoles(userId);
console.log('Role:', permissions.role);
console.log('Full group access:', permissions.groups.map(g => g.name));
console.log('Subgroup access:', permissions.subgroups.map(s => `${s.group.name} > ${s.subgroup}`));
```

## Database Schema

### New Table: `user_subgroup_permissions`

```sql
CREATE TABLE user_subgroup_permissions (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES tank_groups(id) ON DELETE CASCADE,
    subgroup_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, group_id, subgroup_name)
);
```

### New Functions

1. **`user_has_tank_access_with_subgroups(tank_id UUID)`**: Checks if a user has access to a specific tank
2. **`get_user_accessible_subgroups(target_group_id UUID)`**: Returns subgroups a user can access within a group

### New View: `user_all_permissions`

Unified view showing both group and subgroup permissions:

```sql
SELECT * FROM user_all_permissions WHERE user_id = 'USER_ID';
```

## How It Works

### Permission Hierarchy

1. **Admin/Manager**: Full access to everything
2. **Full Group Access**: User can see all tanks in the group
3. **Subgroup Access**: User can only see tanks in specific subgroups

### Permission Logic

When checking tank access, the system:
1. First checks if user is admin/manager → Full access
2. Then checks if user has full group access → Access granted
3. Finally checks if user has subgroup access → Access granted only if tank is in allowed subgroup

### Frontend Integration

The `useUserPermissions` hook automatically handles both group and subgroup permissions:

```typescript
const { data: permissions } = useUserPermissions();

// permissions.accessibleGroups now includes:
// - Groups with full access (no subgroups property)
// - Groups with subgroup access (includes subgroups array)
```

## Real-World Scenario

### Your Use Case: GSFS Narrogin Manager

1. **Current State**: Manager has full access to "GSF Depots" group
2. **Desired State**: Manager can only see "GSFS Narrogin" subgroup

**Solution**:
```typescript
// Remove current group permission and add subgroup permission
await updateUserSubgroupPermissions(
  managerId,
  'manager',
  [
    {
      groupName: 'GSF Depots',
      subgroups: ['GSFS Narrogin']
    }
  ]
);
```

**Result**: 
- User can only see tanks where `group_name = 'GSF Depots'` AND `subgroup = 'GSFS Narrogin'`
- All other GSF Depots subgroups are hidden
- User experience remains the same, just with filtered data

## Safety Features

### Backward Compatibility

- Existing group permissions continue to work unchanged
- No data migration required for existing users
- All existing functionality preserved

### Multiple Permission Types

A user can have:
- Full access to some groups
- Subgroup access to other groups
- Mix of both types

### Rollback Plan

If issues arise, you can:
1. Remove all subgroup permissions
2. Restore group permissions
3. Drop the new table and functions

## Testing

### Manual Testing

1. **Create test user** with subgroup permissions
2. **Login as test user** and verify they only see correct tanks
3. **Test all features**: dip entry, alerts, reporting
4. **Verify security**: User cannot access other subgroups

### Automated Testing

```typescript
// Test that subgroup permissions work correctly
const { tanks } = await useTanks();
const narroginTanks = tanks.filter(t => t.subgroup === 'Narrogin');
expect(tanks).toEqual(narroginTanks); // Should only see Narrogin tanks
```

## Security Considerations

### Database Level Security

- Row Level Security (RLS) enforced at database level
- Direct database access respects permissions
- No way to bypass frontend restrictions

### Frontend Security

- All queries automatically filtered
- UI components hide inaccessible options
- Error handling for permission violations

## Performance Impact

### Database Performance

- New queries include additional JOIN operations
- Minimal impact due to proper indexing
- RLS policies optimized for performance

### Frontend Performance

- No significant impact on React app
- Permissions cached for 5 minutes
- Real-time updates work normally

## Troubleshooting

### Common Issues

1. **User sees no tanks**: Check if subgroup names match exactly
2. **Permission denied errors**: Verify user has correct role
3. **Frontend not updating**: Clear cache and refresh

### Debug Queries

```sql
-- Check user's current permissions
SELECT * FROM user_all_permissions WHERE user_id = 'USER_ID';

-- Check what subgroups exist for a group
SELECT DISTINCT subgroup FROM fuel_tanks WHERE group_id = 'GROUP_ID';

-- Test tank access for a user
SELECT user_has_tank_access_with_subgroups('TANK_ID');
```

## Best Practices

### User Management

1. **Be explicit**: Always specify exact subgroup names
2. **Test thoroughly**: Verify permissions before going live
3. **Document changes**: Keep track of who has what access
4. **Regular audits**: Review permissions periodically

### System Administration

1. **Backup first**: Always backup before making permission changes
2. **Test in staging**: Verify changes work before production
3. **Monitor logs**: Watch for permission-related errors
4. **Plan rollback**: Have a rollback plan ready

## Migration for Your Specific Case

### Step-by-Step for Your Manager

1. **Identify the user**: Find the manager's user ID
2. **Check current permissions**: Verify they have GSF Depots access
3. **Apply subgroup permissions**: Grant only Narrogin access
4. **Test access**: Verify they can only see Narrogin tanks
5. **Monitor**: Watch for any issues

### SQL Commands

```sql
-- 1. Find user ID
SELECT id FROM auth.users WHERE email = 'manager@example.com';

-- 2. Check current permissions
SELECT * FROM user_all_permissions WHERE user_id = 'USER_ID';

-- 3. Apply subgroup permissions (use TypeScript function)
-- See usage examples above

-- 4. Verify new permissions
SELECT * FROM user_all_permissions WHERE user_id = 'USER_ID';
```

## Conclusion

The subgroup permissions system provides fine-grained access control while maintaining:
- **Security**: Database-level enforcement
- **Performance**: Minimal impact on system performance
- **Usability**: No change to user experience
- **Flexibility**: Mix of group and subgroup permissions
- **Safety**: Backward compatibility and rollback options

This system solves your specific need to restrict a manager to only the Narrogin subgroup while keeping the door open for future granular permission requirements. 