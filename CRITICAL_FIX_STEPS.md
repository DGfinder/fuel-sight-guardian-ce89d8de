# CRITICAL: Schema Not Actually Exposed

## Problem Confirmed
Even though you added `great_southern_fuels` to the Exposed Schemas list, the API is **still rejecting it**.

The error message from Supabase API says:
```
The schema must be one of the following: public, scheduling_tool_smb
```

Notice: `great_southern_fuels` is NOT in that list!

## This Means
1. ❌ The setting didn't save properly, OR
2. ❌ The changes haven't propagated yet (can take 2-3 minutes), OR
3. ❌ There's a browser/cache issue preventing the save

## Fix Steps (Try These in Order)

### Option 1: Force Save Again
1. Go back to: **Supabase Dashboard → Settings → API → Exposed Schemas**
2. **Remove** `great_southern_fuels` from the list
3. Click **Save** (or checkmark)
4. Wait 10 seconds
5. **Add** `great_southern_fuels` back to the list
6. Click **Save** (or checkmark)
7. **Wait 2-3 minutes** (this is important!)
8. Run: `node check-permissions-direct.mjs`

### Option 2: Check for Save Button
- After adding the schema, make sure you clicked the **Save button** or **checkmark icon**
- Look for a success toast/notification confirming the save
- Sometimes the UI doesn't save unless you click outside the input field first

### Option 3: Try Different Browser
- The Supabase dashboard sometimes has caching issues
- Try opening in an incognito/private window
- Or try a different browser entirely
- Do a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Option 4: Verify in Project Settings
After saving, verify the setting stuck:
1. Navigate away from the API settings page
2. Come back to: **Settings → API → Exposed Schemas**
3. **Confirm** `great_southern_fuels` is still there
4. If it's gone, that confirms the save didn't work

### Option 5: Check Project Status
- Make sure your Supabase project is not paused
- Check if there are any pending migrations or updates
- Look for any error messages in the dashboard

## How to Verify It's Fixed

Run this command:
```bash
node check-permissions-direct.mjs
```

**Expected output when fixed:**
```
✅ Service role CAN access schema (found X records)
✅ Anon role CAN access schema (found X records)
🎉 Everything is working! Webhook should work now.
```

**Current output (broken):**
```
❌ Service role CANNOT access schema: The schema must be one of the following: public, scheduling_tool_smb
```

## If Still Not Working

The schema exposure might be cached at the API gateway level. Try:

1. **Wait longer**: Sometimes takes 5-10 minutes to propagate
2. **Restart project**: In Supabase dashboard, try pausing and resuming the project
3. **Contact Supabase support**: There might be a platform issue

## Alternative: Use Supabase CLI

If dashboard isn't working, try using the CLI:

```bash
# Link your project (if not already linked)
npx supabase link --project-ref YOUR_PROJECT_REF

# Update the config
# Edit supabase/config.toml and add:
# [api]
# schemas = ["public", "scheduling_tool_smb", "great_southern_fuels"]

# Push the config
npx supabase db push
```

## Next Step

Please try Option 1 above and let me know:
1. Did you see a success message after clicking Save?
2. Does `great_southern_fuels` stay in the list when you navigate away and back?
3. What does `node check-permissions-direct.mjs` show after waiting 2-3 minutes?
