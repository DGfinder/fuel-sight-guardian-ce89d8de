# ⚡ Phase 3 Quick Start - 2 Minutes

## What Phase 3 Does
Links your data sources together:
- LYTX events → Vehicles
- Guardian events → Drivers
- Drivers ⟷ Vehicles (assignments)
- GPS trips ⟷ Fuel deliveries

## How to Run

### Step 1: Open The File
```
database/fixes/PHASE3_MASTER.sql
```

### Step 2: Copy Everything
Press `Ctrl+A` then `Ctrl+C`

### Step 3: Paste in Supabase
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Press `Ctrl+V` to paste
4. Click "Run" button

### Step 4: Wait ~2 Minutes
You'll see progress messages like:
```
NOTICE: === PHASE 3.1: LINKING LYTX EVENTS TO VEHICLES ===
NOTICE: ✓ Matched 1234 events by registration
NOTICE: ✓ Matched 567 events by device serial
NOTICE: === PHASE 3.2: LINKING GUARDIAN EVENTS TO DRIVERS ===
...
NOTICE: ✓ PHASE 3 COMPLETE - DATA RELATIONSHIPS BUILT
```

### Step 5: Verify Success
```sql
SELECT * FROM data_quality_dashboard;
```

Should show link percentages for each data source.

---

## What Gets Created

### New Tables
- `driver_vehicle_assignments` - Track driver-vehicle pairs over time
- `trip_delivery_correlations` - Link GPS trips to deliveries

### New Views
- `data_quality_dashboard` - Data health metrics
- `current_driver_assignments` - Active assignments
- `unmatched_lytx_events` - LYTX events without vehicle links
- `unmatched_guardian_events` - Guardian events without driver links
- `trip_delivery_correlations_verified` - High-confidence trip-delivery matches
- ...and 10+ more monitoring/review views

---

## Expected Results

After Phase 3:
- ✅ 70-90% of LYTX events linked to vehicles
- ✅ 60-85% of Guardian events linked to drivers
- ✅ 10-100+ driver-vehicle assignments created
- ✅ Trip-delivery correlations established
- ✅ Data quality monitoring active

---

## Next Steps

### 1. Check Data Quality
```sql
SELECT * FROM data_quality_dashboard;
```

### 2. Review Unmatched LYTX Events
```sql
SELECT * FROM unmatched_lytx_events LIMIT 20;
```

### 3. Review Unmatched Guardian Events
```sql
SELECT * FROM unmatched_guardian_events LIMIT 20;
```

### 4. Check Active Assignments
```sql
SELECT * FROM current_driver_assignments;
```

### 5. Review Low-Confidence Correlations
```sql
SELECT * FROM trip_delivery_correlations_review LIMIT 20;
```

---

## Troubleshooting

### Error: "relation does not exist"
**Cause:** Phase 1-2 not completed
**Fix:** Run `database/fixes/SUPABASE_MASTER_FIX.sql` first

### Low match rates (<50%)
**Cause:** Data quality issues (typos, missing records)
**Fix:**
1. Review unmatched views
2. Add missing drivers/vehicles to master tables
3. Re-run Phase 3

### Script takes >5 minutes
**Cause:** Very large dataset
**Fix:** Run individual scripts instead:
- `PHASE3_01_populate_lytx_vehicle_ids.sql`
- `PHASE3_02_populate_guardian_driver_ids.sql`
- etc.

---

## Done!

That's it. One file, one paste, 2 minutes.

Your data sources are now connected!

**Full documentation:** See `database/fixes/PHASE3_README.md`

---

Last Updated: 2025-10-01
