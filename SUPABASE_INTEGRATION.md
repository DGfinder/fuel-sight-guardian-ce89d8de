# Data Centre Supabase Integration

This document outlines the complete Supabase integration for the Data Centre, providing centralized analytics data storage and processing.

## Overview

The Data Centre Supabase integration provides:

- **Centralized Data Storage**: All analytics data (captive payments, LYTX events, Guardian events) stored in Supabase
- **Real-time Analytics**: Pre-computed views and real-time data access
- **Automated Data Pipeline**: Scheduled syncs and batch processing
- **Cross-source Analytics**: Combined insights from multiple data sources
- **Data Quality Monitoring**: Import tracking and error handling

## Database Schema

### Core Analytics Tables

#### `captive_payment_records` (Existing Table)
Stores individual CSV records from captive payments data.
- **Primary Data**: `bill_of_lading`, `delivery_date`, `customer`, `product`, `volume_litres`
- **Metadata**: `carrier` (SMB/GSF/Combined), `terminal`, `raw_location`, `source_file`
- **Indexes**: Optimized for BOL grouping, date ranges, and carrier filtering

#### `captive_deliveries` (Existing Materialized View)
Pre-aggregated unique deliveries (BOL + Date + Customer combinations).
- **Aggregations**: `total_volume_litres`, `total_volume_litres_abs`, `record_count`, `products[]`
- **Purpose**: Performance optimization for dashboard queries with BOL-based grouping
- **Key Fields**: `delivery_key`, `bill_of_lading`, `delivery_date`, `customer`, `terminal`

#### `lytx_safety_events`
LYTX safety event data from API and CSV imports.
- **Event Data**: Driver, vehicle, event type, score, behaviors
- **Metadata**: Carrier, depot, verification status, notes
- **Real-time**: Supports both scheduled API sync and manual CSV import

#### `lytx_event_behaviors`
Normalized behavior data linked to LYTX events.
- **Relationships**: Foreign key to `lytx_safety_events`
- **Purpose**: Detailed behavior analysis and scoring

#### `guardian_events`
Guardian telematics event data.
- **Event Details**: Vehicle, event type, location, severity
- **Verification**: Manual verification workflow support
- **Fleet Management**: Integrated with existing vehicle data

#### `data_import_batches`
Tracking and monitoring of all data imports.
- **Batch Processing**: Progress tracking, error logging
- **Data Quality**: Success/failure rates, processing metadata
- **Audit Trail**: Complete import history

### Analytics Views

#### `captive_payments_analytics`
Monthly aggregated captive payments data with KPIs.

#### `lytx_safety_analytics`
Monthly LYTX safety metrics by carrier and depot.

#### `cross_analytics_summary`
Combined analytics across all data sources.

## Data Processing Services

### `CaptivePaymentsSupabaseService`
- Process CSV data to existing `captive_payment_records` table
- Refresh `captive_deliveries` materialized view after import
- Get analytics from `captive_payments_analytics` view
- Uses correct field names: `bill_of_lading`, `volume_litres`, `terminal`

### `LytxSupabaseService`
- Sync from LYTX API (scheduled every 15 minutes)
- Process CSV events
- Real-time event transformation

### `GuardianSupabaseService`
- Process Guardian events from CSV/API
- Event verification workflow
- Fleet-based data management

### `DataMigrationService`
- Migrate all historical data
- Batch processing coordination
- Migration status tracking

### `ScheduledSyncService`
- Initialize scheduled jobs
- Manual sync triggers
- Health monitoring

### `DataCentreSupabaseService`
- Comprehensive analytics API
- Data refresh capabilities
- Export functionality

## Migration Files

- `database/migrations/001_create_analytics_tables.sql` - Core table creation
- `database/migrations/002_create_rls_policies.sql` - Security policies  
- `database/migrations/003_create_analytics_views.sql` - Analytics views (fixed PostgreSQL grouping errors)
- `database/migrations/validate_analytics_views.sql` - View validation script
- `database/migrations/test_all_views.sql` - Comprehensive testing script

## Setup Instructions

### 1. Database Migration
```bash
# Apply migrations to Supabase
supabase db reset
supabase migration up

# Validate views (optional)
psql -f database/migrations/validate_analytics_views.sql
psql -f database/migrations/test_all_views.sql
```

### 2. Environment Configuration
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Initial Data Migration
```typescript
const migrationService = new DataMigrationService();
const result = await migrationService.migrateAllHistoricalData();
```

### 4. Start Scheduled Sync
```typescript
const syncService = new ScheduledSyncService();
await syncService.initializeScheduledJobs();
```

## Usage Examples

### Get Data Centre Analytics
```typescript
const dataCentreService = new DataCentreSupabaseService();

// Get comprehensive analytics
const analytics = await dataCentreService.getDataCentreAnalytics({
  fleet: 'Stevemacs',
  dateRange: { start: new Date('2024-01-01'), end: new Date('2024-12-31') }
});

// Refresh data
await dataCentreService.refreshData('lytx-events');

// Export data
const csvData = await dataCentreService.exportAnalyticsData('csv', 'captive-payments');
```

### Process New Data
```typescript
const captiveService = new CaptivePaymentsSupabaseService();

// Process CSV file (automatically maps to correct field names)
const result = await captiveService.processCsvToSupabase(
  csvData, 
  'SMB', 
  'Monthly SMB Captive Payments'
);

console.log(`Processed ${result.recordsProcessed} records`);

// Get deliveries from materialized view
const deliveries = await captiveService.getCaptiveDeliveries({
  carrier: 'SMB',
  startDate: '2024-01-01',
  endDate: '2024-12-31'
});
```

### Manual LYTX Sync
```typescript
const syncService = new ScheduledSyncService();

// Trigger manual sync for last 30 days
const syncResult = await syncService.triggerManualSync('lytx_events', { 
  daysBack: 30 
});

console.log(`Synced ${syncResult.recordsProcessed} events`);
```

## Data Flow

```
CSV Files/APIs → Services → Validation → Transformation → Supabase → Views → Data Centre UI
```

## Performance Features

- **Indexed queries**: Date ranges, carriers, fleets
- **Batch processing**: Configurable batch sizes
- **Progress tracking**: Real-time status updates
- **Error handling**: Individual record failure tracking
- **Materialized views**: Pre-computed analytics
- **Scheduled sync**: Automated data updates

## Security

- **Row Level Security (RLS)**: User-based data access
- **Carrier restrictions**: Data isolation by carrier
- **Fleet limitations**: Access control by fleet
- **Service role**: Automation bypass permissions

## Monitoring

- **Import tracking**: `data_import_batches` table
- **Health checks**: Service status monitoring
- **Error logging**: Detailed failure tracking
- **Performance metrics**: Processing duration analysis

## Files Created

### Services
- `src/services/captivePaymentsSupabaseService.ts`
- `src/services/lytxSupabaseService.ts`
- `src/services/guardianSupabaseService.ts`
- `src/services/dataMigrationService.ts`
- `src/services/scheduledSyncService.ts`
- `src/services/dataCentreSupabaseService.ts`

### Database
- `database/migrations/001_create_analytics_tables.sql`
- `database/migrations/002_create_rls_policies.sql`
- `database/migrations/003_create_analytics_views.sql`

### Types
- Extended `src/types/supabase.ts` with new table definitions

## Next Steps

1. **Run Database Migrations**: Apply the SQL migration files to Supabase
2. **Test Services**: Verify data processing with sample CSV files
3. **Initialize Scheduled Jobs**: Start automated LYTX sync
4. **Update Data Centre Components**: Integrate with new Supabase services
5. **Monitor Data Quality**: Review import batches and error logs

The Data Centre is now prepared for centralized data processing through Supabase with comprehensive analytics, real-time sync, and robust error handling.