# Phase 1: Terminal GPS Verification - Implementation Complete! ✅

## Overview
Successfully implemented **Terminal GPS Verification System** that analyzes actual trip data to verify and correct terminal GPS coordinates. This ensures accurate trip-to-terminal matching and idle time attribution.

## Problem Solved

**GPS Accuracy Issue Discovered:**
- Port Hedland GPS coordinates were in the ocean (-20.3192, 118.5717)
- Correct location is Wilson Street terminal (-20.31337885914364, 118.58269286072687)
- Newman terminal was a rest area, not a fuel terminal (deleted)
- Need systematic way to verify all 12 terminals using actual trip data

## What Was Built

### 1. **GPS Verification Database Function** (`database/functions/verify_terminal_gps_accuracy.sql`)

PostGIS-powered function that analyzes trip data to verify terminal accuracy:

**How It Works:**
1. Finds all trips that start/end within each terminal's service radius
2. Calculates centroid (average GPS position) of actual trip endpoints
3. Measures drift distance between recorded GPS and actual centroid
4. Assigns confidence score (0-100) and status classification
5. Provides recommendations for each terminal

**Status Classifications:**
- **VERIFIED** (<50m drift) - Highly accurate, no action needed
- **GOOD** (50-100m drift) - Reasonably accurate
- **NEEDS_REVIEW** (100-500m drift) - Should be reviewed
- **INACCURATE** (>500m drift) - Significantly inaccurate, update recommended
- **NO_DATA** - No trips found within service radius

**Confidence Scoring:**
```sql
95% confidence: <50m drift
85% confidence: <100m drift
70% confidence: <500m drift
50% confidence: <1000m drift
25% confidence: >1000m drift
```

**Key Features:**
- Analyzes both trip start and end points
- Uses PostGIS ST_Centroid for accurate averaging
- Calculates drift with ST_Distance (spheroid geography)
- Returns trip count, start/end breakdown
- Provides actionable recommendations

### 2. **API Layer** (`src/api/terminalVerification.ts`)

TypeScript API layer with type safety and helper functions:

**Core Functions:**
```typescript
// Verify all terminals or specific terminal
verifyTerminalGPS(terminalId?: string): Promise<TerminalVerificationResult[]>

// Accept GPS correction from verification analysis
acceptGPSCorrection(terminalId, newLat, newLon): Promise<void>

// Get summary statistics
getVerificationSummary(): Promise<SummaryStats>
```

**Helper Functions:**
- `formatDrift(meters)` - Format drift distance (e.g., "125m" or "1.5km")
- `getStatusColor(status)` - Badge colors for UI
- `getStatusLabel(status)` - Human-readable labels
- `needsCorrection(verification)` - Check if correction needed

**TypeScript Interface:**
```typescript
interface TerminalVerificationResult {
  terminal_id: string;
  terminal_name: string;
  recorded_latitude: number;
  recorded_longitude: number;
  actual_centroid_lat: number | null;
  actual_centroid_lon: number | null;
  drift_meters: number | null;
  trip_count: number;
  start_point_count: number;
  end_point_count: number;
  confidence_score: number;
  status: 'VERIFIED' | 'GOOD' | 'NEEDS_REVIEW' | 'INACCURATE' | 'NO_DATA';
  recommendations: string;
}
```

### 3. **React Query Hooks** (`src/hooks/useTerminalVerification.ts`)

Data fetching and mutations with auto-refresh:

**Hooks Available:**
```typescript
useTerminalVerification() // Verify all terminals
useTerminalVerificationById(id) // Verify specific terminal
useVerificationSummary() // Get summary stats
useAcceptGPSCorrection() // Mutation to update GPS
useTerminalVerificationDashboard() // Combined dashboard hook
```

**Helper Functions:**
- `sortByDrift(verifications)` - Sort worst drift first
- `filterByStatus(verifications, status)` - Filter by status
- `needsCorrection(verification)` - Check if needs review

**Features:**
- 5-minute stale time for cached data
- Auto-invalidation on GPS updates
- Toast notifications for success/error
- Loading and error states

### 4. **Terminal Verification Page** (`src/pages/TerminalVerificationPage.tsx`)

Comprehensive verification dashboard with:

**Summary Cards (5 cards):**
1. **Total Terminals** - Count being verified
2. **Verified** - <50m drift (green)
3. **Good** - 50-100m drift (blue)
4. **Needs Review** - 100-500m drift (yellow)
5. **Inaccurate** - >500m drift or no data (red)

**Verification Results Table:**
Columns:
- Terminal name
- Status badge (color-coded)
- Recorded GPS coordinates (6 decimal places)
- Actual centroid from trip data
- Drift distance (color-coded: green/blue/yellow/red)
- Trip count (starts/ends breakdown)
- Confidence score (progress bar visualization)
- Recommendations text
- Actions (Accept Correction button)

**Interactive Features:**
- Terminals sorted by drift (worst first)
- "Accept Correction" button for terminals needing review
- Confirmation dialog before GPS update
- Shows before/after coordinates
- Real-time updates via React Query
- Loading states and empty states

**Visual Indicators:**
- Color-coded status badges
- Color-coded drift distances
- Confidence score progress bars
- Icon-based status labels

### 5. **Navigation Integration**

**Added to Data Centre Sidebar:**
- Route: `/data-centre/terminal-verification`
- Label: "Terminal GPS Verification"
- Icon: MapPinCheck (checkmark map pin)
- Permission: `manage_data_sources` (admin only)
- Position: Between Terminal Management and Master Data Config

**App Routing:**
- Lazy-loaded page component
- Protected route (admin required)
- Error boundary wrapper
- DataCentreLayout wrapper

### 6. **Port Hedland GPS Fix** (`database/migrations/fix_port_hedland_gps.sql`)

SQL migration to correct Port Hedland coordinates:

**Before (Incorrect - In Ocean):**
```
Latitude: -20.3192
Longitude: 118.5717
```

**After (Correct - Wilson Street Terminal):**
```
Latitude: -20.31337885914364
Longitude: 118.58269286072687
```

**Migration Features:**
- Updates Port Hedland to Wilson Street location
- Flexible matching (handles variations in terminal name)
- Automatic geography field updates via trigger
- Verification query included
- Timestamp update tracking

## How to Use

### For Admins:

#### Step 1: Run Database Migrations

```bash
# In Supabase SQL Editor:
# 1. Run the verification function
database/functions/verify_terminal_gps_accuracy.sql

# 2. Fix Port Hedland coordinates
database/migrations/fix_port_hedland_gps.sql
```

#### Step 2: Access Terminal Verification

1. Navigate to **Data Centre → Terminal GPS Verification**
2. (Admin permission required)

#### Step 3: Review Verification Results

The page will display:
- **Summary cards** showing count by status
- **Verification table** with all terminals sorted by drift (worst first)
- **Color-coded indicators** for quick identification

#### Step 4: Accept GPS Corrections

For terminals with status **NEEDS_REVIEW** or **INACCURATE**:

1. Click **"Accept Correction"** button
2. Review confirmation dialog showing:
   - Current GPS coordinates
   - New GPS coordinates (from trip centroid)
   - Drift distance
   - Number of trip samples used
3. Click **"Accept Correction"** to update
4. Terminal GPS and service area will be automatically updated

#### Step 5: Monitor Improvements

- Re-run verification after GPS updates
- Confidence scores should improve
- Drift distances should decrease
- More terminals should show "Verified" status

### For Developers:

**Query verification programmatically:**
```typescript
import { useTerminalVerification } from '@/hooks/useTerminalVerification';

const { data: verifications, isLoading } = useTerminalVerification();

// Find terminals needing correction
const needsReview = verifications.filter(v =>
  v.status === 'NEEDS_REVIEW' || v.status === 'INACCURATE'
);
```

**Accept corrections programmatically:**
```typescript
import { useAcceptGPSCorrection } from '@/hooks/useTerminalVerification';

const acceptCorrection = useAcceptGPSCorrection();

await acceptCorrection.mutateAsync({
  terminalId: 'terminal-uuid',
  newLatitude: -20.31337885914364,
  newLongitude: 118.58269286072687
});
```

**Get verification summary:**
```typescript
import { useVerificationSummary } from '@/hooks/useTerminalVerification';

const { data: summary } = useVerificationSummary();
// Returns: { total, verified, good, needsReview, inaccurate, noData }
```

## Files Created (6):

1. **`database/functions/verify_terminal_gps_accuracy.sql`** (184 lines)
   - PostGIS function for GPS verification analysis

2. **`src/api/terminalVerification.ts`** (148 lines)
   - API layer with TypeScript types and helpers

3. **`src/hooks/useTerminalVerification.ts`** (107 lines)
   - React Query hooks for data fetching/mutations

4. **`src/pages/TerminalVerificationPage.tsx`** (350 lines)
   - Full verification dashboard UI

5. **`database/migrations/fix_port_hedland_gps.sql`** (35 lines)
   - SQL migration to fix Port Hedland GPS

6. **`PHASE_1_TERMINAL_GPS_VERIFICATION_COMPLETE.md`** (This file)
   - Implementation documentation

## Files Modified (2):

1. **`src/App.tsx`** - Added route and lazy import for TerminalVerificationPage
2. **`src/components/DataCentreSidebar.tsx`** - Added navigation item and MapPinCheck icon

## Technical Architecture

### Database Layer (PostGIS)
- **ST_Centroid** - Calculate average GPS position from trip points
- **ST_Distance** - Measure drift between recorded and actual coordinates
- **ST_DWithin** - Find trips within terminal service radius
- **GEOGRAPHY(POINT, 4326)** - WGS84 spheroid for accurate distance

### API Layer (TypeScript)
- Strong typing with interfaces
- Error handling and logging
- Helper functions for formatting
- Supabase RPC integration

### UI Layer (React)
- React Query for data management
- Real-time updates with invalidation
- Optimistic UI updates
- Loading/error states
- Toast notifications

### Data Flow:
```
1. User accesses Terminal Verification page
2. React Query calls verifyTerminalGPS() API
3. API calls Supabase RPC function
4. PostGIS analyzes 6,355+ trips in database
5. Results calculated: drift, confidence, status
6. UI displays sorted table with actions
7. User accepts correction
8. Mutation updates terminal_locations table
9. PostGIS trigger updates geography fields
10. React Query invalidates cache
11. UI refreshes with new verification data
```

## Benefits Unlocked

✅ **Automated GPS Verification** - No manual coordinate checking
✅ **Data-Driven Accuracy** - Based on actual 6,355+ trip samples
✅ **Confidence Scoring** - Know which terminals are accurate
✅ **One-Click Corrections** - Accept centroid coordinates instantly
✅ **Visual Indicators** - Color-coded status for quick identification
✅ **Systematic Review** - All terminals verified in one place
✅ **Improved Matching** - Better trip-to-terminal correlation
✅ **Idle Time Attribution** - More accurate location matching

## Key Insights from Verification

**Expected Findings:**
- Port Hedland will show **INACCURATE** status with high drift
- Kewdale (primary SMB terminal) likely **VERIFIED** (high trip count)
- Remote terminals may show **NO_DATA** (few trips)
- Terminals on main routes will have high confidence scores

**Actionable Data:**
- Trip count indicates terminal usage frequency
- Start vs End count shows terminal function (depot vs customer)
- Drift direction shows GPS systematic error
- Confidence score guides update priority

## Integration Points

### Ready to Integrate:
- **Route Pattern Analysis** - More accurate terminal matching
- **Idle Time Attribution** - Correct location for idle periods
- **POI Auto-Discovery** - Verify discovered terminals
- **Trip Correlation** - Improved start/end point matching

### Database Functions Available:
```sql
-- Verify all terminals
SELECT * FROM verify_terminal_gps_accuracy(NULL);

-- Verify specific terminal
SELECT * FROM verify_terminal_gps_accuracy('terminal-uuid');
```

## Testing Checklist

Before production deployment:

- [ ] Run `verify_terminal_gps_accuracy.sql` migration
- [ ] Run `fix_port_hedland_gps.sql` migration
- [ ] Access Terminal Verification page
- [ ] View verification results for all terminals
- [ ] Check Port Hedland shows corrected GPS
- [ ] Verify drift calculations are accurate
- [ ] Test "Accept Correction" button
- [ ] Confirm GPS updates persist to database
- [ ] Check PostGIS geography fields auto-update
- [ ] Verify React Query invalidation works
- [ ] Test loading and error states
- [ ] Confirm toast notifications appear
- [ ] Review confidence scores make sense
- [ ] Sort table by drift (worst first)

## Next Steps: POI Auto-Discovery (Phase 2)

With Terminal GPS Verification complete, ready to proceed with:

### Phase 2: POI Auto-Discovery from Trip Data
- Use ST_ClusterDBSCAN to discover terminals and customers
- Cluster trip start points → terminals/depots
- Cluster trip end points → customer locations
- Create discovered_poi table
- Build POI discovery page with map
- Classification workflow (terminal/customer/ignore)

### Phase 3: Idle Time Estimation
- Calculate average idle time at each location
- Break down idle time by location type
- Create idle time analytics dashboard

### Phase 4: Terminal Aliases
- Add text matching for terminal variations
- "Wilson Street" → "Port Hedland"
- Improve trip-to-terminal correlation

---

**Implementation Date:** 2025-11-12
**Status:** ✅ Phase 1 Complete
**Next Action:** Deploy migrations, verify all terminals, then proceed with Phase 2: POI Auto-Discovery

**Key Achievement:** Terminal GPS verification system with data-driven accuracy and one-click corrections! 🎯
