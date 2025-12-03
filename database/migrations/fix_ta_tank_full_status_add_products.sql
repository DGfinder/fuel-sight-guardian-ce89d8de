-- Migration: Fix Tank Dashboard Views to Include Product Information
-- Created: 2025-12-03
-- Description: Updates ta_tank_dashboard and ta_tank_full_status views to include product names

-- ============================================
-- UPDATE VIEW 1: ta_tank_dashboard
-- Add product_id to the base dashboard view
-- ============================================

-- Drop both views before recreating them
DROP VIEW IF EXISTS ta_tank_full_status CASCADE;
DROP VIEW IF EXISTS ta_tank_dashboard CASCADE;

CREATE VIEW ta_tank_dashboard AS
SELECT
    t.id,
    t.name,
    t.business_id,
    b.name as business_name,
    b.code as business_code,
    t.group_id,
    g.name as group_name,
    t.subgroup_id,
    s.name as subgroup_name,
    t.product_id,  -- ADDED: Include product_id
    t.capacity_liters,
    t.current_level_liters,
    t.current_level_datetime,
    t.current_level_source,
    t.fill_percent,
    t.safe_level_liters,
    t.min_level_liters,
    t.critical_level_liters,
    t.rolling_avg_liters_per_day,
    t.days_to_min_level,
    t.unit,
    t.installation_type,
    t.has_sensor,
    t.status,
    t.notes,
    t.created_at,
    t.updated_at
FROM ta_tanks t
LEFT JOIN ta_businesses b ON t.business_id = b.id
LEFT JOIN ta_groups g ON t.group_id = g.id
LEFT JOIN ta_subgroups s ON t.subgroup_id = s.id
WHERE t.archived_at IS NULL;

-- ============================================
-- UPDATE VIEW 2: ta_tank_full_status
-- Add product_name by joining with ta_products
-- ============================================

CREATE VIEW ta_tank_full_status AS
SELECT
    d.*,
    p.name as product_name,  -- ADDED: Product name from ta_products
    COALESCE(a.avg_daily_consumption_liters, 0) as avg_daily_consumption_liters,
    COALESCE(a.estimated_days_until_empty, 999) as estimated_days_until_empty,
    a.estimated_empty_date,
    COALESCE(a.days_until_min_level, 999) as days_until_min_level,
    COALESCE(a.readings_in_period, 0) as readings_in_period,
    a.calculated_at as analytics_updated_at,
    -- Urgency scoring based on fill level AND days until empty
    CASE
        WHEN d.fill_percent <= 10 THEN 'critical'
        WHEN d.fill_percent <= 20 THEN 'urgent'
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 3 THEN 'urgent'
        WHEN d.fill_percent <= 30 THEN 'warning'
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 7 THEN 'warning'
        WHEN d.current_level_liters <= d.min_level_liters THEN 'warning'
        ELSE 'ok'
    END as urgency_status,
    -- Priority score for sorting (lower = more urgent)
    CASE
        WHEN d.fill_percent <= 10 THEN 1
        WHEN d.fill_percent <= 20 THEN 2
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 3 THEN 2
        WHEN d.fill_percent <= 30 THEN 3
        WHEN COALESCE(a.estimated_days_until_empty, 999) <= 7 THEN 3
        ELSE 4
    END as priority_score
FROM ta_tank_dashboard d
LEFT JOIN ta_products p ON d.product_id = p.id  -- ADDED: JOIN with ta_products
LEFT JOIN ta_tank_analytics a ON d.id = a.tank_id;
