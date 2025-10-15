-- Guardian Dashboard Data Verification Script
-- Run this to verify data is correctly structured for the dashboard
-- https://fuel-sight-guardian-ce89d8de.vercel.app/data-centre/guardian

-- ============================================================================
-- 1. CHECK DATA VOLUME
-- ============================================================================

-- Check total events and fleet distribution
SELECT
  'Data Volume Check' as check_name,
  fleet,
  COUNT(*) as total_events,
  COUNT(DISTINCT vehicle_registration) as unique_vehicles,
  COUNT(DISTINCT driver_name) FILTER (WHERE driver_name IS NOT NULL) as unique_drivers,
  MIN(detection_time) as earliest_event,
  MAX(detection_time) as latest_event,
  COUNT(*) FILTER (WHERE detection_time >= NOW() - INTERVAL '30 days') as events_last_30_days,
  COUNT(*) FILTER (WHERE detection_time >= NOW() - INTERVAL '12 months') as events_last_12_months
FROM guardian_events
GROUP BY fleet
ORDER BY fleet;

-- ============================================================================
-- 2. VERIFY FLEET VALUES
-- ============================================================================

-- Check for fleet value variations (should only be "Stevemacs" or "Great Southern Fuels")
SELECT
  'Fleet Values Check' as check_name,
  fleet,
  COUNT(*) as event_count,
  CASE
    WHEN fleet = 'Stevemacs' THEN '✓ Correct'
    WHEN fleet = 'Great Southern Fuels' THEN '✓ Correct'
    ELSE '✗ INCORRECT - Should be "Stevemacs" or "Great Southern Fuels"'
  END as validation_status
FROM guardian_events
GROUP BY fleet
ORDER BY fleet;

-- ============================================================================
-- 3. VERIFY EVENT TYPE VALUES (for Distraction/Fatigue filtering)
-- ============================================================================

-- Check event_type values to ensure they match dashboard filter logic
SELECT
  'Event Type Distribution' as check_name,
  event_type,
  COUNT(*) as event_count,
  CASE
    WHEN LOWER(event_type) LIKE '%distraction%' THEN 'Distraction'
    WHEN LOWER(event_type) LIKE '%fatigue%' THEN 'Fatigue'
    WHEN LOWER(event_type) LIKE '%microsleep%' THEN 'Fatigue (Microsleep)'
    WHEN LOWER(event_type) LIKE '%field of view%' OR LOWER(event_type) LIKE '%fov%' THEN 'Field of View'
    ELSE 'Other'
  END as category,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM guardian_events
WHERE detection_time >= NOW() - INTERVAL '12 months'
GROUP BY event_type
ORDER BY event_count DESC
LIMIT 20;

-- ============================================================================
-- 4. CURRENT MONTH STATISTICS (matching dashboard KPI cards)
-- ============================================================================

-- This should match the numbers shown on the dashboard
SELECT
  'Current Month Stats' as check_name,
  fleet,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE LOWER(event_type) LIKE '%distraction%') as distraction_events,
  COUNT(*) FILTER (WHERE LOWER(event_type) LIKE '%fatigue%' OR LOWER(event_type) LIKE '%microsleep%') as fatigue_events,
  COUNT(*) FILTER (WHERE LOWER(event_type) LIKE '%field of view%' OR LOWER(event_type) LIKE '%fov%') as field_of_view_events,
  COUNT(*) FILTER (WHERE verified OR confirmation = 'verified') as verified_events,
  ROUND(COUNT(*) FILTER (WHERE verified OR confirmation = 'verified') * 100.0 / NULLIF(COUNT(*), 0), 1) as verification_rate_percent,
  COUNT(*) FILTER (WHERE severity = 'Critical') as critical_events,
  COUNT(*) FILTER (WHERE severity IN ('High', 'Critical')) as high_severity_events
FROM guardian_events
WHERE detection_time >= DATE_TRUNC('month', CURRENT_DATE)
  AND detection_time < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
GROUP BY fleet
ORDER BY fleet;

-- ============================================================================
-- 5. VERIFY guardian_events_requiring_attention VIEW
-- ============================================================================

-- Check if view exists and returns data
SELECT
  'View Check: guardian_events_requiring_attention' as check_name,
  COUNT(*) as events_requiring_attention,
  COUNT(*) FILTER (WHERE severity = 'Critical') as critical_count,
  COUNT(*) FILTER (WHERE severity = 'High') as high_count,
  COUNT(*) FILTER (WHERE confirmation IS NULL) as missing_confirmation_count,
  COUNT(DISTINCT fleet) as fleets_with_attention_items
FROM guardian_events_requiring_attention;

-- Sample events from the view
SELECT
  'Sample Attention Events' as check_name,
  external_event_id,
  vehicle_registration,
  event_type,
  severity,
  fleet,
  confirmation,
  detection_time
FROM guardian_events_requiring_attention
LIMIT 10;

-- ============================================================================
-- 6. CHECK FOR POTENTIAL DATA QUALITY ISSUES
-- ============================================================================

-- Check for NULL or empty critical fields
SELECT
  'Data Quality Check' as check_name,
  COUNT(*) FILTER (WHERE vehicle_registration IS NULL OR vehicle_registration = '') as missing_vehicle,
  COUNT(*) FILTER (WHERE event_type IS NULL OR event_type = '') as missing_event_type,
  COUNT(*) FILTER (WHERE fleet IS NULL OR fleet = '') as missing_fleet,
  COUNT(*) FILTER (WHERE detection_time IS NULL) as missing_detection_time,
  COUNT(*) FILTER (WHERE severity IS NULL) as missing_severity,
  COUNT(*) as total_events
FROM guardian_events
WHERE detection_time >= NOW() - INTERVAL '30 days';

-- ============================================================================
-- 7. MONTHLY TREND DATA (for chart verification)
-- ============================================================================

-- Last 12 months trend by event type
SELECT
  'Monthly Trend - Distraction' as metric_type,
  DATE_TRUNC('month', detection_time) as month,
  fleet,
  COUNT(*) as event_count,
  COUNT(*) FILTER (WHERE verified OR confirmation = 'verified') as verified_count
FROM guardian_events
WHERE detection_time >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
  AND LOWER(event_type) LIKE '%distraction%'
GROUP BY DATE_TRUNC('month', detection_time), fleet
ORDER BY month DESC, fleet;

SELECT
  'Monthly Trend - Fatigue' as metric_type,
  DATE_TRUNC('month', detection_time) as month,
  fleet,
  COUNT(*) as event_count,
  COUNT(*) FILTER (WHERE verified OR confirmation = 'verified') as verified_count
FROM guardian_events
WHERE detection_time >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
  AND (LOWER(event_type) LIKE '%fatigue%' OR LOWER(event_type) LIKE '%microsleep%')
GROUP BY DATE_TRUNC('month', detection_time), fleet
ORDER BY month DESC, fleet;

-- ============================================================================
-- 8. TOP RISK VEHICLES (matching dashboard widget)
-- ============================================================================

-- Top 5 vehicles by event count this month
SELECT
  'Top Risk Vehicles - Current Month' as check_name,
  vehicle_registration,
  fleet,
  COUNT(*) as event_count,
  COUNT(*) FILTER (WHERE severity IN ('High', 'Critical')) as high_severity_count
FROM guardian_events
WHERE detection_time >= DATE_TRUNC('month', CURRENT_DATE)
  AND detection_time < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
GROUP BY vehicle_registration, fleet
ORDER BY event_count DESC
LIMIT 5;

-- ============================================================================
-- 9. FIELD OF VIEW PROBLEM VEHICLES (last 3 months)
-- ============================================================================

-- Vehicles with 5+ FOV events in last 3 months
SELECT
  'FOV Problem Vehicles - Last 3 Months' as check_name,
  vehicle_registration,
  fleet,
  COUNT(*) as fov_event_count
FROM guardian_events
WHERE detection_time >= CURRENT_DATE - INTERVAL '3 months'
  AND (LOWER(event_type) LIKE '%field of view%' OR LOWER(event_type) LIKE '%fov%')
GROUP BY vehicle_registration, fleet
HAVING COUNT(*) >= 5
ORDER BY fov_event_count DESC
LIMIT 10;

-- ============================================================================
-- 10. SUMMARY REPORT
-- ============================================================================

WITH summary AS (
  SELECT
    COUNT(*) as total_events,
    COUNT(DISTINCT fleet) as unique_fleets,
    COUNT(DISTINCT vehicle_registration) as unique_vehicles,
    COUNT(*) FILTER (WHERE detection_time >= NOW() - INTERVAL '30 days') as events_last_30_days,
    COUNT(*) FILTER (WHERE LOWER(event_type) LIKE '%distraction%') as total_distraction,
    COUNT(*) FILTER (WHERE LOWER(event_type) LIKE '%fatigue%' OR LOWER(event_type) LIKE '%microsleep%') as total_fatigue,
    COUNT(*) FILTER (WHERE verified OR confirmation = 'verified') as total_verified,
    MIN(detection_time) as data_start,
    MAX(detection_time) as data_end
  FROM guardian_events
)
SELECT
  '=== GUARDIAN DASHBOARD DATA SUMMARY ===' as report_section,
  TO_CHAR(total_events, '999,999') as total_events,
  unique_fleets || ' fleets' as fleet_count,
  unique_vehicles || ' vehicles' as vehicle_count,
  TO_CHAR(events_last_30_days, '999,999') as events_last_30_days,
  total_distraction || ' distraction events' as distraction_total,
  total_fatigue || ' fatigue events' as fatigue_total,
  ROUND(total_verified * 100.0 / NULLIF(total_events, 0), 1) || '%' as verification_rate,
  TO_CHAR(data_start, 'YYYY-MM-DD') as earliest_event,
  TO_CHAR(data_end, 'YYYY-MM-DD') as latest_event,
  CASE
    WHEN total_events = 0 THEN '✗ NO DATA - Database is empty!'
    WHEN events_last_30_days = 0 THEN '⚠ WARNING - No recent data (last 30 days)'
    WHEN unique_fleets < 2 THEN '⚠ WARNING - Only 1 fleet has data'
    ELSE '✓ Data looks good'
  END as status
FROM summary;
