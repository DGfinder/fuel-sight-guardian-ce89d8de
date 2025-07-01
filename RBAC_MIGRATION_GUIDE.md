# RBAC System Migration Guide

## Overview

This document describes the comprehensive overhaul of the Role-Based Access Control (RBAC) system to fix critical design flaws and improve security, performance, and scalability.

## Problem Statement

### Original Issues
1. **Schema Flaw**: The `user_roles` table incorrectly combined user roles with group access
2. **Security Risk**: UNIQUE constraints were dropped to allow multiple group access, compromising data integrity
3. **Performance Issues**: RLS policies relied on complex functions that could become slow
4. **Maintenance Complexity**: Frontend code was tightly coupled to the flawed schema

## Solution Architecture

### New Schema Design

#### 1. `user_roles` Table (Refactored)
- **Purpose**: Store only the user's primary role
- **Schema**: `user_id` (UUID, PK), `role` (text)
- **Constraints**: UNIQUE on `user_id` (one role per user)
- **Removed**: `group_id` column

#### 2. `user_group_permissions` Table (New)
- **Purpose**: Manage user-group access relationships
- **Schema**: `user_id` (UUID, FK), `group_id` (UUID, FK), `created_at` (timestamp)
- **Constraints**: Composite PK on `(user_id, group_id)`
- **Benefits**: Clean separation of concerns, proper many-to-many relationship

### RLS Policy Improvements

#### Before (Problematic)
```sql
-- Complex function-based policies
CREATE POLICY "Users can view tanks" ON fuel_tanks
FOR SELECT USING (user_has_tank_access(tank_id));
```

#### After (Optimized)
```sql
-- Direct, performant policies
CREATE POLICY "Users can view tanks in their assigned groups" ON fuel_tanks
FOR SELECT USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin'
    OR
    EXISTS (
        SELECT 1 FROM user_group_permissions
        WHERE user_group_permissions.user_id = auth.uid()
        AND user_group_permissions.group_id = fuel_tanks.group_id
    )
);
```

## Migration Process

### Step 1: Database Migration
Run the `rbac_migration.sql` script which performs:

1. **Create new table**: `user_group_permissions`
2. **Migrate data**: Copy user-group relationships from `user_roles`
3. **Refactor user_roles**: Remove `group_id`, ensure one role per user
4. **Update RLS policies**: Replace function-based policies with direct checks
5. **Verify migration**: Confirm data integrity

### Step 2: Frontend Updates
The `useUserPermissions` hook has been refactored to:

1. **Fetch role separately**: Query `user_roles` table for role
2. **Fetch groups separately**: Query `user_group_permissions` table for group access
3. **Maintain compatibility**: Return the same interface to minimize component changes

## Benefits

### Security Improvements
- ✅ **Data Integrity**: Proper constraints prevent duplicate/conflicting permissions
- ✅ **Principle of Least Privilege**: Clear separation between roles and group access
- ✅ **Audit Trail**: `created_at` timestamp for permission tracking

### Performance Improvements
- ✅ **Faster Queries**: Direct RLS policies without function calls
- ✅ **Better Indexing**: Optimized for the new schema structure
- ✅ **Reduced Complexity**: Simpler, more maintainable policies

### Maintainability Improvements
- ✅ **Clean Separation**: Roles and permissions are now independent
- ✅ **Scalable Design**: Easy to add new roles or permission types
- ✅ **Clear Interface**: Frontend code is more readable and maintainable

## Verification

### Database Verification
```sql
-- Check user roles
SELECT user_id, role FROM user_roles;

-- Check group permissions
SELECT user_id, group_id FROM user_group_permissions;

-- Verify no orphaned data
SELECT COUNT(*) FROM user_roles WHERE user_id NOT IN (
    SELECT DISTINCT user_id FROM user_group_permissions
);
```

### Frontend Verification
1. **Login**: Verify users can still log in and access appropriate data
2. **Navigation**: Check that sidebar shows correct groups
3. **Tank Access**: Confirm users can only see tanks in their groups
4. **Admin Functions**: Verify admin users retain full access

## Rollback Plan

If issues arise, the rollback script `rbac_rollback.sql` will:

1. **Restore original schema**: Re-add `group_id` to `user_roles`
2. **Migrate data back**: Copy group permissions back to `user_roles`
3. **Restore original policies**: Re-create function-based RLS policies
4. **Verify rollback**: Confirm system returns to previous state

## Testing Checklist

### Pre-Migration
- [ ] Backup database
- [ ] Test migration on staging environment
- [ ] Verify all user permissions are correctly mapped
- [ ] Confirm admin users retain full access

### Post-Migration
- [ ] Verify user login and authentication
- [ ] Test tank access for different user types
- [ ] Confirm group-based navigation works
- [ ] Test admin functions and permissions
- [ ] Verify dip reading permissions
- [ ] Test alert access and management

### Performance Testing
- [ ] Measure query performance improvements
- [ ] Test with large datasets
- [ ] Verify RLS policy performance
- [ ] Monitor application response times

## Support

If you encounter issues during or after migration:

1. **Check logs**: Review application and database logs
2. **Verify data**: Run verification queries from this guide
3. **Test rollback**: Use rollback script if necessary
4. **Contact team**: Reach out to the development team for assistance

## Future Enhancements

With the new schema, future improvements can include:

- **Role Hierarchy**: Implement role inheritance
- **Permission Granularity**: Add specific permissions (read, write, delete)
- **Temporary Access**: Time-limited group access
- **Audit Logging**: Track permission changes
- **Bulk Operations**: Efficient permission management tools 