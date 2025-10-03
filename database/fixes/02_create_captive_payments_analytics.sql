-- =====================================================
-- CREATE CAPTIVE PAYMENTS ANALYTICS VIEW
-- =====================================================
-- Critical view for DataCentreSupabaseService
-- Referenced: dataCentreSupabaseService.ts:147
-- Provides monthly analytics for captive payment deliveries
-- =====================================================

-- Drop existing view if present
DROP VIEW IF EXISTS captive_payments_analytics CASCADE;

-- =====================================================
-- CREATE VIEW
-- =====================================================

CREATE OR REPLACE VIEW captive_payments_analytics AS

WITH monthly_summary AS (
    SELECT
        carrier,
        TO_CHAR(delivery_date, 'Mon') as month,
        EXTRACT(YEAR FROM delivery_date)::INTEGER as year,
        EXTRACT(MONTH FROM delivery_date)::INTEGER as month_num,
        DATE_TRUNC('month', delivery_date) as month_start,
        COUNT(DISTINCT delivery_key)::INTEGER as total_deliveries,
        SUM(total_volume_litres_abs)::DECIMAL(15,2) as total_volume_litres,
        (SUM(total_volume_litres_abs) / 1000000)::DECIMAL(12,4) as total_volume_megalitres,
        COUNT(DISTINCT customer)::INTEGER as unique_customers,
        CASE
            WHEN COUNT(DISTINCT delivery_key) > 0
            THEN (SUM(total_volume_litres_abs) / COUNT(DISTINCT delivery_key))::DECIMAL(10,2)
            ELSE 0
        END as avg_delivery_size
    FROM captive_deliveries
    WHERE delivery_date IS NOT NULL
    GROUP BY
        carrier,
        DATE_TRUNC('month', delivery_date),
        EXTRACT(YEAR FROM delivery_date),
        EXTRACT(MONTH FROM delivery_date),
        TO_CHAR(delivery_date, 'Mon')
),

-- Get top customer per carrier per month
customer_rankings AS (
    SELECT
        carrier,
        DATE_TRUNC('month', delivery_date) as month_start,
        customer,
        SUM(total_volume_litres_abs)::DECIMAL(15,2) as customer_volume,
        ROW_NUMBER() OVER (
            PARTITION BY carrier, DATE_TRUNC('month', delivery_date)
            ORDER BY SUM(total_volume_litres_abs) DESC
        ) as rank
    FROM captive_deliveries
    WHERE delivery_date IS NOT NULL
    GROUP BY carrier, DATE_TRUNC('month', delivery_date), customer
)

-- Join summary with top customers
SELECT
    ms.carrier::TEXT,
    ms.month::TEXT,
    ms.year,
    ms.month_num,
    ms.total_deliveries,
    ms.total_volume_litres,
    ms.total_volume_megalitres,
    ms.unique_customers,
    COALESCE(cr.customer, 'N/A')::TEXT as top_customer,
    COALESCE(cr.customer_volume, 0)::DECIMAL(15,2) as top_customer_volume,
    ms.avg_delivery_size

FROM monthly_summary ms

LEFT JOIN customer_rankings cr
    ON ms.carrier = cr.carrier
    AND ms.month_start = cr.month_start
    AND cr.rank = 1

ORDER BY ms.year DESC, ms.month_num DESC, ms.carrier;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Enable security invoker to inherit RLS from underlying tables
ALTER VIEW captive_payments_analytics SET (security_invoker = true);

-- Grant to authenticated users
GRANT SELECT ON captive_payments_analytics TO authenticated;

-- Grant to service role for backend queries
GRANT SELECT ON captive_payments_analytics TO service_role;

-- =====================================================
-- VALIDATION
-- =====================================================

-- Test the view
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM captive_payments_analytics LIMIT 1;
  RAISE NOTICE 'captive_payments_analytics view created successfully';
  RAISE NOTICE 'Test query executed - view is functional';
END $$;

-- Sample data (top 5 rows)
SELECT
  carrier,
  month,
  year,
  total_deliveries,
  total_volume_megalitres,
  unique_customers,
  top_customer
FROM captive_payments_analytics
ORDER BY year DESC, month_num DESC
LIMIT 5;

-- Show carrier comparison for latest month
SELECT
  carrier,
  month,
  year,
  total_deliveries,
  total_volume_megalitres,
  unique_customers
FROM captive_payments_analytics
WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
ORDER BY month_num DESC, carrier
LIMIT 10;

-- =====================================================
-- NOTES
-- =====================================================

-- Dependencies:
--   ✓ captive_deliveries (materialized view from create_captive_payments_system.sql)
--
-- Used by:
--   ✓ dataCentreSupabaseService.ts:147 (getCaptivePaymentsAnalytics)
--   ✓ CaptivePaymentsDashboard.tsx (monthly trends)
--   ✓ SMBDashboard.tsx / GSFDashboard.tsx (carrier-specific analytics)
--
-- Field mapping matches TypeScript interface:
--   interface MonthlyAnalytics {
--     carrier: 'SMB' | 'GSF';
--     month: string;
--     year: number;
--     total_deliveries: number;
--     total_volume_megalitres: number;
--     top_customer: string;
--     ...
--   }
