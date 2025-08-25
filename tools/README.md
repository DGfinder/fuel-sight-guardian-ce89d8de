# Database Administration & Analysis Tools

This directory contains professional tools for managing and analyzing the fuel management system database.

## 🏗️ Directory Structure

```
tools/
├── driver-management/          # Driver record management tools
├── lytx-analysis/             # LYTX safety event analysis tools  
├── database-admin/            # Database administration scripts
└── README.md                  # This file
```

## 🚗 Driver Management Tools

### `driver-management/driver-data-audit.js`
Comprehensive auditing tool for driver data across multiple systems.

**Usage:**
```bash
# Audit specific driver by name
node tools/driver-management/driver-data-audit.js --driver-name "John Smith"

# Audit by driver ID with custom timeframe
node tools/driver-management/driver-data-audit.js --driver-id "123e4567-e89b-12d3-a456-426614174000" --days 90

# Show help
node tools/driver-management/driver-data-audit.js --help
```

**Features:**
- Multi-system data correlation (LYTX, MtData, Driver records)
- Configurable date ranges (30, 90, 180 days)
- Event analysis and trip correlation
- Performance metrics calculation

### `driver-management/create-driver-record-admin.js`
Administrative tool for creating missing driver records using service role privileges.

**Usage:**
```bash
# Create basic driver record
node tools/driver-management/create-driver-record-admin.js --name "John Smith" --fleet "Great Southern Fuels" --depot "Perth"

# Create with specific ID (for LYTX event correlation)
node tools/driver-management/create-driver-record-admin.js --driver-id "uuid-here" --name "John Smith" --fleet "GSF"
```

**Features:**
- Service role authentication (bypasses RLS)
- Automatic name parsing and validation
- Frontend accessibility testing
- LYTX event linkage verification

### `driver-management/debug-driver-permissions.js`
Diagnostic tool for troubleshooting RLS policy and permission issues.

**Usage:**
```bash
# Test specific driver permissions
node tools/driver-management/debug-driver-permissions.js --driver-id "uuid-here"

# General RLS policy testing
node tools/driver-management/debug-driver-permissions.js --test-rls

# Test by driver name
node tools/driver-management/debug-driver-permissions.js --driver-name "John Smith"
```

**Features:**
- Service vs Anonymous role comparison
- RLS policy analysis
- Frontend accessibility simulation
- LYTX event access testing

## 🛡️ LYTX Analysis Tools

### `lytx-analysis/lytx-event-analysis.js`
Comprehensive LYTX safety event analysis tool.

**Usage:**
```bash
# Analyze specific driver over 180 days
node tools/lytx-analysis/lytx-event-analysis.js --driver-name "John Smith" --days 180

# Fleet-wide analysis
node tools/lytx-analysis/lytx-event-analysis.js --fleet "Great Southern Fuels" --days 90

# Summary report
node tools/lytx-analysis/lytx-event-analysis.js --summary --days 30
```

**Features:**
- Multi-dimensional event analysis
- Trigger type and status breakdowns
- Score distribution analysis
- Fleet and depot comparisons
- Time-series trend analysis

## 🗄️ Database Administration

### `database-admin/fix-drivers-rls-policy.sql`
SQL script to fix RLS policy issues preventing frontend access to driver records.

**Usage:**
1. Copy the SQL content
2. Paste into Supabase SQL Editor
3. Execute the script
4. Verify using the included test queries

**What it fixes:**
- Anonymous access to driver records
- Frontend driver modal functionality
- Driver search capabilities
- RLS policy configuration

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Environment variables configured (`.env` file):
  ```env
  VITE_SUPABASE_URL=your-supabase-url
  VITE_SUPABASE_ANON_KEY=your-anon-key
  SUPABASE_SERVICE_ROLE_KEY=your-service-key
  ```

### Common Workflows

#### Troubleshooting Driver Modal Issues
1. **Debug permissions**: `node tools/driver-management/debug-driver-permissions.js --test-rls`
2. **Fix RLS policies**: Run `tools/database-admin/fix-drivers-rls-policy.sql`
3. **Create missing records**: `node tools/driver-management/create-driver-record-admin.js --name "Driver Name" --fleet "Fleet"`
4. **Verify fix**: `node tools/driver-management/driver-data-audit.js --driver-name "Driver Name"`

#### Analyzing Data Discrepancies
1. **Audit specific driver**: `node tools/driver-management/driver-data-audit.js --driver-name "John Smith" --days 180`
2. **Analyze LYTX events**: `node tools/lytx-analysis/lytx-event-analysis.js --driver-name "John Smith" --days 180`
3. **Compare with external systems** (LYTX dashboard, MtData reports)

#### Fleet Performance Analysis
1. **Fleet overview**: `node tools/lytx-analysis/lytx-event-analysis.js --fleet "Fleet Name" --days 90`
2. **Depot comparison**: `node tools/lytx-analysis/lytx-event-analysis.js --depot "Depot Name"`
3. **Trend analysis**: Vary the `--days` parameter for different time windows

## 📝 Best Practices

1. **Always test with `--help`** first to understand tool capabilities
2. **Use specific timeframes** (`--days N`) based on your analysis needs
3. **Start with debugging tools** when troubleshooting issues
4. **Document any manual fixes** applied to the database
5. **Verify changes** using audit tools after making modifications

## 🔧 Tool Development

All tools follow consistent patterns:
- Command-line argument parsing with `--help` support
- Professional error handling and user feedback
- Modular functions for specific operations
- Comprehensive logging and result reporting
- Environment variable validation

### Adding New Tools
1. Create in appropriate subdirectory
2. Include shebang line: `#!/usr/bin/env node`
3. Add comprehensive help text
4. Follow existing naming conventions
5. Update this README with tool documentation