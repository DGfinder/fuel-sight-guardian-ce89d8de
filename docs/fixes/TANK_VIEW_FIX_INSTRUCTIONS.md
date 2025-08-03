# TANK VIEW FIX INSTRUCTIONS

## 🚨 CRITICAL UPDATE: RLS POLICY ISSUE IDENTIFIED

The tank view problem is caused by **RLS (Row Level Security) policy conflicts**, not just the SQL view.

## Problem
The `tanks_with_rolling_avg` view is showing **EMPTY DATA** (no tanks at all) due to:
- **RLS infinite recursion** in helper functions
- **Blocked table access** due to overly restrictive policies  
- **Permission conflicts** between user roles and access rules

Expected percentages (once fixed):
- Narrogin ADF: **60.6%** (200000L / 330000L)
- Narrogin ULP: **13.5%** (14800L / 110000L) 
- Narrogin ULP98: **77.3%** (23200L / 30000L)

## ⚡ EMERGENCY SOLUTION (Recommended)
**Use the nuclear option to disable RLS temporarily:**

### 🚨 IMMEDIATE FIX
1. **Execute**: `emergency_disable_rls_nuclear.sql` in Supabase SQL Editor
2. **Follow**: Complete procedure in `EMERGENCY_RLS_FIX_PROCEDURE.md`
3. **Result**: Tanks will show immediately with correct percentages

### 📋 Quick Steps
1. Copy contents of `emergency_disable_rls_nuclear.sql`
2. Paste into Supabase SQL Editor  
3. Click **RUN**
4. Verify test results show working percentages
5. Refresh frontend - tanks should appear

---

## 🛠️ ALTERNATIVE: Manual View Fix (If RLS Not the Issue)

### 1. Access Supabase SQL Editor
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `fuel-sight-guardian`
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query** or use an existing query tab

### 2. Execute the View Fix
1. Copy the entire contents of `working-view.sql` file
2. Paste it into the SQL Editor
3. Click **Run** button (or press Ctrl+Enter)
4. Wait for confirmation: "Success. No rows returned"

### 3. Verify the Fix
Run this test query to check if the fix worked:

```sql
-- Test query to verify the fix
SELECT 
    location,
    current_level,
    safe_level,
    current_level_percent,
    CASE 
        WHEN current_level_percent > 0 THEN '✅ WORKING'
        ELSE '❌ BROKEN'
    END as status
FROM tanks_with_rolling_avg 
WHERE subgroup = 'GSFS Narrogin'
ORDER BY location;
```

**Expected Results:**
- Narrogin ADF: ~61% ✅ WORKING
- Narrogin ULP: ~13% ✅ WORKING  
- Narrogin ULP98: ~77% ✅ WORKING

### 4. Frontend Verification
1. Refresh the Fuel Sight application
2. Navigate to GSF Depots page
3. Check that GSFS Narrogin tanks show correct percentages
4. Verify tank cards display fuel levels properly

## Backup Plan
If the SQL execution fails:

1. **Check Permissions**: Ensure you have `SUPERUSER` or `DATABASE ADMIN` rights
2. **Try RLS Disable**: Temporarily disable RLS if needed:
   ```sql
   ALTER TABLE fuel_tanks DISABLE ROW LEVEL SECURITY;
   -- Execute the view creation
   -- Then re-enable:
   ALTER TABLE fuel_tanks ENABLE ROW LEVEL SECURITY;
   ```
3. **Manual Recreation**: Drop and recreate step by step:
   ```sql
   DROP VIEW IF EXISTS tanks_with_rolling_avg CASCADE;
   -- Then execute the working-view.sql content
   ```

## Alternative: Use Database Tools
If Supabase SQL Editor doesn't work:

1. **pgAdmin**: Connect directly to PostgreSQL
2. **psql command line**: Use the connection string
3. **TablePlus/DataGrip**: Any PostgreSQL client

Connection details available in Supabase Project Settings → Database.

## Verification Commands
Run these in browser console after the fix:

```javascript
// Test if tanks now show percentages
fetch('/api/tanks-with-rolling-avg?subgroup=eq.GSFS Narrogin')
  .then(r => r.json())
  .then(tanks => {
    tanks.forEach(tank => {
      console.log(`${tank.location}: ${tank.current_level_percent}%`);
    });
  });

// Clear frontend cache to see changes immediately
if (window.queryClient) window.queryClient.clear();
window.location.reload();
```

## Files Involved
- `working-view.sql` - The corrected view definition
- `src/hooks/useTanks.ts` - Frontend hook that fetches tank data
- `src/components/Sidebar.tsx` - Updated logout handler
- `src/components/ProtectedRoute.tsx` - Improved auth handling

## Success Indicators
✅ GSFS Narrogin tanks show correct percentages  
✅ No more logout loops  
✅ Tank cards display meaningful fuel levels  
✅ Rolling averages calculate properly  
✅ Days to minimum level shows when applicable  

## Need Help?
If the fix doesn't work:
1. Check browser console for errors
2. Verify the SQL was executed successfully
3. Try the auth cleanup utilities if experiencing login issues
4. Contact system administrator for database access issues