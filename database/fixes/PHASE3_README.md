# Phase 3: Data Relationship Population

## Overview

Phase 3 builds on the analytics views created in Phases 1-2 by populating foreign key relationships and creating intelligent correlation systems between your data sources.

## What Phase 3 Does

### 🔗 Data Relationships Created

1. **LYTX Events → Vehicles**
   - Links safety events to vehicles via registration or device serial
   - 3-stage matching: exact registration, exact device, fuzzy (>85% similarity)
   - Creates `unmatched_lytx_events` view for manual review

2. **Guardian Events → Drivers**
   - Links monitoring events to drivers via name matching
   - Handles name variations (e.g., "John Smith" vs "Smith, John")
   - 4-stage matching: exact, variation, fuzzy (>80% similarity), manual review
   - Creates `unmatched_guardian_events` view

3. **Driver ⟷ Vehicle Assignments**
   - Tracks which driver uses which vehicle during time periods
   - Infers assignments from Guardian event patterns
   - Supports primary/temporary/backup assignment types
   - Creates `current_driver_assignments` view

4. **GPS Trips ⟷ Fuel Deliveries**
   - Correlates MTData trips with Captive deliveries
   - Matches on vehicle, time proximity, and driver assignments
   - Confidence scoring for match quality
   - Creates `trip_delivery_correlations` view

5. **Data Quality Monitoring**
   - Comprehensive dashboards for relationship health
   - Orphaned record tracking
   - Match confidence distributions
   - Automated alerts for data issues

---

## 🚀 How to Execute

### Option 1: Run All at Once (Recommended)

**File:** `PHASE3_MASTER.sql`

1. Open Supabase SQL Editor
2. Copy entire contents of `PHASE3_MASTER.sql`
3. Paste and click "Run"
4. Wait ~1-2 minutes for completion

**What it does:**
- Executes all 6 Phase 3 scripts in correct order
- Shows progress messages as it runs
- Creates all tables, views, and relationships
- Displays summary statistics at end

---

### Option 2: Run Individual Scripts

If you want more control or need to run scripts separately:

#### 1. Populate LYTX Vehicle Links
```sql
-- File: PHASE3_01_populate_lytx_vehicle_ids.sql
-- Links LYTX events to vehicles
-- Expected time: 10-30 seconds
```

#### 2. Populate Guardian Driver Links
```sql
-- File: PHASE3_02_populate_guardian_driver_ids.sql
-- Links Guardian events to drivers
-- Expected time: 10-30 seconds
```

#### 3. Create Assignment Tracking
```sql
-- File: PHASE3_03_create_driver_vehicle_assignments.sql
-- Creates driver-vehicle assignment system
-- Expected time: 5 seconds
```

#### 4. Infer Historical Assignments
```sql
-- File: PHASE3_04_infer_driver_vehicle_assignments.sql
-- Analyzes events to infer assignments
-- Expected time: 20-60 seconds
```

#### 5. Correlate Trips and Deliveries
```sql
-- File: PHASE3_05_create_trip_delivery_correlation.sql
-- Matches GPS trips to fuel deliveries
-- Expected time: 30-90 seconds
```

#### 6. Create Quality Monitoring
```sql
-- File: PHASE3_06_create_data_quality_monitoring.sql
-- Creates data quality dashboards
-- Expected time: 5 seconds
```

**Total time:** ~2-4 minutes for all scripts

---

## ✅ Verification

After running Phase 3, verify success:

### 1. Check Data Quality Dashboard
```sql
SELECT * FROM data_quality_dashboard;
```

**Expected output:**
| data_source | total_records | linked_records | link_percentage | quality_score |
|-------------|---------------|----------------|-----------------|---------------|
| LYTX Events | 1234 | 1100 | 89.1 | 70 |
| Guardian Events | 5678 | 4800 | 84.5 | 75 |
| Captive Deliveries | 890 | 750 | 84.3 | 80 |

### 2. Check Relationship Health
```sql
SELECT * FROM relationship_health_monitor;
```

**Expected:** Link percentages should be 60-95% depending on data quality

### 3. Check Assignments Created
```sql
SELECT * FROM current_driver_assignments;
```

**Expected:** List of active driver-vehicle assignments

### 4. Check Trip-Delivery Correlations
```sql
SELECT COUNT(*) as total_correlations,
       COUNT(*) FILTER (WHERE match_confidence >= 0.70) as high_confidence
FROM trip_delivery_correlations;
```

**Expected:** At least 50% of trips or deliveries correlated

---

## 📊 New Tables and Views

### Tables Created

| Table | Purpose | Records Expected |
|-------|---------|------------------|
| `driver_vehicle_assignments` | Track driver-vehicle pairs over time | 10-100 |
| `trip_delivery_correlations` | Link GPS trips to fuel deliveries | 100-1000s |

### Views Created

#### Monitoring Views
- `data_quality_dashboard` - Overall data health metrics
- `relationship_health_monitor` - Link rates per relationship
- `orphaned_records_summary` - Unlinked records by type
- `match_confidence_distribution` - Quality of matches
- `data_quality_alerts` - Active issues requiring attention

#### Review Views
- `unmatched_lytx_events` - LYTX events without vehicle links
- `unmatched_guardian_events` - Guardian events without driver links
- `guardian_events_without_assignments` - Events without assignments
- `deliveries_without_trips` - Deliveries not matched to trips
- `trips_without_deliveries` - Trips not matched to deliveries

#### Operational Views
- `current_driver_assignments` - Active driver-vehicle assignments
- `driver_assignment_history` - Historical assignments
- `driver_assignment_coverage` - Assignment completeness per driver
- `trip_delivery_correlations_verified` - High-confidence correlations
- `trip_delivery_correlations_review` - Low-confidence matches needing review

---

## 🔍 Common Queries

### Review Unmatched LYTX Events
```sql
SELECT * FROM unmatched_lytx_events LIMIT 20;
```

Shows LYTX events that couldn't be matched to vehicles, with suggested matches.

### Review Unmatched Guardian Events
```sql
SELECT * FROM unmatched_guardian_events LIMIT 20;
```

Shows Guardian events that couldn't be matched to drivers, with suggested matches.

### See Driver Assignment Coverage
```sql
SELECT * FROM driver_assignment_coverage
ORDER BY coverage_percentage ASC
LIMIT 10;
```

Shows which drivers have lowest assignment coverage (need more assignments).

### Review Low-Confidence Correlations
```sql
SELECT * FROM trip_delivery_correlations_review
LIMIT 20;
```

Shows trip-delivery matches that need manual verification.

### Check Data Quality Alerts
```sql
SELECT * FROM data_quality_alerts
ORDER BY severity;
```

Shows active data quality issues (critical, warning, info).

### Find Driver for Vehicle at Specific Time
```sql
SELECT * FROM get_driver_for_vehicle_at_time(
  'vehicle-uuid-here',
  '2025-01-15 14:30:00'::TIMESTAMPTZ
);
```

Returns which driver was assigned to a vehicle at a specific date/time.

---

## 📈 Expected Results

### Match Rates (Typical)

| Relationship | Expected Link Rate | Excellent | Good | Needs Work |
|--------------|-------------------|-----------|------|------------|
| LYTX → Vehicle | 70-90% | >90% | 70-90% | <70% |
| Guardian → Driver | 60-85% | >85% | 60-85% | <60% |
| Guardian → Vehicle | 80-95% | >95% | 80-95% | <80% |
| Driver ⟷ Vehicle Assignment | 50-80% | >80% | 50-80% | <50% |
| Trip ⟷ Delivery | 40-70% | >70% | 40-70% | <40% |

### Why Some Records Stay Unmatched

**LYTX Events:**
- Registration format differs (spaces, dashes, typos)
- Vehicle not in vehicles table
- Device serial missing in both tables

**Guardian Events:**
- Driver name differs significantly (nickname vs full name)
- Driver not in drivers table
- Typo in driver name

**Driver-Vehicle Assignments:**
- Inconsistent vehicle usage (floaters, temporary assignments)
- Short-term usage (< 3 events)
- Missing event data

**Trip-Delivery Correlations:**
- No vehicle match available
- Delivery outside trip timeframe (>30 min gap)
- Multiple possible matches (ambiguous)

---

## 🛠️ Manual Cleanup

After running Phase 3, you'll likely need some manual intervention:

### 1. Add Missing Drivers
```sql
-- Find unmatched names
SELECT * FROM unmatched_driver_names
ORDER BY event_count DESC;

-- Add missing driver
INSERT INTO drivers (name, licence_number)
VALUES ('John Smith', 'LICENSE123')
RETURNING id;

-- Re-run Phase 3.2 to link events
```

### 2. Add Missing Vehicles
```sql
-- Find unmatched registrations
SELECT vehicle_registration, COUNT(*) as event_count
FROM lytx_safety_events
WHERE vehicle_id IS NULL AND excluded IS NOT TRUE
GROUP BY vehicle_registration
ORDER BY event_count DESC;

-- Add missing vehicle
INSERT INTO vehicles (registration, fleet_number)
VALUES ('ABC123', '1234')
RETURNING id;

-- Re-run Phase 3.1 to link events
```

### 3. Manually Link Ambiguous Records
```sql
-- Fix specific LYTX event
UPDATE lytx_safety_events
SET vehicle_id = 'vehicle-uuid-here'
WHERE event_id = 'event-id-here';

-- Fix specific Guardian event
UPDATE guardian_events
SET driver_id = 'driver-uuid-here'
WHERE id = 'event-id-here';
```

### 4. Add Manual Assignments
```sql
-- Create driver-vehicle assignment
INSERT INTO driver_vehicle_assignments (
  driver_id,
  vehicle_id,
  valid_from,
  valid_until,
  assignment_type,
  confidence_score,
  source,
  notes
) VALUES (
  'driver-uuid',
  'vehicle-uuid',
  '2025-01-01 00:00:00',
  NULL, -- NULL = ongoing
  'primary',
  1.0,
  'manual',
  'Manually verified by fleet manager'
);
```

### 5. Verify Trip-Delivery Match
```sql
-- Mark correlation as verified
UPDATE trip_delivery_correlations
SET is_verified = true,
    needs_review = false
WHERE id = 'correlation-uuid-here';
```

---

## 🚨 Troubleshooting

### Issue: Low LYTX Match Rate (<50%)

**Causes:**
- Registration format inconsistency
- Missing vehicles in vehicles table
- Typos in registration numbers

**Solutions:**
1. Review `unmatched_lytx_events` for patterns
2. Add missing vehicles to vehicles table
3. Standardize registration format (remove spaces/dashes)
4. Lower fuzzy matching threshold (edit script, change 0.85 to 0.75)

### Issue: Low Guardian Match Rate (<40%)

**Causes:**
- Name format differences
- Missing drivers in drivers table
- Nicknames vs full names

**Solutions:**
1. Review `unmatched_driver_names` for patterns
2. Add missing drivers to drivers table
3. Create name aliases/mappings
4. Lower fuzzy matching threshold (edit script, change 0.80 to 0.70)

### Issue: Few Assignments Created

**Causes:**
- Inconsistent driver-vehicle pairing
- Not enough event data (< 3 events per pair)
- Short time spans

**Solutions:**
1. Review `driver_assignment_coverage`
2. Lower event count threshold (edit script, change 3 to 2)
3. Add manual assignments for known pairings
4. Wait for more event data to accumulate

### Issue: Low Trip-Delivery Correlation Rate

**Causes:**
- GPS trips not matched to vehicles
- Deliveries not matched to vehicles
- Time windows too narrow

**Solutions:**
1. Ensure Phase 3.1 completed successfully (LYTX vehicle links)
2. Ensure captive_deliveries has vehicle_id populated
3. Widen time window (edit script, change 30 to 60 minutes)
4. Review `deliveries_without_trips` and `trips_without_deliveries`

### Issue: Script Takes Too Long (>5 minutes)

**Causes:**
- Large dataset (>100k records)
- Missing indexes
- Fuzzy matching on huge cross joins

**Solutions:**
1. Run scripts individually instead of PHASE3_MASTER
2. Verify indexes exist: `\di` (psql) or check table indexes in Supabase
3. Add additional filters to reduce cross join size
4. Consider batching updates (e.g., by date range)

---

## 📝 Notes

### Re-running Scripts

Most Phase 3 scripts are **idempotent** - safe to run multiple times:

- ✅ **Safe to re-run:** PHASE3_01, PHASE3_02, PHASE3_03, PHASE3_05, PHASE3_06
- ⚠️ **May create duplicates:** PHASE3_04 (has conflict check, but review results)
- 💡 **Tip:** If you add new drivers/vehicles, re-run PHASE3_01 and PHASE3_02 to link new matches

### Performance Considerations

**Large datasets (>100k events):**
- Consider adding WHERE clauses to filter by date range
- Run scripts individually to monitor progress
- May need to increase statement timeout in Supabase

**Fuzzy matching:**
- Most expensive operation (cross joins)
- Can be disabled by commenting out those sections
- Consider running overnight for very large datasets

### Data Privacy

All Phase 3 scripts:
- ✅ Only read/write to analytics tables
- ✅ No access to auth.users beyond foreign keys
- ✅ Grant SELECT to authenticated users only
- ✅ Use security_invoker for RLS inheritance

---

## 🎯 Success Criteria

Phase 3 is successful when:

- [x] LYTX → Vehicle link rate > 70%
- [x] Guardian → Driver link rate > 60%
- [x] Driver-vehicle assignments created (at least 10)
- [x] Trip-delivery correlations created
- [x] All monitoring views return results
- [x] data_quality_dashboard shows quality scores > 60
- [x] No critical alerts in data_quality_alerts (warnings OK)

---

## 📞 Next Steps

After Phase 3:

1. ✅ **Review unmatched records** (use review views)
2. ✅ **Add missing drivers/vehicles** to master tables
3. ✅ **Manually verify** low-confidence correlations
4. ✅ **Monitor data quality** using dashboard views
5. ⏭️ **Optional: Phase 4** - Frontend interface updates to display correlations

---

## 📚 Related Documentation

- `START_HERE.md` - Overall project guide
- `QUICK_FIX_GUIDE.md` - Quick fixes for common errors
- `database/fixes/README_ANALYTICS_FIXES.md` - Phase 1-2 documentation
- `ANALYTICS_SCHEMA_MASTER_PLAN.md` - Complete schema specification

---

## 🤝 Support

**Issues?**
- Check `data_quality_alerts` for specific problems
- Review troubleshooting section above
- Check Supabase logs for error details

**Questions?**
- Review query examples in this document
- Check individual script comments for details
- Use monitoring views to understand data state

---

Last Updated: 2025-10-01
