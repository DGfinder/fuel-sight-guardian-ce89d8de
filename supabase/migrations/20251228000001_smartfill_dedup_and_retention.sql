-- SmartFill Deduplication and Data Retention
-- Adds unique constraint and cleanup functions

-- ============================================================================
-- 1. Remove existing duplicates before adding constraint
-- Keep only the earliest created_at for each (tank_id, reading_at) pair
-- ============================================================================

DELETE FROM ta_smartfill_readings a
USING ta_smartfill_readings b
WHERE a.tank_id = b.tank_id
  AND a.reading_at = b.reading_at
  AND a.created_at > b.created_at;

-- ============================================================================
-- 2. Add unique constraint for deduplication
-- ============================================================================

ALTER TABLE ta_smartfill_readings
ADD CONSTRAINT uq_ta_smartfill_readings_tank_time
UNIQUE (tank_id, reading_at);

-- ============================================================================
-- 3. Data retention function - delete readings older than X days
-- ============================================================================

CREATE OR REPLACE FUNCTION ta_smartfill_cleanup_old_readings(
  retention_days INTEGER DEFAULT 90
)
RETURNS TABLE (deleted_count BIGINT) AS $$
BEGIN
  WITH deleted AS (
    DELETE FROM ta_smartfill_readings
    WHERE reading_at < NOW() - (retention_days || ' days')::INTERVAL
    RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Function to mark inactive tanks
-- Tanks with no readings in X days are marked as not monitored
-- ============================================================================

CREATE OR REPLACE FUNCTION ta_smartfill_mark_inactive_tanks(
  inactive_threshold_days INTEGER DEFAULT 30
)
RETURNS TABLE (updated_count BIGINT) AS $$
BEGIN
  WITH updated AS (
    UPDATE ta_smartfill_tanks
    SET is_monitored = false
    WHERE is_monitored = true
      AND (
        last_reading_at IS NULL
        OR last_reading_at < NOW() - (inactive_threshold_days || ' days')::INTERVAL
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO updated_count FROM updated;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Combined maintenance function
-- ============================================================================

CREATE OR REPLACE FUNCTION ta_smartfill_maintenance(
  retention_days INTEGER DEFAULT 90,
  inactive_threshold_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  readings_deleted BIGINT,
  tanks_marked_inactive BIGINT
) AS $$
BEGIN
  -- Cleanup old readings
  SELECT deleted_count INTO readings_deleted
  FROM ta_smartfill_cleanup_old_readings(retention_days);

  -- Mark inactive tanks
  SELECT updated_count INTO tanks_marked_inactive
  FROM ta_smartfill_mark_inactive_tanks(inactive_threshold_days);

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT * FROM ta_smartfill_maintenance(90, 30);
-- This deletes readings older than 90 days and marks tanks inactive if no reading in 30 days
