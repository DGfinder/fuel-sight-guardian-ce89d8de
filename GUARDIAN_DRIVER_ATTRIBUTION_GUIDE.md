# Guardian Driver Attribution - Complete Implementation Guide

## 🎯 Problem Statement

**Current Issue**: Guardian dashboard shows "Unknown Driver" for most events

**Root Cause**: Guardian CSV imports contain driver names (`driver_name` field) but they're not linked to the `drivers` table (`driver_id` is NULL)

**Goal**: Reduce "Unknown Driver" from ~100% to <15% using existing data from LYTX and MtData

---

## 📊 Available Solutions

You have **3 migration strategies** already created:

| Solution | Coverage | Complexity | Time | File |
|----------|----------|------------|------|------|
| **Option 1: Direct Name Matching** | 60-70% | Low | 5 min | `PHASE3_02_populate_guardian_driver_ids.sql` |
| **Option 2: Cross-Source Correlation** | 85-90% | High | 10 min | `create_guardian_cross_source_attribution.sql` |
| **Option 3: Unified Timelines** | 80-85% | Low | 10 min | `create_unified_timelines.sql` |

---

## 🚀 **RECOMMENDED: Quick Win Path**

### **Step 1: Run Direct Name Matching** (5 minutes)

This is the foundation - it must be run first.

**File**: `database/fixes/PHASE3_02_populate_guardian_driver_ids.sql`

**What it does**:
1. Adds `driver_id` column to `guardian_events` table
2. Matches Guardian CSV driver names to `drivers` table
3. Handles name variations (John Smith ↔ Smith, John)
4. Fuzzy matching for typos (>80% similarity)
5. Creates views for unmatched names

**How to run**:
```sql
-- In Supabase SQL Editor:
-- 1. Open file: database/fixes/PHASE3_02_populate_guardian_driver_ids.sql
-- 2. Copy entire file
-- 3. Paste and run
-- 4. Wait for completion messages
```

**Expected Output**:
```
=== PHASE 3.2: LINKING GUARDIAN EVENTS TO DRIVERS ===
✓ Name normalization function created
✓ Matched 450 events by exact name
✓ Matched 120 events by name variations
✓ Matched 80 events by fuzzy matching

AFTER POPULATION:
  Total Guardian events: 1000
  Now linked: 650 (65.0%)
  Still unlinked: 350 (35.0%)
```

**Verification**:
```sql
-- Check coverage
SELECT
  COUNT(*) as total_events,
  COUNT(driver_id) as with_driver,
  COUNT(*) FILTER (WHERE driver_id IS NULL) as without_driver,
  ROUND(COUNT(driver_id) * 100.0 / COUNT(*), 1) as coverage_pct
FROM guardian_events;

-- See unmatched names
SELECT * FROM unmatched_driver_names
ORDER BY event_count DESC
LIMIT 20;
```

---

### **Step 2: Add Unified Timeline System** (10 minutes)

This gives you automatic correlation with LYTX and MtData.

**File**: `database/migrations/create_unified_timelines.sql`

**What it does**:
1. Creates `vehicle_unified_timeline` - All events by vehicle (Guardian + LYTX + MtData)
2. Creates `driver_event_correlation` - Matches Guardian events to drivers using:
   - Direct Guardian CSV (if exists)
   - LYTX events ±1 hour (same vehicle)
   - MtData trips (event during trip)
   - LYTX events same day (fallback)
3. Creates `driver_unified_timeline` - All events by driver

**How to run**:
```sql
-- In Supabase SQL Editor:
-- 1. Open file: database/migrations/create_unified_timelines.sql
-- 2. Copy entire file
-- 3. Paste and run
-- 4. Wait for completion messages
```

**Expected Output**:
```
✓ Created vehicle_unified_timeline
✓ Created driver_event_correlation
✓ Created driver_unified_timeline
✓ Created performance indexes

Correlation Coverage:
  direct_guardian: 650 events (65%)
  lytx_hourly: 180 events (18%)
  mtdata_trip: 120 events (12%)
  lytx_daily: 50 events (5%)
  Total: 1000 events (100% coverage!)
```

**Verification**:
```sql
-- Check correlation breakdown
SELECT
  correlation_method,
  COUNT(*) as event_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage,
  ROUND(AVG(confidence), 2) as avg_confidence
FROM driver_event_correlation
GROUP BY correlation_method
ORDER BY event_count DESC;

-- Sample unified timeline for a vehicle
SELECT * FROM vehicle_unified_timeline
WHERE vehicle_registration = '1ABC123'
ORDER BY occurred_at DESC
LIMIT 20;
```

---

### **Result After Steps 1 + 2**

**Before**:
- Guardian events: 1000
- With driver: 0 (0%)
- Unknown driver: 1000 (100%)

**After**:
- Guardian events: 1000
- With driver: ~850 (85%)
- Unknown driver: ~150 (15%)

**Query to use in dashboard**:
```sql
-- Instead of: guardian_events
-- Use: driver_unified_timeline

SELECT * FROM driver_unified_timeline
WHERE fleet = 'Stevemacs'
  AND occurred_at >= NOW() - INTERVAL '30 days'
ORDER BY occurred_at DESC;
```

---

## 🔬 Alternative: Maximum Coverage Path

If you need 90%+ coverage and don't mind complexity:

### **Run Option 1 + Option 2** (15 minutes)

**Step 1**: Run `PHASE3_02_populate_guardian_driver_ids.sql` (same as above)

**Step 2**: Run `create_guardian_cross_source_attribution.sql`

**File**: `database/migrations/create_guardian_cross_source_attribution.sql`

**What it does**:
- Creates `guardian_events_enriched` view with advanced correlation
- Includes vehicle assignments (if PHASE3 tables exist)
- Adds confidence scoring (0.0-1.0)
- Creates audit trail views

**Expected Coverage**: 85-90% (slightly better than Unified Timelines)

**Trade-off**: More complex queries, harder to maintain

---

## 📋 Pre-Flight Checklist

**Before running anything**, verify your data:

```sql
-- ✅ Check 1: Guardian events exist
SELECT COUNT(*), MIN(detection_time), MAX(detection_time)
FROM guardian_events;
-- Expected: >0 events with recent dates

-- ✅ Check 2: Driver names exist in Guardian
SELECT COUNT(*), COUNT(DISTINCT driver_name)
FROM guardian_events
WHERE driver_name IS NOT NULL AND driver_name != '';
-- Expected: Should be >0

-- ✅ Check 3: Drivers table exists
SELECT COUNT(*), COUNT(DISTINCT full_name)
FROM drivers;
-- Expected: >0 drivers

-- ✅ Check 4: LYTX events exist
SELECT COUNT(*), MIN(event_datetime), MAX(event_datetime)
FROM lytx_safety_events;
-- Expected: >0 events with recent dates

-- ✅ Check 5: MtData trips exist
SELECT COUNT(*), MIN(start_time), MAX(end_time)
FROM mtdata_trip_history;
-- Expected: >0 trips with recent dates

-- ✅ Check 6: Vehicle registrations match
SELECT
  'Guardian' as source,
  COUNT(DISTINCT vehicle_registration) as unique_vehicles
FROM guardian_events
UNION ALL
SELECT 'LYTX', COUNT(DISTINCT vehicle_registration)
FROM lytx_safety_events
UNION ALL
SELECT 'MtData', COUNT(DISTINCT vehicle_registration)
FROM mtdata_trip_history;
-- Expected: Similar vehicle counts across sources
```

---

## 🐛 Troubleshooting

### **Issue 1: Low Coverage After Step 1 (<40%)**

**Symptoms**:
```sql
SELECT COUNT(*), COUNT(driver_id)
FROM guardian_events;
-- Result: Only 30-40% have driver_id
```

**Diagnosis**:
```sql
-- Check name format differences
SELECT
  ge.driver_name as guardian_name,
  d.full_name as driver_table_name
FROM guardian_events ge, drivers d
WHERE UPPER(TRIM(ge.driver_name)) LIKE UPPER(TRIM(d.full_name)) || '%'
LIMIT 10;
```

**Solutions**:
1. **Add missing drivers to drivers table**:
   ```sql
   -- See which names are unmatched
   SELECT * FROM unmatched_driver_names
   ORDER BY event_count DESC;

   -- Add them manually
   INSERT INTO drivers (full_name, fleet, active)
   VALUES ('John Smith', 'Stevemacs', true);

   -- Re-run PHASE3_02 (it's safe to run multiple times)
   ```

2. **Check for name format issues**:
   ```sql
   -- Guardian has: "Smith, John"
   -- Drivers has: "John Smith"
   -- PHASE3_02 handles this, but verify:

   SELECT driver_name FROM guardian_events
   WHERE driver_id IS NULL
   LIMIT 10;
   ```

---

### **Issue 2: LYTX Correlation Fails (Step 2)**

**Symptoms**:
```sql
SELECT correlation_method, COUNT(*)
FROM driver_event_correlation
GROUP BY correlation_method;
-- Result: No 'lytx_hourly' or 'mtdata_trip' entries
```

**Diagnosis**:
```sql
-- Check if vehicle registrations match
SELECT
  ge.vehicle_registration as guardian_vehicle,
  l.vehicle_registration as lytx_vehicle,
  ABS(EXTRACT(EPOCH FROM (l.event_datetime - ge.detection_time))) / 3600.0 as time_diff_hours
FROM guardian_events ge
JOIN lytx_safety_events l ON
  UPPER(TRIM(ge.vehicle_registration)) = UPPER(TRIM(l.vehicle_registration))
  AND ABS(EXTRACT(EPOCH FROM (l.event_datetime - ge.detection_time))) <= 3600
LIMIT 10;
-- If empty, vehicles don't match or time windows don't overlap
```

**Solutions**:
1. **Standardize vehicle registrations**:
   ```sql
   -- Check for variations
   SELECT DISTINCT vehicle_registration
   FROM guardian_events
   WHERE vehicle_registration IS NOT NULL
   ORDER BY vehicle_registration
   LIMIT 20;

   -- Compare with LYTX
   SELECT DISTINCT vehicle_registration
   FROM lytx_safety_events
   ORDER BY vehicle_registration
   LIMIT 20;

   -- Fix mismatches (e.g., "1ABC-123" vs "1ABC123")
   UPDATE guardian_events
   SET vehicle_registration = REPLACE(vehicle_registration, '-', '')
   WHERE vehicle_registration LIKE '%-%';
   ```

2. **Check data freshness**:
   ```sql
   -- Ensure LYTX and Guardian overlap in time
   SELECT
     'Guardian' as source,
     MIN(detection_time) as earliest,
     MAX(detection_time) as latest
   FROM guardian_events
   UNION ALL
   SELECT 'LYTX',
     MIN(event_datetime),
     MAX(event_datetime)
   FROM lytx_safety_events;
   ```

---

### **Issue 3: Dashboard Still Shows "Unknown Driver"**

**Diagnosis**:
```sql
-- Check if you're querying the right table/view
-- WRONG:
SELECT * FROM guardian_events;  -- Original table (no correlation)

-- CORRECT:
SELECT * FROM driver_unified_timeline;  -- With correlation
-- OR
SELECT * FROM guardian_events_enriched;  -- With correlation
```

**Solution**:
Update `src/pages/GuardianDashboard.tsx` to use enriched views:

```typescript
// BEFORE (Line 117):
let eventsQuery = supabase
  .from('guardian_events')  // ❌ Wrong table
  .select('*')

// AFTER:
let eventsQuery = supabase
  .from('driver_unified_timeline')  // ✅ Use unified timeline
  .select('*')
  .eq('source', 'guardian')  // Filter to Guardian events only
```

---

## 📊 Expected Results

### **Correlation Method Breakdown**

After running Step 1 + Step 2:

```sql
SELECT
  correlation_method,
  COUNT(*) as events,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) || '%' as percentage
FROM driver_event_correlation
GROUP BY correlation_method
ORDER BY COUNT(*) DESC;
```

**Expected Output**:
```
correlation_method | events | percentage
-------------------+--------+------------
direct_guardian    |    650 |  65.0%
lytx_hourly        |    180 |  18.0%
mtdata_trip        |    120 |  12.0%
lytx_daily         |     50 |   5.0%
```

**Total Coverage**: **100%** (all events matched)

---

### **Coverage by Confidence**

```sql
SELECT
  CASE
    WHEN confidence >= 0.8 THEN 'High (0.8-1.0)'
    WHEN confidence >= 0.6 THEN 'Medium (0.6-0.8)'
    WHEN confidence >= 0.4 THEN 'Low (0.4-0.6)'
    ELSE 'Very Low (<0.4)'
  END as confidence_bracket,
  COUNT(*) as events,
  ROUND(AVG(confidence), 2) as avg_confidence
FROM driver_event_correlation
GROUP BY confidence_bracket
ORDER BY MIN(confidence) DESC;
```

**Expected Output**:
```
confidence_bracket | events | avg_confidence
-------------------+--------+----------------
High (0.8-1.0)     |    650 |  1.00
Medium (0.6-0.8)   |    300 |  0.75
Low (0.4-0.6)      |     50 |  0.50
```

---

## 🔍 Verification Queries

### **1. Check Overall Coverage**

```sql
-- All Guardian events
SELECT
  COUNT(*) as total_guardian_events,
  COUNT(driver_id) as direct_matched,
  ROUND(COUNT(driver_id) * 100.0 / COUNT(*), 1) as direct_coverage_pct
FROM guardian_events;

-- With correlation
SELECT
  COUNT(*) as total_events,
  COUNT(DISTINCT driver_id) as unique_drivers,
  ROUND(AVG(confidence), 2) as avg_confidence
FROM driver_event_correlation;
```

---

### **2. Find Low-Confidence Matches for Review**

```sql
SELECT
  dec.guardian_event_id,
  ge.vehicle_registration,
  ge.detection_time,
  ge.event_type,
  ge.driver_name as original_driver,
  dec.driver_name as correlated_driver,
  dec.correlation_method,
  dec.confidence,
  dec.time_difference
FROM driver_event_correlation dec
JOIN guardian_events ge ON ge.id = dec.guardian_event_id
WHERE dec.confidence < 0.6
ORDER BY dec.confidence ASC, ge.detection_time DESC
LIMIT 20;
```

---

### **3. Test Unified Timeline for a Specific Vehicle**

```sql
-- See all events from all sources for one vehicle
SELECT
  source,
  occurred_at,
  event_type,
  driver_name,
  severity
FROM vehicle_unified_timeline
WHERE vehicle_registration = '1ABC123'
  AND occurred_at >= NOW() - INTERVAL '30 days'
ORDER BY occurred_at DESC;
```

---

### **4. Test Driver Timeline**

```sql
-- See all events for a specific driver
SELECT
  source,
  occurred_at,
  event_type,
  vehicle_registration,
  severity,
  correlation_method,
  correlation_confidence
FROM driver_unified_timeline
WHERE driver_name = 'John Smith'
  AND occurred_at >= NOW() - INTERVAL '30 days'
ORDER BY occurred_at DESC;
```

---

## 🎨 Dashboard Integration

### **Update GuardianDashboard Component**

**File**: `src/pages/GuardianDashboard.tsx`

**Current code** (Lines 117-128):
```typescript
let eventsQuery = supabase
  .from('guardian_events')
  .select('*')
  .gte('detection_time', lastYearStart.toISOString())
  .order('detection_time', { ascending: false });
```

**Replace with** (Option A - Unified Timeline):
```typescript
let eventsQuery = supabase
  .from('driver_unified_timeline')
  .select('*')
  .eq('source', 'guardian')  // Guardian events only
  .gte('occurred_at', lastYearStart.toISOString())
  .order('occurred_at', { ascending: false });
```

**Or** (Option B - Enriched View):
```typescript
let eventsQuery = supabase
  .from('guardian_events_enriched')
  .select('*')
  .gte('detection_time', lastYearStart.toISOString())
  .order('detection_time', { ascending: false });
```

**Update field mappings**:
```typescript
// If using driver_unified_timeline:
// - Use: event.driver_name (correlated driver)
// - Use: event.occurred_at (instead of detection_time)
// - Use: event.correlation_confidence (to show confidence)

// If using guardian_events_enriched:
// - Use: event.enriched_driver_name (correlated driver)
// - Use: event.detection_time (same as before)
// - Use: event.attribution_confidence (to show confidence)
```

---

## 📁 File Reference

### **Migration Files** (Run these in Supabase SQL Editor)

1. **`database/fixes/PHASE3_02_populate_guardian_driver_ids.sql`**
   - Step 1: Direct name matching
   - Must run first
   - Safe to re-run

2. **`database/migrations/create_unified_timelines.sql`**
   - Step 2A: Unified timeline system (RECOMMENDED)
   - Simple and maintainable
   - 80-85% coverage

3. **`database/migrations/create_guardian_cross_source_attribution.sql`**
   - Step 2B: Cross-source correlation (ADVANCED)
   - More complex
   - 85-90% coverage

### **Frontend Files** (Update after migrations)

- **`src/pages/GuardianDashboard.tsx`** - Main dashboard (lines 117-128)
- **`src/components/GuardianMonthlyChart.tsx`** - Chart component
- **`src/hooks/useGuardianEventsEnriched.ts`** - React hook (may need creating)

---

## ✅ Success Criteria

After completing Steps 1 + 2:

- [ ] `guardian_events` has `driver_id` column populated
- [ ] Coverage: >80% of Guardian events have drivers
- [ ] Views created: `driver_unified_timeline`, `driver_event_correlation`
- [ ] Dashboard shows driver names instead of "Unknown Driver"
- [ ] Can query by driver across all sources (Guardian + LYTX + MtData)
- [ ] Confidence scores tracked for audit

---

## 🎓 Next Steps

After driver attribution is working:

1. **Update dashboard UI** to show:
   - Driver names with confidence badges
   - Correlation method indicators
   - Filter by driver dropdown

2. **Create driver profile pages**:
   - All events for one driver
   - Safety metrics
   - Performance trends

3. **Add manual override system**:
   - UI to manually link events to drivers
   - Override low-confidence automatic matches

---

**Need Help?** Run the diagnostic queries in the next section to identify issues.
