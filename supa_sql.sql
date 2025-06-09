-- Updated SQL view definition (using tanks_with_rolling_avg) so that the frontend query (selecting from tanks_with_rolling_avg) works.
DROP VIEW IF EXISTS public.tanks_with_rolling_avg;
CREATE OR REPLACE VIEW public.tanks_with_rolling_avg AS
WITH daily_diff AS (
  SELECT
    t.id,
    rw.created_at,
    rw.value,
    (rw.value - LEAD(rw.value) OVER (PARTITION BY t.id ORDER BY rw.created_at DESC)) AS daily_diff
  FROM fuel_tanks t
  LEFT JOIN LATERAL (
    SELECT *
    FROM dip_readings
    WHERE tank_id = t.id AND created_at >= now() - interval '7 days'
  ) rw ON true
),
avg_diff AS (
  SELECT
    id,
    AVG(CASE WHEN daily_diff IS NULL THEN 0 ELSE daily_diff END) AS avg_diff
  FROM daily_diff
  GROUP BY id
)
SELECT
  t.id,
  t.location,
  t.product_type AS product,
  t.safe_level AS safe_fill,
  tg.id AS group_id,
  tg.name AS group_name,
  dr.value AS current_level,
  CASE WHEN t.safe_level > 0 THEN ROUND(dr.value / t.safe_level, 3) ELSE 0 END AS current_level_percent,
  -- 7-day rolling burn-rate (neg means refill ↑) (computed via a subquery)
  ROUND(avg.avg_diff, 1) AS rolling_avg_lpd,
  CASE
    WHEN avg.avg_diff = 0 THEN NULL
    ELSE ROUND(dr.value / ABS(avg.avg_diff), 1)
  END AS days_to_min_level,
  dr.created_at AS last_dip_ts
FROM fuel_tanks t
JOIN tank_groups tg ON tg.id = t.group_id
JOIN LATERAL (
   SELECT value, created_at
   FROM dip_readings
   WHERE tank_id = t.id
   ORDER BY created_at DESC
   LIMIT 1
) dr ON true
LEFT JOIN avg_diff avg ON avg.id = t.id; 