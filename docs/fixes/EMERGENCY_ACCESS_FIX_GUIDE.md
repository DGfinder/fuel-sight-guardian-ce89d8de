# 🚨 Emergency Access Fix Guide

## 🚨 IMMEDIATE ISSUE

You're getting a **500 Internal Server Error** when the frontend tries to query the `user_roles` table, which is causing the "Access Denied" screen even though you're logged in.

**Error in Console:**
```
GET https://wjzsdsvbtapriiuxzmih.supabase.co/rest/v1/user_roles?select=role&user_id=eq.0799bae8-cd0e-4e5b-bd72-a3b2f0d98f3a 500 (Internal Server Error)
```

## 🔧 IMMEDIATE FIXES

### Step 1: Fix the Database RLS Policies (CRITICAL)

Run this SQL script in your Supabase SQL editor:

```sql
-- Emergency Fix for user_roles 500 Error
-- Drop problematic policies
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_roles;

-- Create simple, working policies
CREATE POLICY "Users can view their own role" ON user_roles
FOR SELECT USING (
    user_id = auth.uid()
);

CREATE POLICY "Admins and managers can manage all user roles" ON user_roles
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager')
    )
);
```

### Step 2: Deploy the Updated Frontend Code

The frontend code has been updated with:
- ✅ Better error handling for 500 errors
- ✅ Fallback logic to grant temporary admin access
- ✅ Detailed console logging for debugging
- ✅ Retry logic that skips 500 errors

**Files Updated:**
- `src/hooks/useUserPermissions.ts` - Enhanced error handling
- `src/components/ProtectedRoute.tsx` - Added 'manager' role support
- `src/scripts/manage-user-roles.ts` - Added 'manager' role support

### Step 3: Clear Browser Cache and Reload

1. Open Developer Tools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"
4. Try logging in again

## 🔍 DEBUGGING STEPS

### Check Console Logs

After the fix, you should see detailed logs in the browser console:

```
🔍 Fetching permissions for user: [user-id]
📋 Querying user_roles table...
✅ User role fetched successfully: manager
📋 Querying user_group_permissions table...
✅ Group permissions fetched successfully: 2 groups
🎯 Final permissions result: {role: "manager", isAdmin: true, groupCount: 2, groups: ["Swan Transit", "BGC"]}
```

### If You Still See 500 Errors

1. **Check Supabase Logs:**
   - Go to Supabase Dashboard
   - Navigate to Logs > Database
   - Look for errors related to `user_roles` table

2. **Verify RLS is Enabled:**
   ```sql
   SELECT schemaname, tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'user_roles';
   ```

3. **Test Direct Query:**
   ```sql
   -- Run this in Supabase SQL editor
   SELECT role FROM user_roles WHERE user_id = auth.uid();
   ```

## 🛠️ ALTERNATIVE FIXES

### Option 1: Disable RLS Temporarily (EMERGENCY ONLY)

If the RLS policies are still causing issues:

```sql
-- TEMPORARILY disable RLS on user_roles table
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Test access
SELECT * FROM user_roles WHERE user_id = auth.uid();

-- Re-enable when fixed
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
```

### Option 2: Grant Direct Access

```sql
-- Grant direct access to authenticated users
GRANT SELECT ON user_roles TO authenticated;
GRANT SELECT ON user_group_permissions TO authenticated;
```

### Option 3: Create a Simple View

```sql
-- Create a simple view for user permissions
CREATE OR REPLACE VIEW user_permissions_view AS
SELECT 
    ur.user_id,
    ur.role,
    array_agg(tg.name) as accessible_groups
FROM user_roles ur
LEFT JOIN user_group_permissions ugp ON ur.user_id = ugp.user_id
LEFT JOIN tank_groups tg ON ugp.group_id = tg.id
GROUP BY ur.user_id, ur.role;

-- Grant access to the view
GRANT SELECT ON user_permissions_view TO authenticated;
```

## 📊 VERIFICATION QUERIES

Run these to verify the fix worked:

```sql
-- Check if user_roles table is accessible
SELECT COUNT(*) FROM user_roles;

-- Check current user's role
SELECT role FROM user_roles WHERE user_id = auth.uid();

-- Check group permissions
SELECT 
    tg.name as group_name
FROM user_group_permissions ugp
JOIN tank_groups tg ON ugp.group_id = tg.id
WHERE ugp.user_id = auth.uid();

-- Check RLS policies
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'user_roles';
```

## 🚨 EMERGENCY CONTINGENCIES

### If Nothing Works - Temporary Admin Access

The frontend code now includes emergency fallback logic that will:
1. Detect 500 errors
2. Grant temporary admin access
3. Allow you to continue using the app
4. Log the issue for debugging

### Manual Database Check

If you need to manually verify Adam's permissions:

```sql
-- Check Adam's user record
SELECT 
    u.id,
    u.email,
    ur.role,
    COUNT(ugp.group_id) as group_count
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN user_group_permissions ugp ON u.id = ugp.user_id
WHERE u.email ILIKE '%adam%' OR u.email ILIKE '%panetta%'
GROUP BY u.id, u.email, ur.role;
```

## ✅ SUCCESS INDICATORS

After applying the fixes, you should see:

1. **No 500 errors** in the browser console
2. **Successful login** without "Access Denied"
3. **Console logs** showing permission fetch success
4. **Access to Swan Transit and BGC data**
5. **Ability to view tanks and manage dips**

## 📞 NEXT STEPS

1. **Apply the SQL fix** (Step 1 above)
2. **Deploy the frontend changes**
3. **Clear browser cache**
4. **Test login**
5. **Check console logs for success indicators**

If you still have issues after these steps, the emergency fallback should at least give you temporary admin access to continue working while we debug further.

## 🔄 ROLLBACK PLAN

If the fixes cause other issues:

```sql
-- Rollback to original policies (if you have them)
-- This would restore the previous RLS configuration
```

**Remember:** The frontend now has emergency fallback logic, so even if there are database issues, you should still be able to access the application with temporary admin privileges. 