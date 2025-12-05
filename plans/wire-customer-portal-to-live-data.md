# Wire Customer Portal to Live Data - Implementation Plan

## Problem Summary

**Issue**: Indosolutions customer login shows hardcoded 54% fill level instead of live data from AgBot webhooks.

**Root Cause**:
- Customer portal reads `calibrated_fill_level` from `ta_agbot_locations` table
- This field is set from webhook `LocationCalibratedFillLevel` which may be:
  - Stale (not updated frequently)
  - Hardcoded/test data (54% appears to be a placeholder)
  - Missing or NULL
- Actual live data exists in `ta_agbot_assets.current_level_percent` which is updated from webhook readings

## Current Data Flow

1. **Webhook receives data** → `api/gasbot-webhook.ts`
2. **Transformer maps data** → `GasbotDataTransformer.ts`:
   - Location: Sets `calibrated_fill_level` from `LocationCalibratedFillLevel` (line 59)
   - Asset: Sets `current_level_percent` from `AssetCalibratedFillLevel` (line 110)
   - Reading: Records `level_percent` in `ta_agbot_readings` (line 180)
3. **Customer portal reads** → `useCustomerTanks()` hook:
   - Queries `ta_agbot_locations.calibrated_fill_level` (line 215)
   - Maps to `latest_calibrated_fill_percentage` in UI

## Solution Options

### Option 1: Update Customer Portal to Use Asset Data (RECOMMENDED)
**Pros**:
- More accurate (uses actual tank readings)
- Simpler (no database changes)
- Already have asset data in query

**Cons**:
- Need to handle multiple assets per location (average them)

### Option 2: Create Database Trigger to Auto-Update Location Level
**Pros**:
- Keeps location table in sync automatically
- No frontend changes needed

**Cons**:
- More complex (database trigger)
- Still need to handle multiple assets per location

## Recommended Implementation: Option 1

### Phase 1: Update Customer Portal Hook

**File**: `src/hooks/useCustomerAuth.ts`

**Change**: Modify `useCustomerTanks()` to calculate fill level from assets instead of location

**Current Code** (line 215):
```typescript
latest_calibrated_fill_percentage: loc.calibrated_fill_level,
```

**New Code**:
```typescript
// Calculate from asset data (more accurate than location aggregate)
const assetFillLevels = (loc.ta_agbot_assets || [])
  .filter(asset => asset.current_level_percent != null)
  .map(asset => asset.current_level_percent);
const calculatedFillLevel = assetFillLevels.length > 0
  ? assetFillLevels.reduce((sum, level) => sum + level, 0) / assetFillLevels.length
  : loc.calibrated_fill_level; // Fallback to location level if no assets

latest_calibrated_fill_percentage: calculatedFillLevel,
```

**Rationale**:
- Uses live asset data from webhooks
- Averages multiple assets if location has multiple tanks
- Falls back to location level if no asset data available

### Phase 2: Update Location Aggregation (Optional Enhancement)

**File**: `database/migrations/012_update_location_fill_from_assets.sql`

**Purpose**: Create a trigger/function to keep `calibrated_fill_level` in sync with asset data

**Implementation**:
```sql
-- Function to update location calibrated_fill_level from assets
CREATE OR REPLACE FUNCTION update_location_fill_from_assets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update location's calibrated_fill_level from average of assets
  UPDATE ta_agbot_locations l
  SET
    calibrated_fill_level = COALESCE(
      (SELECT ROUND(AVG(current_level_percent)::numeric, 2)
       FROM ta_agbot_assets a
       WHERE a.location_id = COALESCE(NEW.location_id, OLD.location_id)
         AND a.is_disabled = false
         AND a.current_level_percent IS NOT NULL),
      l.calibrated_fill_level
    ),
    updated_at = NOW()
  WHERE l.id = COALESCE(NEW.location_id, OLD.location_id);

  RETURN NEW;
END;
$$;

-- Trigger on asset updates
DROP TRIGGER IF EXISTS tr_update_location_fill_from_assets ON ta_agbot_assets;
CREATE TRIGGER tr_update_location_fill_from_assets
  AFTER INSERT OR UPDATE OF current_level_percent ON ta_agbot_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_location_fill_from_assets();
```

**Note**: This is optional - Phase 1 alone will fix the issue. Phase 2 ensures location table stays in sync for other queries.

## Testing Plan

### 1. Verify Current State
```sql
-- Check Indosolutions location data
SELECT
  id, name, customer_name,
  calibrated_fill_level,
  last_telemetry_at
FROM ta_agbot_locations
WHERE customer_name ILIKE '%indosolution%';

-- Check asset data for same location
SELECT
  a.id, a.name, a.current_level_percent,
  a.last_telemetry_at, a.is_online
FROM ta_agbot_assets a
JOIN ta_agbot_locations l ON a.location_id = l.id
WHERE l.customer_name ILIKE '%indosolution%';
```

### 2. Test Frontend Change
- Login as Indosolutions customer
- Verify dashboard shows correct fill level (not 54%)
- Verify tank detail page shows correct level
- Verify level updates after webhook receives new data

### 3. Verify Webhook Updates
- Send test webhook with new fill level
- Verify customer portal reflects new level within 2 minutes (staleTime)
- Check that multiple assets are averaged correctly

## Expected Outcome

**Before**:
- Indosolutions shows hardcoded 54%
- Data doesn't update with webhook

**After**:
- Indosolutions shows live fill level from asset readings
- Data updates automatically when webhook receives new readings
- Multiple tanks at same location show average fill level

## Implementation Order

1. ✅ **Phase 1**: Update `useCustomerTanks()` hook (15 min)
   - Change to use asset `current_level_percent`
   - Add averaging logic for multiple assets
   - Test with Indosolutions login

2. ⏳ **Phase 2**: Database trigger (optional, 10 min)
   - Create trigger function
   - Test trigger updates location table
   - Verify no performance impact

## Files to Modify

1. `src/hooks/useCustomerAuth.ts` - Update `useCustomerTanks()` hook
2. `database/migrations/012_update_location_fill_from_assets.sql` - Optional trigger

## Rollback Plan

If issues occur:
- Revert `useCustomerTanks()` to use `loc.calibrated_fill_level`
- Drop trigger if created: `DROP TRIGGER IF EXISTS tr_update_location_fill_from_assets ON ta_agbot_assets;`

## Notes

- The 54% value is likely from initial test data or a default value
- Webhook data flows correctly to `ta_agbot_assets.current_level_percent`
- Issue is just that customer portal reads from wrong source
- Fix is straightforward: read from assets instead of location aggregate

