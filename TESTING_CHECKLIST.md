# Testing Checklist - Manual Verification

Use this checklist to verify that all fixes are working correctly.

## 📋 **Pre-Testing Setup**

- [ ] **Database fixes applied** - Ran SQL scripts from `MANUAL_RECOVERY_STEPS.md`
- [ ] **Frontend updated** - Latest code pulled with enhanced `useTanks` hook
- [ ] **Browser cache cleared** - Hard refresh (Ctrl+F5) or clear cache
- [ ] **Developer tools open** - F12 → Console tab (to see debug logs)

---

## 🔍 **Database Verification**

### **Step 1: Verify View Structure**
Run in Supabase SQL Editor:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tanks_with_rolling_avg' 
ORDER BY column_name;
```

**✅ Expected Results:**
- [ ] `safe_level` column exists (NOT `safe_fill`)
- [ ] `product_type` column exists (NOT `product`)
- [ ] `usable_capacity` column exists
- [ ] `ullage` column exists
- [ ] `last_dip` column exists (JSON type)

### **Step 2: Verify Data Quality**
```sql
SELECT 
    location,
    safe_level,
    current_level,
    current_level_percent,
    usable_capacity,
    product_type
FROM tanks_with_rolling_avg 
WHERE current_level > 0
LIMIT 5;
```

**✅ Expected Results:**
- [ ] `safe_level` shows numeric values (e.g., 10000, 5000)
- [ ] `current_level` shows fuel levels (e.g., 3500, 7200)
- [ ] `current_level_percent` shows reasonable percentages (0-100)
- [ ] `product_type` shows 'Diesel' or other fuel types
- [ ] `usable_capacity` shows positive numbers

---

## 🖥️ **Frontend Verification**

### **Step 3: Check Debug Logs**
1. Open your application in browser
2. Navigate to tanks page
3. Open Developer Tools (F12) → Console

**✅ Expected Debug Logs:**
- [ ] `[TANKS DEBUG] Fetching tanks and calculating analytics...`
- [ ] `[TANKS DEBUG] Using view: tanks_with_rolling_avg`
- [ ] `[TANKS DEBUG] Successfully fetched X tanks from view` (NOT fallback)
- [ ] `[TANKS DEBUG] Sample tank data structure:` with correct field analysis
- [ ] NO `[TANKS DEBUG] View failed with 500 error` messages

### **Step 4: Verify Tank Data Display**
**✅ Expected UI Results:**
- [ ] **Tank cards/table show data** - Not empty/loading states
- [ ] **Tank locations** - Show proper names (e.g., "GSFS Narrogin Depot")
- [ ] **Fuel levels** - Show numeric values with units (e.g., "3,500 L")
- [ ] **Percentages** - Show realistic values (e.g., 35%, 78%)
- [ ] **Safe levels** - Show capacity values (e.g., "10,000 L")
- [ ] **Product types** - Show fuel types (e.g., "Diesel")

### **Step 5: Check Calculated Analytics**
**✅ Expected Analytics:**
- [ ] **Rolling Average** - Shows L/day values (calculated by frontend)
- [ ] **Previous Day Usage** - Shows consumption amounts
- [ ] **Days to Minimum** - Shows time estimates or "N/A"
- [ ] **Status badges** - Show "Normal" or "Attention" appropriately

---

## 🚨 **Error Verification**

### **Step 6: Check for Errors**
**✅ No Errors Expected:**
- [ ] **No 500 errors** in browser Network tab
- [ ] **No infinite recursion** errors in console
- [ ] **No "Cannot read property"** JavaScript errors
- [ ] **No empty/undefined** field warnings in console

### **Step 7: Field Name Warnings** (Good to see!)
**✅ Expected Warnings (these are good - show defensive code working):**
- [ ] May see: `Tank X using deprecated 'safe_fill' field name` (means old views detected)
- [ ] May see: `Tank X using deprecated 'product' field name` (means normalization working)

---

## 🎯 **Specific Test Cases**

### **Step 8: GSFS Narrogin Tanks**
These tanks were specifically mentioned as problematic:

**✅ Expected Results:**
- [ ] **GSFS Narrogin tanks appear** in the tank list
- [ ] **Show proper percentages** (should be 61%, 14%, 77% or similar)
- [ ] **Not showing 0%** across the board
- [ ] **Group name** shows properly (not "Unknown Group")

### **Step 9: Different User Roles** (if applicable)
Test with different user accounts:

**✅ Expected Results:**
- [ ] **Admin users** - See all tanks
- [ ] **Regular users** - See only their assigned groups
- [ ] **No permission errors** for authorized tanks
- [ ] **Proper filtering** by group/subgroup

---

## 🔧 **Performance Verification**

### **Step 10: Load Time Check**
**✅ Expected Performance:**
- [ ] **Initial load** - Under 3 seconds for tank data
- [ ] **No infinite loading** spinners
- [ ] **Smooth navigation** between pages
- [ ] **Responsive updates** when new data arrives

---

## ❌ **Troubleshooting Failed Tests**

### **If Database Tests Fail:**
1. Re-run the SQL scripts from `MANUAL_RECOVERY_STEPS.md`
2. Check Supabase project permissions
3. Verify you're in the correct project/database

### **If Frontend Shows Empty:**
1. Hard refresh browser (Ctrl+F5)
2. Clear browser cache completely
3. Check console for JavaScript errors
4. Verify debug logs show successful data fetching

### **If Field Name Errors:**
1. Check if old cached views are still active
2. Try recreating the view with different name temporarily
3. Verify database column names match schema

### **If Percentage Calculations Wrong:**
1. Check that `safe_level` and `min_level` have proper values
2. Verify current fuel readings exist in `dip_readings` table
3. Check calculation logic in console debug output

---

## ✅ **Success Criteria**

**🎉 Testing Complete When:**
- [ ] All database verification tests pass
- [ ] Frontend shows tank data with proper percentages  
- [ ] Debug logs show successful view usage (not fallback)
- [ ] No 500 errors or permission issues
- [ ] GSFS Narrogin tanks display correctly
- [ ] Analytics calculations working in frontend
- [ ] No deprecated field name issues

---

## 📞 **Next Steps After Testing**

**If All Tests Pass:**
- ✅ Recovery complete! Your system is working properly
- Monitor for any new issues over the next few days
- Consider removing old problematic view files

**If Some Tests Fail:**
- Check the specific troubleshooting steps above
- Review browser console logs for detailed error information
- Verify each SQL script ran successfully in Supabase

**For Future Maintenance:**
- Always use `safe_level` and `min_level` (never `safe_fill`)
- Always use `product_type` (never `product`)
- Test any new database views against the frontend expectations
- Keep the enhanced debug logging in `useTanks` hook for easier troubleshooting