-- Migration: Deprecate agbot_sync_logs Table
-- Date: 2025-12-05
-- Purpose: Rename agbot_sync_logs to agbot_sync_logs_deprecated after migrating to ta_agbot_sync_log
-- Risk Level: LOW - All application code has been updated to use ta_agbot_sync_log
-- Impact: None - All INSERT/UPDATE queries now use ta_agbot_sync_log

-- Application code updated:
-- ✅ src/services/agbot-api.ts - All INSERT/UPDATE references migrated (lines 484, 652, 737, 1555, 1675)
-- ✅ src/pages/Settings.tsx - Query migrated with field transformation (line 135)
-- ✅ src/hooks/useAgbotData.ts - Uses getAgbotSyncLogs which already queries ta_agbot_sync_log
-- ✅ api/gasbot-sync.mjs - All INSERT/UPDATE references migrated (lines 168, 276, 324)

-- Data migration:
-- ✅ 2,750 historical records migrated from agbot_sync_logs to ta_agbot_sync_log
-- ✅ Migration: 20251205000003_backfill_sync_logs_to_ta.sql

-- Rename table to indicate deprecation
ALTER TABLE IF EXISTS agbot_sync_logs
  RENAME TO agbot_sync_logs_deprecated;

-- Add deprecation comment
COMMENT ON TABLE agbot_sync_logs_deprecated IS 'DEPRECATED 2025-12-05: Replaced by ta_agbot_sync_log table. All application code has been migrated. Historical data (2,750 records) has been backfilled to ta_agbot_sync_log. Scheduled for permanent removal on 2025-12-19 after 2-week monitoring period. If you need to restore this table, rename it back: ALTER TABLE agbot_sync_logs_deprecated RENAME TO agbot_sync_logs;';

-- Note: We're keeping the table for 2 weeks to ensure no hidden dependencies exist
-- Final removal will be in migration: drop_all_deprecated_tables.sql (scheduled for 2025-12-19)
