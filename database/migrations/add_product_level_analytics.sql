-- ============================================================================
-- Migration: Add Product-Level Analytics
-- Created: 2025-12-03
-- Description: Creates materialized view to aggregate tank analytics by product type
--              Enables product-level consumption tracking and comparison
-- ============================================================================

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS ta_product_analytics CASCADE;

-- ============================================================================
-- MATERIALIZED VIEW: ta_product_analytics
-- Aggregates tank analytics by product_id for product-level insights
-- ============================================================================

CREATE MATERIALIZED VIEW ta_product_analytics AS
WITH
-- Aggregate tank-level analytics by product
product_aggregates AS (
    SELECT
        t.product_id,
        COUNT(DISTINCT t.id) as total_tanks,
        COUNT(DISTINCT t.group_id) as unique_groups,
        COUNT(DISTINCT t.location_id) as unique_locations,

        -- Tank Status Counts (based on fill_percent calculation)
        COUNT(DISTINCT t.id) FILTER (
            WHERE ((t.current_level_liters - t.min_level_liters) / NULLIF(t.safe_level_liters - t.min_level_liters, 0) * 100) <= 10
        ) as tanks_critical,
        COUNT(DISTINCT t.id) FILTER (
            WHERE ((t.current_level_liters - t.min_level_liters) / NULLIF(t.safe_level_liters - t.min_level_liters, 0) * 100) > 10
              AND ((t.current_level_liters - t.min_level_liters) / NULLIF(t.safe_level_liters - t.min_level_liters, 0) * 100) <= 20
        ) as tanks_low,
        COUNT(DISTINCT t.id) FILTER (
            WHERE ((t.current_level_liters - t.min_level_liters) / NULLIF(t.safe_level_liters - t.min_level_liters, 0) * 100) > 20
        ) as tanks_normal,

        -- Capacity Metrics
        SUM(t.capacity_liters) as total_capacity_liters,
        SUM(t.current_level_liters) as total_current_level_liters,
        SUM(t.safe_level_liters - t.min_level_liters) as total_usable_capacity_liters,
        AVG((t.current_level_liters - t.min_level_liters) / NULLIF(t.safe_level_liters - t.min_level_liters, 0) * 100) as avg_fill_percent,

        -- Consumption Metrics (from ta_tank_analytics)
        AVG(a.avg_daily_consumption_liters) as avg_daily_consumption_per_tank,
        SUM(a.avg_daily_consumption_liters) as total_daily_consumption_liters,
        SUM(a.consumption_7_days) as total_consumption_7_days,
        SUM(a.consumption_30_days) as total_consumption_30_days,
        AVG(a.consumption_7_days) as avg_consumption_7_days_per_tank,
        AVG(a.consumption_30_days) as avg_consumption_30_days_per_tank,
        MAX(a.peak_daily_consumption) as max_peak_daily_consumption,
        AVG(a.peak_daily_consumption) as avg_peak_daily_consumption,

        -- Days Until Empty Metrics
        AVG(a.estimated_days_until_empty) FILTER (WHERE a.estimated_days_until_empty < 999) as avg_days_until_empty,
        MIN(a.estimated_days_until_empty) FILTER (WHERE a.estimated_days_until_empty < 999) as min_days_until_empty,
        AVG(a.days_until_min_level) FILTER (WHERE a.days_until_min_level < 999) as avg_days_until_min_level,
        MIN(a.days_until_min_level) FILTER (WHERE a.days_until_min_level < 999) as min_days_until_min_level,

        -- Refill Metrics
        COUNT(DISTINCT t.id) FILTER (WHERE a.last_refill_date IS NOT NULL) as tanks_with_refill_data,
        AVG(a.last_refill_volume) FILTER (WHERE a.last_refill_volume IS NOT NULL) as avg_refill_volume,
        AVG(a.avg_refill_interval_days) FILTER (WHERE a.avg_refill_interval_days IS NOT NULL) as avg_refill_interval_days,

        -- Trend Analysis
        COUNT(DISTINCT t.id) FILTER (WHERE a.trend_direction = 'increasing') as tanks_trend_increasing,
        COUNT(DISTINCT t.id) FILTER (WHERE a.trend_direction = 'decreasing') as tanks_trend_decreasing,
        COUNT(DISTINCT t.id) FILTER (WHERE a.trend_direction = 'stable') as tanks_trend_stable,
        AVG(a.trend_percent_change) as avg_trend_percent_change,

        -- Efficiency Metrics
        COUNT(DISTINCT t.id) FILTER (WHERE a.efficiency_trend = 'improving') as tanks_efficiency_improving,
        COUNT(DISTINCT t.id) FILTER (WHERE a.efficiency_trend = 'degrading') as tanks_efficiency_degrading,
        COUNT(DISTINCT t.id) FILTER (WHERE a.efficiency_trend = 'stable') as tanks_efficiency_stable,

        -- Data Quality
        COUNT(DISTINCT t.id) FILTER (WHERE a.data_quality = 'fresh') as tanks_data_fresh,
        COUNT(DISTINCT t.id) FILTER (WHERE a.data_quality = 'stale') as tanks_data_stale,
        COUNT(DISTINCT t.id) FILTER (WHERE a.data_quality = 'outdated') as tanks_data_outdated,
        AVG(a.days_since_last_dip) FILTER (WHERE a.days_since_last_dip < 999) as avg_days_since_last_dip,

        -- Anomalies & Alerts
        COUNT(DISTINCT t.id) FILTER (WHERE a.is_anomaly = TRUE) as tanks_with_anomalies,
        COUNT(DISTINCT t.id) FILTER (WHERE a.order_urgency = 'order_now') as tanks_order_now,
        COUNT(DISTINCT t.id) FILTER (WHERE a.order_urgency = 'order_soon') as tanks_order_soon,

        -- Predictability
        COUNT(DISTINCT t.id) FILTER (WHERE a.predictability = 'high') as tanks_predictability_high,
        COUNT(DISTINCT t.id) FILTER (WHERE a.predictability = 'medium') as tanks_predictability_medium,
        COUNT(DISTINCT t.id) FILTER (WHERE a.predictability = 'low') as tanks_predictability_low,
        AVG(a.consumption_stddev) as avg_consumption_stddev

    FROM ta_tanks t
    LEFT JOIN ta_tank_analytics a ON t.id = a.tank_id
    WHERE t.archived_at IS NULL
      AND t.product_id IS NOT NULL
    GROUP BY t.product_id
),

-- Calculate efficiency score per product (0-100)
efficiency_scores AS (
    SELECT
        product_id,
        -- Efficiency calculation: factors in consumption stability, predictability, and data quality
        ROUND(
            -- Base score from predictability (40 points max)
            (CASE
                WHEN tanks_predictability_high > 0 THEN 40 * (tanks_predictability_high::decimal / NULLIF(total_tanks, 0))
                WHEN tanks_predictability_medium > 0 THEN 25 * (tanks_predictability_medium::decimal / NULLIF(total_tanks, 0))
                ELSE 10 * (tanks_predictability_low::decimal / NULLIF(total_tanks, 0))
            END)
            -- Data freshness score (30 points max)
            + (CASE
                WHEN tanks_data_fresh > 0 THEN 30 * (tanks_data_fresh::decimal / NULLIF(total_tanks, 0))
                WHEN tanks_data_stale > 0 THEN 15 * (tanks_data_stale::decimal / NULLIF(total_tanks, 0))
                ELSE 5
            END)
            -- Tank health score (30 points max, penalize critical tanks)
            + (30 - (30 * (tanks_critical::decimal / NULLIF(total_tanks, 0))))
        )::integer as efficiency_score
    FROM product_aggregates
)

SELECT
    p.id as product_id,
    p.name as product_name,
    p.code as product_code,

    -- Tank Counts
    COALESCE(pa.total_tanks, 0) as total_tanks,
    COALESCE(pa.unique_groups, 0) as unique_groups,
    COALESCE(pa.unique_locations, 0) as unique_locations,
    COALESCE(pa.tanks_critical, 0) as tanks_critical,
    COALESCE(pa.tanks_low, 0) as tanks_low,
    COALESCE(pa.tanks_normal, 0) as tanks_normal,

    -- Percentages
    ROUND((pa.tanks_critical::decimal / NULLIF(pa.total_tanks, 0)) * 100, 1) as percent_critical,
    ROUND((pa.tanks_low::decimal / NULLIF(pa.total_tanks, 0)) * 100, 1) as percent_low,
    ROUND((pa.tanks_normal::decimal / NULLIF(pa.total_tanks, 0)) * 100, 1) as percent_normal,

    -- Capacity Metrics
    COALESCE(pa.total_capacity_liters, 0)::bigint as total_capacity_liters,
    COALESCE(pa.total_current_level_liters, 0)::bigint as total_current_level_liters,
    COALESCE(pa.total_usable_capacity_liters, 0)::bigint as total_usable_capacity_liters,
    ROUND(COALESCE(pa.avg_fill_percent, 0), 1) as avg_fill_percent,

    -- Consumption Metrics
    ROUND(COALESCE(pa.avg_daily_consumption_per_tank, 0))::integer as avg_daily_consumption_per_tank_liters,
    ROUND(COALESCE(pa.total_daily_consumption_liters, 0))::integer as total_daily_consumption_liters,
    COALESCE(pa.total_consumption_7_days, 0)::bigint as total_consumption_7_days_liters,
    COALESCE(pa.total_consumption_30_days, 0)::bigint as total_consumption_30_days_liters,
    ROUND(COALESCE(pa.avg_consumption_7_days_per_tank, 0))::integer as avg_consumption_7_days_per_tank_liters,
    ROUND(COALESCE(pa.avg_consumption_30_days_per_tank, 0))::integer as avg_consumption_30_days_per_tank_liters,
    ROUND(COALESCE(pa.max_peak_daily_consumption, 0))::integer as max_peak_daily_consumption_liters,
    ROUND(COALESCE(pa.avg_peak_daily_consumption, 0))::integer as avg_peak_daily_consumption_liters,

    -- Days Until Empty
    ROUND(COALESCE(pa.avg_days_until_empty, 0), 1) as avg_days_until_empty,
    ROUND(COALESCE(pa.min_days_until_empty, 0), 1) as min_days_until_empty,
    ROUND(COALESCE(pa.avg_days_until_min_level, 0), 1) as avg_days_until_min_level,
    ROUND(COALESCE(pa.min_days_until_min_level, 0), 1) as min_days_until_min_level,

    -- Refill Metrics
    COALESCE(pa.tanks_with_refill_data, 0) as tanks_with_refill_data,
    ROUND(COALESCE(pa.avg_refill_volume, 0))::integer as avg_refill_volume_liters,
    ROUND(COALESCE(pa.avg_refill_interval_days, 0))::integer as avg_refill_interval_days,

    -- Trend Counts
    COALESCE(pa.tanks_trend_increasing, 0) as tanks_trend_increasing,
    COALESCE(pa.tanks_trend_decreasing, 0) as tanks_trend_decreasing,
    COALESCE(pa.tanks_trend_stable, 0) as tanks_trend_stable,
    ROUND(COALESCE(pa.avg_trend_percent_change, 0))::integer as avg_trend_percent_change,

    -- Dominant Trend
    CASE
        WHEN pa.tanks_trend_increasing > GREATEST(pa.tanks_trend_decreasing, pa.tanks_trend_stable) THEN 'increasing'
        WHEN pa.tanks_trend_decreasing > GREATEST(pa.tanks_trend_increasing, pa.tanks_trend_stable) THEN 'decreasing'
        ELSE 'stable'
    END as dominant_trend,

    -- Efficiency Counts
    COALESCE(pa.tanks_efficiency_improving, 0) as tanks_efficiency_improving,
    COALESCE(pa.tanks_efficiency_degrading, 0) as tanks_efficiency_degrading,
    COALESCE(pa.tanks_efficiency_stable, 0) as tanks_efficiency_stable,

    -- Data Quality
    COALESCE(pa.tanks_data_fresh, 0) as tanks_data_fresh,
    COALESCE(pa.tanks_data_stale, 0) as tanks_data_stale,
    COALESCE(pa.tanks_data_outdated, 0) as tanks_data_outdated,
    ROUND(COALESCE(pa.avg_days_since_last_dip, 0), 1) as avg_days_since_last_dip,

    -- Anomalies & Alerts
    COALESCE(pa.tanks_with_anomalies, 0) as tanks_with_anomalies,
    COALESCE(pa.tanks_order_now, 0) as tanks_order_now,
    COALESCE(pa.tanks_order_soon, 0) as tanks_order_soon,

    -- Predictability
    COALESCE(pa.tanks_predictability_high, 0) as tanks_predictability_high,
    COALESCE(pa.tanks_predictability_medium, 0) as tanks_predictability_medium,
    COALESCE(pa.tanks_predictability_low, 0) as tanks_predictability_low,
    ROUND(COALESCE(pa.avg_consumption_stddev, 0))::integer as avg_consumption_stddev,

    -- Efficiency Score (0-100)
    COALESCE(es.efficiency_score, 0) as efficiency_score,

    -- Metadata
    NOW() as calculated_at

FROM ta_products p
LEFT JOIN product_aggregates pa ON p.id = pa.product_id
LEFT JOIN efficiency_scores es ON p.id = es.product_id
WHERE p.archived_at IS NULL
ORDER BY pa.total_tanks DESC NULLS LAST;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_ta_product_analytics_pk ON ta_product_analytics(product_id);

-- Create index on calculated_at for staleness checks
CREATE INDEX idx_ta_product_analytics_calculated_at ON ta_product_analytics(calculated_at DESC);

-- Grant permissions
GRANT SELECT ON ta_product_analytics TO authenticated;
GRANT SELECT ON ta_product_analytics TO anon;

-- ============================================================================
-- AUTO-REFRESH FUNCTION AND TRIGGER
-- Refreshes product analytics after tank analytics updates
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_product_analytics_on_tank_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh product analytics concurrently (non-blocking)
  REFRESH MATERIALIZED VIEW CONCURRENTLY ta_product_analytics;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Trigger will be created after ta_tank_analytics exists
-- If ta_tank_analytics doesn't have triggers yet, we'll rely on manual refresh
-- Uncomment the following if ta_tank_analytics supports triggers:
-- CREATE TRIGGER refresh_product_analytics_after_tank_analytics
--   AFTER INSERT OR UPDATE ON ta_tank_analytics
--   FOR EACH STATEMENT
--   EXECUTE FUNCTION refresh_product_analytics_on_tank_update();

-- Add comment
COMMENT ON MATERIALIZED VIEW ta_product_analytics IS
  'Product-level analytics aggregated from ta_tank_analytics. Enables cross-site product comparisons and consumption tracking.';

COMMENT ON FUNCTION refresh_product_analytics_on_tank_update() IS
  'Automatically refreshes ta_product_analytics materialized view when tank analytics updates.';

-- ============================================================================
-- INITIAL REFRESH
-- Populate view with current data
-- ============================================================================

REFRESH MATERIALIZED VIEW ta_product_analytics;

-- ============================================================================
-- VERIFICATION QUERY
-- Run to verify view created successfully
-- ============================================================================

-- SELECT
--   product_name,
--   total_tanks,
--   total_daily_consumption_liters,
--   avg_fill_percent,
--   efficiency_score,
--   dominant_trend
-- FROM ta_product_analytics
-- ORDER BY total_tanks DESC;
