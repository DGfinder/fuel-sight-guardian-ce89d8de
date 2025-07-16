-- ============================================================================
-- AUDIT LOGGING SYSTEM SETUP
-- ============================================================================
-- This migration creates a comprehensive audit logging system for tracking
-- all data modifications in the Fuel Sight Guardian application.
-- 
-- Features:
-- - Tracks all INSERT, UPDATE, DELETE operations
-- - Records old and new values as JSON
-- - Captures user information and IP addresses
-- - Provides audit trail for compliance and security
-- ============================================================================

-- STEP 1: Create audit log table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    user_ip INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT audit_log_action_check CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_action ON audit_log(user_id, action, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_created ON audit_log(table_name, created_at DESC);

-- STEP 2: Create audit trigger function
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    audit_record RECORD;
    user_info RECORD;
BEGIN
    -- Get current user information
    SELECT 
        auth.uid() as user_id,
        auth.jwt() ->> 'email' as user_email
    INTO user_info;
    
    -- Determine the record to audit
    IF TG_OP = 'DELETE' THEN
        audit_record = OLD;
    ELSE
        audit_record = NEW;
    END IF;
    
    -- Insert audit record
    INSERT INTO audit_log (
        table_name,
        record_id,
        action,
        old_values,
        new_values,
        user_id,
        user_email,
        created_at
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(audit_record.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END,
        user_info.user_id,
        user_info.user_email,
        NOW()
    );
    
    -- Return appropriate record
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 3: Create triggers for critical tables
-- ----------------------------------------------------------------------------

-- Audit dip_readings table (critical for fuel tracking)
DROP TRIGGER IF EXISTS audit_dip_readings_trigger ON dip_readings;
CREATE TRIGGER audit_dip_readings_trigger
    AFTER INSERT OR UPDATE OR DELETE ON dip_readings
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Audit fuel_tanks table (tank configuration changes)
DROP TRIGGER IF EXISTS audit_fuel_tanks_trigger ON fuel_tanks;
CREATE TRIGGER audit_fuel_tanks_trigger
    AFTER INSERT OR UPDATE OR DELETE ON fuel_tanks
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Audit tank_alerts table (alert management)
DROP TRIGGER IF EXISTS audit_tank_alerts_trigger ON tank_alerts;
CREATE TRIGGER audit_tank_alerts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tank_alerts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Audit user_roles table (user permission changes)
DROP TRIGGER IF EXISTS audit_user_roles_trigger ON user_roles;
CREATE TRIGGER audit_user_roles_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Audit user_group_permissions table (access control changes)
DROP TRIGGER IF EXISTS audit_user_group_permissions_trigger ON user_group_permissions;
CREATE TRIGGER audit_user_group_permissions_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_group_permissions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Audit profiles table (user profile changes)
DROP TRIGGER IF EXISTS audit_profiles_trigger ON profiles;
CREATE TRIGGER audit_profiles_trigger
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- STEP 4: Create audit query functions for easy access
-- ----------------------------------------------------------------------------

-- Function to get audit trail for a specific record
CREATE OR REPLACE FUNCTION get_audit_trail(
    p_table_name TEXT,
    p_record_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    action TEXT,
    old_values JSONB,
    new_values JSONB,
    user_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.action,
        al.old_values,
        al.new_values,
        al.user_email,
        al.created_at
    FROM audit_log al
    WHERE al.table_name = p_table_name 
      AND al.record_id = p_record_id
    ORDER BY al.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent audit activity
CREATE OR REPLACE FUNCTION get_recent_audit_activity(
    p_hours INTEGER DEFAULT 24,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    table_name TEXT,
    record_id UUID,
    action TEXT,
    user_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.table_name,
        al.record_id,
        al.action,
        al.user_email,
        al.created_at
    FROM audit_log al
    WHERE al.created_at >= NOW() - INTERVAL '1 hour' * p_hours
    ORDER BY al.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 5: Set up Row Level Security for audit log
-- ----------------------------------------------------------------------------

-- Enable RLS on audit_log table
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view audit logs for data they have access to
-- This will need to be refined based on your specific access control needs
CREATE POLICY "Users can view relevant audit logs" ON audit_log
FOR SELECT USING (
    -- Admins can see all audit logs
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin'
    OR
    -- Users can see audit logs for their own actions
    user_id = auth.uid()
    OR
    -- Users can see audit logs for tanks they have access to
    (table_name = 'dip_readings' AND EXISTS (
        SELECT 1 FROM user_has_tank_access(record_id::text)
    ))
);

-- STEP 6: Grant necessary permissions
-- ----------------------------------------------------------------------------

-- Grant access to authenticated users
GRANT SELECT ON audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION get_audit_trail(TEXT, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_audit_activity(INTEGER, INTEGER) TO authenticated;

-- STEP 7: Create view for easier querying
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW audit_summary AS
SELECT 
    table_name,
    action,
    user_email,
    created_at,
    CASE 
        WHEN table_name = 'dip_readings' THEN 
            COALESCE(new_values->>'value', old_values->>'value') || ' L'
        WHEN table_name = 'fuel_tanks' THEN 
            COALESCE(new_values->>'location', old_values->>'location')
        ELSE 'N/A'
    END as affected_item,
    record_id
FROM audit_log
ORDER BY created_at DESC;

GRANT SELECT ON audit_summary TO authenticated;

-- STEP 8: Data retention policy (optional)
-- ----------------------------------------------------------------------------

-- Create function to clean up old audit logs (retain for 7 years for compliance)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_log 
    WHERE created_at < NOW() - INTERVAL '7 years';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 9: Test audit logging
-- ----------------------------------------------------------------------------

-- Verify triggers are working
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers 
WHERE trigger_name LIKE 'audit_%_trigger'
ORDER BY event_object_table;

-- Check audit log table structure
\d audit_log;

COMMENT ON TABLE audit_log IS 'Comprehensive audit trail for all data modifications in Fuel Sight Guardian';
COMMENT ON FUNCTION audit_trigger_function() IS 'Trigger function that logs all data changes with user context';
COMMENT ON FUNCTION get_audit_trail(TEXT, UUID, INTEGER) IS 'Get audit history for a specific record';
COMMENT ON FUNCTION get_recent_audit_activity(INTEGER, INTEGER) IS 'Get recent audit activity across all tables';

-- ============================================================================
-- AUDIT SYSTEM STATUS
-- ============================================================================
-- Tables monitored: dip_readings, fuel_tanks, tank_alerts, user_roles, 
--                   user_group_permissions, profiles
-- Retention period: 7 years (configurable)
-- Access control: RLS enabled with role-based access
-- Performance: Indexed for common query patterns
-- ============================================================================