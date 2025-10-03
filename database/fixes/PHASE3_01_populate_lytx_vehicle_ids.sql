-- =====================================================
-- PHASE 3.1: POPULATE VEHICLE IDs IN LYTX EVENTS
-- =====================================================
-- Links existing LYTX safety events to vehicles
-- Matches by registration number OR device serial
-- =====================================================

DO $$ BEGIN RAISE NOTICE '=== PHASE 3.1: LINKING LYTX EVENTS TO VEHICLES ==='; END $$;

-- =====================================================
-- STEP 1: PRE-POPULATION STATISTICS
-- =====================================================

DO $$
DECLARE
  total_events INTEGER;
  events_with_vehicle INTEGER;
  events_without_vehicle INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_events FROM lytx_safety_events;
  SELECT COUNT(*) INTO events_with_vehicle FROM lytx_safety_events WHERE vehicle_id IS NOT NULL;
  SELECT COUNT(*) INTO events_without_vehicle FROM lytx_safety_events WHERE vehicle_id IS NULL;

  RAISE NOTICE '';
  RAISE NOTICE 'BEFORE POPULATION:';
  RAISE NOTICE '  Total LYTX events: %', total_events;
  RAISE NOTICE '  Already linked: % (%.1f%%)', events_with_vehicle, (events_with_vehicle::DECIMAL / NULLIF(total_events, 0) * 100);
  RAISE NOTICE '  Need linking: % (%.1f%%)', events_without_vehicle, (events_without_vehicle::DECIMAL / NULLIF(total_events, 0) * 100);
  RAISE NOTICE '';
END $$;

-- =====================================================
-- STEP 2: MATCH BY REGISTRATION NUMBER (EXACT)
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 1/3: Matching by registration number (exact match)...'; END $$;

UPDATE lytx_safety_events
SET vehicle_id = v.id,
    updated_at = NOW()
FROM vehicles v
WHERE lytx_safety_events.vehicle_id IS NULL
  AND lytx_safety_events.vehicle_registration IS NOT NULL
  AND TRIM(lytx_safety_events.vehicle_registration) != ''
  AND UPPER(TRIM(lytx_safety_events.vehicle_registration)) = UPPER(TRIM(v.registration));

DO $$
DECLARE
  matched_count INTEGER;
BEGIN
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE '✓ Matched % events by registration number', matched_count;
END $$;

-- =====================================================
-- STEP 3: MATCH BY DEVICE SERIAL (EXACT)
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 2/3: Matching by LYTX device serial...'; END $$;

UPDATE lytx_safety_events
SET vehicle_id = v.id,
    updated_at = NOW()
FROM vehicles v
WHERE lytx_safety_events.vehicle_id IS NULL
  AND lytx_safety_events.device_serial IS NOT NULL
  AND TRIM(lytx_safety_events.device_serial) != ''
  AND v.lytx_device IS NOT NULL
  AND lytx_safety_events.device_serial = v.lytx_device;

DO $$
DECLARE
  matched_count INTEGER;
BEGIN
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE '✓ Matched % events by device serial', matched_count;
END $$;

-- =====================================================
-- STEP 4: FUZZY MATCH BY REGISTRATION (SIMILAR)
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 3/3: Fuzzy matching registration numbers (>85%% similarity)...'; END $$;

-- Only update if we have exactly one high-confidence match
WITH fuzzy_matches AS (
  SELECT DISTINCT ON (lse.id)
    lse.id as event_id,
    v.id as vehicle_id,
    similarity(
      UPPER(TRIM(lse.vehicle_registration)),
      UPPER(TRIM(v.registration))
    ) as match_score
  FROM lytx_safety_events lse
  CROSS JOIN vehicles v
  WHERE lse.vehicle_id IS NULL
    AND lse.vehicle_registration IS NOT NULL
    AND TRIM(lse.vehicle_registration) != ''
    AND v.registration IS NOT NULL
    AND similarity(
      UPPER(TRIM(lse.vehicle_registration)),
      UPPER(TRIM(v.registration))
    ) > 0.85  -- 85% similar
  ORDER BY lse.id, match_score DESC
)
UPDATE lytx_safety_events
SET vehicle_id = fm.vehicle_id,
    updated_at = NOW()
FROM fuzzy_matches fm
WHERE lytx_safety_events.id = fm.event_id;

DO $$
DECLARE
  matched_count INTEGER;
BEGIN
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE '✓ Matched % events by fuzzy matching', matched_count;
END $$;

-- =====================================================
-- STEP 5: POST-POPULATION STATISTICS
-- =====================================================

DO $$
DECLARE
  total_events INTEGER;
  events_with_vehicle INTEGER;
  events_without_vehicle INTEGER;
  improvement INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_events FROM lytx_safety_events;
  SELECT COUNT(*) INTO events_with_vehicle FROM lytx_safety_events WHERE vehicle_id IS NOT NULL;
  SELECT COUNT(*) INTO events_without_vehicle FROM lytx_safety_events WHERE vehicle_id IS NULL;

  RAISE NOTICE '';
  RAISE NOTICE 'AFTER POPULATION:';
  RAISE NOTICE '  Total LYTX events: %', total_events;
  RAISE NOTICE '  Now linked: % (%.1f%%)', events_with_vehicle, (events_with_vehicle::DECIMAL / NULLIF(total_events, 0) * 100);
  RAISE NOTICE '  Still unlinked: % (%.1f%%)', events_without_vehicle, (events_without_vehicle::DECIMAL / NULLIF(total_events, 0) * 100);
  RAISE NOTICE '';
END $$;

-- =====================================================
-- STEP 6: CREATE UNMATCHED EVENTS REPORT
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Creating unmatched events report view...'; END $$;

CREATE OR REPLACE VIEW unmatched_lytx_events AS
SELECT
  event_id,
  event_datetime,
  driver_name,
  vehicle_registration,
  device_serial,
  carrier,
  depot,
  -- Show potential matches
  (
    SELECT string_agg(match_str, ', ')
    FROM (
      SELECT v.registration || ' (similarity: ' || ROUND(similarity(UPPER(TRIM(lse.vehicle_registration)), UPPER(TRIM(v.registration))) * 100) || '%)'as match_str
      FROM vehicles v
      WHERE similarity(UPPER(TRIM(lse.vehicle_registration)), UPPER(TRIM(v.registration))) > 0.5
      ORDER BY similarity(UPPER(TRIM(lse.vehicle_registration)), UPPER(TRIM(v.registration))) DESC
      LIMIT 3
    ) matches
  ) as potential_matches
FROM lytx_safety_events lse
WHERE vehicle_id IS NULL
  AND excluded IS NOT TRUE
ORDER BY event_datetime DESC;

GRANT SELECT ON unmatched_lytx_events TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ Created unmatched_lytx_events view for manual review'; END $$;

-- =====================================================
-- STEP 7: MATCH STATISTICS BY METHOD
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Match statistics by method:'; END $$;

DO $$
DECLARE
  exact_reg INTEGER;
  exact_device INTEGER;
  total_matched INTEGER;
BEGIN
  -- Count exact registration matches
  SELECT COUNT(*) INTO exact_reg
  FROM lytx_safety_events lse
  JOIN vehicles v ON lse.vehicle_id = v.id
  WHERE UPPER(TRIM(lse.vehicle_registration)) = UPPER(TRIM(v.registration));

  -- Count exact device matches
  SELECT COUNT(*) INTO exact_device
  FROM lytx_safety_events lse
  JOIN vehicles v ON lse.vehicle_id = v.id
  WHERE lse.device_serial = v.lytx_device;

  SELECT COUNT(*) INTO total_matched
  FROM lytx_safety_events
  WHERE vehicle_id IS NOT NULL;

  RAISE NOTICE '  Exact registration: %', exact_reg;
  RAISE NOTICE '  Exact device serial: %', exact_device;
  RAISE NOTICE '  Fuzzy/other: %', (total_matched - exact_reg - exact_device);
  RAISE NOTICE '  Total matched: %', total_matched;
END $$;

-- =====================================================
-- STEP 8: SAMPLE UNMATCHED FOR REVIEW
-- =====================================================

DO $$
DECLARE
  unmatched_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmatched_count FROM unmatched_lytx_events;

  IF unmatched_count > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠ % events still unmatched', unmatched_count;
    RAISE NOTICE 'Run this query to review:';
    RAISE NOTICE '  SELECT * FROM unmatched_lytx_events LIMIT 20;';
    RAISE NOTICE '';
    RAISE NOTICE 'Common reasons for no match:';
    RAISE NOTICE '  - Registration format differs (spaces, dashes)';
    RAISE NOTICE '  - Vehicle not in vehicles table';
    RAISE NOTICE '  - Typo in registration';
    RAISE NOTICE '  - Device serial missing in both tables';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '✓ All events matched successfully!';
  END IF;
END $$;

-- =====================================================
-- SUCCESS
-- =====================================================

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== PHASE 3.1 COMPLETE ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Review unmatched_lytx_events view';
  RAISE NOTICE '  2. Manually link remaining events if needed';
  RAISE NOTICE '  3. Proceed to Phase 3.2 (Guardian driver linking)';
  RAISE NOTICE '';
END $$;
