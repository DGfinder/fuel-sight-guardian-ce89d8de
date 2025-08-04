-- Row Level Security (RLS) policies for analytics tables
-- Ensures data access follows the existing permission model based on user roles and groups

-- Enable RLS on analytics tables (captive_payment_records RLS may already be enabled)
ALTER TABLE lytx_safety_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lytx_event_behaviors ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_import_batches ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user has access to carrier data
CREATE OR REPLACE FUNCTION user_can_access_carrier(carrier_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Allow service role (for batch processing)
    IF auth.role() = 'service_role' THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has access to the carrier's data based on their group permissions
    -- Map carriers to groups: SMB -> specific group, GSF -> Great Southern Fuels group
    RETURN EXISTS (
        SELECT 1 FROM user_group_permissions ugp
        JOIN tank_groups tg ON ugp.group_id = tg.id
        WHERE ugp.user_id = auth.uid()
        AND (
            (carrier_name = 'SMB' AND tg.name ILIKE '%SMB%') OR
            (carrier_name = 'GSF' AND tg.name ILIKE '%Great Southern%') OR
            (carrier_name = 'Stevemacs' AND tg.name ILIKE '%Stevemacs%') OR
            (carrier_name = 'Great Southern Fuels' AND tg.name ILIKE '%Great Southern%')
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has access to fleet data
CREATE OR REPLACE FUNCTION user_can_access_fleet(fleet_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Allow service role (for batch processing)
    IF auth.role() = 'service_role' THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has access to the fleet's data based on their group permissions
    RETURN EXISTS (
        SELECT 1 FROM user_group_permissions ugp
        JOIN tank_groups tg ON ugp.group_id = tg.id
        WHERE ugp.user_id = auth.uid()
        AND (
            (fleet_name = 'Stevemacs' AND tg.name ILIKE '%Stevemacs%') OR
            (fleet_name = 'Great Southern Fuels' AND tg.name ILIKE '%Great Southern%')
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Captive Payment Records RLS Policies (may already exist - skip if error occurs)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'captive_payment_records' 
        AND policyname = 'Users can view captive payment records for their carriers'
    ) THEN
        CREATE POLICY "Users can view captive payment records for their carriers" ON captive_payment_records
            FOR SELECT USING (user_can_access_carrier(carrier::text));
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Policy may already exist or table may not exist, continue
        NULL;
END $$;

-- LYTX Safety Events RLS Policies
CREATE POLICY "Users can view LYTX safety events for their carriers" ON lytx_safety_events
    FOR SELECT USING (user_can_access_carrier(carrier));

CREATE POLICY "Users can insert LYTX safety events for their carriers" ON lytx_safety_events
    FOR INSERT WITH CHECK (user_can_access_carrier(carrier));

CREATE POLICY "Users can update LYTX safety events for their carriers" ON lytx_safety_events
    FOR UPDATE USING (user_can_access_carrier(carrier));

-- LYTX Event Behaviors RLS Policies (inherit from parent event)
CREATE POLICY "Users can view LYTX event behaviors if they can access the parent event" ON lytx_event_behaviors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM lytx_safety_events lse 
            WHERE lse.event_id = lytx_event_behaviors.event_id 
            AND user_can_access_carrier(lse.carrier)
        )
    );

CREATE POLICY "Users can insert LYTX event behaviors if they can access the parent event" ON lytx_event_behaviors
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM lytx_safety_events lse 
            WHERE lse.event_id = lytx_event_behaviors.event_id 
            AND user_can_access_carrier(lse.carrier)
        )
    );

-- Guardian Events RLS Policies
CREATE POLICY "Users can view Guardian events for their fleets" ON guardian_events
    FOR SELECT USING (user_can_access_fleet(fleet));

CREATE POLICY "Users can insert Guardian events for their fleets" ON guardian_events
    FOR INSERT WITH CHECK (user_can_access_fleet(fleet));

CREATE POLICY "Users can update Guardian events for their fleets" ON guardian_events
    FOR UPDATE USING (user_can_access_fleet(fleet));

-- Data Import Batches RLS Policies
CREATE POLICY "Users can view their own data import batches" ON data_import_batches
    FOR SELECT USING (created_by = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can insert data import batches" ON data_import_batches
    FOR INSERT WITH CHECK (created_by = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can update their own data import batches" ON data_import_batches
    FOR UPDATE USING (created_by = auth.uid() OR auth.role() = 'service_role');

-- Grant necessary permissions to authenticated users (captive payments grants may already exist)
GRANT SELECT, INSERT, UPDATE ON lytx_safety_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON lytx_event_behaviors TO authenticated;
GRANT SELECT, INSERT, UPDATE ON guardian_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON data_import_batches TO authenticated;

-- Grant permissions to service role for batch processing (captive payments grants may already exist)
GRANT ALL ON lytx_safety_events TO service_role;
GRANT ALL ON lytx_event_behaviors TO service_role;
GRANT ALL ON guardian_events TO service_role;
GRANT ALL ON data_import_batches TO service_role;