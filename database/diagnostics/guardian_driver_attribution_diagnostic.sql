-- =====================================================
-- GUARDIAN DRIVER ATTRIBUTION - DIAGNOSTIC SCRIPT
-- =====================================================
-- Run this BEFORE implementing driver attribution
-- to understand your current state and which solution to use
--
-- Time to run: ~30 seconds
-- =====================================================

\echo '======================================================'
\echo 'GUARDIAN DRIVER ATTRIBUTION - DIAGNOSTIC REPORT'
\echo '======================================================'
\echo ''

-- =====================================================
-- 1. CURRENT DATA AVAILABILITY
-- =====================================================

\echo '1. DATA AVAILABILITY CHECK'
\echo '------------------------------'

-- Guardian Events
SELECT
  '  Guardian Events:' as check_name,
  COUNT(*) as total_events,
  MIN(detection_time)::date as earliest_event,
  MAX(detection_time)::date as latest_event,
  COUNT(*) FILTER (WHERE detection_time >= NOW() - INTERVAL '30 days') as recent_30d
FROM guardian_events;

-- Guardian with driver names
SELECT
  '  Guardian Driver Names:' as check_name,
  COUNT(*) FILTER (WHERE driver_name IS NOT NULL AND driver_name != '') as events_with_names,
  COUNT(DISTINCT driver_name) FILTER (WHERE driver_name IS NOT NULL AND driver_name != '') as unique_names,
  ROUND(
    COUNT(*) FILTER (WHERE driver_name IS NOT NULL AND driver_name != '') * 100.0 / COUNT(*),
    1
  ) as pct_with_names
FROM guardian_events;

-- Drivers table
SELECT
  '  Drivers Table:' as check_name,
  COUNT(*) as total_drivers,
  COUNT(DISTINCT full_name) as unique_names,
  COUNT(*) FILTER (WHERE active = true) as active_drivers
FROM drivers;

-- LYTX Events
SELECT
  '  LYTX Events:' as check_name,
  COUNT(*) as total_events,
  MIN(event_datetime)::date as earliest_event,
  MAX(event_datetime)::date as latest_event,
  COUNT(*) FILTER (WHERE event_datetime >= NOW() - INTERVAL '30 days') as recent_30d
FROM lytx_safety_events;

-- MtData Trips
SELECT
  '  MtData Trips:' as check_name,
  COUNT(*) as total_trips,
  MIN(start_time)::date as earliest_trip,
  MAX(end_time)::date as latest_trip,
  COUNT(*) FILTER (WHERE start_time >= NOW() - INTERVAL '30 days') as recent_30d
FROM mtdata_trip_history;

\echo ''

-- =====================================================
-- 2. CURRENT DRIVER ATTRIBUTION STATUS
-- =====================================================

\echo '2. CURRENT ATTRIBUTION STATUS'
\echo '------------------------------'

-- Check if driver_id column exists
DO $$
DECLARE
  has_driver_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_events' AND column_name = 'driver_id'
  ) INTO has_driver_id;

  IF has_driver_id THEN
    RAISE NOTICE '  ✓ driver_id column exists in guardian_events';
  ELSE
    RAISE NOTICE '  ✗ driver_id column MISSING from guardian_events';
    RAISE NOTICE '    → Need to run: PHASE3_02_populate_guardian_driver_ids.sql';
  END IF;
END $$;

-- Show current driver_id population (if column exists)
DO $$
DECLARE
  has_driver_id BOOLEAN;
  total_count INTEGER;
  with_driver_id INTEGER;
  coverage DECIMAL;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_events' AND column_name = 'driver_id'
  ) INTO has_driver_id;

  IF has_driver_id THEN
    SELECT COUNT(*) INTO total_count FROM guardian_events;
    SELECT COUNT(*) INTO with_driver_id FROM guardian_events WHERE driver_id IS NOT NULL;

    IF total_count > 0 THEN
      coverage := (with_driver_id::DECIMAL / total_count) * 100;
      RAISE NOTICE '  Events with driver_id: % / % (%.1f%%)', with_driver_id, total_count, coverage;

      IF coverage < 30 THEN
        RAISE NOTICE '  ⚠ LOW COVERAGE - Need to populate driver_id';
      ELSIF coverage < 70 THEN
        RAISE NOTICE '  ⚠ MEDIUM COVERAGE - Consider cross-source correlation';
      ELSE
        RAISE NOTICE '  ✓ GOOD COVERAGE - May still benefit from correlation';
      END IF;
    END IF;
  END IF;
END $$;

\echo ''

-- =====================================================
-- 3. NAME MATCHING POTENTIAL
-- =====================================================

\echo '3. DIRECT NAME MATCHING POTENTIAL'
\echo '------------------------------'

-- Exact name matches (case-insensitive)
WITH exact_matches AS (
  SELECT COUNT(*) as match_count
  FROM guardian_events ge
  JOIN drivers d ON UPPER(TRIM(ge.driver_name)) = UPPER(TRIM(d.full_name))
  WHERE ge.driver_name IS NOT NULL
)
SELECT
  '  Exact Matches:' as metric,
  match_count as count,
  ROUND(
    match_count * 100.0 / (SELECT COUNT(*) FROM guardian_events WHERE driver_name IS NOT NULL),
    1
  ) as pct_of_named
FROM exact_matches;

-- Fuzzy matches (>80% similarity)
WITH fuzzy_matches AS (
  SELECT COUNT(DISTINCT ge.id) as match_count
  FROM guardian_events ge
  CROSS JOIN drivers d
  WHERE ge.driver_name IS NOT NULL
    AND similarity(
      UPPER(TRIM(ge.driver_name)),
      UPPER(TRIM(d.full_name))
    ) > 0.80
)
SELECT
  '  Fuzzy Matches (>80%):' as metric,
  match_count as count,
  ROUND(
    match_count * 100.0 / (SELECT COUNT(*) FROM guardian_events WHERE driver_name IS NOT NULL),
    1
  ) as pct_of_named
FROM fuzzy_matches;

-- Sample unmatched names
\echo ''
\echo '  Sample Unmatched Names (if any):'
SELECT
  driver_name,
  COUNT(*) as event_count
FROM guardian_events
WHERE driver_name IS NOT NULL
  AND driver_name != ''
  AND NOT EXISTS (
    SELECT 1 FROM drivers d
    WHERE UPPER(TRIM(d.full_name)) = UPPER(TRIM(guardian_events.driver_name))
  )
GROUP BY driver_name
ORDER BY COUNT(*) DESC
LIMIT 10;

\echo ''

-- =====================================================
-- 4. CROSS-SOURCE CORRELATION POTENTIAL
-- =====================================================

\echo '4. CROSS-SOURCE CORRELATION POTENTIAL'
\echo '------------------------------'

-- LYTX hourly matches (±1 hour, same vehicle)
WITH lytx_hourly AS (
  SELECT COUNT(DISTINCT ge.id) as match_count
  FROM guardian_events ge
  JOIN lytx_safety_events l ON
    UPPER(TRIM(ge.vehicle_registration)) = UPPER(TRIM(l.vehicle_registration))
    AND ABS(EXTRACT(EPOCH FROM (l.event_datetime - ge.detection_time))) <= 3600
  WHERE l.driver_name IS NOT NULL
)
SELECT
  '  LYTX Hourly Matches (±1h):' as metric,
  match_count as count,
  ROUND(
    match_count * 100.0 / (SELECT COUNT(*) FROM guardian_events),
    1
  ) as pct_of_total
FROM lytx_hourly;

-- MTData trip matches (event during trip)
WITH mtdata_matches AS (
  SELECT COUNT(DISTINCT ge.id) as match_count
  FROM guardian_events ge
  JOIN mtdata_trip_history m ON
    UPPER(TRIM(ge.vehicle_registration)) = UPPER(TRIM(m.vehicle_registration))
    AND ge.detection_time >= m.start_time
    AND ge.detection_time <= m.end_time
  WHERE m.driver_name IS NOT NULL OR m.driver_id IS NOT NULL
)
SELECT
  '  MTData Trip Matches:' as metric,
  match_count as count,
  ROUND(
    match_count * 100.0 / (SELECT COUNT(*) FROM guardian_events),
    1
  ) as pct_of_total
FROM mtdata_matches;

-- LYTX daily matches (same day, same vehicle)
WITH lytx_daily AS (
  SELECT COUNT(DISTINCT ge.id) as match_count
  FROM guardian_events ge
  JOIN lytx_safety_events l ON
    UPPER(TRIM(ge.vehicle_registration)) = UPPER(TRIM(l.vehicle_registration))
    AND DATE(l.event_datetime) = DATE(ge.detection_time)
  WHERE l.driver_name IS NOT NULL
)
SELECT
  '  LYTX Daily Matches (same day):' as metric,
  match_count as count,
  ROUND(
    match_count * 100.0 / (SELECT COUNT(*) FROM guardian_events),
    1
  ) as pct_of_total
FROM lytx_daily;

\echo ''

-- =====================================================
-- 5. VEHICLE REGISTRATION MATCHING
-- =====================================================

\echo '5. VEHICLE REGISTRATION COMPATIBILITY'
\echo '------------------------------'

-- Check if vehicle registrations overlap
WITH guardian_vehicles AS (
  SELECT DISTINCT UPPER(TRIM(vehicle_registration)) as reg
  FROM guardian_events
  WHERE vehicle_registration IS NOT NULL
),
lytx_vehicles AS (
  SELECT DISTINCT UPPER(TRIM(vehicle_registration)) as reg
  FROM lytx_safety_events
  WHERE vehicle_registration IS NOT NULL
),
mtdata_vehicles AS (
  SELECT DISTINCT UPPER(TRIM(vehicle_registration)) as reg
  FROM mtdata_trip_history
  WHERE vehicle_registration IS NOT NULL
)
SELECT
  '  Unique Vehicles:' as metric,
  (SELECT COUNT(*) FROM guardian_vehicles) as guardian,
  (SELECT COUNT(*) FROM lytx_vehicles) as lytx,
  (SELECT COUNT(*) FROM mtdata_vehicles) as mtdata,
  (SELECT COUNT(*) FROM guardian_vehicles gv
   WHERE EXISTS (SELECT 1 FROM lytx_vehicles lv WHERE lv.reg = gv.reg)) as guardian_lytx_overlap,
  (SELECT COUNT(*) FROM guardian_vehicles gv
   WHERE EXISTS (SELECT 1 FROM mtdata_vehicles mv WHERE mv.reg = gv.reg)) as guardian_mtdata_overlap;

-- Sample vehicle registration formats
\echo ''
\echo '  Sample Vehicle Formats:'
SELECT
  'Guardian' as source,
  vehicle_registration as sample
FROM guardian_events
WHERE vehicle_registration IS NOT NULL
LIMIT 3
UNION ALL
SELECT
  'LYTX',
  vehicle_registration
FROM lytx_safety_events
WHERE vehicle_registration IS NOT NULL
LIMIT 3
UNION ALL
SELECT
  'MTData',
  vehicle_registration
FROM mtdata_trip_history
WHERE vehicle_registration IS NOT NULL
LIMIT 3;

\echo ''

-- =====================================================
-- 6. EXISTING VIEWS CHECK
-- =====================================================

\echo '6. EXISTING VIEWS AND MIGRATIONS'
\echo '------------------------------'

-- Check for existing enriched views
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'guardian_events_enriched') THEN
    RAISE NOTICE '  ✓ guardian_events_enriched view exists';
  ELSE
    RAISE NOTICE '  ✗ guardian_events_enriched view NOT found';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'driver_unified_timeline') THEN
    RAISE NOTICE '  ✓ driver_unified_timeline view exists';
  ELSE
    RAISE NOTICE '  ✗ driver_unified_timeline view NOT found';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'driver_event_correlation') THEN
    RAISE NOTICE '  ✓ driver_event_correlation view exists';
  ELSE
    RAISE NOTICE '  ✗ driver_event_correlation view NOT found';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'vehicle_unified_timeline') THEN
    RAISE NOTICE '  ✓ vehicle_unified_timeline view exists';
  ELSE
    RAISE NOTICE '  ✗ vehicle_unified_timeline view NOT found';
  END IF;
END $$;

\echo ''

-- =====================================================
-- 7. RECOMMENDATIONS
-- =====================================================

\echo '7. RECOMMENDED ACTION PLAN'
\echo '------------------------------'

DO $$
DECLARE
  has_driver_id BOOLEAN;
  driver_coverage DECIMAL;
  total_events INTEGER;
  with_driver INTEGER;
  lytx_potential INTEGER;
  mtdata_potential INTEGER;
BEGIN
  -- Check current state
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_events' AND column_name = 'driver_id'
  ) INTO has_driver_id;

  SELECT COUNT(*) INTO total_events FROM guardian_events;

  IF has_driver_id THEN
    SELECT COUNT(*) INTO with_driver FROM guardian_events WHERE driver_id IS NOT NULL;
    IF total_events > 0 THEN
      driver_coverage := (with_driver::DECIMAL / total_events) * 100;
    ELSE
      driver_coverage := 0;
    END IF;
  ELSE
    driver_coverage := 0;
  END IF;

  -- Check LYTX potential
  SELECT COUNT(DISTINCT ge.id) INTO lytx_potential
  FROM guardian_events ge
  JOIN lytx_safety_events l ON
    UPPER(TRIM(ge.vehicle_registration)) = UPPER(TRIM(l.vehicle_registration))
    AND ABS(EXTRACT(EPOCH FROM (l.event_datetime - ge.detection_time))) <= 3600;

  -- Check MTData potential
  SELECT COUNT(DISTINCT ge.id) INTO mtdata_potential
  FROM guardian_events ge
  JOIN mtdata_trip_history m ON
    UPPER(TRIM(ge.vehicle_registration)) = UPPER(TRIM(m.vehicle_registration))
    AND ge.detection_time >= m.start_time
    AND ge.detection_time <= m.end_time;

  RAISE NOTICE '';
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'RECOMMENDATION:';
  RAISE NOTICE '=======================================================';
  RAISE NOTICE '';

  -- Provide recommendation
  IF NOT has_driver_id THEN
    RAISE NOTICE '❶ FIRST: Run PHASE3_02_populate_guardian_driver_ids.sql';
    RAISE NOTICE '   → Adds driver_id column and matches by name';
    RAISE NOTICE '   → Expected coverage: 60-70%%';
    RAISE NOTICE '   → Time: 5 minutes';
    RAISE NOTICE '';
  END IF;

  IF driver_coverage < 70 OR NOT has_driver_id THEN
    IF lytx_potential > 0 OR mtdata_potential > 0 THEN
      RAISE NOTICE '❷ THEN: Run create_unified_timelines.sql';
      RAISE NOTICE '   → Correlates with LYTX and MTData';
      RAISE NOTICE '   → Expected additional coverage: +20-25%%';
      RAISE NOTICE '   → Total expected: 80-85%% coverage';
      RAISE NOTICE '   → Time: 10 minutes';
      RAISE NOTICE '';
      RAISE NOTICE '   LYTX potential: % additional events', lytx_potential;
      RAISE NOTICE '   MTData potential: % additional events', mtdata_potential;
    ELSE
      RAISE NOTICE '⚠  WARNING: Limited LYTX/MTData overlap detected';
      RAISE NOTICE '   → Check vehicle registrations match across sources';
      RAISE NOTICE '   → Check date ranges overlap';
    END IF;
  ELSE
    RAISE NOTICE '✓ Current coverage: %.1f%% - Good!', driver_coverage;
    RAISE NOTICE '  → Consider unified timelines for complete view across sources';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'For detailed instructions, see:';
  RAISE NOTICE '  GUARDIAN_DRIVER_ATTRIBUTION_GUIDE.md';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- 8. SAMPLE CORRELATION TEST
-- =====================================================

\echo '8. SAMPLE CORRELATION TEST (Last 10 Events)'
\echo '------------------------------'
\echo ''

-- Show how the last 10 Guardian events could be correlated
SELECT
  ge.id as event_id,
  ge.detection_time,
  ge.vehicle_registration,
  ge.driver_name as guardian_driver,
  ge.event_type,

  -- Potential LYTX match
  (
    SELECT l.driver_name
    FROM lytx_safety_events l
    WHERE UPPER(TRIM(l.vehicle_registration)) = UPPER(TRIM(ge.vehicle_registration))
      AND ABS(EXTRACT(EPOCH FROM (l.event_datetime - ge.detection_time))) <= 3600
      AND l.driver_name IS NOT NULL
    ORDER BY ABS(EXTRACT(EPOCH FROM (l.event_datetime - ge.detection_time))) ASC
    LIMIT 1
  ) as lytx_match,

  -- Potential MTData match
  (
    SELECT m.driver_name
    FROM mtdata_trip_history m
    WHERE UPPER(TRIM(m.vehicle_registration)) = UPPER(TRIM(ge.vehicle_registration))
      AND ge.detection_time >= m.start_time
      AND ge.detection_time <= m.end_time
      AND (m.driver_name IS NOT NULL OR m.driver_id IS NOT NULL)
    ORDER BY m.start_time DESC
    LIMIT 1
  ) as mtdata_match

FROM guardian_events ge
ORDER BY ge.detection_time DESC
LIMIT 10;

\echo ''
\echo '======================================================'
\echo 'END OF DIAGNOSTIC REPORT'
\echo '======================================================'
\echo ''
\echo 'Next steps: Review recommendations above'
\echo 'Documentation: GUARDIAN_DRIVER_ATTRIBUTION_GUIDE.md'
\echo '======================================================'
