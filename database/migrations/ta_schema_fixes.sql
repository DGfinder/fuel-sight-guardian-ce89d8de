-- TankAlert Schema Fixes
-- Run these in Supabase SQL Editor

-- ============================================
-- FIX 1: Update ta_tanks.current_level_liters from latest dip readings
-- ============================================

UPDATE ta_tanks t
SET
    current_level_liters = sub.level_liters,
    current_level_datetime = sub.measured_at,
    current_level_source = 'dip'
FROM (
    SELECT DISTINCT ON (tank_id)
        tank_id, level_liters, measured_at
    FROM ta_tank_dips
    WHERE archived_at IS NULL
    ORDER BY tank_id, measured_at DESC
) sub
WHERE t.id = sub.tank_id;

-- Verify the fix
SELECT
    COUNT(*) FILTER (WHERE current_level_liters > 0) as tanks_with_levels,
    COUNT(*) FILTER (WHERE current_level_liters = 0 OR current_level_liters IS NULL) as tanks_without_levels,
    COUNT(*) as total_tanks
FROM ta_tanks;

-- ============================================
-- FIX 2: Identified 14 duplicate IDs between ta_groups and ta_subgroups
-- ============================================

-- These 14 IDs exist in BOTH ta_groups AND ta_subgroups:
-- They are subgroups that were incorrectly also added as parent groups.
--
-- Duplicates found:
-- 1. 81905dc4-2a69-4881-8ac1-926bf22b593c (GSFS Albany)
-- 2. 134ecb21-f161-4c97-9360-933cd8199e71 (GSFS Lake Grace)
-- 3. 6ed5c860-7228-4c97-b1db-a5ec61b3ca34 (GSFS Narrogin)
-- 4. 85ed0cf0-f086-48ec-ba2f-7f022fc7e8c9 (GSFS Koorda)
-- 5. a060ee24-b58f-4502-827a-00abcc66c9ae (GSFS Carnamah)
-- 6. 1597be79-3027-4ab3-8cda-58079fc408f4 (GSFS Quairading)
-- 7. e4ee11d8-4df4-4e37-af3a-cb8b2ebfe570 (Goldfields GSM)
-- 8. 49542adf-e0ca-4770-a332-2c57c3c0f783 (Goldfields Agnew)
-- 9. c84025be-9bb5-4caa-8969-1cd2face3d8c (Goldfields St Ives)
-- 10. 659686a0-02c5-413a-9631-d9f406ff2b22 (NSR Carosue)
-- 11. b7fca08f-20fb-46eb-bc7a-07f9afe7979f (Silverlake)
-- 12. 0c0f0ed2-6b14-4de0-ba3d-e385dcd44152 (Koth-Darlot)
-- 13. f2d92f7f-23ec-480f-8289-dcf48124b6d5 (Westgold)
-- 14. 940a79fb-e67d-4e0b-94e7-3b9bbfc09dac (Evolution)

-- Verify duplicates (should return 14 rows)
SELECT
    g.id,
    g.name as group_name,
    s.name as subgroup_name,
    s.group_id as parent_group_id,
    'DUPLICATE - exists in both tables' as issue
FROM ta_groups g
INNER JOIN ta_subgroups s ON g.id = s.id;

-- ============================================
-- FIX 3: Remove subgroup entries from ta_groups
-- These should only exist in ta_subgroups, not ta_groups
-- ============================================

-- TRUE parent groups that should REMAIN in ta_groups (6 total):
-- - 50dd5eea-4865-47b8-b6dd-1980da0bb9f7 (Swan Transit)
-- - 6196e0e9-00dd-4534-aaf4-39c681a8621a (Kalgoorlie)
-- - e8ac6e24-a001-454e-9e28-e42cc81c9167 (Geraldton)
-- - f3294c61-e731-4aa2-9e10-e21697974d87 (GSF Depots)
-- - adb9c45a-c73c-4109-8ff4-aac6b858230d (BGC)
-- - ed8257ae-d703-4dae-b189-3301c0c508d2 (Geraldton Linehaul)

-- Delete the 14 duplicates from ta_groups
DELETE FROM ta_groups
WHERE id IN (
    '81905dc4-2a69-4881-8ac1-926bf22b593c',
    '134ecb21-f161-4c97-9360-933cd8199e71',
    '6ed5c860-7228-4c97-b1db-a5ec61b3ca34',
    '85ed0cf0-f086-48ec-ba2f-7f022fc7e8c9',
    'a060ee24-b58f-4502-827a-00abcc66c9ae',
    '1597be79-3027-4ab3-8cda-58079fc408f4',
    'e4ee11d8-4df4-4e37-af3a-cb8b2ebfe570',
    '49542adf-e0ca-4770-a332-2c57c3c0f783',
    'c84025be-9bb5-4caa-8969-1cd2face3d8c',
    '659686a0-02c5-413a-9631-d9f406ff2b22',
    'b7fca08f-20fb-46eb-bc7a-07f9afe7979f',
    '0c0f0ed2-6b14-4de0-ba3d-e385dcd44152',
    'f2d92f7f-23ec-480f-8289-dcf48124b6d5',
    '940a79fb-e67d-4e0b-94e7-3b9bbfc09dac'
);

-- ============================================
-- FIX 3b: Additional orphaned entries in ta_groups
-- These appear to be subgroups but have different UUIDs
-- ============================================

-- Items in ta_groups that look like subgroups (GSFS prefix) but aren't duplicates:
-- These may need to be moved to ta_subgroups with proper group_id
SELECT id, name, 'Possible orphaned subgroup in ta_groups' as issue
FROM ta_groups
WHERE name LIKE 'GSFS%' OR name LIKE 'NSR%' OR name = 'Genesis' OR name = 'BHP MinOps'
ORDER BY name;

-- After reviewing, consider deleting these orphaned entries too:
-- (Uncomment after verification)
/*
DELETE FROM ta_groups
WHERE id IN (
    '3cfef119-dbed-424f-a701-601a79020845',  -- Genesis (also in subgroups with different ID)
    '6c632232-39ed-46cc-96c6-a487be2ebe3a',  -- NSR (also in subgroups with different ID)
    'a01b00c4-3bc2-4ddf-992d-3a1462e9b692',  -- GSFS-Others (also in subgroups with different ID)
    '7aff6cde-a05e-4b1e-9210-507538851682',  -- NSR Thunderbox Bronzewing (also in subgroups with different ID)
    '22dab885-c129-413a-8837-004ca1845e61',  -- BHP MinOps (needs review)
    'abad75a1-3193-448a-a205-535e5b3357a0',  -- GSFS Katanning (also in subgroups with different ID)
    'c45403e3-7f69-464e-9efa-f240b8236c3c',  -- GSFS Moora (also in subgroups with different ID)
    'e00541f6-a452-4f84-8909-056b9b530cb5',  -- GSFS Wongan Hills (also in subgroups with different ID)
    '8b6dde41-9195-4dd2-b880-9d495da3534a',  -- GSFS Merredin (also in subgroups with different ID)
    '15b5083c-aa16-4b0d-bd78-2fe2d9443a9d',  -- GSFS Jerramungup (also in subgroups with different ID)
    '20a744c0-9616-42f1-b860-1876c4a7f037'   -- GSFS Corrigin (also in subgroups with different ID)
);
*/

-- ============================================
-- FIX 4: Verify proper parent groups remain
-- ============================================

-- These should be the only parent groups after cleanup:
-- Swan Transit, BGC, GSF Depots, Kalgoorlie, Geraldton, Geraldton Linehaul
SELECT id, name, 'Parent Group' as type
FROM ta_groups
WHERE id NOT IN (SELECT id FROM ta_subgroups)
ORDER BY name;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check tank hierarchy
SELECT
    b.name as business,
    g.name as group_name,
    s.name as subgroup_name,
    COUNT(t.id) as tank_count
FROM ta_tanks t
JOIN ta_businesses b ON t.business_id = b.id
LEFT JOIN ta_groups g ON t.group_id = g.id
LEFT JOIN ta_subgroups s ON t.subgroup_id = s.id
GROUP BY b.name, g.name, s.name
ORDER BY b.name, g.name, s.name;

-- Check tanks with current levels
SELECT
    name,
    current_level_liters,
    current_level_datetime,
    capacity_liters,
    ROUND((current_level_liters / NULLIF(capacity_liters, 0) * 100)::numeric, 1) as fill_percent
FROM ta_tanks
WHERE current_level_liters > 0
ORDER BY current_level_datetime DESC
LIMIT 20;
