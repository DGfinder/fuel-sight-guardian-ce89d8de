# Analytics Platform Diagnostics

This directory contains diagnostic scripts to audit the analytics platform database schema and identify issues before remediation.

## Purpose

These scripts identify:
- Missing tables and views
- Broken view dependencies
- Field name mismatches
- Data integrity issues
- Query failures

**Scope**: Analytics platform only
**Excluded**: Fuel tank monitoring system (dip_readings, fuel_tanks, tank_groups)

---

## Scripts

### 1. `01_schema_audit.sql`

**Purpose**: Comprehensive audit of analytics database schema

**What it checks**:
- ✅ Which analytics tables exist
- ✅ Which analytics views exist
- ✅ Critical views referenced by code
- ✅ Data freshness system components
- ✅ Driver association tables
- ✅ Foreign key constraints
- ✅ Indexes on analytics tables
- ✅ Row counts (data volume)
- ✅ Custom types (ENUMs)

**How to run**:
```bash
# Local PostgreSQL
psql -d your_database -f database/diagnostics/01_schema_audit.sql > audit_results.txt

# Supabase (via psql)
psql "postgresql://postgres:[password]@[host]:5432/postgres" \
  -f database/diagnostics/01_schema_audit.sql \
  > audit_results.txt

# Or via Supabase SQL Editor
# Copy/paste content into SQL Editor and run
```

**Expected output**:
- Section-by-section audit results
- EXISTS ✓ or MISSING ✗ status for each component
- Row counts for data validation
- Summary report at end

**Time to run**: ~30 seconds

---

### 2. `02_test_analytics_queries.sql`

**Purpose**: Test all queries that the application code actually executes

**What it tests**:
- ✅ DataCentreSupabaseService queries (5 queries)
- ✅ Captive Payments API queries (4 views)
- ✅ LYTX events enriched view
- ✅ Data freshness system queries
- ✅ Driver profile queries
- ✅ Field name validation
- ✅ Data integrity (NULL checks)

**How to run**:
```bash
# Run with error handling (continues on errors)
psql -d your_database -f database/diagnostics/02_test_analytics_queries.sql > query_test_results.txt

# Run with timing
\timing on
psql -d your_database -f database/diagnostics/02_test_analytics_queries.sql
```

**Expected output**:
- Query execution results or errors
- Field name validation
- NULL value counts
- Summary of passed/failed tests

**Time to run**: ~1 minute

---

## Running the Complete Diagnostic

### Option 1: Via Command Line

```bash
# Navigate to project root
cd C:\Users\HaydenHamilton\Downloads\fuel-sight-guardian-ce89d8de

# Run both scripts in sequence
psql -d your_database -f database/diagnostics/01_schema_audit.sql > audit_results.txt
psql -d your_database -f database/diagnostics/02_test_analytics_queries.sql > query_test_results.txt

# Review results
cat audit_results.txt query_test_results.txt
```

### Option 2: Via Supabase SQL Editor

1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy content from `01_schema_audit.sql`
4. Click "Run"
5. Review results
6. Repeat for `02_test_analytics_queries.sql`

### Option 3: Via pgAdmin

1. Connect to database
2. Open Query Tool
3. File → Open → Select `01_schema_audit.sql`
4. Execute (F5)
5. Review results in Messages/Data Output tabs
6. Repeat for `02_test_analytics_queries.sql`

---

## Interpreting Results

### Schema Audit Results

**Good signs** ✅:
```
VIEW EXISTS ✓
TABLE EXISTS ✓
8 / 8 expected tables found
5 / 5 critical views exist
```

**Problems** ❌:
```
VIEW MISSING ✗
TABLE MISSING ✗
0 / 5 critical views exist
Foreign key count: 0
```

### Query Test Results

**Good signs** ✅:
```
SELECT 5 rows returned
Query executed successfully
All fields present
0 NULL values in critical fields
```

**Problems** ❌:
```
ERROR: relation "cross_analytics_summary" does not exist
ERROR: column "rolling_avg" does not exist
NULL values found: 1234 rows
```

---

## Common Issues & Solutions

### Issue 1: Views Don't Exist

**Symptom**:
```
VIEW MISSING ✗
ERROR: relation "cross_analytics_summary" does not exist
```

**Solution**:
Run missing view creation scripts in Phase 2 (see ANALYTICS_SCHEMA_MASTER_PLAN.md)

---

### Issue 2: Field Name Mismatches

**Symptom**:
```
ERROR: column "rolling_avg_lpd" does not exist
Frontend expects "rolling_avg" but view provides "rolling_avg_lpd"
```

**Solution**:
Fix view definitions to use correct field names (Phase 2 scripts will address)

---

### Issue 3: Missing Foreign Keys

**Symptom**:
```
Foreign key count: 0
No constraints found for lytx_safety_events
```

**Solution**:
Run Phase 4 constraint creation scripts

---

### Issue 4: Empty Tables

**Symptom**:
```
Table: captive_payment_records - Row Count: 0
Table: lytx_safety_events - Row Count: 0
```

**Solution**:
- Verify data import migrations have run
- Check if CSV imports were successful
- Review data_import_batches table for import status

---

### Issue 5: NULL Critical Fields

**Symptom**:
```
null_bol: 523 rows
null_customer: 1042 rows
```

**Solution**:
- Investigate data import process
- Add data validation to import workflows
- Clean up NULL records

---

## After Running Diagnostics

### 1. Review Results

Open both output files and check for:
- Number of MISSING ✗ components
- Query errors
- NULL value counts
- Missing indexes

### 2. Create Issue List

Document each problem found:
```markdown
1. cross_analytics_summary view missing
2. lytx_events_enriched view missing
3. Field name mismatch: rolling_avg vs rolling_avg_lpd
4. 0 foreign key constraints on analytics tables
5. data_import_batches table missing
```

### 3. Prioritize Fixes

**CRITICAL** (blocks DataCentre dashboard):
- cross_analytics_summary view
- captive_payments_analytics view
- lytx_safety_analytics view

**HIGH** (impacts features):
- lytx_events_enriched view
- data_freshness_tracking system
- Field name standardization

**MEDIUM** (optimization):
- Foreign key constraints
- Performance indexes
- Driver association tables

### 4. Execute Phase 2 Fixes

See `docs/ANALYTICS_SCHEMA_MASTER_PLAN.md` for fix execution order.

---

## Re-running After Fixes

After applying fixes, re-run diagnostics to verify:

```bash
# Re-run audit
psql -d your_database -f database/diagnostics/01_schema_audit.sql > audit_results_after.txt

# Re-run query tests
psql -d your_database -f database/diagnostics/02_test_analytics_queries.sql > query_test_results_after.txt

# Compare before/after
diff audit_results.txt audit_results_after.txt
diff query_test_results.txt query_test_results_after.txt
```

**Goal**: All MISSING ✗ become EXISTS ✓, all query errors resolved.

---

## Troubleshooting

### Permission Errors

```
ERROR: permission denied for schema public
```

**Solution**: Run as database owner or with sufficient privileges:
```bash
psql -d your_database -U postgres -f database/diagnostics/01_schema_audit.sql
```

### Connection Issues

```
psql: error: connection to server failed
```

**Solution**: Check connection string and credentials:
```bash
# Test connection
psql -d your_database -c "SELECT version();"
```

### Script Timeout

If scripts take too long (> 5 minutes):
- Database may be under heavy load
- Tables may be very large
- Network latency (if remote database)

**Solution**: Run during off-peak hours or increase timeout.

---

## Support

If you encounter issues running these diagnostics:

1. Check database connection
2. Verify user has SELECT permissions
3. Ensure scripts are using correct schema (public)
4. Review error messages in output files
5. Consult ANALYTICS_SCHEMA_MASTER_PLAN.md for expected schema

---

## Notes

- These scripts are **read-only** - they don't modify data
- Safe to run on production database
- Can be run multiple times
- Output can be committed to git for tracking
- Scripts exclude all fuel tank monitoring components (as designed)

**Last Updated**: 2025-10-01
