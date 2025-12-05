-- Migration: Deprecate location_mapping Table
-- Date: 2025-12-05
-- Purpose: Rename location_mapping to location_mapping_deprecated as it's no longer used
-- Risk Level: LOW - Table is empty (0 rows) and not referenced in application code
-- Impact: None - Only referenced in SQL correlation scripts, not in application

-- Verification performed:
-- ✅ Table has 0 rows
-- ✅ No foreign key constraints pointing to this table
-- ✅ No views depend on this table
-- ✅ Only referenced in database/scripts/* SQL files (correlation functions)
-- ✅ Not referenced in any TypeScript/JavaScript application code
-- ✅ Replaced by discovered_poi and terminal_locations tables

-- Rename table to indicate deprecation
ALTER TABLE IF EXISTS location_mapping
  RENAME TO location_mapping_deprecated;

-- Add deprecation comment
COMMENT ON TABLE location_mapping_deprecated IS
  'DEPRECATED 2025-12-05: Replaced by discovered_poi and terminal_locations tables. ' ||
  'This table was only used in correlation SQL scripts, not in application code. ' ||
  'Contains 0 rows. Scheduled for permanent removal on 2025-12-19 after 2-week monitoring period. ' ||
  'If you need to restore this table, rename it back: ALTER TABLE location_mapping_deprecated RENAME TO location_mapping;';

-- Note: We're keeping the table for 2 weeks to ensure no hidden dependencies exist
-- Final removal will be in migration: drop_all_deprecated_tables.sql (scheduled for 2025-12-19)
