-- ============================================================================
-- Migration: Add Product Consumption Historical Snapshots
-- Created: 2025-12-03
-- Description: Creates table and functions for daily product consumption snapshots
--              Enables historical trend analysis and consumption tracking over time
-- ============================================================================

-- Drop existing table if exists
DROP TABLE IF EXISTS ta_product_consumption_snapshots CASCADE;

-- ============================================================================
-- TABLE: ta_product_consumption_snapshots
-- Stores daily snapshots of product-level consumption metrics
-- ============================================================================

CREATE TABLE ta_product_consumption_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES ta_products(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,

  -- Tank Counts
  total_tanks INTEGER NOT NULL DEFAULT 0,
  tanks_critical INTEGER NOT NULL DEFAULT 0,
  tanks_low INTEGER NOT NULL DEFAULT 0,
  tanks_normal INTEGER NOT NULL DEFAULT 0,

  -- Consumption Metrics
  total_daily_consumption_liters INTEGER NOT NULL DEFAULT 0,
  avg_daily_consumption_per_tank_liters INTEGER NOT NULL DEFAULT 0,
  total_consumption_7_days_liters BIGINT DEFAULT 0,
  total_consumption_30_days_liters BIGINT DEFAULT 0,

  -- Capacity Metrics
  total_capacity_liters BIGINT NOT NULL DEFAULT 0,
  total_current_level_liters BIGINT NOT NULL DEFAULT 0,
  avg_fill_percent NUMERIC(5,2) DEFAULT 0,

  -- Efficiency
  efficiency_score INTEGER DEFAULT 0,
  avg_days_until_empty NUMERIC(10,2) DEFAULT 0,
  min_days_until_empty NUMERIC(10,2) DEFAULT 0,

  -- Trends
  dominant_trend TEXT DEFAULT 'stable',

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one snapshot per product per day
  CONSTRAINT uk_product_snapshot_date UNIQUE(product_id, snapshot_date)
);

-- Indexes for performance
CREATE INDEX idx_snapshots_product_id ON ta_product_consumption_snapshots(product_id);
CREATE INDEX idx_snapshots_snapshot_date_desc ON ta_product_consumption_snapshots(snapshot_date DESC);
CREATE INDEX idx_snapshots_product_date ON ta_product_consumption_snapshots(product_id, snapshot_date DESC);

-- Grant permissions
GRANT SELECT ON ta_product_consumption_snapshots TO authenticated;
GRANT SELECT ON ta_product_consumption_snapshots TO anon;
GRANT INSERT, UPDATE, DELETE ON ta_product_consumption_snapshots TO service_role;

-- ============================================================================
-- FUNCTION: capture_daily_product_snapshot
-- Captures current product analytics as a daily snapshot
-- ============================================================================

CREATE OR REPLACE FUNCTION capture_daily_product_snapshot()
RETURNS INTEGER AS $$
DECLARE
  rows_inserted INTEGER;
BEGIN
  -- Insert today's snapshot from current product analytics
  INSERT INTO ta_product_consumption_snapshots (
    product_id,
    snapshot_date,
    total_tanks,
    tanks_critical,
    tanks_low,
    tanks_normal,
    total_daily_consumption_liters,
    avg_daily_consumption_per_tank_liters,
    total_consumption_7_days_liters,
    total_consumption_30_days_liters,
    total_capacity_liters,
    total_current_level_liters,
    avg_fill_percent,
    efficiency_score,
    avg_days_until_empty,
    min_days_until_empty,
    dominant_trend
  )
  SELECT
    product_id,
    CURRENT_DATE as snapshot_date,
    total_tanks,
    tanks_critical,
    tanks_low,
    tanks_normal,
    total_daily_consumption_liters,
    avg_daily_consumption_per_tank_liters,
    total_consumption_7_days_liters,
    total_consumption_30_days_liters,
    total_capacity_liters,
    total_current_level_liters,
    avg_fill_percent,
    efficiency_score,
    avg_days_until_empty,
    min_days_until_empty,
    dominant_trend
  FROM ta_product_analytics
  WHERE total_tanks > 0  -- Only capture products with tanks
  ON CONFLICT (product_id, snapshot_date)
  DO UPDATE SET
    total_tanks = EXCLUDED.total_tanks,
    tanks_critical = EXCLUDED.tanks_critical,
    tanks_low = EXCLUDED.tanks_low,
    tanks_normal = EXCLUDED.tanks_normal,
    total_daily_consumption_liters = EXCLUDED.total_daily_consumption_liters,
    avg_daily_consumption_per_tank_liters = EXCLUDED.avg_daily_consumption_per_tank_liters,
    total_consumption_7_days_liters = EXCLUDED.total_consumption_7_days_liters,
    total_consumption_30_days_liters = EXCLUDED.total_consumption_30_days_liters,
    total_capacity_liters = EXCLUDED.total_capacity_liters,
    total_current_level_liters = EXCLUDED.total_current_level_liters,
    avg_fill_percent = EXCLUDED.avg_fill_percent,
    efficiency_score = EXCLUDED.efficiency_score,
    avg_days_until_empty = EXCLUDED.avg_days_until_empty,
    min_days_until_empty = EXCLUDED.min_days_until_empty,
    dominant_trend = EXCLUDED.dominant_trend,
    created_at = NOW();

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;

  RAISE NOTICE 'Captured % product consumption snapshots for %', rows_inserted, CURRENT_DATE;

  RETURN rows_inserted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: cleanup_old_snapshots
-- Removes snapshots older than retention period (default 365 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_snapshots(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  rows_deleted INTEGER;
BEGIN
  DELETE FROM ta_product_consumption_snapshots
  WHERE snapshot_date < (CURRENT_DATE - retention_days);

  GET DIAGNOSTICS rows_deleted = ROW_COUNT;

  RAISE NOTICE 'Deleted % old snapshots older than % days', rows_deleted, retention_days;

  RETURN rows_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEDULE DAILY SNAPSHOT via pg_cron
-- Runs at 1 AM daily to capture previous day's metrics
-- ============================================================================

-- Note: pg_cron extension must be enabled
-- Check if cron exists before scheduling
DO $$
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule('daily-product-snapshot');

    -- Schedule daily snapshot at 1 AM
    PERFORM cron.schedule(
      'daily-product-snapshot',
      '0 1 * * *', -- Every day at 1 AM
      $$SELECT capture_daily_product_snapshot()$$
    );

    -- Schedule monthly cleanup at 2 AM on 1st of month
    PERFORM cron.schedule(
      'monthly-snapshot-cleanup',
      '0 2 1 * *', -- 1st of every month at 2 AM
      $$SELECT cleanup_old_snapshots(365)$$  -- Keep 1 year of history
    );

    RAISE NOTICE 'Successfully scheduled daily product snapshot cron job';
  ELSE
    RAISE WARNING 'pg_cron extension not found. Snapshots must be captured manually via: SELECT capture_daily_product_snapshot()';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not schedule cron jobs: %. Snapshots must be captured manually.', SQLERRM;
END $$;

-- ============================================================================
-- CAPTURE INITIAL SNAPSHOT
-- Populate table with today's data
-- ============================================================================

SELECT capture_daily_product_snapshot();

-- ============================================================================
-- BACKFILL HELPER FUNCTION (Optional)
-- Backfills snapshots for date range (use carefully - estimates historical data)
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_product_snapshots(
  start_date DATE,
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(snapshot_date DATE, products_captured INTEGER) AS $$
DECLARE
  current_date_iter DATE;
  rows_inserted INTEGER;
BEGIN
  -- Note: This backfills using CURRENT analytics data
  -- Real historical data would require time-travel queries if available

  current_date_iter := start_date;

  WHILE current_date_iter <= end_date LOOP
    -- Insert snapshot for this date using current analytics
    -- (This is an estimate, not true historical data)
    INSERT INTO ta_product_consumption_snapshots (
      product_id,
      snapshot_date,
      total_tanks,
      tanks_critical,
      tanks_low,
      tanks_normal,
      total_daily_consumption_liters,
      avg_daily_consumption_per_tank_liters,
      total_consumption_7_days_liters,
      total_consumption_30_days_liters,
      total_capacity_liters,
      total_current_level_liters,
      avg_fill_percent,
      efficiency_score,
      avg_days_until_empty,
      min_days_until_empty,
      dominant_trend
    )
    SELECT
      product_id,
      current_date_iter as snapshot_date,
      total_tanks,
      tanks_critical,
      tanks_low,
      tanks_normal,
      total_daily_consumption_liters,
      avg_daily_consumption_per_tank_liters,
      total_consumption_7_days_liters,
      total_consumption_30_days_liters,
      total_capacity_liters,
      total_current_level_liters,
      avg_fill_percent,
      efficiency_score,
      avg_days_until_empty,
      min_days_until_empty,
      dominant_trend
    FROM ta_product_analytics
    WHERE total_tanks > 0
    ON CONFLICT (product_id, snapshot_date) DO NOTHING;

    GET DIAGNOSTICS rows_inserted = ROW_COUNT;

    snapshot_date := current_date_iter;
    products_captured := rows_inserted;

    RETURN NEXT;

    current_date_iter := current_date_iter + INTERVAL '1 day';
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE ta_product_consumption_snapshots IS
  'Daily historical snapshots of product-level consumption metrics for trend analysis';

COMMENT ON FUNCTION capture_daily_product_snapshot() IS
  'Captures current product analytics as a daily snapshot. Scheduled to run at 1 AM daily via pg_cron.';

COMMENT ON FUNCTION cleanup_old_snapshots(INTEGER) IS
  'Removes snapshots older than retention period to manage table size. Default: 365 days.';

COMMENT ON FUNCTION backfill_product_snapshots(DATE, DATE) IS
  'Backfills historical snapshots using current analytics data (estimates). Use with caution.';

-- ============================================================================
-- VERIFICATION QUERIES
-- Run to verify table and snapshots created successfully
-- ============================================================================

-- Check if snapshot was captured
-- SELECT
--   product_id,
--   snapshot_date,
--   total_tanks,
--   total_daily_consumption_liters,
--   efficiency_score
-- FROM ta_product_consumption_snapshots
-- ORDER BY snapshot_date DESC, total_tanks DESC;

-- Check if cron jobs are scheduled
-- SELECT * FROM cron.job WHERE jobname LIKE '%product-snapshot%';
