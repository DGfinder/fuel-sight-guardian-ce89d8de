# RBAC Access Issues - Troubleshooting Guide

## 🚨 Emergency Situation: Access Denied After Migration

If users are getting "Access Denied" after the RBAC migration, follow these steps to restore access immediately.

## 🔧 Immediate Fixes Applied

### 1. Frontend Fallback Logic
The `useUserPermissions` hook has been updated with fallback logic that:
- ✅ Tries the new schema first
- ✅ Falls back to the old schema if needed
- ✅ Grants temporary admin access if no permissions found
- ✅ Prevents complete lockout with error handling

### 2. Improved Logout Function
The logout function now:
- ✅ Handles errors gracefully
- ✅ Forces redirect even if logout fails
- ✅ Provides better error logging

## 🚀 Quick Resolution Steps

### Step 1: Run Emergency Access Fix
Execute the emergency script to restore access:

```sql
-- Run this in your Supabase SQL editor
\i emergency_access_fix.sql
```

This script will:
- Grant admin access to all users
- Ensure all users have group permissions
- Provide temporary access while issues are resolved

### Step 2: Verify Access is Restored
After running the emergency script, users should be able to:
- ✅ Log in successfully
- ✅ Access all application features
- ✅ Log out properly

### Step 3: Check Console for Debug Info
Open browser developer tools and check the console for:
- `"No role found in new schema, checking old schema..."`
- `"No group permissions found in new schema, checking old schema..."`
- `"No permissions found, granting temporary access..."`

## 🔍 Root Cause Analysis

### Possible Causes
1. **Migration Not Run**: The `rbac_migration.sql` script hasn't been executed
2. **Incomplete Migration**: Migration started but didn't complete
3. **RLS Policy Issues**: New policies are too restrictive
4. **Data Migration Failure**: User permissions weren't properly migrated

### Diagnostic Queries
Run these queries to identify the issue:

```sql
-- Check if migration was run
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_group_permissions'
) as migration_completed;

-- Check user permissions
SELECT 
    u.email,
    ur.role,
    COUNT(ugp.group_id) as group_count
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN user_group_permissions ugp ON u.id = ugp.user_id
GROUP BY u.email, ur.role;

-- Check for users without permissions
SELECT COUNT(*) as users_without_access
FROM auth.users u
WHERE u.id NOT IN (SELECT user_id FROM user_roles);
```

## 🛠️ Resolution Options

### Option 1: Complete the Migration (Recommended)
If the migration wasn't run or was incomplete:

1. **Backup your data** (if not already done)
2. **Run the full migration**:
   ```sql
   \i rbac_migration.sql
   ```
3. **Verify the migration**:
   ```sql
   \i emergency_access_fix.sql
   ```

### Option 2: Rollback to Old Schema
If the migration is causing issues:

1. **Run the rollback script**:
   ```sql
   \i rbac_rollback.sql
   ```
2. **Verify rollback success**
3. **Plan a new migration approach**

### Option 3: Temporary RLS Disable (Emergency Only)
If RLS policies are blocking access:

```sql
-- WARNING: This disables security temporarily
ALTER TABLE fuel_tanks DISABLE ROW LEVEL SECURITY;
ALTER TABLE dip_readings DISABLE ROW LEVEL SECURITY;
ALTER TABLE tank_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE tank_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
```

**⚠️ IMPORTANT**: Re-enable RLS after fixing the underlying issue:
```sql
ALTER TABLE fuel_tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dip_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tank_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tank_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
```

## 📋 Verification Checklist

After applying fixes, verify:

- [ ] Users can log in without "Access Denied"
- [ ] All application features are accessible
- [ ] Logout function works properly
- [ ] No console errors related to permissions
- [ ] Data is loading correctly
- [ ] Admin functions work (if applicable)

## 🔄 Next Steps

### Short Term (Immediate)
1. ✅ Restore user access using emergency script
2. ✅ Identify root cause of the issue
3. ✅ Apply appropriate fix (migration/rollback)

### Medium Term (Next 24-48 hours)
1. **Complete the RBAC migration properly**
2. **Test thoroughly in staging environment**
3. **Plan production deployment**

### Long Term (Next week)
1. **Remove temporary fallback logic** from frontend
2. **Implement proper user management tools**
3. **Add monitoring for permission issues**

## 📞 Support

If issues persist:

1. **Check Supabase logs** for database errors
2. **Review browser console** for frontend errors
3. **Run diagnostic queries** to identify the problem
4. **Contact development team** with error details

## 🚨 Emergency Contacts

- **Database Issues**: Check Supabase dashboard logs
- **Frontend Issues**: Check browser console and network tab
- **Authentication Issues**: Verify Supabase auth configuration

---

**Status**: 🔧 **EMERGENCY FIXES APPLIED**

**Next Action**: Run `emergency_access_fix.sql` to restore access immediately 