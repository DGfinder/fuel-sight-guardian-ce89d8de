# Vehicle Registration Normalization System

## Overview

This system provides enhanced vehicle registration normalization and fleet matching capabilities to handle inconsistent data formatting and prevent duplicate entries.

## Key Features

- **Registration Normalization**: Automatically handles spacing and formatting differences (e.g., `1CCL 525` vs `1CCL525`)
- **Fuzzy Matching**: Identifies potential duplicates with configurable similarity thresholds
- **Enhanced Fleet Lookup**: Integrates with vehicle database for accurate fleet assignments
- **Deduplication**: Prevents duplicate vehicle entries during import

## Components

### 1. Registration Normalizer (`utils/registrationNormalizer.js`)

Core utility providing:
- `normalizeRegistration()` - Standardizes registration format
- `deduplicateVehicles()` - Removes duplicates from vehicle lists
- `createRegistrationLookupMap()` - Creates fast lookup maps for fleet matching
- `lookupVehicleFleet()` - Enhanced fleet lookup with fuzzy matching

### 2. Enhanced Import Scripts

#### Fleet Master Import (`scripts/import-fleet-master.js`)
- Automatically deduplicates CSV entries using fuzzy matching
- Normalizes registration formats for consistency
- Shows detailed deduplication statistics

```bash
npm run import:fleet path/to/fleet-master.csv
```

#### Guardian CSV Import (`scripts/import-guardian-csv.js`)
- Uses vehicle database for accurate fleet assignments
- Falls back to pattern-based detection for unknown vehicles
- Provides detailed fleet lookup logging

```bash
npm run import:guardian path/to/guardian-events.csv
```

### 3. Analysis & Cleanup Scripts

#### Duplicate Analysis (`scripts/analyze-vehicle-duplicates.js`)
- Identifies potential duplicates in existing database
- Shows similarity scores and fleet distributions
- Provides recommendations for cleanup

```bash
npm run analyze:duplicates
```

#### CSV vs Database Comparison (`scripts/compare-csv-vs-database.js`)
- Compares CSV content against database records
- Identifies missing or extra vehicles
- Helps verify import accuracy

```bash
npm run compare:csv-db
```

#### Conservative Cleanup (`scripts/cleanup-vehicle-duplicates.js`)
- Removes only exact formatting duplicates (100% similarity)
- Updates Guardian events to reference correct vehicles
- Provides detailed cleanup logging

```bash
npm run cleanup:duplicates
```

#### Fleet Assignment Updates (`scripts/update-guardian-fleets.js`)
- Updates Guardian events with correct fleet assignments
- Uses vehicle database for accurate fleet lookups
- Processes updates in batches for performance

```bash
npm run update:fleets
```

## How It Works

### Registration Normalization

The system normalizes registrations by:
1. Removing all whitespace
2. Converting to uppercase
3. Standardizing character substitutions (O→0, I→1)
4. Removing non-alphanumeric characters

Example: `"1CCL 525"` → `"1CCL525"`

### Fuzzy Matching

Uses Levenshtein distance to calculate similarity:
- **100% similarity**: Exact match after normalization (formatting differences only)
- **85-99% similarity**: Very similar (potential duplicates, manual review recommended)
- **<85% similarity**: Different vehicles

### Fleet Lookup Priority

1. **Database Lookup**: Query vehicles table with fuzzy matching
2. **CSV Fleet Value**: Use fleet specified in CSV data
3. **Pattern Detection**: Infer fleet from registration patterns
4. **Default Assignment**: Fall back to configured default

## Configuration

### Similarity Thresholds

- **Import Deduplication**: 95% (very conservative, only clear duplicates)
- **Analysis**: 85% (shows potential duplicates for review)
- **Cleanup**: 100% (only exact formatting matches)

### Fleet Detection Patterns

**Great Southern Fuels**:
- Fleet values containing "great southern", "gsf"
- Registrations starting with "gsf" or containing "southern"

**Stevemacs**:
- Fleet values containing "stevemacs", "steve"
- Registrations starting with "sm" or containing "steve"

## Usage Examples

### Import New Fleet Master CSV
```bash
# Import with enhanced deduplication
npm run import:fleet /path/to/new-fleet-data.csv

# Check for any issues
npm run analyze:duplicates

# Clean up any exact duplicates
npm run cleanup:duplicates
```

### Import Guardian Events
```bash
# Import with fleet lookup
npm run import:guardian /path/to/guardian-events.csv

# Update any events with incorrect fleet assignments
npm run update:fleets
```

### Data Quality Checks
```bash
# Analyze current data quality
npm run analyze:duplicates

# Compare CSV vs database
npm run compare:csv-db

# Clean up exact duplicates only
npm run cleanup:duplicates
```

## Current System Status

### Database State (After Cleanup)
- **Total Vehicles**: 226
- **Fleet Distribution**: 
  - Stevemacs: 104 vehicles
  - Great Southern Fuels: 122 vehicles
- **Exact Duplicates**: 0 (cleaned up)
- **Guardian Events**: 2,000 with accurate fleet assignments

### Data Sources
- **Fleet Master CSV**: 128 unique vehicles (after deduplication from 147 raw entries)
- **Additional Vehicles**: 98 vehicles from other sources
- **Guardian Events**: 70 unique vehicles generating safety events

### Guardian Dashboard
- **Main Dashboard**: `/data-centre/guardian` - All fleets with navigation
- **Stevemacs View**: `/data-centre/guardian/smb` - SMB-specific analytics
- **GSF View**: `/data-centre/guardian/gsf` - GSF-specific analytics

## Best Practices

1. **Always run analysis before cleanup**: Use `npm run analyze:duplicates` first
2. **Use conservative thresholds**: Only clean up 100% matches automatically
3. **Verify fleet assignments**: Run `npm run update:fleets` after imports
4. **Monitor data quality**: Regular analysis helps catch issues early
5. **Backup before cleanup**: Database changes are irreversible

## Troubleshooting

### Common Issues

**"Unknown vehicles" in Guardian events**:
- Run `npm run compare:csv-db` to identify missing vehicles
- Check if vehicles exist with different formatting

**Incorrect fleet assignments**:
- Run `npm run update:fleets` to correct using database
- Verify vehicle exists in fleet master

**Import performance issues**:
- Large CSVs are processed in batches automatically
- Check environment variables are set correctly

### Environment Variables Required

```bash
VITE_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Technical Details

The system is built using:
- **Node.js ES Modules** for import scripts
- **Supabase Client** for database operations
- **Custom Fuzzy Matching** using Levenshtein distance
- **Batch Processing** for large datasets
- **TypeScript** for frontend components

All scripts include comprehensive error handling, progress logging, and rollback capabilities where appropriate.