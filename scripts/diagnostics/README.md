# SmartFill Sync Diagnostics

This directory contains diagnostic tools and SQL queries to help investigate SmartFill synchronization failures, particularly for getting complete error details that may be truncated in the UI.

## Files

### 1. `smartfill-sync-diagnostics.sql`

Comprehensive SQL queries to investigate sync failures and examine error messages in detail.

**Key Queries:**
- Get recent sync logs with full error messages (no truncation)
- Search specifically for Altona Farms 4309 errors
- Analyze error patterns and categorize failures
- Check sync performance metrics
- Compare successful vs failed syncs

**Usage:**
```sql
-- Connect to your database and run individual queries
psql "your-database-connection-string"
\i scripts/diagnostics/smartfill-sync-diagnostics.sql
```

**Important Queries for Your Issue:**

```sql
-- Query 1: Get full error messages for Altona Farms
SELECT 
    id, sync_type, sync_status, started_at, completed_at,
    sync_duration_ms, error_message as full_error_details
FROM smartfill_sync_logs 
WHERE error_message ILIKE '%altona%' 
   OR error_message ILIKE '%4309%'
ORDER BY started_at DESC;

-- Query 8: Get the most recent error with complete text
SELECT 
    id, sync_type, sync_status, started_at, completed_at,
    sync_duration_ms, LENGTH(error_message) as error_length,
    error_message
FROM smartfill_sync_logs 
WHERE error_message IS NOT NULL
ORDER BY started_at DESC 
LIMIT 1;
```

### 2. `check-smartfill-customer-details.js`

Interactive diagnostic script to test specific SmartFill customers and investigate API connectivity issues.

**Features:**
- Test SmartFill API connectivity for specific customers
- Check customer database records
- Analyze recent sync logs
- Get detailed error information from API calls

**Usage:**
```bash
# Test specific customer (Altona Farms)
node scripts/diagnostics/check-smartfill-customer-details.js ALTONAfm4309

# Analyze all customers and find potential matches
node scripts/diagnostics/check-smartfill-customer-details.js

# Make sure you have environment variables set:
# SUPABASE_URL=your-supabase-url
# SUPABASE_ANON_KEY=your-supabase-key
```

## Investigating the "Altona Farms 4309" Error

Based on the codebase analysis, here's what the diagnostic tools will help you discover:

### 1. Database Investigation

The SmartFill system uses these tables:
- `smartfill_customers` - API credentials and customer info
- `smartfill_locations` - Units/locations for each customer  
- `smartfill_tanks` - Individual tanks within locations
- `smartfill_sync_logs` - Sync attempt logs with error details

From `populate_smartfill_customers.sql`, Altona Farms is configured as:
```sql
('ALTONAfm4309', 'f3c5316db0610cdb', 'Altona Farms 4309', true, NOW(), NOW())
```

### 2. Error Message Sources

The error "E..." you're seeing is likely truncated in the UI. The full error is stored in:
- `smartfill_sync_logs.error_message` (TEXT column - no length limit)
- Frontend components may truncate for display (see SmartFillPage.tsx line 1335)

### 3. API Error Patterns

Common SmartFill API errors include:
- Authentication failures (invalid API reference/secret)
- Network timeouts (30-second timeout configured)
- API rate limiting (50 requests/hour per customer)
- JSON-RPC error responses from SmartFill service

### 4. Sync Process Flow

The sync process follows this pattern:
1. `api/smartfill-sync.mjs` - Full sync endpoint
2. `api/smartfill-sync-customer.mjs` - Single customer sync
3. `src/services/smartfill-api.ts` - Core API client logic

Each creates detailed log entries in `smartfill_sync_logs` with complete error details.

## Quick Commands to Get Full Error Details

### Option 1: SQL Query (Fastest)
```sql
-- Get the most recent Altona Farms error with full details
SELECT error_message 
FROM smartfill_sync_logs 
WHERE (error_message ILIKE '%altona%' OR error_message ILIKE '%4309%')
  AND error_message IS NOT NULL
ORDER BY started_at DESC 
LIMIT 1;
```

### Option 2: Direct API Test
```bash
# Test the Altona Farms customer directly
node scripts/diagnostics/check-smartfill-customer-details.js ALTONAfm4309
```

### Option 3: Manual API Sync with Logging
```bash
# Trigger a sync for just this customer to see real-time errors
curl -X POST "your-domain/api/smartfill-sync-customer?customer=ALTONAfm4309"
```

## Error Pattern Analysis

The diagnostic tools will help identify if the error is:

1. **Authentication Issue**: Invalid API credentials
2. **Data Format Issue**: Unexpected response from SmartFill API
3. **Network Issue**: Timeout or connectivity problems
4. **Database Issue**: Problem storing/processing the data
5. **Business Logic Issue**: Data validation failures

## Troubleshooting Steps

1. **Run the SQL diagnostics** to get full error messages
2. **Use the Node.js script** to test API connectivity
3. **Check recent sync logs** for error patterns
4. **Verify customer configuration** in the database
5. **Test individual API calls** to isolate the issue

This should give you complete visibility into what's causing the Altona Farms sync failures.