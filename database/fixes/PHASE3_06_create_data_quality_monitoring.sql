-- =====================================================
-- PHASE 3.6: DATA QUALITY MONITORING VIEWS
-- =====================================================
-- Creates comprehensive data quality dashboards
-- Monitors relationship integrity and completeness
-- Tracks match rates and data health metrics
-- =====================================================

DO $$ BEGIN RAISE NOTICE '=== PHASE 3.6: CREATING DATA QUALITY MONITORING VIEWS ==='; END $$;

-- =====================================================
-- STEP 1: DATA COMPLETENESS DASHBOARD
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 1/5: Creating data_quality_dashboard view...'; END $$;

CREATE OR REPLACE VIEW data_quality_dashboard AS
WITH metrics AS (
  SELECT
    'LYTX Events' as data_source,
    (SELECT COUNT(*) FROM lytx_safety_events) as total_records,
    (SELECT COUNT(*) FROM lytx_safety_events WHERE vehicle_id IS NOT NULL) as with_vehicle_link,
    (SELECT COUNT(*) FROM lytx_safety_events WHERE excluded = true) as excluded_records,
    (SELECT MIN(event_datetime) FROM lytx_safety_events) as earliest_record,
    (SELECT MAX(event_datetime) FROM lytx_safety_events) as latest_record
  UNION ALL
  SELECT
    'Guardian Events' as data_source,
    (SELECT COUNT(*) FROM guardian_events) as total_records,
    (SELECT COUNT(*) FROM guardian_events WHERE driver_id IS NOT NULL AND verified = true) as with_driver_link,
    (SELECT COUNT(*) FROM guardian_events WHERE verified = false) as excluded_records,
    (SELECT MIN(detection_time) FROM guardian_events) as earliest_record,
    (SELECT MAX(detection_time) FROM guardian_events) as latest_record
  UNION ALL
  SELECT
    'Captive Deliveries' as data_source,
    (SELECT COUNT(*) FROM captive_deliveries) as total_records,
    (SELECT COUNT(*) FROM captive_deliveries WHERE vehicle_id IS NOT NULL) as with_vehicle_link,
    0 as excluded_records,
    (SELECT MIN(delivery_date) FROM captive_deliveries) as earliest_record,
    (SELECT MAX(delivery_date) FROM captive_deliveries) as latest_record
  UNION ALL
  SELECT
    'MTData Trips' as data_source,
    (SELECT COUNT(*) FROM mtdata_raw) as total_records,
    (SELECT COUNT(*) FROM mtdata_raw WHERE vehicle_id IS NOT NULL) as with_vehicle_link,
    0 as excluded_records,
    (SELECT MIN(start_time) FROM mtdata_raw) as earliest_record,
    (SELECT MAX(start_time) FROM mtdata_raw) as latest_record
)
SELECT
  data_source,
  total_records,
  with_vehicle_link as linked_records,
  CASE
    WHEN total_records > 0 THEN (with_vehicle_link::DECIMAL / total_records * 100)
    ELSE 0
  END::DECIMAL(5,2) as link_percentage,
  excluded_records,
  earliest_record::DATE as earliest_date,
  latest_record::DATE as latest_date,
  EXTRACT(DAY FROM latest_record - earliest_record)::INTEGER as data_span_days,
  -- Data freshness
  EXTRACT(DAY FROM NOW() - latest_record)::INTEGER as days_since_latest,
  -- Quality score (0-100)
  CASE
    WHEN total_records = 0 THEN 0
    ELSE LEAST(100, (
      (with_vehicle_link::DECIMAL / total_records * 50) + -- 50% weight on linking
      (CASE WHEN EXTRACT(DAY FROM NOW() - latest_record) < 7 THEN 30 ELSE 0 END) + -- 30% for fresh data
      (CASE WHEN excluded_records::DECIMAL / total_records < 0.1 THEN 20 ELSE 0 END) -- 20% for low exclusions
    ))::INTEGER
  END as quality_score
FROM metrics
ORDER BY
  CASE data_source
    WHEN 'Guardian Events' THEN 1
    WHEN 'LYTX Events' THEN 2
    WHEN 'Captive Deliveries' THEN 3
    WHEN 'MTData Trips' THEN 4
  END;

GRANT SELECT ON data_quality_dashboard TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ data_quality_dashboard view created'; END $$;

-- =====================================================
-- STEP 2: RELATIONSHIP HEALTH MONITOR
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 2/5: Creating relationship_health_monitor view...'; END $$;

CREATE OR REPLACE VIEW relationship_health_monitor AS
SELECT
  'LYTX → Vehicle' as relationship,
  (SELECT COUNT(*) FROM lytx_safety_events) as total_source_records,
  (SELECT COUNT(*) FROM lytx_safety_events WHERE vehicle_id IS NOT NULL) as linked_records,
  (SELECT COUNT(*) FROM lytx_safety_events WHERE vehicle_id IS NULL AND excluded IS NOT TRUE) as orphaned_records,
  CASE
    WHEN (SELECT COUNT(*) FROM lytx_safety_events) > 0
    THEN ((SELECT COUNT(*) FROM lytx_safety_events WHERE vehicle_id IS NOT NULL)::DECIMAL /
          (SELECT COUNT(*) FROM lytx_safety_events) * 100)
    ELSE 0
  END::DECIMAL(5,2) as link_percentage,
  'database/fixes/PHASE3_01_populate_lytx_vehicle_ids.sql' as fix_script,
  'SELECT * FROM unmatched_lytx_events LIMIT 20;' as review_query
UNION ALL
SELECT
  'Guardian → Driver' as relationship,
  (SELECT COUNT(*) FROM guardian_events WHERE verified = true) as total_source_records,
  (SELECT COUNT(*) FROM guardian_events WHERE driver_id IS NOT NULL AND verified = true) as linked_records,
  (SELECT COUNT(*) FROM guardian_events WHERE driver_id IS NULL AND verified = true) as orphaned_records,
  CASE
    WHEN (SELECT COUNT(*) FROM guardian_events WHERE verified = true) > 0
    THEN ((SELECT COUNT(*) FROM guardian_events WHERE driver_id IS NOT NULL AND verified = true)::DECIMAL /
          (SELECT COUNT(*) FROM guardian_events WHERE verified = true) * 100)
    ELSE 0
  END::DECIMAL(5,2) as link_percentage,
  'database/fixes/PHASE3_02_populate_guardian_driver_ids.sql' as fix_script,
  'SELECT * FROM unmatched_guardian_events LIMIT 20;' as review_query
UNION ALL
SELECT
  'Guardian → Vehicle' as relationship,
  (SELECT COUNT(*) FROM guardian_events WHERE verified = true) as total_source_records,
  (SELECT COUNT(*) FROM guardian_events WHERE vehicle_id IS NOT NULL AND verified = true) as linked_records,
  (SELECT COUNT(*) FROM guardian_events WHERE vehicle_id IS NULL AND verified = true) as orphaned_records,
  CASE
    WHEN (SELECT COUNT(*) FROM guardian_events WHERE verified = true) > 0
    THEN ((SELECT COUNT(*) FROM guardian_events WHERE vehicle_id IS NOT NULL AND verified = true)::DECIMAL /
          (SELECT COUNT(*) FROM guardian_events WHERE verified = true) * 100)
    ELSE 0
  END::DECIMAL(5,2) as link_percentage,
  'Linked via vehicle field in events' as fix_script,
  'SELECT * FROM guardian_events WHERE verified = true AND vehicle_id IS NULL LIMIT 20;' as review_query
UNION ALL
SELECT
  'Driver ⟷ Vehicle Assignments' as relationship,
  (SELECT COUNT(*) FROM guardian_events WHERE driver_id IS NOT NULL AND vehicle_id IS NOT NULL AND verified = true) as total_source_records,
  (SELECT COUNT(*) FROM guardian_events ge WHERE ge.driver_id IS NOT NULL AND ge.vehicle_id IS NOT NULL AND ge.verified = true AND EXISTS (
    SELECT 1 FROM driver_vehicle_assignments dva
    WHERE dva.driver_id = ge.driver_id
      AND dva.vehicle_id = ge.vehicle_id
      AND dva.valid_from <= ge.detection_time
      AND (dva.valid_until IS NULL OR dva.valid_until > ge.detection_time)
  )) as linked_records,
  (SELECT COUNT(*) FROM guardian_events_without_assignments) as orphaned_records,
  CASE
    WHEN (SELECT COUNT(*) FROM guardian_events WHERE driver_id IS NOT NULL AND vehicle_id IS NOT NULL AND verified = true) > 0
    THEN ((SELECT COUNT(*) FROM guardian_events ge WHERE ge.driver_id IS NOT NULL AND ge.vehicle_id IS NOT NULL AND ge.verified = true AND EXISTS (
      SELECT 1 FROM driver_vehicle_assignments dva
      WHERE dva.driver_id = ge.driver_id AND dva.vehicle_id = ge.vehicle_id
        AND dva.valid_from <= ge.detection_time AND (dva.valid_until IS NULL OR dva.valid_until > ge.detection_time)
    ))::DECIMAL / (SELECT COUNT(*) FROM guardian_events WHERE driver_id IS NOT NULL AND vehicle_id IS NOT NULL AND verified = true) * 100)
    ELSE 0
  END::DECIMAL(5,2) as link_percentage,
  'database/fixes/PHASE3_04_infer_driver_vehicle_assignments.sql' as fix_script,
  'SELECT * FROM driver_assignment_coverage ORDER BY coverage_percentage ASC LIMIT 10;' as review_query
UNION ALL
SELECT
  'Trip ⟷ Delivery Correlations' as relationship,
  GREATEST(
    (SELECT COUNT(*) FROM mtdata_raw WHERE start_time IS NOT NULL),
    (SELECT COUNT(*) FROM captive_deliveries)
  ) as total_source_records,
  (SELECT COUNT(*) FROM trip_delivery_correlations) as linked_records,
  LEAST(
    (SELECT COUNT(*) FROM trips_without_deliveries),
    (SELECT COUNT(*) FROM deliveries_without_trips)
  ) as orphaned_records,
  CASE
    WHEN GREATEST((SELECT COUNT(*) FROM mtdata_raw WHERE start_time IS NOT NULL), (SELECT COUNT(*) FROM captive_deliveries)) > 0
    THEN ((SELECT COUNT(*) FROM trip_delivery_correlations)::DECIMAL /
          GREATEST((SELECT COUNT(*) FROM mtdata_raw WHERE start_time IS NOT NULL), (SELECT COUNT(*) FROM captive_deliveries)) * 100)
    ELSE 0
  END::DECIMAL(5,2) as link_percentage,
  'database/fixes/PHASE3_05_create_trip_delivery_correlation.sql' as fix_script,
  'SELECT * FROM trip_delivery_correlations_review LIMIT 20;' as review_query
ORDER BY link_percentage ASC;

GRANT SELECT ON relationship_health_monitor TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ relationship_health_monitor view created'; END $$;

-- =====================================================
-- STEP 3: ORPHANED RECORDS SUMMARY
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 3/5: Creating orphaned_records_summary view...'; END $$;

CREATE OR REPLACE VIEW orphaned_records_summary AS
WITH orphan_counts AS (
  SELECT
    'LYTX Events without Vehicle' as orphan_type,
    COUNT(*) as count,
    MIN(event_datetime) as earliest,
    MAX(event_datetime) as latest,
    'unmatched_lytx_events' as review_view
  FROM lytx_safety_events
  WHERE vehicle_id IS NULL AND excluded IS NOT TRUE

  UNION ALL

  SELECT
    'Guardian Events without Driver' as orphan_type,
    COUNT(*) as count,
    MIN(detection_time) as earliest,
    MAX(detection_time) as latest,
    'unmatched_guardian_events' as review_view
  FROM guardian_events
  WHERE driver_id IS NULL AND verified = true AND driver IS NOT NULL AND TRIM(driver) != ''

  UNION ALL

  SELECT
    'Guardian Events without Vehicle' as orphan_type,
    COUNT(*) as count,
    MIN(detection_time) as earliest,
    MAX(detection_time) as latest,
    'guardian_events WHERE vehicle_id IS NULL' as review_view
  FROM guardian_events
  WHERE vehicle_id IS NULL AND verified = true

  UNION ALL

  SELECT
    'Guardian Events without Assignment' as orphan_type,
    COUNT(*) as count,
    MIN(detection_time) as earliest,
    MAX(detection_time) as latest,
    'guardian_events_without_assignments' as review_view
  FROM guardian_events_without_assignments

  UNION ALL

  SELECT
    'Deliveries without Trip' as orphan_type,
    COUNT(*) as count,
    MIN(delivery_date) as earliest,
    MAX(delivery_date) as latest,
    'deliveries_without_trips' as review_view
  FROM deliveries_without_trips

  UNION ALL

  SELECT
    'Trips without Delivery' as orphan_type,
    COUNT(*) as count,
    MIN(start_time) as earliest,
    MAX(start_time) as latest,
    'trips_without_deliveries' as review_view
  FROM trips_without_deliveries
)
SELECT
  orphan_type,
  count as orphan_count,
  earliest::DATE as earliest_date,
  latest::DATE as latest_date,
  CASE
    WHEN count = 0 THEN 'None'
    WHEN count < 10 THEN 'Low'
    WHEN count < 100 THEN 'Medium'
    WHEN count < 1000 THEN 'High'
    ELSE 'Critical'
  END as severity,
  review_view,
  -- Action recommendation
  CASE
    WHEN count = 0 THEN 'No action needed'
    WHEN count < 10 THEN 'Manual review recommended'
    WHEN count < 100 THEN 'Review patterns and adjust matching logic'
    ELSE 'Investigate data quality issues or missing source data'
  END as recommended_action
FROM orphan_counts
WHERE count > 0
ORDER BY count DESC;

GRANT SELECT ON orphaned_records_summary TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ orphaned_records_summary view created'; END $$;

-- =====================================================
-- STEP 4: MATCH CONFIDENCE DISTRIBUTION
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 4/5: Creating match_confidence_distribution view...'; END $$;

CREATE OR REPLACE VIEW match_confidence_distribution AS
SELECT
  'Driver-Vehicle Assignments' as match_type,
  COUNT(*) FILTER (WHERE confidence_score >= 0.90) as excellent,
  COUNT(*) FILTER (WHERE confidence_score >= 0.70 AND confidence_score < 0.90) as good,
  COUNT(*) FILTER (WHERE confidence_score >= 0.50 AND confidence_score < 0.70) as fair,
  COUNT(*) FILTER (WHERE confidence_score < 0.50 OR confidence_score IS NULL) as poor,
  COUNT(*) as total,
  AVG(confidence_score)::DECIMAL(3,2) as avg_confidence
FROM driver_vehicle_assignments

UNION ALL

SELECT
  'Trip-Delivery Correlations' as match_type,
  COUNT(*) FILTER (WHERE match_confidence >= 0.90) as excellent,
  COUNT(*) FILTER (WHERE match_confidence >= 0.70 AND match_confidence < 0.90) as good,
  COUNT(*) FILTER (WHERE match_confidence >= 0.50 AND match_confidence < 0.70) as fair,
  COUNT(*) FILTER (WHERE match_confidence < 0.50 OR match_confidence IS NULL) as poor,
  COUNT(*) as total,
  AVG(match_confidence)::DECIMAL(3,2) as avg_confidence
FROM trip_delivery_correlations;

GRANT SELECT ON match_confidence_distribution TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ match_confidence_distribution view created'; END $$;

-- =====================================================
-- STEP 5: DATA QUALITY ALERTS
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 5/5: Creating data_quality_alerts view...'; END $$;

CREATE OR REPLACE VIEW data_quality_alerts AS
WITH alerts AS (
  -- Alert: High orphan rate
  SELECT
    'High Orphan Rate' as alert_type,
    'LYTX Events' as data_source,
    'critical' as severity,
    format('%s LYTX events without vehicle links (%.1f%%)',
      COUNT(*),
      (COUNT(*)::DECIMAL / NULLIF((SELECT COUNT(*) FROM lytx_safety_events), 0) * 100)
    ) as message,
    'Review unmatched_lytx_events and update vehicle matching logic' as action
  FROM lytx_safety_events
  WHERE vehicle_id IS NULL AND excluded IS NOT TRUE
  HAVING COUNT(*)::DECIMAL / NULLIF((SELECT COUNT(*) FROM lytx_safety_events), 0) > 0.20

  UNION ALL

  SELECT
    'High Orphan Rate' as alert_type,
    'Guardian Events' as data_source,
    'critical' as severity,
    format('%s Guardian events without driver links (%.1f%%)',
      COUNT(*),
      (COUNT(*)::DECIMAL / NULLIF((SELECT COUNT(*) FROM guardian_events WHERE verified = true), 0) * 100)
    ) as message,
    'Review unmatched_guardian_events and update driver matching logic' as action
  FROM guardian_events
  WHERE driver_id IS NULL AND verified = true AND driver IS NOT NULL
  HAVING COUNT(*)::DECIMAL / NULLIF((SELECT COUNT(*) FROM guardian_events WHERE verified = true), 0) > 0.20

  UNION ALL

  -- Alert: Stale data
  SELECT
    'Stale Data' as alert_type,
    'LYTX Events' as data_source,
    'warning' as severity,
    format('Last LYTX event is %s days old', EXTRACT(DAY FROM NOW() - MAX(event_datetime))::INTEGER) as message,
    'Check LYTX API integration and data sync status' as action
  FROM lytx_safety_events
  HAVING EXTRACT(DAY FROM NOW() - MAX(event_datetime)) > 7

  UNION ALL

  SELECT
    'Stale Data' as alert_type,
    'Guardian Events' as data_source,
    'warning' as severity,
    format('Last Guardian event is %s days old', EXTRACT(DAY FROM NOW() - MAX(detection_time))::INTEGER) as message,
    'Check Guardian system integration and data sync' as action
  FROM guardian_events
  HAVING EXTRACT(DAY FROM NOW() - MAX(detection_time)) > 7

  UNION ALL

  -- Alert: Low assignment coverage
  SELECT
    'Low Assignment Coverage' as alert_type,
    'Driver-Vehicle Assignments' as data_source,
    'warning' as severity,
    format('%s drivers have assignment coverage below 50%%', COUNT(*)) as message,
    'Review driver_assignment_coverage and backfill missing assignments' as action
  FROM driver_assignment_coverage
  WHERE coverage_percentage < 50
  HAVING COUNT(*) > 0

  UNION ALL

  -- Alert: Many low-confidence matches
  SELECT
    'Low Confidence Matches' as alert_type,
    'Trip-Delivery Correlations' as data_source,
    'info' as severity,
    format('%s trip-delivery correlations need manual review', COUNT(*)) as message,
    'Review trip_delivery_correlations_review and verify matches' as action
  FROM trip_delivery_correlations
  WHERE needs_review = true
  HAVING COUNT(*) > 10
)
SELECT
  alert_type,
  data_source,
  severity,
  message,
  action,
  NOW() as detected_at
FROM alerts
ORDER BY
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'warning' THEN 2
    WHEN 'info' THEN 3
  END,
  data_source;

GRANT SELECT ON data_quality_alerts TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ data_quality_alerts view created'; END $$;

-- =====================================================
-- STEP 6: GRANT ALL PERMISSIONS
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Granting view permissions...'; END $$;

-- All quality views are read-only for authenticated users
GRANT SELECT ON data_quality_dashboard TO authenticated;
GRANT SELECT ON relationship_health_monitor TO authenticated;
GRANT SELECT ON orphaned_records_summary TO authenticated;
GRANT SELECT ON match_confidence_distribution TO authenticated;
GRANT SELECT ON data_quality_alerts TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ Permissions granted'; END $$;

-- =====================================================
-- STEP 7: DISPLAY CURRENT QUALITY METRICS
-- =====================================================

DO $$
DECLARE
  alert_count INTEGER;
  critical_alerts INTEGER;
  avg_link_rate DECIMAL;
BEGIN
  SELECT COUNT(*) INTO alert_count FROM data_quality_alerts;
  SELECT COUNT(*) INTO critical_alerts FROM data_quality_alerts WHERE severity = 'critical';
  SELECT AVG(link_percentage) INTO avg_link_rate FROM relationship_health_monitor;

  RAISE NOTICE '';
  RAISE NOTICE 'DATA QUALITY SUMMARY:';
  RAISE NOTICE '  Active alerts: % (% critical)', alert_count, critical_alerts;
  RAISE NOTICE '  Average relationship link rate: %.1f%%', avg_link_rate;
  RAISE NOTICE '';

  IF critical_alerts > 0 THEN
    RAISE NOTICE '⚠️  CRITICAL ALERTS DETECTED:';
    RAISE NOTICE 'Run this query to see details:';
    RAISE NOTICE '  SELECT * FROM data_quality_alerts WHERE severity = ''critical'';';
    RAISE NOTICE '';
  END IF;
END $$;

-- =====================================================
-- SUCCESS
-- =====================================================

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== PHASE 3.6 COMPLETE ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Created Data Quality Monitoring Views:';
  RAISE NOTICE '  ✓ data_quality_dashboard - Overall metrics per data source';
  RAISE NOTICE '  ✓ relationship_health_monitor - Link rates and orphaned records';
  RAISE NOTICE '  ✓ orphaned_records_summary - Unlinked records by type';
  RAISE NOTICE '  ✓ match_confidence_distribution - Quality of matches';
  RAISE NOTICE '  ✓ data_quality_alerts - Active issues requiring attention';
  RAISE NOTICE '';
  RAISE NOTICE 'Key Queries:';
  RAISE NOTICE '  SELECT * FROM data_quality_dashboard;';
  RAISE NOTICE '  SELECT * FROM relationship_health_monitor;';
  RAISE NOTICE '  SELECT * FROM orphaned_records_summary;';
  RAISE NOTICE '  SELECT * FROM data_quality_alerts;';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Create master runner script (PHASE3_MASTER.sql)';
  RAISE NOTICE '';
END $$;
