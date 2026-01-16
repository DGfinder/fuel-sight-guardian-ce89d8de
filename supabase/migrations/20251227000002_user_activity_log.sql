-- User Activity Log - Comprehensive audit logging for all user actions
-- Tracks: auth events, customer account changes, tank assignments, delivery requests

-- Main activity log table
CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action_type TEXT NOT NULL,
  action_category TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_activity_user_time ON user_activity_log(user_id, created_at DESC);
CREATE INDEX idx_activity_category_time ON user_activity_log(action_category, created_at DESC);
CREATE INDEX idx_activity_type_time ON user_activity_log(action_type, created_at DESC);
CREATE INDEX idx_activity_resource ON user_activity_log(resource_type, resource_id);
CREATE INDEX idx_activity_created_at ON user_activity_log(created_at DESC);

-- Enable RLS
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- Admins and managers can read all activity logs
CREATE POLICY "Admin can read activity logs"
ON user_activity_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- Authenticated users can insert their own activity (for frontend logging)
CREATE POLICY "Users can insert own activity"
ON user_activity_log FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Service role can do anything (for triggers)
CREATE POLICY "Service role full access"
ON user_activity_log FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Anonymous users can insert (for login attempts before auth)
CREATE POLICY "Anon can insert activity"
ON user_activity_log FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- Helper function to log activity from triggers
CREATE OR REPLACE FUNCTION log_activity_from_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_action_type TEXT;
  v_details JSONB;
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action_type := TG_ARGV[0] || '_created';
    v_details := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action_type := TG_ARGV[0] || '_updated';
    v_details := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW),
      'changed_fields', (
        SELECT jsonb_object_agg(key, value)
        FROM jsonb_each(to_jsonb(NEW))
        WHERE to_jsonb(NEW) -> key != to_jsonb(OLD) -> key
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := TG_ARGV[0] || '_deleted';
    v_details := to_jsonb(OLD);
  END IF;

  -- Get current user info
  v_user_id := auth.uid();
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Insert activity log
  INSERT INTO user_activity_log (
    user_id,
    user_email,
    action_type,
    action_category,
    resource_type,
    resource_id,
    details
  ) VALUES (
    v_user_id,
    v_user_email,
    v_action_type,
    TG_ARGV[1],  -- category passed as second argument
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_details
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for customer_accounts
DROP TRIGGER IF EXISTS trg_customer_accounts_activity ON customer_accounts;
CREATE TRIGGER trg_customer_accounts_activity
AFTER INSERT OR UPDATE OR DELETE ON customer_accounts
FOR EACH ROW
EXECUTE FUNCTION log_activity_from_trigger('account', 'customer');

-- Trigger for customer_tank_access
DROP TRIGGER IF EXISTS trg_customer_tank_access_activity ON customer_tank_access;
CREATE TRIGGER trg_customer_tank_access_activity
AFTER INSERT OR UPDATE OR DELETE ON customer_tank_access
FOR EACH ROW
EXECUTE FUNCTION log_activity_from_trigger('tank_access', 'tank');

-- Trigger for delivery_requests (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_requests') THEN
    DROP TRIGGER IF EXISTS trg_delivery_requests_activity ON delivery_requests;
    CREATE TRIGGER trg_delivery_requests_activity
    AFTER INSERT OR UPDATE OR DELETE ON delivery_requests
    FOR EACH ROW
    EXECUTE FUNCTION log_activity_from_trigger('request', 'delivery');
  END IF;
END $$;

-- Function for frontend to log activity
CREATE OR REPLACE FUNCTION log_user_activity(
  p_action_type TEXT,
  p_action_category TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}',
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO user_activity_log (
    user_id,
    user_email,
    action_type,
    action_category,
    resource_type,
    resource_id,
    details,
    user_agent
  ) VALUES (
    auth.uid(),
    v_user_email,
    p_action_type,
    p_action_category,
    p_resource_type,
    p_resource_id,
    p_details,
    p_user_agent
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get activity logs with filters
CREATE OR REPLACE FUNCTION get_activity_logs(
  p_category TEXT DEFAULT NULL,
  p_action_type TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  action_type TEXT,
  action_category TEXT,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.user_id,
    l.user_email,
    l.action_type,
    l.action_category,
    l.resource_type,
    l.resource_id,
    l.details,
    l.ip_address,
    l.user_agent,
    l.created_at
  FROM user_activity_log l
  WHERE (p_category IS NULL OR l.action_category = p_category)
    AND (p_action_type IS NULL OR l.action_type = p_action_type)
    AND (p_user_id IS NULL OR l.user_id = p_user_id)
    AND (p_resource_type IS NULL OR l.resource_type = p_resource_type)
    AND (p_resource_id IS NULL OR l.resource_id = p_resource_id)
    AND (p_start_date IS NULL OR l.created_at >= p_start_date)
    AND (p_end_date IS NULL OR l.created_at <= p_end_date)
  ORDER BY l.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get activity summary stats
CREATE OR REPLACE FUNCTION get_activity_summary(
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  category TEXT,
  action_type TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.action_category as category,
    l.action_type,
    COUNT(*) as count
  FROM user_activity_log l
  WHERE l.created_at > NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY l.action_category, l.action_type
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function for old logs (90 day retention)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM user_activity_log
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION log_user_activity(TEXT, TEXT, TEXT, UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION log_user_activity(TEXT, TEXT, TEXT, UUID, JSONB, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_activity_logs(TEXT, TEXT, UUID, TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_activity_summary(INTEGER) TO authenticated;

-- Comments
COMMENT ON TABLE user_activity_log IS 'Comprehensive audit log tracking all user actions across the application';
COMMENT ON FUNCTION log_user_activity IS 'Log user activity from frontend (login, logout, password changes, etc.)';
COMMENT ON FUNCTION get_activity_logs IS 'Query activity logs with filters for admin dashboard';
COMMENT ON FUNCTION get_activity_summary IS 'Get summary statistics of recent activity by category and type';
