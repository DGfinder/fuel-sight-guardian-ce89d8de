-- Analytics views for Data Centre dashboard
-- These views provide pre-aggregated data for performance and ease of use

-- Captive Payments Monthly Analytics View (using existing captive_deliveries materialized view)
CREATE OR REPLACE VIEW captive_payments_analytics AS
WITH monthly_summary AS (
    SELECT 
        carrier,
        TO_CHAR(delivery_date, 'Mon') as month,
        EXTRACT(YEAR FROM delivery_date)::INTEGER as year,
        EXTRACT(MONTH FROM delivery_date)::INTEGER as month_num,
        DATE_TRUNC('month', delivery_date) as month_start,
        COUNT(DISTINCT delivery_key) as total_deliveries,
        SUM(total_volume_litres_abs)::DECIMAL(15,2) as total_volume_litres,
        (SUM(total_volume_litres_abs) / 1000000)::DECIMAL(12,4) as total_volume_megalitres,
        COUNT(DISTINCT customer) as unique_customers,
        CASE 
            WHEN COUNT(DISTINCT delivery_key) > 0 
            THEN (SUM(total_volume_litres_abs) / COUNT(DISTINCT delivery_key))::DECIMAL(10,2)
            ELSE 0 
        END as avg_delivery_size
    FROM captive_deliveries
    GROUP BY carrier, DATE_TRUNC('month', delivery_date), EXTRACT(YEAR FROM delivery_date), EXTRACT(MONTH FROM delivery_date), TO_CHAR(delivery_date, 'Mon')
),
customer_rankings AS (
    SELECT 
        carrier,
        DATE_TRUNC('month', delivery_date) as month_start,
        customer,
        SUM(total_volume_litres_abs) as customer_volume,
        ROW_NUMBER() OVER (
            PARTITION BY carrier, DATE_TRUNC('month', delivery_date) 
            ORDER BY SUM(total_volume_litres_abs) DESC
        ) as rank
    FROM captive_deliveries
    GROUP BY carrier, DATE_TRUNC('month', delivery_date), customer
)
SELECT 
    ms.carrier,
    ms.month,
    ms.year,
    ms.month_num,
    ms.total_deliveries,
    ms.total_volume_litres,
    ms.total_volume_megalitres,
    ms.unique_customers,
    COALESCE(cr.customer, 'N/A') as top_customer,
    COALESCE(cr.customer_volume::DECIMAL(15,2), 0) as top_customer_volume,
    ms.avg_delivery_size
FROM monthly_summary ms
LEFT JOIN customer_rankings cr ON ms.carrier = cr.carrier 
    AND ms.month_start = cr.month_start 
    AND cr.rank = 1
ORDER BY ms.year DESC, ms.month_num DESC;

-- LYTX Safety Events Monthly Analytics View
CREATE OR REPLACE VIEW lytx_safety_analytics AS
SELECT 
    carrier,
    depot,
    TO_CHAR(event_datetime, 'Mon') as month,
    EXTRACT(YEAR FROM event_datetime)::INTEGER as year,
    EXTRACT(MONTH FROM event_datetime)::INTEGER as month_num,
    COUNT(*)::INTEGER as total_events,
    COUNT(CASE WHEN event_type = 'Coachable' THEN 1 END)::INTEGER as coachable_events,
    COUNT(CASE WHEN event_type = 'Driver Tagged' THEN 1 END)::INTEGER as driver_tagged_events,
    COUNT(CASE WHEN status = 'New' THEN 1 END)::INTEGER as new_events,
    COUNT(CASE WHEN status = 'Resolved' THEN 1 END)::INTEGER as resolved_events,
    COALESCE(AVG(score)::DECIMAL(5,2), 0) as avg_score,
    COUNT(DISTINCT driver_name)::INTEGER as unique_drivers,
    COUNT(DISTINCT CASE WHEN score >= 80 THEN driver_name END)::INTEGER as high_risk_drivers
FROM lytx_safety_events
WHERE NOT excluded
GROUP BY carrier, depot, DATE_TRUNC('month', event_datetime), EXTRACT(YEAR FROM event_datetime), EXTRACT(MONTH FROM event_datetime), TO_CHAR(event_datetime, 'Mon')
ORDER BY year DESC, month_num DESC;

-- Enriched LYTX events view mapping to vehicles by registration or device
CREATE OR REPLACE VIEW lytx_events_enriched AS
SELECT
  e.*,
  v.id AS vehicle_id,
  COALESCE(NULLIF(e.vehicle_registration, ''), v.registration) AS resolved_registration,
  v.fleet AS resolved_fleet,
  v.depot AS resolved_depot
FROM lytx_safety_events e
LEFT JOIN vehicles v
  ON UPPER(e.vehicle_registration) = UPPER(v.registration)
  OR (e.device_serial IS NOT NULL AND e.device_serial = v.lytx_device);

-- Cross-Analytics Summary View (combining all data sources)
CREATE OR REPLACE VIEW cross_analytics_summary AS
WITH monthly_captive AS (
    SELECT 
        CASE 
            WHEN carrier = 'SMB' THEN 'Stevemacs'
            WHEN carrier = 'GSF' THEN 'Great Southern Fuels'
            ELSE carrier::text
        END as fleet,
        terminal as depot,
        TO_CHAR(delivery_date, 'Mon') as month,
        EXTRACT(YEAR FROM delivery_date)::INTEGER as year,
        EXTRACT(MONTH FROM delivery_date)::INTEGER as month_num,
        COUNT(DISTINCT delivery_key) as deliveries,
        (SUM(total_volume_litres_abs) / 1000000) as volume_ml
    FROM captive_deliveries
    GROUP BY 
        CASE 
            WHEN carrier = 'SMB' THEN 'Stevemacs'
            WHEN carrier = 'GSF' THEN 'Great Southern Fuels'
            ELSE carrier::text
        END,
        terminal, 
        DATE_TRUNC('month', delivery_date),
        EXTRACT(YEAR FROM delivery_date),
        EXTRACT(MONTH FROM delivery_date),
        TO_CHAR(delivery_date, 'Mon')
),
monthly_lytx AS (
    SELECT 
        carrier as fleet,
        depot,
        TO_CHAR(event_datetime, 'Mon') as month,
        EXTRACT(YEAR FROM event_datetime)::INTEGER as year,
        EXTRACT(MONTH FROM event_datetime)::INTEGER as month_num,
        COUNT(*) as safety_events,
        AVG(score) as avg_safety_score
    FROM lytx_safety_events
    WHERE NOT excluded
    GROUP BY carrier, depot, DATE_TRUNC('month', event_datetime), EXTRACT(YEAR FROM event_datetime), EXTRACT(MONTH FROM event_datetime), TO_CHAR(event_datetime, 'Mon')
),
monthly_guardian AS (
    SELECT 
        fleet,
        depot,
        TO_CHAR(detection_time, 'Mon') as month,
        EXTRACT(YEAR FROM detection_time)::INTEGER as year,
        EXTRACT(MONTH FROM detection_time)::INTEGER as month_num,
        COUNT(*) as guardian_events
    FROM guardian_events
    WHERE verified = true
    GROUP BY fleet, depot, DATE_TRUNC('month', detection_time), EXTRACT(YEAR FROM detection_time), EXTRACT(MONTH FROM detection_time), TO_CHAR(detection_time, 'Mon')
),
monthly_vehicles AS (
    SELECT 
        fleet,
        depot,
        COUNT(DISTINCT id) as active_vehicles
    FROM vehicles
    WHERE status = 'Active'
    GROUP BY fleet, depot
)
SELECT 
    COALESCE(mc.fleet, ml.fleet, mg.fleet) as fleet,
    COALESCE(mc.depot, ml.depot, mg.depot) as depot,
    COALESCE(mc.month, ml.month, mg.month) as month,
    COALESCE(mc.year, ml.year, mg.year) as year,
    COALESCE(mc.month_num, ml.month_num, mg.month_num) as month_num,
    COALESCE(mc.deliveries, 0)::INTEGER as captive_deliveries,
    COALESCE(mc.volume_ml, 0)::DECIMAL(12,4) as captive_volume_ml,
    COALESCE(ml.safety_events, 0)::INTEGER as safety_events,
    COALESCE(mg.guardian_events, 0)::INTEGER as guardian_events,
    COALESCE(mv.active_vehicles, 0)::INTEGER as active_vehicles,
    COALESCE(ml.avg_safety_score, 0)::DECIMAL(5,2) as avg_safety_score,
    CASE 
        WHEN COALESCE(mv.active_vehicles, 0) > 0 
        THEN ((COALESCE(ml.safety_events, 0) + COALESCE(mg.guardian_events, 0))::DECIMAL / mv.active_vehicles)::DECIMAL(6,2)
        ELSE 0 
    END as events_per_vehicle,
    CASE 
        WHEN COALESCE(mv.active_vehicles, 0) > 0 
        THEN (COALESCE(mc.volume_ml, 0) / mv.active_vehicles)::DECIMAL(8,2)
        ELSE 0 
    END as volume_per_vehicle
FROM monthly_captive mc
FULL OUTER JOIN monthly_lytx ml ON mc.fleet = ml.fleet AND mc.depot = ml.depot AND mc.month = ml.month AND mc.year = ml.year
FULL OUTER JOIN monthly_guardian mg ON COALESCE(mc.fleet, ml.fleet) = mg.fleet AND COALESCE(mc.depot, ml.depot) = mg.depot AND COALESCE(mc.month, ml.month) = mg.month AND COALESCE(mc.year, ml.year) = mg.year
LEFT JOIN monthly_vehicles mv ON COALESCE(mc.fleet, ml.fleet, mg.fleet) = mv.fleet AND COALESCE(mc.depot, ml.depot, mg.depot) = mv.depot
WHERE COALESCE(mc.fleet, ml.fleet, mg.fleet) IS NOT NULL
ORDER BY year DESC, month_num DESC, fleet, depot;

-- Enable RLS on views (inherit from underlying tables)
ALTER VIEW captive_payments_analytics SET (security_invoker = true);
ALTER VIEW lytx_safety_analytics SET (security_invoker = true);
ALTER VIEW cross_analytics_summary SET (security_invoker = true);

-- Grant permissions to authenticated users
GRANT SELECT ON captive_payments_analytics TO authenticated;
GRANT SELECT ON lytx_safety_analytics TO authenticated;
GRANT SELECT ON cross_analytics_summary TO authenticated;