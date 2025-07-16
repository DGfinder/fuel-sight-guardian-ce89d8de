# EMERGENCY RLS FIX PROCEDURE

## 🚨 CRITICAL ISSUE
Tank data is empty due to RLS (Row Level Security) policy conflicts causing infinite recursion or access blocking.

## 🎯 IMMEDIATE SOLUTION
Execute the "nuclear option" to completely disable RLS temporarily and restore application functionality.

---

## 📋 STEP-BY-STEP INSTRUCTIONS

### 1. 🚪 Access Supabase SQL Editor
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select project: `fuel-sight-guardian`
3. Click **SQL Editor** in left sidebar
4. Create new query or use existing tab

### 2. 💥 Execute Emergency Script
1. **Copy entire contents** of `emergency_disable_rls_nuclear.sql`
2. **Paste into SQL Editor**
3. **Click RUN** (or Ctrl+Enter)
4. **Wait for completion** - should see multiple success messages

### 3. ✅ Verify the Fix
The script includes test queries that should show:

**Expected Test Results:**
```
Testing tanks_with_rolling_avg view:
- total_tanks_in_view: >0 (should show tank count)
- narrogin_tanks_in_view: 3 (GSFS Narrogin tanks)
- tanks_with_percentage: >0 (tanks showing percentages)

GSFS Narrogin Tank Test:
- Narrogin ADF: ~61% ✅ WORKING
- Narrogin ULP: ~13% ✅ WORKING  
- Narrogin ULP98: ~77% ✅ WORKING
```

### 4. 🌐 Test Frontend
1. **Refresh** the Fuel Sight application (Ctrl+F5)
2. **Navigate to GSF Depots** page
3. **Check GSFS Narrogin tanks** show correct percentages
4. **Verify tank cards** display fuel levels properly

---

## ⚠️ WHAT THIS SCRIPT DOES

### Disables RLS Security ❌
- Removes `ROW LEVEL SECURITY` from all tables
- **WARNING:** This temporarily removes data protection

### Clears Broken Policies 🧹
- Drops all existing RLS policies that may have recursion
- Removes helper functions causing infinite loops

### Grants Full Access 🔓
- Gives all `authenticated` users complete table access
- Bypasses permission checks entirely

### Tests Everything ✅
- Verifies database access works
- Confirms tank view returns data
- Tests GSFS Narrogin specifically

---

## 🎉 SUCCESS INDICATORS

✅ **Tank Data Appears**: GSFS Narrogin tanks visible  
✅ **Percentages Calculate**: Shows 61%, 14%, 77%  
✅ **No Empty Cards**: Tank cards have meaningful data  
✅ **No Permission Errors**: Users can access assigned data  
✅ **Logout Still Works**: Authentication functions properly  

---

## 🔐 SECURITY CONSIDERATIONS

### ⚠️ TEMPORARY SECURITY REMOVAL
- **All authenticated users** can access all data
- **No permission restrictions** in place
- **Use only as emergency measure**

### 🛡️ RESTORATION PLAN
After confirming the application works:
1. **Plan new RLS policies** without recursion issues
2. **Implement group-based access** properly
3. **Test incrementally** to avoid breaking again
4. **Consider simplified permission model**

---

## 🆘 TROUBLESHOOTING

### If Script Fails:
```sql
-- Manual fallback - run these one by one:
ALTER TABLE fuel_tanks DISABLE ROW LEVEL SECURITY;
ALTER TABLE tank_groups DISABLE ROW LEVEL SECURITY;
GRANT ALL ON fuel_tanks TO authenticated;
GRANT ALL ON tank_groups TO authenticated;
GRANT SELECT ON tanks_with_rolling_avg TO authenticated;
```

### If Frontend Still Empty:
1. **Clear browser cache**: Ctrl+Shift+Delete
2. **Clear React Query cache**: In console run `window.queryClient?.clear()`
3. **Hard refresh**: Ctrl+F5
4. **Check browser console** for any errors

### If Percentages Still 0%:
The view calculation might still be wrong. Run:
```sql
-- Test percentage calculation manually
SELECT 
    location,
    current_level,
    safe_level,
    ROUND((current_level::numeric / safe_level::numeric) * 100, 1) as manual_percent
FROM tanks_with_rolling_avg 
WHERE subgroup = 'GSFS Narrogin';
```

---

## 📞 ESCALATION

If this emergency fix doesn't work:
1. **Database permissions issue** - contact DB admin
2. **View definition corrupted** - recreate from scratch
3. **Frontend caching issue** - clear all browser data
4. **Network/proxy issue** - check connection to Supabase

---

## 📝 POST-FIX ACTIONS

Once application is working:
1. **Document what caused the RLS issues**
2. **Plan proper permission architecture**
3. **Implement gradual security restoration**
4. **Monitor for any regression issues**
5. **Create backup access procedures**

**Remember: This is an emergency measure. Plan proper security restoration once the application is stable.**