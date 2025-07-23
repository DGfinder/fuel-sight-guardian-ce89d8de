# Optional RLS Fix - If You Need Security

## ⚠️ **When to Use This**

**Only run this RLS fix if:**
- You need Row Level Security enabled
- Multiple users need different access permissions  
- You want to restrict data access by user groups

**Skip this if:**
- Your current setup is working fine
- You're the only user accessing the system
- You prefer to handle security at the application level

## 🔧 **RLS Fix SQL** 

If you decide you need RLS, **copy and paste this after the view fix**:

```sql
-- OPTIONAL: Non-Recursive RLS Policies
-- Only run this if you need user-based access control

SELECT 'SETTING UP NON-RECURSIVE RLS POLICIES' as step;

-- Clean up any existing problematic policies
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Users can view tanks in their assigned groups" ON fuel_tanks;

-- Drop problematic helper functions that cause recursion
DROP FUNCTION IF EXISTS is_admin_user();
DROP FUNCTION IF EXISTS is_admin_or_manager_user();
DROP FUNCTION IF EXISTS user_has_tank_access_with_subgroups(UUID);

-- Create simple, non-recursive helper functions
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN (
      'admin@fuelsightguardian.com',
      'hayden@fuelsightguardian.com'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_group_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT ugp.group_id), ARRAY[]::uuid[])
  FROM user_group_permissions ugp
  WHERE ugp.user_id = auth.uid();
$$;

-- Enable RLS on critical tables
ALTER TABLE fuel_tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dip_readings ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
CREATE POLICY "fuel_tanks_admin_access" ON fuel_tanks
  FOR ALL USING (is_user_admin());

CREATE POLICY "fuel_tanks_group_access" ON fuel_tanks
  FOR SELECT USING (
    is_user_admin() OR 
    group_id = ANY(get_user_group_ids())
  );

CREATE POLICY "dip_readings_tank_access" ON dip_readings
  FOR ALL USING (
    is_user_admin() OR 
    EXISTS (
      SELECT 1 FROM fuel_tanks ft 
      WHERE ft.id = dip_readings.tank_id 
      AND ft.group_id = ANY(get_user_group_ids())
    )
  );

-- Grant necessary permissions
GRANT SELECT ON fuel_tanks TO authenticated;
GRANT ALL ON dip_readings TO authenticated;
GRANT SELECT ON tanks_with_rolling_avg TO authenticated;

SELECT 'RLS POLICIES CREATED' as result;
```

## 🧪 **Test RLS (Optional)**

If you implemented RLS, test it:

```sql
-- Test RLS is working
SELECT 
    'RLS Test' as test,
    COUNT(*) as accessible_tanks
FROM fuel_tanks;

-- Should return count based on your user permissions
-- Admin users: All tanks
-- Regular users: Only tanks in their assigned groups
```

## 🎯 **RLS vs No RLS**

### **Without RLS (Current Setup):**
- ✅ **Simpler** - No permission complexity
- ✅ **Faster** - No policy checks on queries
- ✅ **Easier debugging** - No access restrictions
- ⚠️ **Less secure** - All authenticated users see all data

### **With RLS (If You Enable):**  
- ✅ **More secure** - Users only see permitted data
- ✅ **Granular control** - Different access for different users
- ⚠️ **More complex** - Policies need maintenance
- ⚠️ **Potential issues** - Can break if policies are wrong

## 📋 **Recommendation**

**For now, skip the RLS fix.** Your main issue was the empty frontend data, which the view fix resolves.

**Consider RLS later if:**
- You add multiple user types
- You need data isolation between organizations  
- You have security compliance requirements

The view fix alone should get your system working properly! 🚀