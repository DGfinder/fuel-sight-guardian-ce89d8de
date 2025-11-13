# POI-to-Customer Assignment System - COMPLETE

## Overview
Successfully implemented a comprehensive system to link discovered POIs (Points of Interest) to billing customers from the captive payments system. This enables correlation of operational trip data with billing records for reconciliation and analytics.

## Problem Solved
**Before:** Discovered POIs representing customer delivery locations existed independently from billing customer records, making it difficult to correlate trip data with invoices.

**After:** POIs can be automatically or manually matched to customers using spatial proximity and fuzzy name matching, enabling complete trip-to-billing correlation.

## What Was Implemented

### 1. Database Layer ✅ COMPLETE

#### Migration: `add_poi_customer_linkage.sql`
**Purpose:** Link discovered POIs to customer billing records

**New Columns in `discovered_poi` table:**
- `matched_customer_id` (UUID) - Foreign key to customer_locations
- `customer_assignment_method` (TEXT) - How assignment was made:
  - `manual` - User selected via UI
  - `auto_spatial` - GPS proximity matching
  - `auto_name_match` - Fuzzy name matching
  - `auto_combined` - Both spatial and name matching
- `customer_assignment_confidence` (INTEGER 0-100) - Match confidence score
- `customer_assigned_at` (TIMESTAMPTZ) - Assignment timestamp
- `customer_assigned_by` (UUID) - User who made assignment

**Indexes Created:**
- `idx_discovered_poi_customer` - Fast customer lookups
- Foreign key constraint with CASCADE on delete

#### Function: `match_poi_to_customers()`
**Purpose:** Intelligent customer matching using spatial proximity + fuzzy name matching

**Parameters:**
- `p_poi_id` (UUID) - Specific POI to match (NULL = all unmatched customer POIs)
- `p_max_distance_km` (DECIMAL) - Maximum spatial distance (default: 2km)
- `p_min_name_similarity` (INTEGER) - Minimum name similarity 0-100 (default: 70)
- `p_auto_assign` (BOOLEAN) - Auto-assign high-confidence matches (default: FALSE)
- `p_assigned_by` (UUID) - User ID for audit trail

**Matching Algorithm:**
```sql
-- Confidence Score = (Spatial Score × 60%) + (Name Similarity × 40%)

Spatial Scoring:
  ≤ 0.5km distance  → 100 points
  ≤ 1.0km distance  → 90 points
  ≤ 2.0km distance  → 75 points
  > 2.0km distance  → 50 points

Name Similarity:
  Uses PostgreSQL pg_trgm extension for fuzzy matching
  Matches full names and partial matches (e.g., "BHP" in "BHP Port Hedland")
  Score: 0-100 based on trigram similarity

Recommendations:
  ≥90% confidence → "High Confidence - Auto-assign recommended"
  ≥75% confidence → "Good Match - Review recommended"
  ≥60% confidence → "Possible Match - Manual verification needed"
  <60% confidence → "Low Confidence - Not recommended"
```

**Return Format:**
Returns top 5 customer matches per POI with:
- Customer name, BP customer ID
- Match method and confidence score
- Distance (km) and name similarity (%)
- Recommendation text

**Usage Examples:**
```sql
-- Get match suggestions for all unmatched POIs
SELECT * FROM match_poi_to_customers();

-- Get matches for specific POI
SELECT * FROM match_poi_to_customers(
  p_poi_id := '123e4567-e89b-12d3-a456-426614174000'
);

-- Auto-assign all high-confidence matches
SELECT * FROM match_poi_to_customers(
  p_auto_assign := TRUE,
  p_assigned_by := auth.uid()
);

-- Custom thresholds for stricter matching
SELECT * FROM match_poi_to_customers(
  p_max_distance_km := 1.0,
  p_min_name_similarity := 85,
  p_auto_assign := TRUE
);
```

#### View: `customer_poi_analytics`
**Purpose:** Comprehensive analytics linking POIs to customers with trip and billing data

**Provides:**
- Customer details (name, BP ID, address, state)
- POI details (name, type, confidence, trip count, GPS accuracy)
- Assignment metadata (method, confidence, timestamp)
- GPS coordinates for both POI and customer record
- Distance between POI and customer record
- Trip statistics:
  - Delivery trip count
  - Average delivery distance and time
  - Average unloading time
- Billing correlation:
  - Potential billing records matched by customer name
  - Delivery route count
  - Common delivery routes (top 5)
- Terminal associations

**Usage Examples:**
```sql
-- Get all customers with assigned POIs
SELECT * FROM customer_poi_analytics
WHERE customer_id IS NOT NULL;

-- High-activity customers without assignments
SELECT * FROM customer_poi_analytics
WHERE customer_id IS NULL
  AND poi_trip_count > 20
ORDER BY poi_trip_count DESC;

-- Billing reconciliation candidates
SELECT
  customer_name,
  poi_name,
  delivery_trip_count,
  potential_billing_records,
  common_delivery_routes
FROM customer_poi_analytics
WHERE customer_id IS NOT NULL
  AND potential_billing_records > 0
ORDER BY delivery_trip_count DESC;

-- Review POI-customer matches that may need adjustment
SELECT * FROM customer_poi_analytics
WHERE customer_id IS NOT NULL
  AND poi_customer_distance_km > 1.0
ORDER BY poi_customer_distance_km DESC;
```

---

### 2. API Layer ✅ COMPLETE

#### File: `src/api/customerAssignment.ts`
**Provides:**
- `getCustomerMatches()` - Get match suggestions
- `assignCustomerToPOI()` - Manual customer assignment
- `autoAssignCustomer()` - Auto-assign single POI
- `bulkAutoAssignCustomers()` - Auto-assign all unmatched POIs
- `unassignCustomerFromPOI()` - Remove assignment
- `getCustomerPOIAnalytics()` - Fetch analytics view data

**TypeScript Interface:**
```typescript
export interface CustomerMatch {
  poi_id: string;
  poi_name: string;
  customer_id: string;
  customer_name: string;
  customer_bp_id: string | null;
  match_method: string;
  confidence_score: number;
  distance_km: number;
  name_similarity: number;
  recommendation: string;
}
```

---

### 3. React Hooks ✅ COMPLETE

#### File: `src/hooks/useCustomerAssignment.ts`
**Provides:**
- `useCustomerMatches()` - Fetch matches with caching
- `useAssignCustomer()` - Manual assignment mutation
- `useAutoAssignCustomer()` - Auto-assign mutation
- `useBulkAutoAssign()` - Bulk auto-assign mutation
- `useUnassignCustomer()` - Remove assignment mutation
- `useCustomerAssignment()` - Composite hook with all functionality

**Features:**
- React Query integration with automatic cache invalidation
- Toast notifications for success/error
- Loading states for all operations
- Optimistic updates

---

### 4. UI Components ✅ COMPLETE

#### Component: `POICustomerAssignmentModal.tsx`
**Purpose:** Interactive modal for assigning customers to POIs

**Features:**
1. **POI Information Card**
   - Shows POI name, type, trip count, confidence
   - Displays GPS coordinates

2. **High-Confidence Auto-Assign**
   - Alert banner when ≥75% confidence match found
   - One-click auto-assign button

3. **Customer Search**
   - Real-time filtering by customer name or BP ID
   - Search across all customer matches

4. **Customer Match List**
   - Displays top 5 matches per POI
   - Color-coded confidence badges:
     - Green (≥90%) - High confidence
     - Blue (≥75%) - Good match
     - Yellow (≥60%) - Possible match
     - Gray (<60%) - Low confidence
   - Shows distance, name similarity, match method
   - Recommendation icons and text
   - Click to select customer

5. **Action Buttons**
   - Manual assignment of selected customer
   - Cancel operation
   - Loading states during assignment

**Visual Design:**
- Clean, card-based layout
- White background (fixed from transparent issue)
- Color-coded confidence indicators
- Responsive grid layout
- Maximum height with scroll

---

### 5. POI Discovery Page Integration ✅ COMPLETE

#### Updates to `POIDiscoveryPage.tsx`
**New Features:**

1. **Bulk Auto-Assign Button**
   - Located in page header next to "Run Discovery"
   - Auto-assigns all unmatched customer POIs with ≥75% confidence
   - Shows loading state and success toast

2. **Customer Assignment Column**
   - New table column showing assignment status
   - Badges:
     - "Assigned" (green) - Customer linked
     - "Not assigned" (gray) - No customer linked
     - "N/A" - Non-customer POI types

3. **Assign Customer Action Button**
   - User icon button in Actions column
   - Only visible for customer-type POIs
   - Opens assignment modal
   - Tooltip shows "Assign Customer" or "Reassign Customer"

4. **Customer Assignment Modal Integration**
   - Opens when user clicks assign button
   - Loads matches automatically
   - Refreshes POI list after assignment

**User Workflow:**
```
1. Navigate to Data Centre → POI Discovery
2. View discovered POIs in table
3. For customer POIs:
   Option A: Click "Bulk Auto-Assign Customers" to assign all
   Option B: Click user icon on specific POI to assign individually
4. Review match suggestions with confidence scores
5. Either:
   - Click "Auto-Assign" for top match
   - Select different customer and click "Assign Selected Customer"
6. POI now shows "Assigned" badge in Customer column
```

---

## Files Created/Modified

### Database Files (NEW)
- `database/migrations/add_poi_customer_linkage.sql`
- `database/functions/match_poi_to_customers.sql`
- `database/views/customer_poi_analytics.sql`

### API Layer (NEW)
- `src/api/customerAssignment.ts`

### Hooks (NEW)
- `src/hooks/useCustomerAssignment.ts`

### Components (NEW)
- `src/components/POICustomerAssignmentModal.tsx`

### Pages (MODIFIED)
- `src/pages/POIDiscoveryPage.tsx`
  - Added bulk auto-assign functionality
  - Added customer assignment column
  - Added assign customer action button
  - Integrated assignment modal

### Documentation (NEW)
- `POI_CUSTOMER_ASSIGNMENT_COMPLETE.md` (this file)

---

## Benefits Achieved

### 1. Trip-to-Billing Correlation
**Before:**
- Trip data and billing records existed separately
- Manual reconciliation required
- No automated way to link deliveries to invoices
- Difficult to verify billing accuracy

**After:**
- Automatic correlation using GPS and name matching
- POIs linked to billing customers with confidence scores
- Trip statistics aggregated by customer
- Billing reconciliation through analytics view

### 2. Intelligent Matching
**Features:**
- Hybrid scoring: 60% spatial proximity + 40% name similarity
- Handles name variations (e.g., "BHP" matches "BHP Port Hedland")
- Confidence-based recommendations
- Manual override capability
- Audit trail with timestamps and user attribution

### 3. Data Quality Assurance
**Quality Indicators:**
- Confidence scores (0-100) for all matches
- Distance measurements between POI and customer record
- Assignment method tracking
- GPS accuracy metrics
- Multiple match candidates for review

### 4. Operational Intelligence
**Analytics Available:**
- Deliveries per customer location
- Average delivery times and distances
- Unloading time analysis
- Route pattern identification
- Terminal association tracking

---

## Usage Guide

### Quick Start

#### 1. Discover POIs (if not done yet)
```sql
-- Run POI discovery to find customer locations
SELECT * FROM discover_poi_from_trips(500, 10, false);
```

#### 2. Classify POIs as Customers
Via UI:
- Navigate to Data Centre → POI Discovery
- Click "Classify" on high-trip-count POIs
- Set type to "Customer"
- Provide name and address

#### 3. Auto-Assign Customers (Recommended)
**Option A: Bulk Auto-Assign (UI)**
- Navigate to Data Centre → POI Discovery
- Click "Bulk Auto-Assign Customers" button
- System auto-assigns all POIs with ≥75% confidence
- Review assignments in Customer column

**Option B: Bulk Auto-Assign (SQL)**
```sql
-- Auto-assign all unmatched customer POIs
SELECT * FROM match_poi_to_customers(
  p_auto_assign := TRUE,
  p_assigned_by := auth.uid()
);
```

**Option C: Selective Auto-Assign**
```sql
-- Auto-assign specific POI
SELECT * FROM match_poi_to_customers(
  p_poi_id := 'poi-uuid-here',
  p_auto_assign := TRUE,
  p_assigned_by := auth.uid()
);
```

#### 4. Manual Assignment (when auto-assign confidence is low)
Via UI:
- Navigate to Data Centre → POI Discovery
- Click user icon on POI row
- Review match suggestions
- Select correct customer
- Click "Assign Selected Customer"

#### 5. Review Assignments
**Via Analytics View:**
```sql
-- Review all assignments
SELECT
  poi_name,
  customer_name,
  customer_assignment_confidence,
  poi_customer_distance_km,
  delivery_trip_count,
  potential_billing_records
FROM customer_poi_analytics
ORDER BY delivery_trip_count DESC;

-- Find assignments that need review
SELECT * FROM customer_poi_analytics
WHERE customer_assignment_confidence < 75
  OR poi_customer_distance_km > 1.0;
```

#### 6. Billing Reconciliation
```sql
-- Find customers with trip data but no billing records
SELECT
  customer_name,
  poi_name,
  delivery_trip_count,
  avg_delivery_distance_km,
  avg_delivery_time_hours,
  potential_billing_records
FROM customer_poi_analytics
WHERE customer_id IS NOT NULL
  AND potential_billing_records = 0
  AND delivery_trip_count > 10
ORDER BY delivery_trip_count DESC;

-- Find customers with billing records to correlate
SELECT
  customer_name,
  delivery_trip_count,
  potential_billing_records,
  common_delivery_routes
FROM customer_poi_analytics
WHERE potential_billing_records > 0
ORDER BY potential_billing_records DESC;
```

---

## Advanced Configuration

### Adjust Matching Thresholds
```sql
-- Stricter matching (closer distance, higher name similarity)
SELECT * FROM match_poi_to_customers(
  p_max_distance_km := 1.0,      -- Only match within 1km
  p_min_name_similarity := 85,   -- 85% name match required
  p_auto_assign := FALSE          -- Just get suggestions
);

-- Looser matching (for rural/remote areas)
SELECT * FROM match_poi_to_customers(
  p_max_distance_km := 5.0,      -- Match within 5km
  p_min_name_similarity := 60,   -- 60% name match acceptable
  p_auto_assign := FALSE
);
```

### Remove Incorrect Assignment
**Via API:**
```typescript
await unassignCustomerFromPOI('poi-id-here');
```

**Via SQL:**
```sql
UPDATE discovered_poi
SET
  matched_customer_id = NULL,
  customer_assignment_method = NULL,
  customer_assignment_confidence = NULL,
  customer_assigned_at = NULL,
  customer_assigned_by = NULL
WHERE id = 'poi-id-here';
```

---

## Integration with Existing Systems

### POI Auto-Discovery
- Builds on discovered POIs from trip clustering
- Uses POI confidence scores for quality filtering
- Leverages GPS accuracy metrics
- Respects POI service radius for matching

### Customer Locations
- Links to existing customer_locations table
- Utilizes GPS coordinates for spatial matching
- Leverages customer names for fuzzy matching
- References BP customer IDs for billing correlation

### Captive Payments
- Correlates trips with billing records by customer name
- Enables invoice verification
- Supports delivery reconciliation
- Provides billing analytics

### Route Patterns
- Identifies common delivery routes per customer
- Links routes to billing customers
- Enables route-based billing analysis
- Supports delivery frequency analytics

---

## Performance Considerations

### Indexes
All matching queries use spatial and standard indexes:
- `idx_discovered_poi_customer` - Customer lookups
- `discovered_poi.location_point` (GIST) - Spatial queries
- `customer_locations.location_point` (GIST) - Spatial queries
- Foreign key index for referential integrity

### Query Optimization
- Spatial queries limited by max_distance_km parameter
- Name similarity uses pg_trgm GIN indexes
- Top-N limit (5 matches per POI) reduces result size
- Distinct ON for efficient best-match selection

### Expected Performance
- Match suggestions: 1-3 seconds for all POIs
- Auto-assignment: 2-5 seconds for all POIs
- Analytics view: <1 second for filtered queries
- Manual assignment: <500ms per POI

---

## Success Metrics

### Data Quality
- ✅ Confidence-based matching (0-100 score)
- ✅ Spatial accuracy validation (distance in km)
- ✅ Name similarity scoring with fuzzy matching
- ✅ Assignment audit trail (method, user, timestamp)

### Operational Intelligence
- ✅ Trip-to-customer correlation
- ✅ Delivery time and distance analytics per customer
- ✅ Route pattern identification
- ✅ Billing reconciliation support

### User Experience
- ✅ One-click bulk auto-assignment
- ✅ Visual confidence indicators
- ✅ Interactive assignment modal
- ✅ Search and filter capabilities
- ✅ Manual override option

---

## Troubleshooting

### Issue: No Customer Matches Found
**Possible Causes:**
1. POI not classified as "customer" type
2. No customer_locations records in database
3. Distance threshold too restrictive
4. Name similarity threshold too high

**Solutions:**
```sql
-- Check POI type
SELECT poi_type FROM discovered_poi WHERE id = 'poi-id';

-- Check customer_locations
SELECT COUNT(*) FROM customer_locations;

-- Try looser thresholds
SELECT * FROM match_poi_to_customers(
  p_poi_id := 'poi-id',
  p_max_distance_km := 10.0,
  p_min_name_similarity := 50
);
```

### Issue: Low Confidence Scores
**Possible Causes:**
1. GPS coordinates inaccurate
2. Customer name mismatch
3. POI location far from customer record

**Solutions:**
- Verify GPS coordinates in both tables
- Check for name variations (abbreviations, spelling)
- Use manual assignment for edge cases
- Update customer_locations with correct GPS

### Issue: Wrong Customer Assigned
**Solution:**
```sql
-- Remove incorrect assignment
UPDATE discovered_poi
SET matched_customer_id = NULL,
    customer_assignment_method = NULL,
    customer_assignment_confidence = NULL
WHERE id = 'poi-id';

-- Then manually assign correct customer via UI
```

---

## Next Steps (Future Enhancements)

### Potential Improvements
1. **Interactive Map View**
   - Visualize POIs and customers on map
   - Show assignment lines between POI and customer
   - Color-code by confidence score

2. **Batch Import Customer Locations**
   - CSV upload for customer GPS coordinates
   - Automatic geocoding from addresses
   - Validation and duplicate detection

3. **Enhanced Analytics Dashboard**
   - Customer delivery frequency charts
   - Billing vs. trip data comparison
   - Route efficiency metrics per customer

4. **Automated Billing Reconciliation**
   - Match trips to invoices automatically
   - Flag discrepancies for review
   - Generate reconciliation reports

---

## Conclusion

The POI-to-Customer Assignment System is **COMPLETE** and production-ready. The system provides:

1. **Intelligent Matching** - Hybrid spatial + name-based matching with confidence scoring
2. **Flexible Assignment** - Both automatic and manual assignment workflows
3. **Complete Audit Trail** - Track who assigned what, when, and how
4. **Rich Analytics** - Correlate trip data with billing customers for reconciliation
5. **User-Friendly UI** - Intuitive modal with visual confidence indicators

**Estimated Value:** Significant time savings in billing reconciliation + improved data accuracy for customer analytics

**Status:** ✅ Production Ready (Full Stack Complete)
**Version:** 1.0
**Date:** 2025-01-12
