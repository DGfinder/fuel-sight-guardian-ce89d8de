# Workaround: Use Public Schema Until Supabase Settings Fixed

## The Problem
- Schema `great_southern_fuels` exists ✅ (31 tables)
- Schema has data ✅
- Dashboard settings won't apply ❌ (3+ minutes, no effect)
- This is likely a Supabase platform bug ❌

## Temporary Workaround

Since you said it "worked at first", this suggests:
1. The data was originally in `public` schema
2. It was migrated to `great_southern_fuels` schema
3. The webhook still tries to use `great_southern_fuels`
4. But API won't expose it

## Question for You

**Where is the AgBot data actually being used?**
- Is the webhook writing to `public.ta_agbot_locations`?
- Or to `great_southern_fuels.ta_agbot_locations`?

Run this to check which schema has recent data:

```sql
-- Check last update in public schema
SELECT
  'public' as schema_name,
  COUNT(*) as total_locations,
  MAX(updated_at) as last_updated
FROM public.ta_agbot_locations

UNION ALL

-- Check last update in gsf schema
SELECT
  'great_southern_fuels' as schema_name,
  COUNT(*) as total_locations,
  MAX(updated_at) as last_updated
FROM great_southern_fuels.ta_agbot_locations;
```

## Option 1: Revert Webhook to Use Public Schema (Quick Fix)

If `public` schema has the recent data, we can change the webhook to use it:

**File:** `api/repositories/AgBotLocationRepository.ts`
**Change:** Replace `.schema('great_southern_fuels')` with `.from()` (uses public by default)

This would make the webhook work immediately.

## Option 2: Wait for Supabase Support

If you prefer to keep using `great_southern_fuels`:
1. Contact Supabase support about the settings not applying
2. They may need to restart your project's PostgREST instance
3. Or there could be a platform-wide issue

## Option 3: Try Project Restart

In Supabase Dashboard:
1. Go to Settings → General
2. Try "Pause project" then "Resume project"
3. This sometimes clears stuck settings
4. Wait 5 minutes after resume
5. Then test: `node verify-schema-exposure.mjs`

## My Recommendation

**Check which schema has the latest data first**, then we'll know the best path forward.
