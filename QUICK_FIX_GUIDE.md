# ⚡ QUICK FIX - 30 Second Guide

## You Got This Error in Supabase:
```
ERROR: 42601: syntax error at or near "\"
```

## Here's The Fix:

### Step 1: Open The Right File
Open this file in your code editor:
```
database/fixes/SUPABASE_MASTER_FIX.sql
```

### Step 2: Copy Everything
Press `Ctrl+A` then `Ctrl+C` to copy the entire file.

### Step 3: Paste in Supabase
1. Go to https://supabase.com/dashboard/project/wjzsdsvbtapriiuxzmih
2. Click "SQL Editor" → "New Query"
3. Press `Ctrl+V` to paste
4. Click "Run" button

### Step 4: Wait for Success
You'll see messages like:
```
NOTICE: ✓ cross_analytics_summary created
NOTICE: ✓ captive_payments_analytics created
NOTICE: ✓ lytx_safety_analytics created
NOTICE: ✓ lytx_events_enriched created
NOTICE: === SUCCESS: ALL FIXES APPLIED! ===
```

### Step 5: Test Your App
1. Open your application
2. Go to DataCentre page
3. Should load without errors!

---

## Why Did The Other File Fail?

The file you tried (`00_RUN_ALL_CRITICAL_VIEW_FIXES.sql`) has **psql meta-commands** like `\echo` and `\i` that only work in command-line psql, not Supabase SQL Editor.

`SUPABASE_MASTER_FIX.sql` is the **Supabase-compatible version** - same fixes, no psql commands.

---

## Done!

That's it. One file, one paste, 30 seconds. Your analytics should work now.

---

**Still having issues?** See `START_HERE.md` for detailed help.
