-- TankAlert Performance Indexes
-- Run in Supabase SQL Editor
-- These indexes optimize common query patterns for the ta_ schema
--
-- NOTE: CONCURRENTLY removed because Supabase SQL Editor runs in transactions.
-- Use CONCURRENTLY only when running via psql CLI on production.

-- ============================================
-- STEP 1: Foreign Key Indexes for Fast Joins
-- ============================================

-- ta_tanks indexes
CREATE INDEX IF NOT EXISTS idx_ta_tanks_business_id
    ON ta_tanks(business_id);

CREATE INDEX IF NOT EXISTS idx_ta_tanks_group_id
    ON ta_tanks(group_id);

CREATE INDEX IF NOT EXISTS idx_ta_tanks_subgroup_id
    ON ta_tanks(subgroup_id);

CREATE INDEX IF NOT EXISTS idx_ta_tanks_status
    ON ta_tanks(status)
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ta_tanks_location_id
    ON ta_tanks(location_id);

-- ============================================
-- STEP 2: Dip Readings Indexes (Critical for Performance)
-- ============================================

-- Composite index for "latest reading per tank" queries
-- This is the most important index for dashboard performance
CREATE INDEX IF NOT EXISTS idx_ta_tank_dips_tank_measured
    ON ta_tank_dips(tank_id, measured_at DESC)
    WHERE archived_at IS NULL;

-- Business-level queries (for RLS and filtering)
CREATE INDEX IF NOT EXISTS idx_ta_tank_dips_business_id
    ON ta_tank_dips(business_id);

-- Time-range queries (for analytics)
CREATE INDEX IF NOT EXISTS idx_ta_tank_dips_measured_at
    ON ta_tank_dips(measured_at DESC)
    WHERE archived_at IS NULL;

-- Source channel filtering
CREATE INDEX IF NOT EXISTS idx_ta_tank_dips_source_channel
    ON ta_tank_dips(source_channel)
    WHERE archived_at IS NULL;

-- ============================================
-- STEP 3: Groups & Subgroups Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ta_groups_business_id
    ON ta_groups(business_id);

CREATE INDEX IF NOT EXISTS idx_ta_groups_is_active
    ON ta_groups(is_active)
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ta_subgroups_group_id
    ON ta_subgroups(group_id);

CREATE INDEX IF NOT EXISTS idx_ta_subgroups_business_id
    ON ta_subgroups(business_id);

-- ============================================
-- VERIFICATION
-- ============================================

-- Run this to verify indexes were created:
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename LIKE 'ta_%'
ORDER BY tablename, indexname;
