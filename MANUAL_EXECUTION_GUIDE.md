# Manual Execution Guide - Supabase SQL Editor

If you prefer to execute fixes manually via Supabase Dashboard, follow this guide.

---

## Method 1: Supabase SQL Editor (Recommended) ⭐

### Quick Version (One Script Does Everything)

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/wjzsdsvbtapriiuxzmih)
2. Click "SQL Editor" in left sidebar
3. Click "New Query"
4. Open `database/fixes/SUPABASE_MASTER_FIX.sql` in your code editor
5. **Copy the ENTIRE file** (Ctrl+A, Ctrl+C)
6. **Paste** into Supabase SQL Editor (Ctrl+V)
7. Click "Run" (or press Ctrl+Enter)
8. Wait ~30 seconds
9. **Look for success message** in output:
   ```
   NOTICE:  === SUCCESS: ALL FIXES APPLIED! ===
   NOTICE:  ✓ cross_analytics_summary
   NOTICE:  ✓ captive_payments_analytics
   NOTICE:  ✓ lytx_safety_analytics
   NOTICE:  ✓ lytx_events_enriched
   ```

**That's it!** All 4 views created + foreign keys added in one go.

---

### Detailed Version (Step-by-Step with Diagnostics)

If you want to see before/after comparison:

#### Step 1: Run BEFORE Diagnostics (Optional)

**Note:** The diagnostic scripts contain psql commands and won't work in Supabase SQL Editor.
Skip this step unless you're using command line.

#### Step 2: Apply All Fixes

1. In SQL Editor, click "New Query"
2. Copy/paste **entire contents** from `database/fixes/SUPABASE_MASTER_FIX.sql`
3. Click "Run"
4. Review output for success messages

#### Step 3: Verify Views Created

Run this quick check in SQL Editor:

```sql
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name IN (
  'cross_analytics_summary',
  'captive_payments_analytics',
  'lytx_safety_analytics',
  'lytx_events_enriched'
);
```

Should return **4 rows**.

#### Step 4: Test Queries

```sql
-- Should return data (if you have records)
SELECT COUNT(*) FROM cross_analytics_summary;
SELECT COUNT(*) FROM captive_payments_analytics;
SELECT COUNT(*) FROM lytx_safety_analytics;
SELECT COUNT(*) FROM lytx_events_enriched;
```

If all return counts, you're good! ✅

---

## Method 2: Command Line (For Advanced Users)

### Windows:

```cmd
# Navigate to project directory
cd C:\Users\HaydenHamilton\Downloads\fuel-sight-guardian-ce89d8de

# Run the batch script
EXECUTE_FIXES_LOCALLY.bat
```

### Mac/Linux:

```bash
# Navigate to project directory
cd ~/Downloads/fuel-sight-guardian-ce89d8de

# Make script executable
chmod +x EXECUTE_FIXES_LOCALLY.sh

# Run the script
./EXECUTE_FIXES_LOCALLY.sh
```

---

## Method 3: Manual psql Commands

If scripts don't work, run individual commands:

```bash
# Set password (replace if different)
export PGPASSWORD='Canada9898!'
DB_URL="postgresql://postgres@db.wjzsdsvbtapriiuxzmih.supabase.co:5432/postgres"

# Run diagnostics BEFORE
psql "$DB_URL" -f database/diagnostics/01_schema_audit.sql -o before_audit.txt
psql "$DB_URL" -f database/diagnostics/02_test_analytics_queries.sql -o before_queries.txt

# Apply fixes
psql "$DB_URL" -f database/fixes/00_RUN_ALL_CRITICAL_VIEW_FIXES.sql
psql "$DB_URL" -f database/fixes/05_create_analytics_foreign_keys.sql

# Run diagnostics AFTER
psql "$DB_URL" -f database/diagnostics/01_schema_audit.sql -o after_audit.txt
psql "$DB_URL" -f database/diagnostics/02_test_analytics_queries.sql -o after_queries.txt
```

---

## What to Look For

### Success Indicators ✅

1. **Views Created:**
   ```sql
   SELECT table_name, table_type
   FROM information_schema.tables
   WHERE table_name IN (
     'cross_analytics_summary',
     'captive_payments_analytics',
     'lytx_safety_analytics',
     'lytx_events_enriched'
   );
   ```
   Should return 4 rows with type 'VIEW'

2. **Views Return Data:**
   ```sql
   SELECT COUNT(*) FROM cross_analytics_summary;
   SELECT COUNT(*) FROM captive_payments_analytics;
   SELECT COUNT(*) FROM lytx_safety_analytics;
   SELECT COUNT(*) FROM lytx_events_enriched;
   ```
   Should return counts > 0 (if you have data)

3. **Foreign Keys Exist:**
   ```sql
   SELECT constraint_name, table_name
   FROM information_schema.table_constraints
   WHERE constraint_type = 'FOREIGN KEY'
     AND table_name IN ('lytx_safety_events', 'guardian_events');
   ```
   Should show FK constraints

---

## Troubleshooting

### Error: relation does not exist

**Cause:** Missing dependency table

**Fix:** Check which migrations have been run. You may need to run:
```sql
-- Check if base tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_name IN (
  'captive_deliveries',
  'lytx_safety_events',
  'guardian_events',
  'vehicles',
  'drivers'
);
```

If any are missing, run prerequisite migrations first.

---

### Error: permission denied

**Cause:** Insufficient privileges

**Fix:** Ensure you're connected as postgres user or have CREATE VIEW privileges

---

### Error: syntax error

**Cause:** Copy/paste formatting issue or SQL version incompatibility

**Fix:**
1. Ensure entire file contents copied (check for truncation)
2. Try running smaller sections individually
3. Check PostgreSQL version: `SELECT version();` (should be 14+)

---

### Views created but no data

**Cause:** No data in underlying tables

**Check:**
```sql
SELECT COUNT(*) FROM captive_deliveries;
SELECT COUNT(*) FROM lytx_safety_events WHERE excluded IS NOT TRUE;
SELECT COUNT(*) FROM guardian_events WHERE verified = true;
SELECT COUNT(*) FROM vehicles WHERE status = 'Active';
```

If counts are 0, you need to import data first.

---

## Testing in Application

After applying fixes:

1. **Open your application** (localhost or production)
2. **Navigate to DataCentre page** (`/data-centre`)
3. **Check for**:
   - ✅ Page loads (no infinite spinner)
   - ✅ Analytics cards show numbers
   - ✅ No console errors (F12 → Console)
   - ✅ Filters work
   - ✅ Data displays in tables/charts

4. **If page still broken**:
   - Open browser console (F12)
   - Look for API errors
   - Check Network tab for failed requests
   - Clear browser cache and reload

---

## Getting Help

If you encounter issues:

1. Check diagnostic output files for specific errors
2. Review `database/fixes/README_ANALYTICS_FIXES.md` troubleshooting section
3. Consult `ANALYTICS_SCHEMA_MASTER_PLAN.md` for expected schema
4. Save error messages and diagnostic output for review

---

## Security Note

**After execution:**
- ✅ Results saved in `.diagnostic_results/` (gitignored)
- ✅ No credentials committed to git
- ❌ Delete `EXECUTE_FIXES_LOCALLY.bat` if you edited the password

---

Last Updated: 2025-10-01
