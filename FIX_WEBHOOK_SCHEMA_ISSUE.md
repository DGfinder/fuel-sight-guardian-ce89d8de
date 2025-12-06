# Fix Webhook Schema Issue - Step by Step Guide

## Problem
The webhook is failing with error 406:
```
The schema must be one of the following: public, scheduling_tool_smb
```

This error occurs because:
1. ✅ The code is correctly using `.schema('great_southern_fuels')` to access AgBot tables
2. ❌ The schema is NOT exposed in Supabase API settings
3. ❓ Migration 010 may not have been applied to grant anon permissions

## Solution (Two Steps Required)

### Step 1: Apply Migration 010 (Grant Permissions)

You need to apply `database/migrations/010_grant_gsf_anon_permissions.sql`

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to your Supabase dashboard
2. Navigate to: SQL Editor → New Query
3. Copy the contents of `database/migrations/010_grant_gsf_anon_permissions.sql`
4. Paste and click "Run"
5. Wait for success confirmation

**Option B: Using Direct Connection**

If you have your database password:

1. Add to `.env`:
   ```
   SUPABASE_DB_PASSWORD=your_db_password
   ```
2. Run:
   ```bash
   node apply-010-simple.mjs
   ```

**Option C: Using pgAdmin or psql**

Connect to your Supabase database and run the migration file.

### Step 2: Expose Schema in Supabase (CRITICAL - Most Important Step)

**This is the main issue causing the 406 error!**

1. Go to your Supabase Dashboard
2. Navigate to: **Settings** (⚙️ gear icon in left sidebar)
3. Click: **API** under Project Settings
4. Scroll to: **Exposed Schemas** section
5. You should see:
   - `public` ✓
   - `scheduling_tool_smb` ✓
6. **Add**: `great_southern_fuels`
7. Click **Save** (or the checkmark)
8. **Wait 30-60 seconds** for changes to propagate

### Step 3: Verify the Fix

Test the webhook:

```bash
# Test webhook with curl (replace with your webhook URL)
curl -X POST https://your-app.vercel.app/api/gasbot-webhook \
  -H "Authorization: Bearer FSG-gasbot-webhook-2025" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test",
    "method": "reportAssets",
    "params": [{
      "guid": "test-guid",
      "name": "Test Location",
      "lastDataTime": "2025-12-04 14:00:00"
    }]
  }'
```

Expected: 200 OK (no more 406 errors)

## Why This Happens

The Supabase REST API has a security feature where schemas must be explicitly "exposed" before they can be accessed via the API. Even if:
- The schema exists ✅
- Permissions are granted ✅
- Your code uses `.schema('great_southern_fuels')` ✅

...the API will still reject requests with 406 until the schema is exposed in the dashboard settings.

## Quick Reference: Exposed Schemas Setting

Location: **Supabase Dashboard → Settings → API → Exposed Schemas**

Should contain:
- `public`
- `scheduling_tool_smb`
- `great_southern_fuels` ← **ADD THIS**

## After Fix

Once both steps are complete:
1. All AgBot webhook calls will work ✅
2. Frontend can access `great_southern_fuels` schema ✅
3. No more 406 errors ✅

## Need Help?

If you still see 406 errors after exposing the schema:
1. Wait 1-2 minutes (API settings need time to propagate)
2. Clear your browser cache and do a hard refresh
3. Check that `great_southern_fuels` is still in the exposed schemas list (sometimes it doesn't save)
4. Try saving again if it disappeared
