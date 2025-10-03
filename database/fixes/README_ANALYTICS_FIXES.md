# Analytics Platform View Fixes

This directory contains fix scripts for creating missing critical analytics views.

## Purpose

These scripts fix the broken analytics platform by creating views that the application code expects but may not exist in your database.

**Scope**: Analytics platform only
**Excluded**: Fuel tank monitoring (dip_readings, fuel_tanks, tank_groups) - untouched

---

## Quick Start

### Run All Fixes

```bash
# From project root
psql -d your_database -f database/fixes/00_RUN_ALL_CRITICAL_VIEW_FIXES.sql
```

This creates all 4 critical views in the correct order.

---

## Individual Fix Scripts

### 1. `01_create_cross_analytics_summary.sql`

**Purpose**: Creates the primary multi-source analytics view

**What it does**:
- Combines Guardian events, LYTX safety data, and Captive deliveries
- Aggregates by month/fleet/depot
- Calculates events per vehicle, volume per vehicle
- Provides data for DataCentre dashboard overview

**Dependencies**:
- `captive_deliveries` (materialized view)
- `lytx_safety_events` (table)
- `guardian_events` (table)
- `vehicles` (table)

**Creates**:
- `cross_analytics_summary` VIEW

**Used by**:
- `dataCentreSupabaseService.ts:126` (getOverviewAnalytics)
- `dataCentreSupabaseService.ts:245` (getCrossAnalytics)
- `dataCentreSupabaseService.ts:327` (getDataForComponent)
- `DataCentrePage.tsx` (main dashboard)

**Run individually**:
```bash
psql -d your_database -f database/fixes/01_create_cross_analytics_summary.sql
```

---

### 2. `02_create_captive_payments_analytics.sql`

**Purpose**: Creates monthly analytics for captive payment deliveries

**What it does**:
- Aggregates deliveries by carrier/month
- Calculates volume metrics (litres, megalitres)
- Identifies top customer per month
- Provides carrier comparison data

**Dependencies**:
- `captive_deliveries` (materialized view)

**Creates**:
- `captive_payments_analytics` VIEW

**Used by**:
- `dataCentreSupabaseService.ts:147` (getCaptivePaymentsAnalytics)
- `CaptivePaymentsDashboard.tsx`
- `SMBDashboard.tsx`
- `GSFDashboard.tsx`

**Run individually**:
```bash
psql -d your_database -f database/fixes/02_create_captive_payments_analytics.sql
```

---

### 3. `03_create_lytx_safety_analytics.sql`

**Purpose**: Creates monthly analytics for LYTX safety events

**What it does**:
- Aggregates safety events by carrier/depot/month
- Counts coachable vs driver-tagged events
- Calculates average safety scores
- Identifies high-risk drivers (score >= 80)

**Dependencies**:
- `lytx_safety_events` (table)

**Creates**:
- `lytx_safety_analytics` VIEW

**Used by**:
- `dataCentreSupabaseService.ts:185` (getSafetyEventsAnalytics)
- `LYTXSafetyDashboard.tsx`
- `GSFSafetyDashboard.tsx`
- `StevemacsSafetyDashboard.tsx`

**Run individually**:
```bash
psql -d your_database -f database/fixes/03_create_lytx_safety_analytics.sql
```

---

### 4. `04_create_lytx_events_enriched.sql`

**Purpose**: Enriches LYTX events with vehicle information

**What it does**:
- Maps LYTX events to vehicles by registration or device serial
- Provides resolved vehicle data (fleet, depot, make, model)
- Indicates match quality (EXACT_REGISTRATION, EXACT_DEVICE, NO_MATCH)
- Enables vehicle-based analytics

**Dependencies**:
- `lytx_safety_events` (table)
- `vehicles` (table)

**Creates**:
- `lytx_events_enriched` VIEW

**Used by**:
- `LYTXEventTable.tsx` (display vehicle info)
- Driver profile analytics
- Vehicle performance metrics

**Run individually**:
```bash
psql -d your_database -f database/fixes/04_create_lytx_events_enriched.sql
```

---

## Running the Fixes

### Prerequisites

Before running these fixes, ensure:

1. **Dependencies exist**:
   - `captive_deliveries` materialized view
   - `lytx_safety_events` table
   - `guardian_events` table
   - `vehicles` table

2. **Check dependencies**:
   ```bash
   psql -d your_database -f database/diagnostics/01_schema_audit.sql
   ```

3. **User permissions**:
   - CREATE VIEW privilege
   - SELECT on underlying tables
   - GRANT privilege (for permissions)

### Execution Order

**IMPORTANT**: Run in this order (or use `00_RUN_ALL_CRITICAL_VIEW_FIXES.sql`)

1. `01_create_cross_analytics_summary.sql` (depends on all base tables)
2. `02_create_captive_payments_analytics.sql` (depends on captive_deliveries)
3. `03_create_lytx_safety_analytics.sql` (depends on lytx_safety_events)
4. `04_create_lytx_events_enriched.sql` (depends on lytx_safety_events + vehicles)

### Via Command Line

```bash
# Run all fixes
psql -d your_database -f database/fixes/00_RUN_ALL_CRITICAL_VIEW_FIXES.sql

# Or run individually in order
psql -d your_database -f database/fixes/01_create_cross_analytics_summary.sql
psql -d your_database -f database/fixes/02_create_captive_payments_analytics.sql
psql -d your_database -f database/fixes/03_create_lytx_safety_analytics.sql
psql -d your_database -f database/fixes/04_create_lytx_events_enriched.sql
```

### Via Supabase SQL Editor

1. Open Supabase Dashboard → SQL Editor
2. Create new query
3. Copy content from `00_RUN_ALL_CRITICAL_VIEW_FIXES.sql`
4. Click "Run"
5. Verify success messages

---

## Verification

### After Running Fixes

1. **Re-run diagnostics**:
   ```bash
   psql -d your_database -f database/diagnostics/02_test_analytics_queries.sql
   ```

2. **Check view exists**:
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

3. **Test queries**:
   ```sql
   -- Should return data
   SELECT * FROM cross_analytics_summary LIMIT 5;
   SELECT * FROM captive_payments_analytics LIMIT 5;
   SELECT * FROM lytx_safety_analytics LIMIT 5;
   SELECT * FROM lytx_events_enriched LIMIT 5;
   ```

4. **Test application**:
   - Navigate to DataCentre page
   - Verify data displays
   - Check for console errors
   - Confirm analytics cards populate

---

## Troubleshooting

### Error: relation does not exist

```
ERROR:  relation "captive_deliveries" does not exist
```

**Cause**: Missing dependency table/view

**Solution**: Run prerequisite migrations first
```bash
psql -d your_database -f database/migrations/create_captive_payments_system.sql
```

---

### Error: permission denied

```
ERROR:  permission denied for schema public
```

**Cause**: Insufficient privileges

**Solution**: Run as database owner or grant privileges
```sql
GRANT CREATE ON SCHEMA public TO your_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO your_user;
```

---

### Error: column does not exist

```
ERROR:  column "excluded" does not exist
```

**Cause**: Table schema mismatch

**Solution**: Verify table structure matches expected schema
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'lytx_safety_events';
```

---

### View returns 0 rows

**Cause**: No data in underlying tables

**Check**:
```sql
SELECT COUNT(*) FROM captive_deliveries;
SELECT COUNT(*) FROM lytx_safety_events WHERE excluded IS NOT TRUE;
SELECT COUNT(*) FROM guardian_events WHERE verified = true;
SELECT COUNT(*) FROM vehicles WHERE status = 'Active';
```

**Solution**: Import data or check data import status

---

### DataCentre page still shows errors

**Possible causes**:
1. Views created but permissions not granted
2. Field name still doesn't match TypeScript interface
3. Frontend caching old error state

**Check**:
```sql
-- Verify permissions
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'cross_analytics_summary';
```

**Solution**: Clear browser cache, verify permissions, check field names

---

## What These Fixes Don't Touch

❌ **Excluded from these fixes** (as per requirements):

- `dip_readings` table
- `fuel_tanks` table
- `tank_groups` table
- `tanks_with_rolling_avg` view
- Any tank-related views or functions
- Fuel monitoring system

These remain 100% unchanged.

---

## Next Steps

After running these fixes:

1. ✅ Views created and working
2. ⏭️ Create foreign key constraints (Phase 3)
3. ⏭️ Implement driver association tracking (Phase 3)
4. ⏭️ Build trip-delivery correlation (Phase 3)
5. ⏭️ Update TypeScript interfaces if needed (Phase 4)

See `docs/ANALYTICS_SCHEMA_MASTER_PLAN.md` for complete remediation plan.

---

## Support

Issues running these scripts?

1. Run diagnostics first: `database/diagnostics/01_schema_audit.sql`
2. Check dependencies exist
3. Verify permissions
4. Review error messages
5. Consult ANALYTICS_SCHEMA_MASTER_PLAN.md

**Last Updated**: 2025-10-01
