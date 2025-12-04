# Supabase Schema Exposure Configuration

## Problem
When accessing the `great_southern_fuels` schema from the frontend, you may see this error:
```
The schema must be one of the following: public, scheduling_tool_smb
```

## Solution
You need to expose the `great_southern_fuels` schema in your Supabase project settings.

### Steps to Expose Schema

1. **Go to Supabase Dashboard**
   - Navigate to your project: https://supabase.com/dashboard/project/[your-project-id]

2. **Open API Settings**
   - Click on **Settings** (gear icon) in the left sidebar
   - Click on **API** under Project Settings

3. **Configure Exposed Schemas**
   - Scroll down to **Exposed Schemas** section
   - Add `great_southern_fuels` to the list of exposed schemas
   - The list should include:
     - `public` (default)
     - `scheduling_tool_smb` (if you have this)
     - `great_southern_fuels` (add this)

4. **Save Changes**
   - Click **Save** or the checkmark to apply changes

### Alternative: Using Supabase CLI

If you have Supabase CLI configured, you can also update this via the project config:

```bash
# Update supabase/config.toml
# Add to [api] section:
[api]
exposed_schemas = ["public", "scheduling_tool_smb", "great_southern_fuels"]
```

Then apply the config:
```bash
supabase db push
```

### Verification

After exposing the schema, verify it works:

1. **Test in Browser Console**
   ```javascript
   const { data, error } = await supabase
     .schema('great_southern_fuels')
     .from('ta_agbot_locations')
     .select('count', { count: 'exact', head: true });
   
   console.log('Schema access:', error ? 'FAILED' : 'SUCCESS', error);
   ```

2. **Check Network Tab**
   - Open browser DevTools → Network tab
   - Try loading AgBot data
   - Look for API calls to `/rest/v1/ta_agbot_locations`
   - Should return 200 OK, not 400 Bad Request

### Related Migrations

After exposing the schema, make sure you've also run:
- `010_grant_gsf_anon_permissions.sql` - Grants read permissions to anon role

### Security Note

Exposing a schema in Supabase settings only makes it accessible via the API. You still need:
- Proper GRANT permissions (handled by migration)
- Row Level Security (RLS) policies if needed
- Application-level access control

The schema exposure setting is just the first step - it tells Supabase "this schema can be queried via REST API", but permissions still control who can read/write what.

