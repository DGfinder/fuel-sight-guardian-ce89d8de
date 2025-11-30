-- TankAlert Auto-Update Triggers
-- Run in Supabase SQL Editor AFTER create_ta_dashboard_views.sql
-- These triggers keep tank levels and analytics automatically updated

-- ============================================
-- TRIGGER 1: Auto-update tank level when dip is recorded
-- ============================================

-- Function to update tank's current level when dip is recorded
CREATE OR REPLACE FUNCTION update_tank_level_on_dip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only update if this is the most recent reading for the tank
    -- (prevents older imports from overwriting newer data)
    UPDATE ta_tanks
    SET
        current_level_liters = NEW.level_liters,
        current_level_datetime = NEW.measured_at,
        current_level_source = 'dip',
        fill_percent = ROUND((NEW.level_liters::numeric / NULLIF(capacity_liters, 0) * 100), 2),
        updated_at = NOW()
    WHERE id = NEW.tank_id
      AND (current_level_datetime IS NULL OR NEW.measured_at >= current_level_datetime);

    RETURN NEW;
END;
$$;

-- Drop existing trigger if exists (for re-running)
DROP TRIGGER IF EXISTS tr_update_tank_level_on_dip ON ta_tank_dips;

-- Create trigger AFTER INSERT
CREATE TRIGGER tr_update_tank_level_on_dip
    AFTER INSERT ON ta_tank_dips
    FOR EACH ROW
    EXECUTE FUNCTION update_tank_level_on_dip();

-- ============================================
-- TRIGGER 2: Auto-refresh analytics after dip batch
-- ============================================

-- Function to refresh analytics (uses statement-level trigger to batch)
CREATE OR REPLACE FUNCTION refresh_analytics_on_dip_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Refresh materialized view concurrently (non-blocking)
    -- This runs once per INSERT statement, not per row
    PERFORM refresh_ta_tank_analytics();
    RETURN NULL;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS tr_refresh_analytics_after_dip ON ta_tank_dips;

-- Create trigger AFTER INSERT (statement level for batching)
CREATE TRIGGER tr_refresh_analytics_after_dip
    AFTER INSERT ON ta_tank_dips
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_analytics_on_dip_change();

-- ============================================
-- VERIFICATION
-- ============================================

-- Test the trigger by checking current triggers on ta_tank_dips
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_orientation
FROM information_schema.triggers
WHERE event_object_table = 'ta_tank_dips'
ORDER BY trigger_name;

-- Expected output:
-- tr_refresh_analytics_after_dip | INSERT | AFTER | STATEMENT
-- tr_update_tank_level_on_dip    | INSERT | AFTER | ROW
