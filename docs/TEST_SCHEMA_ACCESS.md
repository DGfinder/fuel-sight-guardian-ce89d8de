# Test Schema Access

## Quick Test in Browser Console

Open your browser console (F12) on the AgBot page and run:

```javascript
// Import supabase client
const { supabase } = await import('/src/lib/supabase.js');

// Test schema access
const { data, error } = await supabase
  .schema('great_southern_fuels')
  .from('ta_agbot_locations')
  .select('count', { count: 'exact', head: true });

if (error) {
  console.error('❌ Schema access FAILED:', error);
  console.error('Error message:', error.message);
  console.error('Error details:', error);
} else {
  console.log('✅ Schema access SUCCESS!');
  console.log('Count:', data);
}
```

## Expected Results

### ✅ Success
- No error
- Returns count of locations
- AgBot data should load

### ❌ Still Failing
If you still get "The schema must be one of the following: public, scheduling_tool_smb":

1. **Check Supabase Dashboard**
   - Go to Settings → API
   - Verify `great_southern_fuels` is in "Exposed schemas"
   - Click Save again (even if it's already there)

2. **Check Network Request**
   - Open DevTools → Network tab
   - Look for request to `/rest/v1/ta_agbot_locations`
   - Check the request headers - should include schema parameter
   - Check response - should be 200 OK, not 400 Bad Request

3. **Clear All Caches**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or clear browser cache completely
   - Or try incognito/private window

4. **Verify Migration Ran**
   - Check that `010_grant_gsf_anon_permissions.sql` was executed
   - Run this query in Supabase SQL Editor:
   ```sql
   SELECT
     nspname as schema_name,
     has_schema_privilege('anon', nspname, 'USAGE') as anon_has_usage
   FROM pg_namespace
   WHERE nspname = 'great_southern_fuels';
   ```
   - Should return `anon_has_usage: true`

