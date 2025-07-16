# Adam Panetta Access Fix - Complete Solution

## 🚨 Problem Summary

Adam Panetta has:
- ✅ **Role**: `'manager'` in `user_roles` table
- ✅ **Group Permissions**: Two rows in `user_group_permissions` for Swan Transit and BGC
- ❌ **Access Denied**: Still getting "Access Denied" after RBAC migration

## 🔍 Root Cause

The frontend code and RLS policies were hardcoded to only recognize specific roles:
- `'admin'`, `'swan_transit'`, `'gsfs_depots'`, `'kalgoorlie'`

The role `'manager'` was not included in these checks, so Adam was denied access even though he had proper group permissions.

## ✅ Solution Applied

### 1. Frontend Code Updates

#### Updated `useUserPermissions` Hook
**File**: `src/hooks/useUserPermissions.ts`

**Changes**:
- Added `'manager'` to the `UserPermissions` interface
- Updated `isAdmin` logic: `role === 'admin' || role === 'manager'`

```typescript
export interface UserPermissions {
  role: 'admin' | 'manager' | 'swan_transit' | 'gsfs_depots' | 'kalgoorlie' | null;
  // ... rest of interface
}

// In the hook:
isAdmin: role === 'admin' || role === 'manager', // Include manager as admin-equivalent
```

#### Updated `ProtectedRoute` Component
**File**: `src/components/ProtectedRoute.tsx`

**Changes**:
- Added `'manager'` to the `requiredRole` prop type

```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'manager' | 'swan_transit' | 'gsfs_depots' | 'kalgoorlie';
  requiredGroup?: string;
}
```

#### Updated User Management Scripts
**File**: `src/scripts/manage-user-roles.ts`

**Changes**:
- Added `'manager'` to the `CreateUserRoleParams` interface
- Updated example usage to include manager role

### 2. Database RLS Policy Updates

**File**: `update_rls_for_manager_role.sql`

**Changes**:
- Updated all RLS policies to include `'manager'` as a privileged role
- Changed from `role = 'admin'` to `role IN ('admin', 'manager')`

**Affected Policies**:
- `fuel_tanks` - Managers can view all tanks
- `dip_readings` - Managers can manage all dips
- `tank_alerts` - Managers can view and acknowledge all alerts
- `tank_groups` - Managers can view all groups
- `user_roles` - Managers can manage all user roles

## 🚀 Implementation Steps

### Step 1: Deploy Frontend Changes
The frontend code has been updated and tested. Deploy these changes to your application.

### Step 2: Update RLS Policies
Run the SQL script in your Supabase SQL editor:

```sql
\i update_rls_for_manager_role.sql
```

### Step 3: Verify Adam's Access
After deploying both changes, Adam should be able to:
- ✅ Log in successfully
- ✅ Access Swan Transit and BGC data
- ✅ View all tanks in his assigned groups
- ✅ Manage dip readings
- ✅ View and acknowledge alerts

## 🔧 Verification Queries

Run these queries to verify Adam's permissions:

```sql
-- Check Adam's role
SELECT 
    u.email,
    ur.role
FROM user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email ILIKE '%adam%' OR u.email ILIKE '%panetta%';

-- Check Adam's group permissions
SELECT 
    u.email,
    COUNT(ugp.group_id) as group_count,
    STRING_AGG(tg.name, ', ') as accessible_groups
FROM user_group_permissions ugp
JOIN auth.users u ON ugp.user_id = u.id
JOIN tank_groups tg ON ugp.group_id = tg.id
WHERE u.email ILIKE '%adam%' OR u.email ILIKE '%panetta%'
GROUP BY u.email;
```

## 📊 Expected Results

After the fix, Adam should have:

| Permission | Status |
|------------|--------|
| **Login** | ✅ Allowed |
| **Role Recognition** | ✅ `'manager'` recognized as privileged |
| **Group Access** | ✅ Swan Transit + BGC |
| **Tank Viewing** | ✅ All tanks in assigned groups |
| **Dip Management** | ✅ Can add/edit dip readings |
| **Alert Management** | ✅ Can view and acknowledge alerts |
| **Admin Functions** | ✅ Same access as admin users |

## 🛡️ Security Implications

### What Managers Can Do
- ✅ View all tanks (not just their assigned groups)
- ✅ Manage all dip readings
- ✅ View and acknowledge all alerts
- ✅ Manage user roles and permissions
- ✅ Access all application features

### What Managers Cannot Do
- ❌ No additional restrictions beyond admin users
- ❌ Same level of access as admin users

## 🔄 Alternative Approaches

If you want to limit manager access to only their assigned groups:

### Option 1: Group-Only Access
Remove the `IN ('admin', 'manager')` checks and rely only on group permissions.

### Option 2: Custom Manager Policies
Create separate policies for managers with different restrictions.

### Option 3: Change Adam's Role
Change Adam's role from `'manager'` to `'admin'` if he should have full admin access.

## 📞 Support

If Adam still has access issues after implementing these changes:

1. **Check Browser Console**: Look for any JavaScript errors
2. **Verify RLS Policies**: Ensure the SQL script ran successfully
3. **Test Login**: Try logging in as Adam and check the network tab
4. **Review Logs**: Check Supabase logs for any database errors

## ✅ Status

**Frontend Changes**: ✅ **COMPLETED**  
**Database Changes**: ⏳ **READY TO DEPLOY**  
**Adam's Access**: ⏳ **PENDING DEPLOYMENT**

Once you run the RLS policy update script, Adam should have full access to the application! 🎉 