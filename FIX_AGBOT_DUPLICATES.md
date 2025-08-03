# Fix Agbot Monitoring Duplicate Data - Complete Solution 🔧

## 🔍 Problem Identified

Your Agbot monitoring page is showing **22 locations** but should only show **~11 unique locations**. The duplicates are:

- **Bruce Rock Diesel**: 3 entries (should be 1 location)
- **Corrigin Tank 3**: 2 entries (duplicates)  
- **Corrigin Tank 4**: 2 entries (duplicates)
- **Other locations**: Similar duplication pattern

## 🎯 Root Cause Analysis

1. **Inconsistent location identification** - Using device GUIDs as location GUIDs
2. **Multiple imports** - Each CSV import test created new duplicate records
3. **Improper upsert logic** - Not recognizing existing locations
4. **Location vs Device confusion** - Treating each device as a separate location

## ✅ Solutions Implemented

### 1. **Database Cleanup Script** (`database/fixes/cleanup_duplicate_agbot_locations.sql`)
- **Purpose**: Remove duplicate location records from database
- **Logic**: Keep newest record for each unique location name
- **Safety**: Updates foreign keys before deletion to prevent orphans
- **Result**: Will reduce 22 locations to ~11 unique locations

### 2. **Fixed Location GUID Generation**
**Updated Files:**
- `import-athara-csv.js` - CSV import logic
- `pages/api/gasbot-webhook.js` - Webhook endpoint

**Before** (Wrong):
```javascript
location_guid: csvRow.GUID // Device GUID - causes duplicates
```

**After** (Fixed):
```javascript
// Generate consistent location_guid based on location name
const locationGuid = `location-${locationName.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;
```

### 3. **Improved CSV Import Logic** (`import-athara-csv-improved.js`)
- **Groups devices by location** - Multiple devices per location handled correctly
- **Creates one location record** per unique location name
- **Links multiple devices** to the same location properly
- **Prevents future duplicates** with consistent GUID generation

### 4. **Updated Webhook Logic**
- **Consistent with CSV import** - Same location identification logic
- **Proper upsert handling** - Updates existing locations instead of creating duplicates
- **Future-proof** - Won't create duplicates when Gasbot webhook starts working

## 🚀 How to Fix Your Dashboard

### Step 1: Run Database Cleanup (Required)
```sql
-- In Supabase Dashboard SQL Editor, run:
-- database/fixes/cleanup_duplicate_agbot_locations.sql
```

**This will:**
- ✅ Remove duplicate Bruce Rock Diesel entries (keep 1)  
- ✅ Remove duplicate Corrigin Tank entries (keep 1 each)
- ✅ Update all device/asset references to point to correct locations
- ✅ Clean up any orphaned readings

### Step 2: Re-import with Fixed Logic (Optional but Recommended)
```bash
# Run the improved import
node import-athara-csv-improved.js
```

**This will:**
- ✅ Use proper location-device relationships
- ✅ Prevent future duplicates
- ✅ Ensure data consistency

## 📊 Expected Results After Fix

### Before Fix:
```
22 Locations (with duplicates)
12 Devices
Dashboard shows:
- Bruce Rock Diesel (3 times)
- Corrigin Tank 3 (2 times) 
- Corrigin Tank 4 (2 times)
```

### After Fix:
```
~11 Unique Locations (no duplicates)
12 Devices (same devices, properly linked)
Dashboard shows:
- Bruce Rock Diesel (1 time, with all its devices)
- Corrigin Tank 3 (1 time)
- Corrigin Tank 4 (1 time)
```

## 🔧 Technical Details

### Location GUID Logic (Consistent):
```javascript
// Both CSV import and webhook now use this logic:
const locationGuid = `location-${locationName
  .replace(/\s+/g, '-')
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, '')}`;

// Examples:
// "Bruce Rock Diesel" → "location-bruce-rock-diesel"
// "Corrigin Tank 3 Diesel 54,400ltrs" → "location-corrigin-tank-3-diesel-54400ltrs"
```

### Upsert Conflict Resolution:
```sql
-- Now properly upserts on location_guid instead of creating duplicates
INSERT ... ON CONFLICT (location_guid) DO UPDATE SET ...
```

## 🎯 Next Steps

1. **Execute cleanup script** in Supabase Dashboard
2. **Refresh your Agbot page** - should show ~11 unique locations
3. **Verify device counts** - multiple devices per location should show correctly
4. **Test webhook** - when Gasbot fixes their config, no duplicates will be created

## 🔍 How to Verify Fix Worked

After running the cleanup script, your dashboard should show:
- ✅ **~11 unique locations** instead of 22
- ✅ **No duplicate Bruce Rock Diesel entries**
- ✅ **No duplicate Corrigin Tank entries**  
- ✅ **Same device count** (devices properly linked to locations)
- ✅ **All readings preserved** (no data loss)

The fix ensures both your current CSV import system and future Gasbot webhook integration will work without creating duplicates! 🚀