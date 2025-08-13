-- Archive the Joondalup tank that no longer receives dips
-- Migration: archive_joondalup_tank.sql

-- Find and archive the Joondalup tank(s)
-- This will update any tank with 'joondalup' in the location name to archived status

UPDATE fuel_tanks 
SET status = 'archived',
    updated_at = NOW()
WHERE LOWER(location) LIKE '%joondalup%';

-- Log the action for verification
SELECT 
    'Tanks archived' as action,
    id,
    location,
    group_id,
    status
FROM fuel_tanks 
WHERE LOWER(location) LIKE '%joondalup%';

-- Optional: Show BGC tanks for context
SELECT 
    'BGC tanks (for context)' as info,
    COUNT(*) as total_bgc_tanks,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_bgc_tanks,
    SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived_bgc_tanks
FROM fuel_tanks ft
LEFT JOIN tank_groups tg ON tg.id = ft.group_id
WHERE tg.name = 'BGC' OR LOWER(ft.location) LIKE '%bgc%';