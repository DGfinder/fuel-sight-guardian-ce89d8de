-- Check which schema has recent AgBot data
-- Run this in Supabase SQL Editor

SELECT
  'public' as schema_name,
  COUNT(*) as total_locations,
  MAX(updated_at) as last_updated,
  COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '1 hour') as updated_last_hour
FROM public.ta_agbot_locations

UNION ALL

SELECT
  'great_southern_fuels' as schema_name,
  COUNT(*) as total_locations,
  MAX(updated_at) as last_updated,
  COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '1 hour') as updated_last_hour
FROM great_southern_fuels.ta_agbot_locations;

-- This will show:
-- - Which schema has more locations
-- - Which one was updated most recently
-- - Which one received updates in the last hour
--
-- The active schema will have recent updates!
