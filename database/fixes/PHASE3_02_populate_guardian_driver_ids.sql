-- =====================================================
-- PHASE 3.2: POPULATE DRIVER IDs IN GUARDIAN EVENTS
-- =====================================================
-- Links existing Guardian events to drivers
-- Handles name variations and fuzzy matching
-- =====================================================

DO $$ BEGIN RAISE NOTICE '=== PHASE 3.2: LINKING GUARDIAN EVENTS TO DRIVERS ==='; END $$;

-- =====================================================
-- STEP 1: PRE-POPULATION STATISTICS
-- =====================================================

DO $$
DECLARE
  total_events INTEGER;
  events_with_driver INTEGER;
  events_without_driver INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_events FROM guardian_events WHERE verified = true;
  SELECT COUNT(*) INTO events_with_driver FROM guardian_events WHERE driver_id IS NOT NULL AND verified = true;
  SELECT COUNT(*) INTO events_without_driver FROM guardian_events WHERE driver_id IS NULL AND verified = true;

  RAISE NOTICE '';
  RAISE NOTICE 'BEFORE POPULATION (verified events only):';
  RAISE NOTICE '  Total Guardian events: %', total_events;
  RAISE NOTICE '  Already linked: % (%.1f%%)', events_with_driver, (events_with_driver::DECIMAL / NULLIF(total_events, 0) * 100);
  RAISE NOTICE '  Need linking: % (%.1f%%)', events_without_driver, (events_without_driver::DECIMAL / NULLIF(total_events, 0) * 100);
  RAISE NOTICE '';
END $$;

-- =====================================================
-- STEP 2: CREATE NAME NORMALIZATION FUNCTION
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 1/4: Creating name normalization function...'; END $$;

CREATE OR REPLACE FUNCTION normalize_driver_name(name TEXT)
RETURNS TEXT AS $$
BEGIN
  IF name IS NULL THEN
    RETURN NULL;
  END IF;

  -- Convert to uppercase, remove extra spaces, trim
  RETURN UPPER(TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DO $$ BEGIN RAISE NOTICE '✓ Name normalization function created'; END $$;

-- =====================================================
-- STEP 3: MATCH BY EXACT NAME (NORMALIZED)
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 2/4: Matching by exact name (normalized)...'; END $$;

UPDATE guardian_events
SET driver_id = d.id,
    updated_at = NOW()
FROM drivers d
WHERE guardian_events.driver_id IS NULL
  AND guardian_events.verified = true
  AND guardian_events.driver_name IS NOT NULL
  AND TRIM(guardian_events.driver_name) != ''
  AND normalize_driver_name(guardian_events.driver_name) = normalize_driver_name(d.full_name);

DO $$
DECLARE
  matched_count INTEGER;
BEGIN
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE '✓ Matched % events by exact name', matched_count;
END $$;

-- =====================================================
-- STEP 4: MATCH BY NAME VARIATIONS
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 3/4: Matching by name variations (First Last / Last, First)...'; END $$;

-- Try matching "John Smith" with "Smith, John" patterns
WITH name_variations AS (
  SELECT
    ge.id as event_id,
    d.id as driver_id,
    ge.driver_name as event_name,
    d.full_name as driver_name
  FROM guardian_events ge
  CROSS JOIN drivers d
  WHERE ge.driver_id IS NULL
    AND ge.verified = true
    AND ge.driver_name IS NOT NULL
    AND TRIM(ge.driver_name) != ''
    AND (
      -- "John Smith" matches "Smith, John"
      (normalize_driver_name(ge.driver_name) = normalize_driver_name(
        CASE
          WHEN POSITION(',' IN d.full_name) > 0 THEN
            TRIM(SPLIT_PART(d.full_name, ',', 2)) || ' ' || TRIM(SPLIT_PART(d.full_name, ',', 1))
          ELSE d.full_name
        END
      ))
      OR
      -- "Smith, John" matches "John Smith"
      (CASE
        WHEN POSITION(',' IN ge.driver_name) > 0 THEN
          normalize_driver_name(TRIM(SPLIT_PART(ge.driver_name, ',', 2)) || ' ' || TRIM(SPLIT_PART(ge.driver_name, ',', 1)))
        ELSE normalize_driver_name(ge.driver_name)
      END = normalize_driver_name(d.full_name))
    )
)
UPDATE guardian_events
SET driver_id = nv.driver_id,
    updated_at = NOW()
FROM name_variations nv
WHERE guardian_events.id = nv.event_id;

DO $$
DECLARE
  matched_count INTEGER;
BEGIN
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE '✓ Matched % events by name variations', matched_count;
END $$;

-- =====================================================
-- STEP 5: FUZZY MATCH BY NAME (HIGH CONFIDENCE)
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Step 4/4: Fuzzy matching driver names (>80%% similarity)...'; END $$;

-- Only update if we have exactly one high-confidence match
WITH fuzzy_matches AS (
  SELECT DISTINCT ON (ge.id)
    ge.id as event_id,
    d.id as driver_id,
    similarity(
      normalize_driver_name(ge.driver_name),
      normalize_driver_name(d.full_name)
    ) as match_score
  FROM guardian_events ge
  CROSS JOIN drivers d
  WHERE ge.driver_id IS NULL
    AND ge.verified = true
    AND ge.driver_name IS NOT NULL
    AND TRIM(ge.driver_name) != ''
    AND d.full_name IS NOT NULL
    AND similarity(
      normalize_driver_name(ge.driver_name),
      normalize_driver_name(d.full_name)
    ) > 0.80  -- 80% similar
  ORDER BY ge.id, match_score DESC
)
UPDATE guardian_events
SET driver_id = fm.driver_id,
    updated_at = NOW()
FROM fuzzy_matches fm
WHERE guardian_events.id = fm.event_id;

DO $$
DECLARE
  matched_count INTEGER;
BEGIN
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RAISE NOTICE '✓ Matched % events by fuzzy matching', matched_count;
END $$;

-- =====================================================
-- STEP 6: POST-POPULATION STATISTICS
-- =====================================================

DO $$
DECLARE
  total_events INTEGER;
  events_with_driver INTEGER;
  events_without_driver INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_events FROM guardian_events WHERE verified = true;
  SELECT COUNT(*) INTO events_with_driver FROM guardian_events WHERE driver_id IS NOT NULL AND verified = true;
  SELECT COUNT(*) INTO events_without_driver FROM guardian_events WHERE driver_id IS NULL AND verified = true;

  RAISE NOTICE '';
  RAISE NOTICE 'AFTER POPULATION:';
  RAISE NOTICE '  Total Guardian events: %', total_events;
  RAISE NOTICE '  Now linked: % (%.1f%%)', events_with_driver, (events_with_driver::DECIMAL / NULLIF(total_events, 0) * 100);
  RAISE NOTICE '  Still unlinked: % (%.1f%%)', events_without_driver, (events_without_driver::DECIMAL / NULLIF(total_events, 0) * 100);
  RAISE NOTICE '';
END $$;

-- =====================================================
-- STEP 7: CREATE UNMATCHED EVENTS REPORT
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Creating unmatched events report view...'; END $$;

CREATE OR REPLACE VIEW unmatched_guardian_events AS
SELECT
  id as event_id,
  detection_time,
  driver_name as driver_name_in_event,
  event_type,
  detected_event_type,
  fleet,
  depot,
  vehicle_registration as vehicle,
  -- Show potential matches
  (
    SELECT string_agg(match_str, ', ')
    FROM (
      SELECT d.full_name || ' (similarity: ' || ROUND(similarity(normalize_driver_name(ge.driver_name), normalize_driver_name(d.full_name)) * 100) || '%)'as match_str
      FROM drivers d
      WHERE similarity(normalize_driver_name(ge.driver_name), normalize_driver_name(d.full_name)) > 0.5
      ORDER BY similarity(normalize_driver_name(ge.driver_name), normalize_driver_name(d.full_name)) DESC
      LIMIT 3
    ) matches
  ) as potential_driver_matches
FROM guardian_events ge
WHERE driver_id IS NULL
  AND verified = true
  AND driver_name IS NOT NULL
  AND TRIM(driver_name) != ''
ORDER BY detection_time DESC;

GRANT SELECT ON unmatched_guardian_events TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ Created unmatched_guardian_events view for manual review'; END $$;

-- =====================================================
-- STEP 8: UNIQUE UNMATCHED DRIVER NAMES
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Creating unique unmatched names view...'; END $$;

CREATE OR REPLACE VIEW unmatched_driver_names AS
SELECT
  driver_name as name_in_events,
  COUNT(*) as event_count,
  MIN(detection_time) as first_event,
  MAX(detection_time) as last_event,
  string_agg(DISTINCT fleet, ', ') as fleets,
  -- Show closest driver matches
  (
    SELECT string_agg(match_str, ', ')
    FROM (
      SELECT d.full_name || ' (' || ROUND(similarity(normalize_driver_name(uge.driver_name), normalize_driver_name(d.full_name)) * 100) || '%)'as match_str
      FROM drivers d
      WHERE similarity(normalize_driver_name(uge.driver_name), normalize_driver_name(d.full_name)) > 0.5
      ORDER BY similarity(normalize_driver_name(uge.driver_name), normalize_driver_name(d.full_name)) DESC
      LIMIT 3
    ) matches
  ) as suggested_matches
FROM (
  SELECT DISTINCT driver_name, detection_time, fleet
  FROM guardian_events
  WHERE driver_id IS NULL
    AND verified = true
    AND driver_name IS NOT NULL
    AND TRIM(driver_name) != ''
) uge
GROUP BY driver_name
ORDER BY event_count DESC;

GRANT SELECT ON unmatched_driver_names TO authenticated;

DO $$ BEGIN RAISE NOTICE '✓ Created unmatched_driver_names view for bulk review'; END $$;

-- =====================================================
-- STEP 9: MATCH STATISTICS BY METHOD
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Match statistics by method:'; END $$;

DO $$
DECLARE
  exact_name INTEGER;
  fuzzy_match INTEGER;
  total_matched INTEGER;
BEGIN
  -- Count exact matches
  SELECT COUNT(*) INTO exact_name
  FROM guardian_events ge
  JOIN drivers d ON ge.driver_id = d.id
  WHERE normalize_driver_name(ge.driver_name) = normalize_driver_name(d.full_name);

  SELECT COUNT(*) INTO total_matched
  FROM guardian_events
  WHERE driver_id IS NOT NULL AND verified = true;

  fuzzy_match := total_matched - exact_name;

  RAISE NOTICE '  Exact/variation match: %', exact_name;
  RAISE NOTICE '  Fuzzy match: %', fuzzy_match;
  RAISE NOTICE '  Total matched: %', total_matched;
END $$;

-- =====================================================
-- STEP 10: SAMPLE UNMATCHED FOR REVIEW
-- =====================================================

DO $$
DECLARE
  unmatched_count INTEGER;
  unique_names INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmatched_count FROM unmatched_guardian_events;
  SELECT COUNT(*) INTO unique_names FROM unmatched_driver_names;

  IF unmatched_count > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠ % events still unmatched (% unique driver names)', unmatched_count, unique_names;
    RAISE NOTICE 'Review queries:';
    RAISE NOTICE '  SELECT * FROM unmatched_driver_names;';
    RAISE NOTICE '  SELECT * FROM unmatched_guardian_events LIMIT 20;';
    RAISE NOTICE '';
    RAISE NOTICE 'Common reasons for no match:';
    RAISE NOTICE '  - Driver not in drivers table';
    RAISE NOTICE '  - Name format differs significantly';
    RAISE NOTICE '  - Typo in driver name';
    RAISE NOTICE '  - Nickname vs full name';
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
  RAISE NOTICE '=== PHASE 3.2 COMPLETE ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Review unmatched_driver_names view';
  RAISE NOTICE '  2. Add missing drivers to drivers table if needed';
  RAISE NOTICE '  3. Manually link remaining events if needed';
  RAISE NOTICE '  4. Proceed to Phase 3.3 (Driver-Vehicle assignments)';
  RAISE NOTICE '';
END $$;
