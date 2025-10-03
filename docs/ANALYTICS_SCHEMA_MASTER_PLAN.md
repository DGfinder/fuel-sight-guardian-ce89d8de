# Analytics Platform Schema Master Plan

**Created**: 2025-10-01
**Purpose**: Document expected vs actual schema state for analytics platform remediation
**Scope**: Analytics only - excludes fuel tank monitoring (dip_readings, fuel_tanks, tank_groups)

---

## 1. Core Analytics Tables

### 1.1 Expected Base Tables

| Table Name | Status | Purpose | Priority |
|------------|--------|---------|----------|
| `captive_payment_records` | Should exist (create_captive_payments_system.sql) | Raw captive delivery records | **CRITICAL** |
| `lytx_safety_events` | Should exist (001_create_analytics_tables.sql) | LYTX safety event data | **CRITICAL** |
| `guardian_events` | Should exist (create_guardian_events_system.sql) | Guardian monitoring events | **CRITICAL** |
| `mtdata_trip_history` | Should exist (create_mtdata_trip_history_system.sql) | GPS trip data | HIGH |
| `vehicles` | Should exist | Fleet vehicle registry | **CRITICAL** |
| `drivers` | Should exist (create_driver_management_system.sql) | Driver registry | **CRITICAL** |
| `data_source_registry` | Should exist (02_create_data_freshness_tables.sql) | Data source tracking | HIGH |
| `data_freshness_tracking` | Should exist (02_create_data_freshness_tables.sql) | Freshness monitoring | HIGH |
| `data_import_batches` | Referenced by code | Upload batch tracking | HIGH |

### 1.2 Expected Driver Association Tables

| Table Name | Status | Purpose | Priority |
|------------|--------|---------|----------|
| `driver_lytx_associations` | Should exist (add_lytx_driver_associations.sql) | Link drivers to LYTX events | HIGH |
| `driver_guardian_associations` | Should exist (add_guardian_driver_associations.sql) | Link drivers to Guardian events | HIGH |
| `driver_mtdata_associations` | Should exist (add_mtdata_driver_associations.sql) | Link drivers to MTData trips | MEDIUM |

---

## 2. Analytics Views

### 2.1 **CRITICAL** Views (Referenced by DataCentreSupabaseService)

| View Name | File | Code Reference | Status |
|-----------|------|----------------|--------|
| `cross_analytics_summary` | 003_create_analytics_views.sql:90 | dataCentreSupabaseService.ts:126,245,327 | **MUST FIX** |
| `captive_payments_analytics` | 003_create_analytics_views.sql:5 | dataCentreSupabaseService.ts:147 | **MUST FIX** |
| `lytx_safety_analytics` | 003_create_analytics_views.sql:57 | dataCentreSupabaseService.ts:185 | **MUST FIX** |
| `lytx_events_enriched` | 003_create_analytics_views.sql:78 | Vehicle mapping | **MUST FIX** |

### 2.2 Captive Payments Views

| View Name | File | Purpose | Status |
|-----------|------|---------|--------|
| `captive_deliveries` | create_captive_payments_system.sql:81 | Materialized view - BOL grouped deliveries | Should exist |
| `captive_monthly_analytics` | create_captive_payments_system.sql:117 | Monthly metrics by carrier | Should exist |
| `captive_customer_analytics` | create_captive_payments_system.sql:148 | Customer volume rankings | Should exist |
| `captive_terminal_analytics` | create_captive_payments_system.sql:176 | Terminal performance | Should exist |

### 2.3 Driver Profile Views

| View Name | File | Purpose | Status |
|-----------|------|---------|--------|
| `unified_driver_profile` | create_unified_driver_profile.sql | Combines all driver data sources | **TO CREATE** |

### 2.4 Data Freshness Views

| View Name | File | Purpose | Status |
|-----------|------|---------|--------|
| `data_freshness_dashboard` | 05_create_data_freshness_views.sql | Dashboard data source status | Should exist |

---

## 3. Expected Field Names (Data Contracts)

### 3.1 cross_analytics_summary

**Required Fields:**
```typescript
{
  fleet: 'Stevemacs' | 'Great Southern Fuels',
  depot: string,
  month: string,              // 'Jan', 'Feb', etc.
  year: number,
  month_num: number,          // 1-12
  captive_deliveries: number,
  captive_volume_ml: number,  // Megalitres
  safety_events: number,      // LYTX events
  guardian_events: number,
  active_vehicles: number,
  avg_safety_score: number,
  events_per_vehicle: number,
  volume_per_vehicle: number
}
```

### 3.2 captive_payments_analytics

**Required Fields:**
```typescript
{
  carrier: 'SMB' | 'GSF',
  month: string,
  year: number,
  month_num: number,
  total_deliveries: number,
  total_volume_litres: number,
  total_volume_megalitres: number,
  unique_customers: number,
  top_customer: string,
  top_customer_volume: number,
  avg_delivery_size: number
}
```

### 3.3 lytx_safety_analytics

**Required Fields:**
```typescript
{
  carrier: 'Stevemacs' | 'Great Southern Fuels',
  depot: string,
  month: string,
  year: number,
  month_num: number,
  total_events: number,
  coachable_events: number,
  driver_tagged_events: number,
  new_events: number,
  resolved_events: number,
  avg_score: number,
  unique_drivers: number,
  high_risk_drivers: number  // score >= 80
}
```

### 3.4 lytx_events_enriched

**Required Fields:**
```typescript
{
  // All lytx_safety_events fields plus:
  vehicle_id: string,
  resolved_registration: string,
  resolved_fleet: string,
  resolved_depot: string
}
```

---

## 4. Foreign Key Relationships

### 4.1 Expected Constraints

```sql
-- LYTX to Vehicles
ALTER TABLE lytx_safety_events
  ADD CONSTRAINT fk_lytx_vehicle
  FOREIGN KEY (vehicle_registration)
  REFERENCES vehicles(registration)
  ON DELETE SET NULL;

-- OR via device serial
ALTER TABLE lytx_safety_events
  ADD CONSTRAINT fk_lytx_device
  FOREIGN KEY (device_serial)
  REFERENCES vehicles(lytx_device)
  ON DELETE SET NULL;

-- Guardian to Drivers
ALTER TABLE guardian_events
  ADD CONSTRAINT fk_guardian_driver
  FOREIGN KEY (driver_id)
  REFERENCES drivers(id)
  ON DELETE SET NULL;

-- Captive to Terminal Locations
ALTER TABLE captive_payment_records
  ADD CONSTRAINT fk_captive_terminal
  FOREIGN KEY (terminal)
  REFERENCES terminal_locations(terminal_name)
  ON DELETE RESTRICT;

-- Driver Associations
ALTER TABLE driver_lytx_associations
  ADD CONSTRAINT fk_driver_lytx_driver
  FOREIGN KEY (driver_id)
  REFERENCES drivers(id)
  ON DELETE CASCADE;

ALTER TABLE driver_lytx_associations
  ADD CONSTRAINT fk_driver_lytx_event
  FOREIGN KEY (lytx_event_id)
  REFERENCES lytx_safety_events(id)
  ON DELETE CASCADE;
```

---

## 5. Custom Types

### 5.1 Expected ENUM Types

```sql
-- Carrier type for captive payments
CREATE TYPE carrier_type AS ENUM ('SMB', 'GSF', 'Combined');

-- Data freshness status
CREATE TYPE freshness_status AS ENUM ('fresh', 'stale', 'very_stale', 'critical');

-- Data source type
CREATE TYPE data_source_type AS ENUM (
  'daily_api',
  'monthly_upload',
  'csv_upload',
  'webhook',
  'manual_entry'
);
```

---

## 6. Indexes for Performance

### 6.1 Captive Payment Records

```sql
CREATE INDEX idx_captive_bol_grouping ON captive_payment_records (bill_of_lading, delivery_date, customer);
CREATE INDEX idx_captive_delivery_date ON captive_payment_records (delivery_date DESC);
CREATE INDEX idx_captive_carrier_date ON captive_payment_records (carrier, delivery_date DESC);
```

### 6.2 LYTX Safety Events

```sql
CREATE INDEX idx_lytx_event_datetime ON lytx_safety_events (event_datetime DESC);
CREATE INDEX idx_lytx_carrier_depot ON lytx_safety_events (carrier, depot);
CREATE INDEX idx_lytx_driver_name ON lytx_safety_events (driver_name);
CREATE INDEX idx_lytx_vehicle_reg ON lytx_safety_events (vehicle_registration);
```

### 6.3 Guardian Events

```sql
CREATE INDEX idx_guardian_detection_time ON guardian_events (detection_time DESC);
CREATE INDEX idx_guardian_fleet ON guardian_events (fleet);
CREATE INDEX idx_guardian_driver ON guardian_events (driver);
CREATE INDEX idx_guardian_verified ON guardian_events (verified) WHERE verified = true;
```

---

## 7. Known Issues from Code Analysis

### 7.1 DataCentreSupabaseService.ts Issues

**Line 126**: Queries `cross_analytics_summary` - view may not exist
**Line 147**: Queries `captive_payments_analytics` - view may not exist
**Line 185**: Queries `lytx_safety_analytics` - view may not exist
**Line 194**: Queries `lytx_safety_events.excluded` - field must exist
**Line 269**: Queries `data_import_batches` - table may not exist

**Impact**: All DataCentre dashboard queries will fail if views missing

### 7.2 Frontend Field Mismatches

**Issue**: Components expect fields that views don't provide

Examples:
- TopCustomersTable expects `terminals_list` array
- TerminalPerformanceTable expects `deliveries_last_30_days`
- BOLDeliveryTable expects `driverName`, `vehicleId` (not linked)

---

## 8. Migration Execution Order

### Phase 1: Base Tables (If Missing)
1. `create_captive_payments_system.sql`
2. `create_guardian_events_system.sql`
3. `create_mtdata_trip_history_system.sql`
4. `create_driver_management_system.sql`
5. `02_create_data_freshness_tables.sql`

### Phase 2: Association Tables
1. `add_lytx_driver_associations.sql`
2. `add_guardian_driver_associations.sql`
3. `add_mtdata_driver_associations.sql`

### Phase 3: Analytics Views
1. `003_create_analytics_views.sql` (includes cross_analytics_summary)
2. `05_create_data_freshness_views.sql`
3. `create_unified_driver_profile.sql`

### Phase 4: Constraints & Indexes
1. Foreign key constraints (see section 4.1)
2. Performance indexes (see section 6)

---

## 9. Validation Checklist

After running diagnostics, verify:

- [ ] All base tables exist
- [ ] All critical views exist and queryable
- [ ] Field names match TypeScript interfaces
- [ ] Foreign keys properly constrained
- [ ] Indexes created for performance
- [ ] Custom types defined
- [ ] Row counts > 0 for production tables
- [ ] No NULL values in critical fields
- [ ] DataCentreSupabaseService queries succeed
- [ ] Frontend components display data

---

## 10. Next Steps

1. Run `database/diagnostics/01_schema_audit.sql` against production database
2. Run `database/diagnostics/02_test_analytics_queries.sql` to test views
3. Identify missing components from output
4. Create fix scripts for missing views (Phase 2)
5. Execute fixes in order
6. Re-run diagnostics to confirm
7. Update frontend if field names don't match

---

## Exclusions (DO NOT TOUCH)

❌ **EXCLUDED FROM THIS REMEDIATION:**
- `dip_readings` table
- `fuel_tanks` table
- `tank_groups` table
- `tanks_with_rolling_avg` view
- `bulletproof_tanks_view`
- Any tank or dip-related views/functions
- useTanks.ts hook
- useTankDips.ts hook
- Tank monitoring pages

**These remain 100% unchanged during analytics platform fixes.**
