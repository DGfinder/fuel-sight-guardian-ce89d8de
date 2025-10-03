-- =====================================================
-- Unified Driver Profile RPC
-- Aggregates LYTX, Guardian, and MtData for a given driver UUID
-- with vehicle-based and name-based fallbacks
-- =====================================================

BEGIN;

DROP FUNCTION IF EXISTS get_unified_driver_profile(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_unified_driver_profile(
    p_driver_id UUID,
    p_days_back INTEGER DEFAULT 180
) RETURNS JSON AS $$
DECLARE
    v_from TIMESTAMPTZ := NOW() - (p_days_back || ' days')::INTERVAL;
    v_to   TIMESTAMPTZ := NOW();

    v_first_name TEXT;
    v_last_name  TEXT;
    v_full_name  TEXT;

    result JSON;
BEGIN
    -- Driver basics
    SELECT first_name, last_name, (first_name || ' ' || last_name)
    INTO v_first_name, v_last_name, v_full_name
    FROM drivers
    WHERE id = p_driver_id;

    IF v_first_name IS NULL THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Driver not found',
            'driver_id', p_driver_id
        );
    END IF;

    -- LYTX via enriched view (resolved_driver_id)
    WITH lytx AS (
        SELECT 
            COUNT(*)                          AS total_events,
            MIN(event_datetime)               AS earliest,
            MAX(event_datetime)               AS latest,
            ROUND(AVG(NULLIF(score, 0)), 2)  AS avg_score
        FROM lytx_events_driver_enriched
        WHERE resolved_driver_id = p_driver_id
          AND event_datetime BETWEEN v_from AND v_to
    ),
    -- MtData by foreign key plus basic aggregates
    mt AS (
        SELECT 
            COUNT(*)                    AS total_trips,
            COALESCE(SUM(distance_km),0)       AS total_km,
            COALESCE(SUM(travel_time_hours),0) AS total_hours,
            MIN(start_time)              AS earliest,
            MAX(start_time)              AS latest
        FROM mtdata_trip_history
        WHERE driver_id = p_driver_id
          AND start_time BETWEEN v_from AND v_to
    ),
    -- Vehicles driven by this driver (by FK only)
    vehicles_driven AS (
        SELECT DISTINCT vehicle_registration
        FROM mtdata_trip_history
        WHERE driver_id = p_driver_id
          AND start_time BETWEEN v_from AND v_to
    ),
    -- Build driver vehicle-day tuples from MtData and LYTX (vehicle present)
    driver_vehicle_days AS (
        SELECT
            mth.vehicle_registration,
            (mth.start_time::date) AS day
        FROM mtdata_trip_history mth
        WHERE mth.driver_id = p_driver_id
          AND mth.start_time BETWEEN v_from AND v_to
          AND mth.vehicle_registration IS NOT NULL
        UNION
        SELECT
            lse.vehicle_registration,
            (lse.event_datetime::date) AS day
        FROM lytx_safety_events lse
        WHERE lse.driver_id = p_driver_id
          AND lse.event_datetime BETWEEN v_from AND v_to
          AND lse.vehicle_registration IS NOT NULL
    ),
    -- Guardian by FK if present (ids)
    guardian_fk_ids AS (
        SELECT ge.id
        FROM guardian_events ge
        WHERE ge.driver_id = p_driver_id
          AND ge.detection_time BETWEEN v_from AND v_to
    ),
    -- Guardian matched by vehicle and same day (ids)
    guardian_by_vehicle_day_ids AS (
        SELECT ge.id
        FROM guardian_events ge
        WHERE ge.detection_time BETWEEN v_from AND v_to
          AND EXISTS (
            SELECT 1
            FROM driver_vehicle_days dvd
            WHERE dvd.vehicle_registration = ge.vehicle_registration
              AND dvd.day = ge.detection_time::date
          )
    ),
    guardian_counts AS (
        SELECT
          (SELECT COUNT(*) FROM guardian_fk_ids)                AS events_fk,
          (SELECT COUNT(*) FROM guardian_by_vehicle_day_ids)    AS events_by_vehicle_day,
          (
            SELECT COUNT(DISTINCT id)
            FROM (
              SELECT id FROM guardian_fk_ids
              UNION ALL
              SELECT id FROM guardian_by_vehicle_day_ids
            ) u
          ) AS total_events
    )
    SELECT json_build_object(
        'success', TRUE,
        'driver', json_build_object(
            'id', p_driver_id,
            'first_name', v_first_name,
            'last_name', v_last_name
        ),
        'date_range', json_build_object('from', v_from, 'to', v_to),
        'lytx', json_build_object(
            'total_events', COALESCE((SELECT total_events FROM lytx), 0),
            'avg_score',    COALESCE((SELECT avg_score FROM lytx), 0),
            'earliest',     (SELECT earliest FROM lytx),
            'latest',       (SELECT latest FROM lytx)
        ),
        'mtdata', json_build_object(
            'total_trips', COALESCE((SELECT total_trips FROM mt), 0),
            'total_km',    COALESCE((SELECT total_km FROM mt), 0),
            'total_hours', COALESCE((SELECT total_hours FROM mt), 0),
            'earliest',    (SELECT earliest FROM mt),
            'latest',      (SELECT latest FROM mt)
        ),
        'guardian', (
            SELECT json_build_object(
              'events_fk', COALESCE(gc.events_fk, 0),
              'events_by_vehicle_day', COALESCE(gc.events_by_vehicle_day, 0),
              'total_events', COALESCE(gc.total_events, 0)
            )
            FROM guardian_counts gc
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_unified_driver_profile(UUID, INTEGER) TO authenticated;

COMMIT;


