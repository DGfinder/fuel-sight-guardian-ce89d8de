-- ============================================================================
-- Update SmartFill Consumption to Hourly Decrease Summation
-- Unified consumption calculation across all telematics (AgBot, SmartFill)
-- Date: 2024-12-07
-- ============================================================================
--
-- APPROACH: Hourly Decrease Summation
-- - Sum all decreases > noise threshold between consecutive readings
-- - Ignore increases (refills) > refill threshold
-- - Consistent with AgBot and Customer Portal calculations
--
-- THRESHOLDS:
-- - NOISE_THRESHOLD: 5L (ignore sensor noise)
-- - REFILL_THRESHOLD: 250L (bulk fuel deliveries)
-- ============================================================================

-- 2.1 Daily Consumption Summary View (UPDATED)
-- Uses window function LAG() to compare consecutive readings
CREATE OR REPLACE VIEW ta_smartfill_consumption_daily AS
WITH reading_changes AS (
  SELECT
    r.tank_id,
    r.volume,
    r.volume_percent,
    r.reading_at,
    r.timezone,
    DATE(r.reading_at AT TIME ZONE COALESCE(r.timezone, 'Australia/Perth')) as reading_date,
    -- Calculate change from previous reading using LAG
    r.volume - LAG(r.volume) OVER (
      PARTITION BY r.tank_id
      ORDER BY r.reading_at
    ) as volume_change,
    -- Previous reading time for overnight detection
    LAG(r.reading_at) OVER (
      PARTITION BY r.tank_id
      ORDER BY r.reading_at
    ) as prev_reading_at
  FROM ta_smartfill_readings r
  WHERE r.reading_at IS NOT NULL
    AND r.volume IS NOT NULL
)
SELECT
  rc.tank_id,
  t.customer_id,
  c.name as customer_name,
  t.unit_number,
  t.tank_number,
  t.capacity,
  rc.reading_date,
  COUNT(*) as reading_count,
  MAX(rc.volume) as max_volume,
  MIN(rc.volume) as min_volume,
  -- Hourly decrease summation: sum all decreases > 5L noise threshold
  -- Negative volume_change means fuel decreased (consumption)
  COALESCE(SUM(CASE
    WHEN rc.volume_change < -5 THEN ABS(rc.volume_change)
    ELSE 0
  END), 0) as daily_consumption,
  AVG(rc.volume_percent) as avg_fill_percent,
  MAX(rc.volume_percent) as max_fill_percent,
  MIN(rc.volume_percent) as min_fill_percent,
  -- Refill detection: any increase > 250L (bulk fuel deliveries)
  BOOL_OR(rc.volume_change > 250) as had_refill,
  -- Count of actual consumption events (for data quality)
  SUM(CASE WHEN rc.volume_change < -5 THEN 1 ELSE 0 END) as consumption_events
FROM reading_changes rc
JOIN ta_smartfill_tanks t ON rc.tank_id = t.id
JOIN ta_smartfill_customers c ON t.customer_id = c.id
GROUP BY
  rc.tank_id,
  t.customer_id,
  c.name,
  t.unit_number,
  t.tank_number,
  t.capacity,
  rc.reading_date;

-- Update the detect_refill trigger function to use consistent threshold
CREATE OR REPLACE FUNCTION ta_smartfill_detect_refill()
RETURNS TRIGGER AS $$
DECLARE
  v_prev_volume NUMERIC;
  v_noise_threshold NUMERIC := 5;     -- Ignore changes < 5L
  v_refill_threshold NUMERIC := 250;  -- Increases > 250L = refill (bulk fuel)
BEGIN
  -- Get previous reading volume
  SELECT volume INTO v_prev_volume
  FROM ta_smartfill_readings
  WHERE tank_id = NEW.tank_id AND reading_at < NEW.reading_at
  ORDER BY reading_at DESC
  LIMIT 1;

  -- Calculate volume change
  IF v_prev_volume IS NOT NULL THEN
    NEW.volume_change := NEW.volume - v_prev_volume;
    -- Detect refill: increase > 250L (bulk fuel delivery)
    NEW.is_refill := NEW.volume_change > v_refill_threshold;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment documenting the consumption calculation approach
COMMENT ON VIEW ta_smartfill_consumption_daily IS
'Daily consumption calculated using Hourly Decrease Summation approach.
Thresholds: NOISE_THRESHOLD=5L (ignore sensor noise), REFILL_THRESHOLD=250L (bulk fuel).
Consistent with AgBot and Customer Portal consumption calculations.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'SmartFill consumption view updated to hourly summation approach' as result;
