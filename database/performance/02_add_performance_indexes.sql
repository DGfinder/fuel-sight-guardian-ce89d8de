-- ============================================================================
-- Database Performance Indexes
-- ============================================================================
-- Adds composite indexes to improve query performance for common access patterns
-- in the fuel dips system
--
-- Query patterns optimized:
-- 1. Filter by tank + date range (most common)
-- 2. Filter by tank + archived status
-- 3. Filter by recorded_by user
-- 4. Sort by created_at DESC (default sort)
-- ============================================================================

-- Index for tank_id + created_at queries (used in history views)
-- Covers: WHERE tank_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_dip_tank_date_archived
ON dip_readings(tank_id, created_at DESC, archived_at)
WHERE archived_at IS NULL;

COMMENT ON INDEX idx_dip_tank_date_archived IS
  'Optimizes queries filtering by tank and date, excluding archived records';

-- Index for multi-tank queries (used in group views)
-- Covers: WHERE tank_id IN (?,?,?) AND archived_at IS NULL
CREATE INDEX IF NOT EXISTS idx_dip_archived_tank_date
ON dip_readings(archived_at, tank_id, created_at DESC)
WHERE archived_at IS NULL;

COMMENT ON INDEX idx_dip_archived_tank_date IS
  'Optimizes group-wide queries across multiple tanks';

-- Index for user-specific queries
-- Covers: WHERE recorded_by = ? AND archived_at IS NULL
CREATE INDEX IF NOT EXISTS idx_dip_recorded_by_active
ON dip_readings(recorded_by, created_at DESC)
WHERE archived_at IS NULL;

COMMENT ON INDEX idx_dip_recorded_by_active IS
  'Optimizes queries filtering by user (recorded_by)';

-- Partial index for recent readings (90 days)
-- Covers: Most common queries that look at recent data only
CREATE INDEX IF NOT EXISTS idx_dip_recent_90days
ON dip_readings(tank_id, created_at DESC)
WHERE archived_at IS NULL
  AND created_at > (NOW() - INTERVAL '90 days');

COMMENT ON INDEX idx_dip_recent_90days IS
  'Optimizes queries for recent readings (last 90 days)';

-- Index for value-based filtering (used in analytics)
-- Covers: WHERE value BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_dip_value
ON dip_readings(value)
WHERE archived_at IS NULL;

COMMENT ON INDEX idx_dip_value IS
  'Supports queries filtering by dip value ranges';

-- Analyze tables to update statistics
ANALYZE dip_readings;

-- Display index information
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_indexes
JOIN pg_class ON pg_indexes.indexname = pg_class.relname
WHERE tablename = 'dip_readings'
ORDER BY pg_relation_size(indexrelid) DESC;
