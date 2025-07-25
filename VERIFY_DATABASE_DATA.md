# Database Data Verification - Quick Check

## 🔍 **Quick Test Queries**

Since you're still seeing loading animation, run these queries in **Supabase SQL Editor** to verify the data:

### **Test 1: Check if view exists and has data**
```sql
SELECT 
    'View Data Check' as test,
    COUNT(*) as total_tanks,
    COUNT(CASE WHEN current_level_percent > 0 THEN 1 END) as tanks_with_percentage,
    COUNT(CASE WHEN location IS NOT NULL THEN 1 END) as tanks_with_location
FROM tanks_with_rolling_avg;
```

**Expected Result:**
- `total_tanks`: Should be > 0 (like 200+ tanks)
- `tanks_with_percentage`: Should be > 0 
- `tanks_with_location`: Should equal total_tanks

**If you get 0 tanks:** The view creation failed or is empty

### **Test 2: Check specific GSFS Narrogin tanks**
```sql
SELECT 
    'GSFS Narrogin Check' as test,
    location,
    safe_level,
    current_level,
    current_level_percent,
    product_type,
    subgroup
FROM tanks_with_rolling_avg
WHERE subgroup LIKE '%Narrogin%' 
   OR location LIKE '%Narrogin%'
ORDER BY location
LIMIT 5;
```

**Expected Result:**
- Should show several Narrogin tanks
- `current_level_percent` should be > 0 (not all zeros)
- `safe_level` should show values like 10000, 5000 etc
- `product_type` should show 'Diesel' or similar

### **Test 3: Check field names match frontend expectations**
```sql
-- This should NOT return an error
SELECT 
    location,
    safe_level,        -- NOT safe_fill
    product_type,      -- NOT product  
    current_level_percent,
    usable_capacity,   -- Should exist
    ullage            -- Should exist
FROM tanks_with_rolling_avg
LIMIT 1;
```

**If this errors:** Field names don't match what frontend expects

### **Test 4: Raw fuel_tanks table check**
```sql
SELECT 
    'Base Table Check' as test,
    location,
    safe_level,
    product_type,
    subgroup
FROM fuel_tanks
WHERE subgroup LIKE '%Narrogin%'
LIMIT 3;
```

**This should always work** - if it doesn't, there's a fundamental database issue.

## 🚨 **Common Issues & Solutions**

### **Issue 1: View returns 0 rows**
**Cause:** View creation failed or WHERE clause too restrictive
**Fix:** Recreate the view from `EXECUTE_FIXES_NOW.md`

### **Issue 2: All percentages are 0**
**Cause:** No dip readings data or calculation error
**Fix:** 
```sql
-- Check if dip readings exist
SELECT COUNT(*) as dip_count FROM dip_readings;
-- Should be > 0
```

### **Issue 3: Field names wrong**
**Cause:** View created with wrong field aliases
**Fix:** Drop and recreate view with correct field names

### **Issue 4: RLS blocking data**
**Cause:** Row Level Security preventing data access
**Fix:**
```sql
-- Temporarily disable RLS to test
ALTER TABLE fuel_tanks DISABLE ROW LEVEL SECURITY;
-- Test again, then re-enable if needed
```

## 🎯 **What to Report Back**

After running these tests, let me know:

1. **How many tanks** does Test 1 show?
2. **Do GSFS Narrogin tanks appear** in Test 2?
3. **What percentages** do you see (0% or realistic values)?
4. **Any SQL errors** from the tests?

This will tell us exactly what's wrong with the data flow! 🔍