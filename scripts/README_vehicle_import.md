# Vehicle Import from MtData Trip History

This document outlines the process for identifying and importing vehicles from MtData trip history that are missing from the fleet management database.

## Overview

During the MtData trip history import, we discovered that approximately 13% of vehicles in the trip data were not present in the existing fleet database. This represents around 130+ unique vehicles that need to be added to achieve complete operational visibility.

## Scripts and Process

### 1. Analysis Phase

#### `analyze-unmatched-vehicles.sql`
SQL queries to analyze unmatched vehicles in the trip history database.

**Usage:**
```sql
-- Run in your PostgreSQL client connected to the database
\i scripts/analyze-unmatched-vehicles.sql
```

**What it provides:**
- Summary statistics of unmatched vehicles
- Detailed vehicle information with trip counts
- Fleet assignment analysis by group
- Device mapping potential
- Recent activity patterns

### 2. Export Phase

#### `export-new-vehicles.js`
Extracts unmatched vehicles from the trip history and prepares them for import.

**Usage:**
```bash
node scripts/export-new-vehicles.js [output-file.csv]
```

**Features:**
- Identifies vehicles in trip history without fleet database entries
- Applies fleet/depot mapping logic based on MtData group names
- Detects potential Guardian device serial numbers
- Checks for potential duplicates with existing vehicles
- Exports clean candidates to CSV format

**Output:**
- `new-vehicles-from-trips.csv` - Main export file
- `new-vehicles-from-trips-potential-duplicates.csv` - Duplicates for review

### 3. Import Phase

#### `import-new-vehicles-from-trips.js`
Imports new vehicles into the fleet database and updates trip correlations.

**Usage:**
```bash
# Import directly from database
node scripts/import-new-vehicles-from-trips.js

# Or import from CSV
node scripts/import-new-vehicles-from-trips.js new-vehicles-from-trips.csv
```

**Process:**
1. Reads candidate vehicles (from DB or CSV)
2. Applies fleet/depot mapping using group names
3. Checks for existing vehicles to avoid duplicates
4. Inserts new vehicles with default values
5. Updates trip history to link vehicle IDs
6. Provides detailed import statistics

### 4. Validation Phase

#### `validate-vehicle-additions.js`
Comprehensive validation of the import process and system health.

**Usage:**
```bash
node scripts/validate-vehicle-additions.js
```

**Validation Areas:**
- Trip correlation rates (target: >95%)
- Fleet database statistics
- Device mapping coverage
- Trip analytics functionality
- Recent vehicle additions
- Overall system health score

## Fleet Mapping Logic

The system maps MtData group names to fleet assignments:

| Group Name | Fleet | Depot |
|------------|--------|--------|
| Kewdale | Stevemacs | Kewdale |
| Kalgoorlie | Great Southern Fuels | Kalgoorlie |
| Katanning | Great Southern Fuels | Katanning |
| Wongan Hills | Great Southern Fuels | Wongan Hills |
| Narrogin | Great Southern Fuels | Narrogin |
| Albany | Great Southern Fuels | Albany |
| Merredin | Great Southern Fuels | Merredin |
| Geraldton | Great Southern Fuels | Geraldton |
| Quairading | Great Southern Fuels | Quairading |
| GSF | Great Southern Fuels | Kewdale |
| Stevemacs | Stevemacs | Kewdale |

## Vehicle Data Structure

New vehicles are created with the following structure:

```javascript
{
  registration: "ABC123",           // From trip data
  fleet: "Great Southern Fuels",   // Mapped from group
  depot: "Kalgoorlie",            // Mapped from group
  status: "Active",               // Default
  guardian_unit: "AA123456",      // If serial matches Guardian format
  lytx_device: null,              // To be populated later
  safety_score: 0.0,              // Default
  fuel_efficiency: 0.0,           // Default
  utilization: 0,                 // Default
  total_deliveries: 0,            // Default
  total_kilometers: 1234,         // From trip data
  fatigue_events: 0,              // Default
  safety_events: 0                // Default
}
```

## Expected Outcomes

After successful import:
- **130+ new vehicles** added to fleet database
- **Trip correlation rate** improved from 87% to ~99%
- **Complete operational visibility** across both fleets
- **Enhanced trip analytics** with full vehicle coverage

## Safety and Rollback

### Before Running
1. Backup the database
2. Run the analysis script first to understand scope
3. Review the export CSV before importing
4. Test with a small subset if concerned

### Rollback Process
If issues occur during import:

```sql
-- Find recently added vehicles (adjust timestamp as needed)
SELECT id, registration, fleet, depot, created_at 
FROM vehicles 
WHERE created_at > '2025-08-14 00:00:00';

-- Remove specific vehicles if needed (replace IDs)
DELETE FROM vehicles WHERE id IN ('uuid1', 'uuid2', ...);

-- Reset trip history links if needed
UPDATE mtdata_trip_history 
SET vehicle_id = NULL 
WHERE vehicle_id IN ('uuid1', 'uuid2', ...);
```

## Troubleshooting

### Common Issues

1. **Permission Errors**
   - Ensure `SUPABASE_SERVICE_ROLE_KEY` environment variable is set
   - Verify database permissions for vehicle table

2. **Correlation Not Improving**
   - Check for registration format differences
   - Review potential duplicates file
   - Verify fleet mapping logic

3. **Missing Trip Data**
   - Ensure MtData trip history was imported first
   - Check database connection
   - Verify table names match schema

4. **Analytics Not Working**
   - Run database schema migration first
   - Check view dependencies
   - Verify RLS policies

### Getting Help

1. Run the validation script for system health check
2. Check logs in the console output
3. Review error messages for specific issues
4. Use the analysis SQL to understand data patterns

## Integration with Fleet Management

After successful import:

1. **Vehicle Database Page**: New vehicles will appear in the Vehicle Database
2. **Trip Analytics**: Correlation improvements will be visible in trip analytics
3. **Fleet Dashboards**: New vehicles will show in fleet-specific dashboards
4. **Device Mapping**: Guardian devices will be automatically mapped where detected

## Maintenance

### Regular Tasks
1. Monitor trip correlation rates
2. Update device mappings as new hardware is deployed
3. Verify fleet assignments for edge cases
4. Run validation script monthly for system health

### Future Imports
- The export script can be run regularly to catch new vehicles
- The import process is designed to handle incremental additions
- Duplicate detection prevents re-importing existing vehicles