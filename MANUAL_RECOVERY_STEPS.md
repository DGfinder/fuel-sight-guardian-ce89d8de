# Manual Recovery Steps - No MCP Required

Since Supabase MCP may not be working, here are manual steps you can execute directly in your Supabase dashboard.

## 🎯 **Step-by-Step Recovery Process**

### **Step 1: Open Supabase Dashboard**
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Navigate to your project: `fuel-sight-guardian`
3. Go to **SQL Editor** tab

---

### **Step 2: Create Frontend-Compatible View**

**Purpose**: Fix field name mismatches and add missing columns

**Copy and paste this SQL into Supabase SQL Editor:**

```sql
-- Frontend Compatible Database View Fix
-- This creates a view that matches exactly what the frontend expects
-- Fixes field name mismatches and missing columns

SELECT 'CREATING FRONTEND COMPATIBLE VIEW' as step;

DROP VIEW IF EXISTS public.tanks_with_rolling_avg CASCADE;

CREATE VIEW public.tanks_with_rolling_avg AS
SELECT 
  -- CORE TANK IDENTIFICATION (Required fields with correct names)
  t.id,
  COALESCE(t.location, 'Unknown Location') as location,
  COALESCE(t.product_type, 'Diesel') as product_type,  -- Frontend expects 'product_type' not 'product'
  
  -- TANK CAPACITY (Using correct field names)
  COALESCE(t.safe_level, 10000) as safe_level,  -- NOT safe_fill
  COALESCE(t.min_level, 0) as min_level,        -- NOT min_fill
  
  -- GROUP AND ORGANIZATION (Required for RBAC)
  t.group_id,
  COALESCE(tg.name, 'Unknown Group') as group_name,
  COALESCE(t.subgroup, 'No Subgroup') as subgroup,
  
  -- CURRENT LEVEL DATA
  COALESCE((
    SELECT dr.value 
    FROM dip_readings dr 
    WHERE dr.tank_id = t.id 
    ORDER BY dr.created_at DESC 
    LIMIT 1
  ), 0) as current_level,
  
  COALESCE((
    SELECT dr.created_at 
    FROM dip_readings dr 
    WHERE dr.tank_id = t.id 
    ORDER BY dr.created_at DESC 
    LIMIT 1
  ), t.created_at) as last_dip_ts,
  
  COALESCE((
    SELECT dr.recorded_by 
    FROM dip_readings dr 
    WHERE dr.tank_id = t.id 
    ORDER BY dr.created_at DESC 
    LIMIT 1
  ), 'No readings') as last_dip_by,
  
  -- CURRENT LEVEL PERCENTAGE
  CASE
    WHEN COALESCE(t.safe_level, 10000) > COALESCE(t.min_level, 0)
         AND (SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) IS NOT NULL
    THEN GREATEST(0, LEAST(100, ROUND(
      (((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1) - COALESCE(t.min_level, 0)) /
       (COALESCE(t.safe_level, 10000) - COALESCE(t.min_level, 0))) * 100, 1
    )))
    ELSE 0
  END AS current_level_percent,
  
  -- ANALYTICS (Frontend calculates these)
  0 as rolling_avg,           -- Frontend expects 'rolling_avg' not 'rolling_avg_lpd'
  0 as prev_day_used,         
  NULL as days_to_min_level,  
  
  -- CALCULATED FIELDS (Frontend expects these)
  CASE 
    WHEN COALESCE(t.safe_level, 10000) > COALESCE(t.min_level, 0) 
    THEN COALESCE(t.safe_level, 10000) - COALESCE(t.min_level, 0)
    ELSE 0
  END as usable_capacity,
  
  CASE 
    WHEN COALESCE(t.safe_level, 10000) > 0 
    THEN COALESCE(t.safe_level, 10000) - COALESCE((
      SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1
    ), 0)
    ELSE 0
  END as ullage,
  
  -- STRUCTURED LAST DIP (Frontend expects this)
  json_build_object(
    'value', COALESCE((SELECT dr.value FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1), 0),
    'created_at', COALESCE((SELECT dr.created_at FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1), t.created_at),
    'recorded_by', COALESCE((SELECT dr.recorded_by FROM dip_readings dr WHERE dr.tank_id = t.id ORDER BY dr.created_at DESC LIMIT 1), 'System')
  ) as last_dip,
  
  -- ADDITIONAL TANK DETAILS
  t.address,
  t.vehicle,
  t.discharge,
  t.bp_portal,
  t.delivery_window,
  t.afterhours_contact,
  t.notes,
  t.serviced_on,
  t.serviced_by,
  t.latitude,
  t.longitude,
  t.created_at,
  t.updated_at

FROM fuel_tanks t
LEFT JOIN tank_groups tg ON tg.id = t.group_id
WHERE t.archived_at IS NULL;  -- Only show active tanks

-- Grant permissions
GRANT SELECT ON public.tanks_with_rolling_avg TO authenticated;

SELECT 'FRONTEND COMPATIBLE VIEW CREATED SUCCESSFULLY' as status;
```

**Expected Result**: You should see "FRONTEND COMPATIBLE VIEW CREATED SUCCESSFULLY"

---

### **Step 3: Test the View** 

**Copy and paste this SQL to test:**

```sql
-- Test the new view
SELECT 
    'View Test' as test_name,
    COUNT(*) as total_tanks,
    COUNT(CASE WHEN current_level_percent > 0 THEN 1 END) as tanks_with_percentage,
    COUNT(CASE WHEN usable_capacity > 0 THEN 1 END) as tanks_with_capacity
FROM tanks_with_rolling_avg;

-- Test specific tanks
SELECT 
    'Sample Tanks' as test_name,
    location,
    safe_level,    -- Should be 'safe_level' NOT 'safe_fill'
    product_type,  -- Should be 'product_type' NOT 'product'
    current_level,
    current_level_percent,
    usable_capacity,
    ullage,
    subgroup
FROM tanks_with_rolling_avg
WHERE subgroup LIKE '%Narrogin%' OR location LIKE '%Narrogin%'
ORDER BY location
LIMIT 5;
```

**Expected Result**: Should show tanks with proper field names and percentage calculations

---

### **Step 4: Fix RLS Policies (If Needed)**

**Only run this if you're getting permission errors:**

```sql
-- Non-Recursive RLS Policies Fix
SELECT 'CREATING NON-RECURSIVE RLS POLICIES' as step;

-- Clean up existing problematic policies
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Users can view tanks in their assigned groups" ON fuel_tanks;

-- Drop problematic helper functions
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

-- Enable RLS and create simple policies
ALTER TABLE fuel_tanks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fuel_tanks_admin_access" ON fuel_tanks
  FOR ALL USING (is_user_admin());

CREATE POLICY "fuel_tanks_group_access" ON fuel_tanks
  FOR SELECT USING (
    is_user_admin() OR 
    EXISTS (
      SELECT 1 FROM user_group_permissions ugp 
      WHERE ugp.user_id = auth.uid() 
      AND ugp.group_id = fuel_tanks.group_id
    )
  );

-- Grant permissions
GRANT SELECT ON fuel_tanks TO authenticated;
GRANT SELECT ON tanks_with_rolling_avg TO authenticated;

SELECT 'RLS POLICIES CREATED' as status;
```

---

### **Step 5: Verify Everything Works**

**Run this final test:**

```sql
-- Final verification
SELECT 
    'Final Test' as test_name,
    location,
    safe_level,      -- Should show values
    min_level,       -- Should show values  
    product_type,    -- Should be 'Diesel' etc, NOT null
    current_level,   -- Should show fuel levels
    current_level_percent, -- Should show percentages
    usable_capacity, -- Should show calculated capacity
    last_dip->>'value' as last_dip_value,  -- Should show structured data
    CASE 
        WHEN current_level > 0 AND current_level_percent > 0 THEN '✅ WORKING'
        WHEN current_level > 0 THEN '⚠️ Level OK, Percentage Issue'
        ELSE '❌ No Data'
    END as status
FROM tanks_with_rolling_avg
ORDER BY location
LIMIT 10;
```

**Expected Result**: Status should show "✅ WORKING" for tanks with dip readings

---

## 🔍 **Troubleshooting**

### **If tanks show 0% but have fuel levels:**
- Run Step 2 again to recreate the view
- Check that `safe_level` and `min_level` columns have proper values

### **If you get permission errors:**
- Run Step 4 to fix RLS policies
- Or temporarily disable RLS: `ALTER TABLE fuel_tanks DISABLE ROW LEVEL SECURITY;`

### **If frontend still shows empty:**
1. Refresh your browser (Ctrl+F5)
2. Check browser console for debug logs
3. Verify the view was created with correct field names

## ✅ **Success Indicators**

After completing these steps, you should see:
- ✅ Tank data appears in your frontend
- ✅ Percentages calculated correctly
- ✅ No 500 errors in browser console
- ✅ Debug logs showing "Successfully fetched X tanks from view"

## 📞 **Need Help?**

If any step fails, check the browser console logs for detailed error messages. The enhanced frontend logging will show exactly what's happening with data fetching.