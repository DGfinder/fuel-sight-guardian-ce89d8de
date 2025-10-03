-- ============================================================================
-- DATA CENTRE CLEANUP: VALIDATION & TESTING
-- ============================================================================
-- Purpose: Validate all cleanup migrations and test query functions
-- Status: READ-ONLY VALIDATION (no data changes)
-- Dependencies: Requires all previous migrations (001-006) to be completed
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'DATA CENTRE CLEANUP - VALIDATION & TESTING';
  RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- TEST 1: FOREIGN KEY INTEGRITY
-- ============================================================================

DO $$
DECLARE
  v_test_name TEXT := 'Foreign Key Integrity';
  v_passed BOOLEAN := TRUE;
  v_orphaned_lytx INT;
  v_orphaned_guardian INT;
  v_orphaned_trips INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '[TEST 1] %...', v_test_name;

  -- Check for orphaned LYTX events
  SELECT COUNT(*) INTO v_orphaned_lytx
  FROM lytx_safety_events le
  WHERE le.vehicle_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.id = le.vehicle_id);

  IF v_orphaned_lytx > 0 THEN
    RAISE WARNING '  ✗ Found % orphaned LYTX events (vehicle_id not in vehicles)', v_orphaned_lytx;
    v_passed := FALSE;
  ELSE
    RAISE NOTICE '  ✓ All LYTX events have valid vehicle references';
  END IF;

  -- Check for orphaned Guardian events
  SELECT COUNT(*) INTO v_orphaned_guardian
  FROM guardian_events ge
  WHERE ge.vehicle_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.id = ge.vehicle_id);

  IF v_orphaned_guardian > 0 THEN
    RAISE WARNING '  ✗ Found % orphaned Guardian events (vehicle_id not in vehicles)', v_orphaned_guardian;
    v_passed := FALSE;
  ELSE
    RAISE NOTICE '  ✓ All Guardian events have valid vehicle references';
  END IF;

  -- Check for orphaned trip correlations
  SELECT COUNT(*) INTO v_orphaned_trips
  FROM mtdata_captive_correlations mcc
  WHERE NOT EXISTS (SELECT 1 FROM mtdata_trip_history th WHERE th.id = mcc.mtdata_trip_id);

  IF v_orphaned_trips > 0 THEN
    RAISE WARNING '  ✗ Found % orphaned correlations (trip_id not in trips)', v_orphaned_trips;
    v_passed := FALSE;
  ELSE
    RAISE NOTICE '  ✓ All correlations have valid trip references';
  END IF;

  IF v_passed THEN
    RAISE NOTICE '  ✅ TEST PASSED: %', v_test_name;
  ELSE
    RAISE WARNING '  ❌ TEST FAILED: %', v_test_name;
  END IF;
END $$;

-- ============================================================================
-- TEST 2: RELATIONSHIP COVERAGE
-- ============================================================================

DO $$
DECLARE
  v_test_name TEXT := 'Relationship Coverage';
  v_passed BOOLEAN := TRUE;
  v_lytx_vehicle_rate DECIMAL;
  v_guardian_vehicle_rate DECIMAL;
  v_trip_driver_rate DECIMAL;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '[TEST 2] %...', v_test_name;

  -- LYTX vehicle coverage
  SELECT ROUND((COUNT(*) FILTER (WHERE vehicle_id IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2)
  INTO v_lytx_vehicle_rate
  FROM lytx_safety_events;

  RAISE NOTICE '  → LYTX vehicle match rate: %%', v_lytx_vehicle_rate;
  IF v_lytx_vehicle_rate < 60 THEN
    RAISE WARNING '  ✗ LYTX vehicle match rate below 60%%';
    v_passed := FALSE;
  END IF;

  -- Guardian vehicle coverage
  SELECT ROUND((COUNT(*) FILTER (WHERE vehicle_id IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2)
  INTO v_guardian_vehicle_rate
  FROM guardian_events;

  RAISE NOTICE '  → Guardian vehicle match rate: %%', v_guardian_vehicle_rate;
  IF v_guardian_vehicle_rate < 60 THEN
    RAISE WARNING '  ✗ Guardian vehicle match rate below 60%%';
    v_passed := FALSE;
  END IF;

  -- Trip driver coverage
  SELECT ROUND((COUNT(*) FILTER (WHERE driver_id IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2)
  INTO v_trip_driver_rate
  FROM mtdata_trip_history;

  RAISE NOTICE '  → Trip driver match rate: %%', v_trip_driver_rate;
  IF v_trip_driver_rate < 70 THEN
    RAISE WARNING '  ✗ Trip driver match rate below 70%%';
    v_passed := FALSE;
  END IF;

  IF v_passed THEN
    RAISE NOTICE '  ✅ TEST PASSED: %', v_test_name;
  ELSE
    RAISE WARNING '  ❌ TEST FAILED: % (low match rates)', v_test_name;
  END IF;
END $$;

-- ============================================================================
-- TEST 3: QUERY FUNCTION VALIDATION
-- ============================================================================

DO $$
DECLARE
  v_test_name TEXT := 'Query Function Validation';
  v_passed BOOLEAN := TRUE;
  v_sample_driver_id UUID;
  v_sample_vehicle_id UUID;
  v_sample_trip_id UUID;
  v_result JSON;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '[TEST 3] %...', v_test_name;

  -- Get sample IDs
  SELECT id INTO v_sample_driver_id FROM drivers WHERE status = 'Active' LIMIT 1;
  SELECT id INTO v_sample_vehicle_id FROM vehicles WHERE status = 'Active' LIMIT 1;
  SELECT id INTO v_sample_trip_id FROM mtdata_trip_history WHERE driver_id IS NOT NULL LIMIT 1;

  -- Test get_driver_complete_profile
  IF v_sample_driver_id IS NOT NULL THEN
    BEGIN
      SELECT get_driver_complete_profile(v_sample_driver_id) INTO v_result;
      IF v_result IS NOT NULL THEN
        RAISE NOTICE '  ✓ get_driver_complete_profile() works';
      ELSE
        RAISE WARNING '  ✗ get_driver_complete_profile() returned NULL';
        v_passed := FALSE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '  ✗ get_driver_complete_profile() failed: %', SQLERRM;
      v_passed := FALSE;
    END;
  ELSE
    RAISE WARNING '  - No sample driver available for testing';
  END IF;

  -- Test get_vehicle_complete_profile
  IF v_sample_vehicle_id IS NOT NULL THEN
    BEGIN
      SELECT get_vehicle_complete_profile(v_sample_vehicle_id) INTO v_result;
      IF v_result IS NOT NULL THEN
        RAISE NOTICE '  ✓ get_vehicle_complete_profile() works';
      ELSE
        RAISE WARNING '  ✗ get_vehicle_complete_profile() returned NULL';
        v_passed := FALSE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '  ✗ get_vehicle_complete_profile() failed: %', SQLERRM;
      v_passed := FALSE;
    END;
  ELSE
    RAISE WARNING '  - No sample vehicle available for testing';
  END IF;

  -- Test get_trip_complete_data
  IF v_sample_trip_id IS NOT NULL THEN
    BEGIN
      SELECT get_trip_complete_data(v_sample_trip_id) INTO v_result;
      IF v_result IS NOT NULL THEN
        RAISE NOTICE '  ✓ get_trip_complete_data() works';
      ELSE
        RAISE WARNING '  ✗ get_trip_complete_data() returned NULL';
        v_passed := FALSE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '  ✗ get_trip_complete_data() failed: %', SQLERRM;
      v_passed := FALSE;
    END;
  ELSE
    RAISE WARNING '  - No sample trip available for testing';
  END IF;

  IF v_passed THEN
    RAISE NOTICE '  ✅ TEST PASSED: %', v_test_name;
  ELSE
    RAISE WARNING '  ❌ TEST FAILED: %', v_test_name;
  END IF;
END $$;

-- ============================================================================
-- TEST 4: VIEW ACCESSIBILITY
-- ============================================================================

DO $$
DECLARE
  v_test_name TEXT := 'View Accessibility';
  v_passed BOOLEAN := TRUE;
  v_count INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '[TEST 4] %...', v_test_name;

  -- Test unified_event_timeline
  BEGIN
    SELECT COUNT(*) INTO v_count FROM unified_event_timeline LIMIT 100;
    RAISE NOTICE '  ✓ unified_event_timeline accessible (% rows sampled)', v_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  ✗ unified_event_timeline failed: %', SQLERRM;
    v_passed := FALSE;
  END;

  -- Test dvtd_relationships
  BEGIN
    SELECT COUNT(*) INTO v_count FROM dvtd_relationships LIMIT 100;
    RAISE NOTICE '  ✓ dvtd_relationships accessible (% rows sampled)', v_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  ✗ dvtd_relationships failed: %', SQLERRM;
    v_passed := FALSE;
  END;

  -- Test data_quality_dashboard
  BEGIN
    SELECT COUNT(*) INTO v_count FROM data_quality_dashboard;
    RAISE NOTICE '  ✓ data_quality_dashboard accessible (% rows)', v_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  ✗ data_quality_dashboard failed: %', SQLERRM;
    v_passed := FALSE;
  END;

  IF v_passed THEN
    RAISE NOTICE '  ✅ TEST PASSED: %', v_test_name;
  ELSE
    RAISE WARNING '  ❌ TEST FAILED: %', v_test_name;
  END IF;
END $$;

-- ============================================================================
-- TEST 5: INDEX EFFECTIVENESS
-- ============================================================================

DO $$
DECLARE
  v_test_name TEXT := 'Index Effectiveness';
  v_passed BOOLEAN := TRUE;
  v_index_count INT;
  v_unused_indexes INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '[TEST 5] %...', v_test_name;

  -- Count indexes on key tables
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN ('lytx_safety_events', 'guardian_events', 'mtdata_trip_history',
                      'captive_payment_records', 'mtdata_captive_correlations');

  RAISE NOTICE '  → Found % indexes on key tables', v_index_count;

  IF v_index_count < 20 THEN
    RAISE WARNING '  ✗ Expected at least 20 indexes, found %', v_index_count;
    v_passed := FALSE;
  ELSE
    RAISE NOTICE '  ✓ Sufficient indexes created';
  END IF;

  -- Check for unused indexes (if pg_stat_user_indexes is available)
  BEGIN
    SELECT COUNT(*) INTO v_unused_indexes
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
      AND idx_scan = 0
      AND indexrelname NOT LIKE 'pg_toast%';

    IF v_unused_indexes > 0 THEN
      RAISE NOTICE '  → Note: % indexes have not been used yet (normal for new deployment)', v_unused_indexes;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  - Index usage statistics not available';
  END;

  IF v_passed THEN
    RAISE NOTICE '  ✅ TEST PASSED: %', v_test_name;
  ELSE
    RAISE WARNING '  ❌ TEST FAILED: %', v_test_name;
  END IF;
END $$;

-- ============================================================================
-- TEST 6: PERFORMANCE BENCHMARK
-- ============================================================================

DO $$
DECLARE
  v_test_name TEXT := 'Performance Benchmark';
  v_passed BOOLEAN := TRUE;
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
  v_duration DECIMAL;
  v_sample_driver_id UUID;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '[TEST 6] %...', v_test_name;

  SELECT id INTO v_sample_driver_id FROM drivers WHERE status = 'Active' LIMIT 1;

  IF v_sample_driver_id IS NOT NULL THEN
    -- Test driver profile query performance
    v_start_time := clock_timestamp();
    PERFORM get_driver_complete_profile(v_sample_driver_id);
    v_end_time := clock_timestamp();
    v_duration := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time));

    RAISE NOTICE '  → get_driver_complete_profile: % ms', ROUND(v_duration, 2);

    IF v_duration > 500 THEN
      RAISE WARNING '  ✗ Query took > 500ms (%.2f ms)', v_duration;
      v_passed := FALSE;
    ELSE
      RAISE NOTICE '  ✓ Query completed in acceptable time';
    END IF;
  ELSE
    RAISE NOTICE '  - No sample driver available for benchmarking';
  END IF;

  IF v_passed THEN
    RAISE NOTICE '  ✅ TEST PASSED: %', v_test_name;
  ELSE
    RAISE WARNING '  ❌ TEST FAILED: % (performance issues)', v_test_name;
  END IF;
END $$;

-- ============================================================================
-- FINAL VALIDATION REPORT
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'VALIDATION COMPLETE';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'VALIDATION SUMMARY:';
  RAISE NOTICE '  Review the test results above';
  RAISE NOTICE '  ✅ = Test passed';
  RAISE NOTICE '  ❌ = Test failed (requires attention)';
  RAISE NOTICE '';
  RAISE NOTICE 'DATA QUALITY METRICS:';
  RAISE NOTICE '  Run: SELECT * FROM data_quality_dashboard;';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  1. Review any failed tests and address issues';
  RAISE NOTICE '  2. Test query functions with production data';
  RAISE NOTICE '  3. Monitor performance in production';
  RAISE NOTICE '  4. Update application code to use new functions';
  RAISE NOTICE '  5. Document any manual steps required';
  RAISE NOTICE '';
  RAISE NOTICE 'QUICK START EXAMPLES:';
  RAISE NOTICE '  -- Get complete driver profile';
  RAISE NOTICE '  SELECT get_driver_complete_profile(''<driver_id>'')::jsonb;';
  RAISE NOTICE '';
  RAISE NOTICE '  -- Search for driver by name';
  RAISE NOTICE '  SELECT * FROM search_driver_by_name(''John'');';
  RAISE NOTICE '';
  RAISE NOTICE '  -- View all events for a driver';
  RAISE NOTICE '  SELECT * FROM unified_event_timeline WHERE driver_id = ''<driver_id>'';';
  RAISE NOTICE '';
  RAISE NOTICE '  -- See trip-delivery-event relationships';
  RAISE NOTICE '  SELECT * FROM dvtd_relationships WHERE trip_date >= CURRENT_DATE - 30;';
  RAISE NOTICE '============================================================================';
END $$;
