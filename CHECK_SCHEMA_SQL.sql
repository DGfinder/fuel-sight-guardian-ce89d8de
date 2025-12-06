-- Query 1: Check if great_southern_fuels schema exists
-- Run this first
SELECT
  schema_name,
  schema_owner
FROM information_schema.schemata
WHERE schema_name = 'great_southern_fuels';

-- Expected result: 1 row with schema_name = 'great_southern_fuels'
-- If NO rows returned, the schema DOES NOT EXIST!


-- Query 2: Check how many tables are in the schema
-- Run this second (in a new query)
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'great_southern_fuels';

-- Expected result: Should show a number > 0
-- If 0, the schema exists but is empty!


-- Query 3: List all schemas that exist
-- Run this third to see what schemas you actually have
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT LIKE 'pg_%'
  AND schema_name != 'information_schema'
ORDER BY schema_name;

-- This shows all your custom schemas
