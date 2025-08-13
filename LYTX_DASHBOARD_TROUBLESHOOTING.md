# LYTX Dashboard Troubleshooting Guide

## Problem: Dashboard Shows No Data Despite 34,000+ Rows

Your LYTX Simple Dashboard isn't displaying data even though the `lytx_safety_events` table contains over 34,000 rows. This is almost certainly a **Row Level Security (RLS) permission issue** rather than a code problem.

## 🚀 Quick Fix (Try This First)

1. **Run the permission granting script:**
   ```bash
   node grant-lytx-permissions.js
   ```

2. **Clear browser cache and refresh the dashboard**

3. **Check browser console for debug logs**

## 🔍 Diagnostic Tools Added

### 1. Dashboard Debug Logging
The `LytxSimpleDashboard.tsx` now includes comprehensive console logging:
- User session information
- Query parameters and results  
- Error details
- Data counts and samples

**To see logs:** Open browser Developer Tools → Console tab → Refresh dashboard

### 2. Debug Panel
A red "Debug LYTX Access" button appears in the bottom-right corner of the dashboard.

**What it shows:**
- Current user session details
- User permissions and roles
- Carrier access permissions
- Analytics permissions
- Direct database query test results

### 3. Database Access Test Script
Run `node debug-lytx-data.js` to test:
- Service role access (bypasses RLS)
- Anonymous access (respects RLS)  
- Total event counts
- Carrier distribution
- RLS policy information

## 📋 Step-by-Step Troubleshooting

### Step 1: Check Database Access
```bash
node debug-lytx-data.js
```

**Expected results:**
- ✅ Service role shows 34,000+ events
- ❌ Anonymous role shows 0 events (this is correct)
- Shows carrier distribution and sample data

### Step 2: Check User Permissions
1. Open the dashboard
2. Click "Debug LYTX Access" button  
3. Review the diagnostic results

**Look for:**
- ✅ Valid user session
- ✅ Analytics permissions including `view_lytx_events`
- ✅ Carrier access permissions
- ✅ Direct query test returns data

### Step 3: Grant Missing Permissions
```bash
node grant-lytx-permissions.js
```

This script will:
- Find users without LYTX permissions
- Grant `view_lytx_events` permission
- Auto-assign carrier group permissions
- Provide detailed logging

### Step 4: Check Browser Console
Open Developer Tools → Console and look for:
- 🔍 Debug logs from dashboard query
- User session details
- Query results and error messages
- Final result summaries

## 🛡️ Understanding RLS Policies

The `lytx_safety_events` table has strict RLS policies that require:

1. **User Authentication**: Must be logged in
2. **Analytics Permission**: Must have `view_lytx_events` in `analytics_permissions` table
3. **Carrier Access**: Must have group permissions that match data carriers
4. **Role Requirements**: Must have admin, manager, or compliance_manager role

## 🔧 Common Issues & Fixes

### Issue: "No data showing"
**Likely cause:** Missing analytics permissions
**Fix:** Run `node grant-lytx-permissions.js`

### Issue: "Query failed with RLS error"
**Likely cause:** User not authenticated or lacks carrier access
**Fix:** Check Debug Panel → verify session and permissions

### Issue: "Data shows in debug script but not dashboard"
**Likely cause:** Carrier filtering mismatch
**Fix:** Check if user has access to the correct carriers

### Issue: "Permission denied error"
**Likely cause:** User lacks required role
**Fix:** Update user role in Supabase Auth admin panel

## 🎯 Quick Validation

After running fixes, verify success:

1. **Browser console shows:**
   - ✅ Valid user session
   - ✅ Query returns data (not empty array)
   - ✅ Final result shows rows > 0

2. **Debug panel shows:**
   - ✅ Analytics permissions exist
   - ✅ Direct query test succeeds
   - ✅ Carrier access permissions present

3. **Dashboard displays:**
   - ✅ KPI cards show non-zero numbers
   - ✅ Table shows monthly aggregated data
   - ✅ No error messages

## 🗑️ Cleanup After Fix

Once the dashboard works:

1. **Remove debug panel:**
   ```typescript
   // Remove this line from LytxSimpleDashboard.tsx
   <LytxDebugPanel />
   ```

2. **Reduce console logging:**
   Remove or comment out the debug console.log statements

3. **Keep scripts for future use:**
   - `debug-lytx-data.js` - for database testing
   - `grant-lytx-permissions.js` - for permission management

## 📞 Still Having Issues?

If problems persist:

1. **Check these tables have data:**
   - `analytics_permissions` (should have view_lytx_events entries)
   - `user_group_permissions` (users need carrier access)
   - `lytx_safety_events` (verify carrier field values)

2. **Verify environment variables:**
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` 
   - `SUPABASE_SERVICE_ROLE_KEY`

3. **Check Supabase Dashboard:**
   - RLS policies are enabled on lytx_safety_events
   - Users exist in Auth section
   - Database contains expected data

The root cause is almost always permissions - the 34,000 rows exist but RLS is protecting them from unauthorized access, which is working as intended for security!