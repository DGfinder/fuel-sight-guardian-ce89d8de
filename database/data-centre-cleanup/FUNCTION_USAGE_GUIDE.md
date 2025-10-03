# Data Centre Query Functions - Usage Guide

## Overview

This guide covers all comprehensive query functions created during the Data Centre cleanup. These functions enable single-query access to complete profiles for drivers, vehicles, trips, and deliveries.

---

## Quick Reference

| Function | Purpose | Returns |
|----------|---------|---------|
| `get_driver_complete_profile(driver_id)` | Complete driver information | JSON |
| `get_vehicle_complete_profile(vehicle_id)` | Complete vehicle information | JSON |
| `get_trip_complete_data(trip_id)` | Complete trip details | JSON |
| `search_driver_by_name(name)` | Find drivers by name | TABLE |
| `search_vehicle_by_rego(rego)` | Find vehicles by registration | TABLE |
| `get_delivery_chain(delivery_key)` | Delivery-trip-event chain | JSON |

---

## 1. `get_driver_complete_profile(driver_id UUID)`

### Purpose
Returns comprehensive driver profile including all assignments, performance metrics, events, trips, deliveries, and incidents.

### Signature
```sql
get_driver_complete_profile(p_driver_id UUID) RETURNS JSON
```

### Usage

```sql
-- Get complete driver profile
SELECT get_driver_complete_profile('550e8400-e29b-41d4-a716-446655440000')::jsonb;

-- Pretty print the JSON
SELECT jsonb_pretty(
  get_driver_complete_profile('550e8400-e29b-41d4-a716-446655440000')::jsonb
);

-- Extract specific sections
SELECT
  (get_driver_complete_profile('550e8400-e29b-41d4-a716-446655440000')::jsonb)->>'driver_info' as driver_info,
  (get_driver_complete_profile('550e8400-e29b-41d4-a716-446655440000')::jsonb)->>'current_assignment' as current_vehicle;
```

### Returns

```json
{
  "driver_info": {
    "id": "uuid",
    "name": {
      "first_name": "John",
      "last_name": "Smith",
      "full_name": "John Smith",
      "preferred_name": "Johnny"
    },
    "employment": {
      "employee_id": "EMP001",
      "fleet": "Stevemacs",
      "depot": "Perth",
      "hire_date": "2020-01-15",
      "status": "Active"
    },
    "contact": { ... },
    "licensing": { ... },
    "performance_scores": {
      "safety_score": 8.5,
      "lytx_score": 7.8,
      "guardian_score": 9.1,
      "overall_rating": "Good"
    }
  },
  "name_mappings": [
    {
      "system": "LYTX",
      "mapped_name": "John Smith",
      "is_primary": true,
      "confidence_score": 1.0
    }
  ],
  "current_assignment": {
    "vehicle_id": "uuid",
    "registration": "ABC123",
    "fleet": "Stevemacs",
    "assigned_at": "2025-09-01T08:00:00Z",
    "assignment_duration_days": 32
  },
  "assignment_history": [...],
  "latest_performance": {...},
  "lytx_events_summary": {
    "total_events": 15,
    "last_30_days": 3,
    "avg_safety_score": 7.2,
    "top_triggers": [...],
    "recent_events": [...]
  },
  "guardian_events_summary": {...},
  "trip_history_summary": {...},
  "delivery_summary": {...},
  "incident_summary": {...}
}
```

### Use Cases

1. **Driver Performance Review:**
   ```sql
   SELECT
     (profile->'driver_info'->'name'->>'full_name') as driver_name,
     (profile->'latest_performance'->'lytx_metrics'->>'safety_score')::decimal as lytx_score,
     (profile->'lytx_events_summary'->>'total_events')::int as total_events
   FROM (
     SELECT get_driver_complete_profile(id)::jsonb as profile
     FROM drivers
     WHERE status = 'Active'
   ) profiles;
   ```

2. **Risk Driver Identification:**
   ```sql
   SELECT
     (profile->'driver_info'->'name'->>'full_name') as driver_name,
     (profile->'incident_summary'->>'total_incidents')::int as incidents,
     (profile->'lytx_events_summary'->>'last_30_days')::int as recent_events
   FROM (
     SELECT get_driver_complete_profile(id)::jsonb as profile
     FROM drivers
     WHERE status = 'Active'
   ) profiles
   WHERE (profile->'incident_summary'->>'total_incidents')::int > 5
   ORDER BY (profile->'incident_summary'->>'total_incidents')::int DESC;
   ```

---

## 2. `get_vehicle_complete_profile(vehicle_id UUID)`

### Purpose
Returns comprehensive vehicle profile including driver history, maintenance, events, trips, and deliveries.

### Signature
```sql
get_vehicle_complete_profile(p_vehicle_id UUID) RETURNS JSON
```

### Usage

```sql
-- Get complete vehicle profile
SELECT get_vehicle_complete_profile('660e8400-e29b-41d4-a716-446655440000')::jsonb;

-- Check vehicle compliance status
SELECT
  (profile->'vehicle_info'->>'registration') as rego,
  (profile->'compliance_status'->'compliance_items') as compliance
FROM (
  SELECT get_vehicle_complete_profile(id)::jsonb as profile
  FROM vehicles
  WHERE fleet = 'Stevemacs'
) profiles;
```

### Returns

```json
{
  "vehicle_info": {
    "id": "uuid",
    "registration": "ABC123",
    "fleet": "Stevemacs",
    "depot": "Perth",
    "status": "Active",
    "specifications": {
      "make": "Isuzu",
      "model": "FRR500",
      "year": 2019,
      "vin": "..."
    },
    "devices": {
      "guardian_unit": "GU12345",
      "lytx_device": "LX67890"
    },
    "metrics": {
      "safety_score": 8.2,
      "fuel_efficiency": 12.5,
      "utilization": 85,
      "total_deliveries": 1250,
      "total_kilometers": 45000
    }
  },
  "current_driver": {
    "driver_id": "uuid",
    "driver_name": "John Smith",
    "employee_id": "EMP001",
    "assigned_at": "2025-09-01T08:00:00Z",
    "assignment_duration_days": 32
  },
  "assignment_history": [...],
  "maintenance_records": [...],
  "compliance_status": {
    "registration_expiry": "2025-12-31",
    "insurance_expiry": "2025-11-30",
    "inspection_due": "2025-10-15",
    "next_service": "2025-11-01",
    "compliance_items": [...]
  },
  "lytx_events_summary": {...},
  "guardian_events_summary": {...},
  "trip_history_summary": {...},
  "delivery_summary": {...},
  "efficiency_metrics": {...}
}
```

### Use Cases

1. **Maintenance Due Report:**
   ```sql
   SELECT
     (profile->'vehicle_info'->>'registration') as registration,
     (profile->'compliance_status'->>'next_service')::date as next_service,
     (profile->'current_driver'->>'driver_name') as current_driver
   FROM (
     SELECT get_vehicle_complete_profile(id)::jsonb as profile
     FROM vehicles
     WHERE status = 'Active'
   ) profiles
   WHERE (profile->'compliance_status'->>'next_service')::date <= CURRENT_DATE + 7
   ORDER BY (profile->'compliance_status'->>'next_service')::date;
   ```

2. **Fleet Efficiency Analysis:**
   ```sql
   SELECT
     (profile->'vehicle_info'->>'registration') as rego,
     (profile->'efficiency_metrics'->>'fuel_efficiency')::decimal as fuel_eff,
     (profile->'efficiency_metrics'->>'utilization_rate')::int as utilization
   FROM (
     SELECT get_vehicle_complete_profile(id)::jsonb as profile
     FROM vehicles
     WHERE fleet = 'Stevemacs'
   ) profiles
   ORDER BY (profile->'efficiency_metrics'->>'fuel_efficiency')::decimal DESC;
   ```

---

## 3. `get_trip_complete_data(trip_id UUID)`

### Purpose
Returns comprehensive trip data including vehicle, driver, events, deliveries, and route analysis.

### Signature
```sql
get_trip_complete_data(p_trip_id UUID) RETURNS JSON
```

### Usage

```sql
-- Get complete trip data
SELECT get_trip_complete_data('770e8400-e29b-41d4-a716-446655440000')::jsonb;

-- Find trips with high event count
SELECT
  (trip->'trip_data'->>'trip_external_id') as trip_id,
  (trip->'event_summary'->>'total_events')::int as events,
  (trip->'driver_info'->>'driver_name') as driver
FROM (
  SELECT get_trip_complete_data(id)::jsonb as trip
  FROM mtdata_trip_history
  WHERE trip_date_computed >= CURRENT_DATE - 30
) trips
WHERE (trip->'event_summary'->>'total_events')::int > 2
ORDER BY (trip->'event_summary'->>'total_events')::int DESC;
```

### Returns

```json
{
  "trip_data": {
    "trip_id": "uuid",
    "trip_external_id": "VEH123-456",
    "trip_number": 456,
    "timing": {
      "start_time": "2025-10-03T08:30:00Z",
      "end_time": "2025-10-03T14:45:00Z",
      "travel_time_hours": 6.25,
      "idling_time_hours": 0.5
    },
    "locations": {
      "start_location": "Perth Depot",
      "start_latitude": -31.9505,
      "start_longitude": 115.8605,
      "end_location": "Perth Depot",
      "end_latitude": -31.9505,
      "end_longitude": 115.8605
    },
    "metrics": {
      "distance_km": 245.5,
      "average_speed_kph": 65.2,
      "route_efficiency_score": 92.5,
      "odometer_reading": 45678
    }
  },
  "vehicle_info": {...},
  "driver_info": {...},
  "lytx_events": [...],
  "guardian_events": [...],
  "event_summary": {
    "total_events": 4,
    "lytx_event_count": 2,
    "guardian_event_count": 2,
    "avg_lytx_safety_score": 6.5
  },
  "correlated_deliveries": [...],
  "delivery_summary": {
    "total_deliveries": 8,
    "total_volume_litres": 12500,
    "avg_confidence_score": 87.5,
    "high_confidence_count": 7
  },
  "route_analysis": {...}
}
```

### Use Cases

1. **Trip-Delivery Reconciliation:**
   ```sql
   SELECT
     (trip->'trip_data'->>'trip_external_id') as trip_id,
     (trip->'delivery_summary'->>'total_deliveries')::int as deliveries,
     (trip->'delivery_summary'->>'total_volume_litres')::decimal as volume,
     (trip->'delivery_summary'->>'avg_confidence_score')::decimal as confidence
   FROM (
     SELECT get_trip_complete_data(id)::jsonb as trip
     FROM mtdata_trip_history
     WHERE trip_date_computed >= CURRENT_DATE - 7
   ) trips
   WHERE (trip->'delivery_summary'->>'total_deliveries')::int > 0;
   ```

2. **Safety Event Analysis:**
   ```sql
   SELECT
     (trip->'trip_data'->>'trip_external_id') as trip_id,
     (trip->'driver_info'->>'driver_name') as driver,
     (trip->'event_summary'->>'total_events')::int as total_events,
     (trip->'event_summary'->>'avg_lytx_safety_score')::decimal as avg_score
   FROM (
     SELECT get_trip_complete_data(id)::jsonb as trip
     FROM mtdata_trip_history
     WHERE start_time >= CURRENT_DATE - 30
   ) trips
   WHERE (trip->'event_summary'->>'total_events')::int > 0
   ORDER BY (trip->'event_summary'->>'avg_lytx_safety_score')::decimal;
   ```

---

## 4. `search_driver_by_name(name TEXT)`

### Purpose
Search for drivers by name across all system name mappings.

### Signature
```sql
search_driver_by_name(p_name TEXT) RETURNS TABLE
```

### Usage

```sql
-- Find driver by partial name
SELECT * FROM search_driver_by_name('John');

-- Find driver with system mapping info
SELECT
  full_name,
  employee_id,
  fleet,
  depot,
  matched_systems,
  highest_confidence
FROM search_driver_by_name('Smith')
ORDER BY highest_confidence DESC;

-- Get full profile for search results
SELECT
  s.full_name,
  get_driver_complete_profile(s.driver_id)::jsonb as profile
FROM search_driver_by_name('John') s;
```

### Returns

| Column | Type | Description |
|--------|------|-------------|
| driver_id | UUID | Driver ID |
| full_name | TEXT | Full name (first + last) |
| matched_systems | TEXT[] | Systems where name matched |
| highest_confidence | DECIMAL | Highest confidence score |
| employee_id | TEXT | Employee ID |
| fleet | TEXT | Fleet name |
| depot | TEXT | Depot name |
| status | TEXT | Driver status |

### Use Cases

1. **Fuzzy Name Search:**
   ```sql
   -- Find all variations of "Michael"
   SELECT * FROM search_driver_by_name('Mich');
   -- Returns: Michael, Michelle, Mick, etc.
   ```

2. **System Cross-Reference:**
   ```sql
   -- Find drivers and their system mappings
   SELECT
     full_name,
     employee_id,
     matched_systems
   FROM search_driver_by_name('Wayne')
   WHERE 'LYTX' = ANY(matched_systems);
   ```

---

## 5. `search_vehicle_by_rego(rego TEXT)`

### Purpose
Search for vehicles by registration including alternative formats.

### Signature
```sql
search_vehicle_by_rego(p_rego TEXT) RETURNS TABLE
```

### Usage

```sql
-- Find vehicle by partial registration
SELECT * FROM search_vehicle_by_rego('ABC');

-- Include all registration variants
SELECT
  primary_registration,
  all_registrations,
  fleet,
  current_driver
FROM search_vehicle_by_rego('123');

-- Get full profile for search results
SELECT
  v.primary_registration,
  get_vehicle_complete_profile(v.vehicle_id)::jsonb as profile
FROM search_vehicle_by_rego('ABC') v;
```

### Returns

| Column | Type | Description |
|--------|------|-------------|
| vehicle_id | UUID | Vehicle ID |
| primary_registration | TEXT | Primary registration |
| all_registrations | TEXT[] | All registration formats |
| fleet | TEXT | Fleet name |
| depot | TEXT | Depot name |
| status | TEXT | Vehicle status |
| make | TEXT | Vehicle make |
| model | TEXT | Vehicle model |
| current_driver | TEXT | Current driver name |

### Use Cases

1. **Registration Lookup:**
   ```sql
   -- Handle registration format variations
   SELECT * FROM search_vehicle_by_rego('1ENG419');
   -- Matches: 1ENG419, 1 ENG 419, 1-ENG-419, etc.
   ```

2. **Fleet Management:**
   ```sql
   SELECT
     primary_registration,
     fleet,
     current_driver,
     status
   FROM search_vehicle_by_rego('%')
   WHERE fleet = 'Stevemacs'
     AND status = 'Active';
   ```

---

## 6. `get_delivery_chain(delivery_key TEXT)`

### Purpose
Returns complete delivery chain including trips, vehicles, drivers, and events.

### Signature
```sql
get_delivery_chain(p_delivery_key TEXT) RETURNS JSON
```

### Usage

```sql
-- Get complete delivery chain
SELECT get_delivery_chain('BOL123-2025-10-03-CustomerA')::jsonb;

-- Find high-confidence delivery chains
SELECT
  (chain->'delivery'->>'bill_of_lading') as bol,
  (chain->'delivery'->>'customer') as customer,
  jsonb_array_length(chain->'trips') as trip_count,
  jsonb_array_length(chain->'events'->'lytx_events') +
  jsonb_array_length(chain->'events'->'guardian_events') as event_count
FROM (
  SELECT get_delivery_chain(delivery_key)::jsonb as chain
  FROM captive_deliveries
  WHERE delivery_date >= CURRENT_DATE - 30
) chains;
```

### Returns

```json
{
  "delivery": {
    "delivery_key": "BOL123-2025-10-03-CustomerA",
    "bill_of_lading": "BOL123",
    "delivery_date": "2025-10-03",
    "customer": "CustomerA",
    "terminal": "Perth Terminal",
    "carrier": "SMB",
    "products": ["Diesel", "Unleaded"],
    "total_volume_litres": 12500,
    "record_count": 2
  },
  "trips": [
    {
      "trip_id": "uuid",
      "trip_external_id": "VEH123-456",
      "start_time": "2025-10-03T08:00:00Z",
      "end_time": "2025-10-03T14:00:00Z",
      "distance_km": 245.5,
      "vehicle": {...},
      "driver": {...},
      "correlation": {
        "confidence_score": 92.5,
        "match_type": "geographic_temporal",
        "terminal_distance_km": 0.5
      }
    }
  ],
  "events": {
    "lytx_events": [...],
    "guardian_events": [...]
  }
}
```

### Use Cases

1. **Delivery Verification:**
   ```sql
   -- Verify delivery completion with trip data
   SELECT
     (chain->'delivery'->>'bill_of_lading') as bol,
     (chain->'delivery'->>'customer') as customer,
     (chain->>'trips') as trips,
     CASE
       WHEN jsonb_array_length(chain->'trips') > 0 THEN 'Verified'
       ELSE 'Unverified'
     END as status
   FROM (
     SELECT get_delivery_chain(delivery_key)::jsonb as chain
     FROM captive_deliveries
     WHERE delivery_date = CURRENT_DATE
   ) chains;
   ```

2. **Safety Analysis:**
   ```sql
   -- Find deliveries with safety events
   SELECT
     (chain->'delivery'->>'bill_of_lading') as bol,
     jsonb_array_length(chain->'events'->'lytx_events') as lytx_events,
     jsonb_array_length(chain->'events'->'guardian_events') as guardian_events
   FROM (
     SELECT get_delivery_chain(delivery_key)::jsonb as chain
     FROM captive_deliveries
     WHERE delivery_date >= CURRENT_DATE - 7
   ) chains
   WHERE jsonb_array_length(chain->'events'->'lytx_events') > 0
      OR jsonb_array_length(chain->'events'->'guardian_events') > 0;
   ```

---

## Performance Tips

### 1. **Use Indexes Effectively**

All functions are optimized with indexes. For best performance:

```sql
-- Good: Uses indexes
SELECT * FROM search_driver_by_name('John')
WHERE status = 'Active';

-- Good: Indexed date range
SELECT get_trip_complete_data(id)
FROM mtdata_trip_history
WHERE trip_date_computed >= CURRENT_DATE - 30;
```

### 2. **Limit Result Sets**

```sql
-- Limit when exploring
SELECT * FROM search_driver_by_name('%') LIMIT 100;

-- Use specific criteria
SELECT * FROM search_vehicle_by_rego('ABC') -- Better than '%'
```

### 3. **Cache Results**

```sql
-- Create materialized view for common queries
CREATE MATERIALIZED VIEW active_driver_profiles AS
SELECT
  id,
  get_driver_complete_profile(id)::jsonb as profile
FROM drivers
WHERE status = 'Active';

-- Refresh periodically
REFRESH MATERIALIZED VIEW active_driver_profiles;
```

### 4. **Extract Only What You Need**

```sql
-- Good: Extract specific fields
SELECT
  (profile->'driver_info'->'name'->>'full_name') as name,
  (profile->'latest_performance'->>'lytx_safety_score') as score
FROM (
  SELECT get_driver_complete_profile(id)::jsonb as profile
  FROM drivers WHERE id = '...'
) p;

-- Avoid: Returning full JSON when not needed
```

---

## Integration Examples

### TypeScript/JavaScript

```typescript
// Fetch driver profile
const result = await supabase.rpc('get_driver_complete_profile', {
  p_driver_id: driverId
});

const profile = result.data;

// Access nested data
const driverName = profile.driver_info.name.full_name;
const lytxScore = profile.latest_performance.lytx_metrics.safety_score;
const recentEvents = profile.lytx_events_summary.recent_events;
```

### Python

```python
# Search for driver
result = supabase.rpc('search_driver_by_name', {'p_name': 'John'}).execute()

for driver in result.data:
    print(f"{driver['full_name']} - {driver['employee_id']}")

# Get full profile
profile_result = supabase.rpc('get_driver_complete_profile', {
    'p_driver_id': driver['driver_id']
}).execute()

profile = profile_result.data
```

---

## Troubleshooting

### Issue: Function returns NULL

**Cause:** Invalid UUID or no data for that entity

**Solution:**
```sql
-- Check if entity exists
SELECT * FROM drivers WHERE id = '...';

-- Search instead
SELECT * FROM search_driver_by_name('...');
```

### Issue: Slow performance

**Cause:** Large result set or missing indexes

**Solution:**
```sql
-- Check query plan
EXPLAIN ANALYZE SELECT get_driver_complete_profile('...');

-- Refresh statistics
ANALYZE drivers;
ANALYZE lytx_safety_events;
```

### Issue: JSON parsing errors

**Cause:** Trying to access null fields

**Solution:**
```sql
-- Use COALESCE
SELECT
  COALESCE(
    (profile->'current_assignment'->>'vehicle_id'),
    'No assignment'
  ) as vehicle
FROM (...) p;
```

---

## Best Practices

1. ✅ **Use functions for complete data retrieval**
2. ✅ **Use views for filtered/aggregated queries**
3. ✅ **Cache results when possible**
4. ✅ **Extract only needed JSON fields**
5. ✅ **Use search functions for lookups**
6. ✅ **Monitor performance with EXPLAIN**
7. ✅ **Keep statistics updated with ANALYZE**

---

## Related Documentation

- [Data Centre ERD](./DATA_CENTRE_ERD.md) - Entity relationship diagram
- [Migration Guide](./001_add_foreign_keys.sql) - Database migration scripts
- [Validation Tests](./999_validation_tests.sql) - Testing procedures
