# Guardian Driver Attribution - Quick Start Guide

## 🚀 5-Minute Quick Start

### Problem
Guardian dashboard shows "Unknown Driver" for all events.

### Solution
Run 2 SQL migrations (15 minutes total).

---

## Step 1: Run Diagnostic (Optional but Recommended)

**Purpose**: Understand your current state

**File**: `database/diagnostics/guardian_driver_attribution_diagnostic.sql`

**How**:
1. Open Supabase SQL Editor
2. Copy contents of diagnostic file
3. Paste and run
4. Review recommendations

**Time**: 30 seconds

---

## Step 2: Direct Name Matching (Required)

**Purpose**: Match Guardian driver names to drivers table

**File**: `database/fixes/PHASE3_02_populate_guardian_driver_ids.sql`

**How**:
1. Open Supabase SQL Editor
2. Copy entire file
3. Paste and run
4. Wait for completion

**Expected Output**:
```
✓ Matched 450 events by exact name
✓ Matched 120 events by name variations
✓ Matched 80 events by fuzzy matching
Now linked: 650 (65.0%)
```

**Time**: 5 minutes

---

## Step 3: Cross-Source Correlation (Recommended)

**Purpose**: Correlate with LYTX and MtData to fill remaining gaps

**File**: `database/migrations/create_unified_timelines.sql`

**How**:
1. Open Supabase SQL Editor
2. Copy entire file
3. Paste and run
4. Wait for completion

**Expected Output**:
```
✓ Created vehicle_unified_timeline
✓ Created driver_event_correlation
✓ Created driver_unified_timeline
Correlation Coverage:
  direct_guardian: 650 (65%)
  lytx_hourly: 180 (18%)
  mtdata_trip: 120 (12%)
  lytx_daily: 50 (5%)
  Total: 1000 (100%)
```

**Time**: 10 minutes

---

## Step 4: Verify Results

**Query**:
```sql
-- Check overall coverage
SELECT
  COUNT(*) as total_events,
  COUNT(driver_id) as with_driver,
  ROUND(COUNT(driver_id) * 100.0 / COUNT(*), 1) as coverage_pct
FROM guardian_events;

-- Check correlation breakdown
SELECT
  correlation_method,
  COUNT(*) as events,
  ROUND(AVG(confidence), 2) as avg_confidence
FROM driver_event_correlation
GROUP BY correlation_method
ORDER BY COUNT(*) DESC;
```

**Expected**:
- Coverage: 80-90%
- Methods: direct_guardian, lytx_hourly, mtdata_trip, lytx_daily

**Time**: 1 minute

---

## Step 5: Update Dashboard (Optional)

**File**: `src/pages/GuardianDashboard.tsx`

**Change** (Line 117):
```typescript
// BEFORE:
.from('guardian_events')

// AFTER:
.from('driver_unified_timeline')
.eq('source', 'guardian')
```

**Field mappings**:
- `detection_time` → `occurred_at`
- `driver_name` → `driver_name` (now populated!)
- Add: `correlation_method`, `correlation_confidence`

**Time**: 5 minutes

---

## Decision Tree

```
START: Guardian shows "Unknown Driver"
│
├─→ Has driver_id column?
│   ├─ NO → Run Step 2 (PHASE3_02)
│   └─ YES → Check coverage
│       ├─ <70% → Run Step 3 (Unified Timelines)
│       └─ >70% → DONE (Optional: Step 3 for complete view)
│
└─→ After Step 2:
    ├─ Coverage >70% → DONE
    └─ Coverage <70% → Run Step 3 (Unified Timelines)
```

---

## Troubleshooting

### Issue: Low coverage after Step 2 (<40%)

**Diagnosis**:
```sql
SELECT * FROM unmatched_driver_names
ORDER BY event_count DESC
LIMIT 20;
```

**Solution**: Add missing drivers to `drivers` table

---

### Issue: LYTX correlation not working (Step 3)

**Diagnosis**:
```sql
-- Check vehicle registration overlap
SELECT COUNT(*) FROM guardian_events ge
JOIN lytx_safety_events l ON
  UPPER(TRIM(ge.vehicle_registration)) = UPPER(TRIM(l.vehicle_registration))
  AND ABS(EXTRACT(EPOCH FROM (l.event_datetime - ge.detection_time))) <= 3600;
```

**Solution**: Standardize vehicle registrations

---

### Issue: Dashboard still shows "Unknown Driver"

**Solution**: Update query to use `driver_unified_timeline` instead of `guardian_events`

---

## Expected Results

| Metric | Before | After Step 2 | After Step 3 |
|--------|--------|--------------|--------------|
| **Coverage** | 0% | 60-70% | 80-90% |
| **Unknown Drivers** | 100% | 30-40% | 10-20% |
| **Time Invested** | - | 5 min | 15 min |

---

## Files Reference

### **Run These** (in order):
1. `database/diagnostics/guardian_driver_attribution_diagnostic.sql` (Optional)
2. `database/fixes/PHASE3_02_populate_guardian_driver_ids.sql` (Required)
3. `database/migrations/create_unified_timelines.sql` (Recommended)

### **Read These** (for details):
- `GUARDIAN_DRIVER_ATTRIBUTION_GUIDE.md` - Complete guide
- `GUARDIAN_IMPROVEMENTS_README.md` - Background & context

---

## FAQ

**Q: Will this modify existing data?**
A: Step 2 adds/populates `driver_id` column. Step 3 only creates views (read-only).

**Q: Can I run these multiple times?**
A: Yes, both are safe to re-run.

**Q: What if I don't have LYTX or MtData?**
A: Step 2 will still work. Step 3 will skip missing sources.

**Q: How do I undo this?**
A:
```sql
-- Remove driver_id column
ALTER TABLE guardian_events DROP COLUMN driver_id;

-- Drop views
DROP VIEW IF EXISTS driver_unified_timeline CASCADE;
DROP VIEW IF EXISTS driver_event_correlation CASCADE;
DROP VIEW IF EXISTS vehicle_unified_timeline CASCADE;
```

---

## Next Steps

After driver attribution is working:

1. ✅ Update dashboard queries
2. ✅ Add driver filter dropdown
3. ✅ Show correlation confidence badges
4. ✅ Create driver profile pages
5. ✅ Add manual override UI

---

**Need Help?**
Run the diagnostic script first, then consult `GUARDIAN_DRIVER_ATTRIBUTION_GUIDE.md`
