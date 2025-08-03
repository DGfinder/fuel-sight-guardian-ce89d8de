# Database Scripts

This directory contains all SQL scripts organized by functionality.

## Directory Structure

- **`migrations/`** - Database migration scripts and schema changes
- **`rbac/`** - Role-Based Access Control policies and permissions
- **`fixes/`** - Emergency fixes, patches, and repair scripts
- **`views/`** - View definitions and view-related scripts
- **`utils/`** - Utility scripts, tests, and diagnostic tools

## Usage

Always review scripts before execution and ensure you have proper backups.

### Running Migrations
```bash
# Review the migration first
cat database/migrations/rbac_migration.sql

# Run against your database
psql -d your_database -f database/migrations/rbac_migration.sql
```

### Emergency Fixes
Scripts in the `fixes/` directory should only be used when specifically needed for troubleshooting.