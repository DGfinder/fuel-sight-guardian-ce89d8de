-- Create failed_login_attempts table for rate limiting
-- Tracks failed login attempts to prevent brute force attacks
-- 5 failed attempts in 15 minutes = account locked for 15 minutes

CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT
);

-- Index for efficient lookups by email and time
CREATE INDEX idx_failed_login_email_time ON failed_login_attempts(email, attempted_at);

-- Index for cleanup of old records
CREATE INDEX idx_failed_login_attempted_at ON failed_login_attempts(attempted_at);

-- RLS policies - only service role can insert/query this table
ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- No direct access for authenticated users - only through edge functions
-- Service role bypasses RLS so no policy needed for it

-- Function to check if login is rate limited
CREATE OR REPLACE FUNCTION check_login_rate_limit(
  p_email TEXT,
  p_window_minutes INTEGER DEFAULT 15,
  p_max_attempts INTEGER DEFAULT 5
)
RETURNS TABLE (
  is_limited BOOLEAN,
  attempt_count BIGINT,
  retry_after_seconds INTEGER
) AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_attempt_count BIGINT;
  v_oldest_attempt TIMESTAMPTZ;
  v_retry_after INTEGER;
BEGIN
  v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  -- Count attempts in window
  SELECT COUNT(*), MIN(attempted_at)
  INTO v_attempt_count, v_oldest_attempt
  FROM failed_login_attempts
  WHERE email = LOWER(p_email)
    AND attempted_at > v_window_start;

  -- Calculate retry_after if limited
  IF v_attempt_count >= p_max_attempts THEN
    v_retry_after := GREATEST(0,
      EXTRACT(EPOCH FROM (v_oldest_attempt + (p_window_minutes || ' minutes')::INTERVAL - NOW()))::INTEGER
    );
    RETURN QUERY SELECT TRUE, v_attempt_count, v_retry_after;
  ELSE
    RETURN QUERY SELECT FALSE, v_attempt_count, 0;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record a failed login attempt
CREATE OR REPLACE FUNCTION record_failed_login(
  p_email TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO failed_login_attempts (email, ip_address, user_agent)
  VALUES (LOWER(p_email), p_ip_address, p_user_agent);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear failed attempts on successful login (optional)
CREATE OR REPLACE FUNCTION clear_failed_login_attempts(
  p_email TEXT
)
RETURNS VOID AS $$
BEGIN
  DELETE FROM failed_login_attempts
  WHERE email = LOWER(p_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Scheduled cleanup of old records (older than 24 hours)
-- This should be called periodically via cron/scheduled function
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM failed_login_attempts
  WHERE attempted_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions to authenticated users
-- (functions use SECURITY DEFINER so they run as the function owner)
GRANT EXECUTE ON FUNCTION check_login_rate_limit(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION record_failed_login(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION clear_failed_login_attempts(TEXT) TO authenticated;

COMMENT ON TABLE failed_login_attempts IS 'Tracks failed login attempts for rate limiting (5 attempts per 15 minutes)';
COMMENT ON FUNCTION check_login_rate_limit IS 'Check if an email is rate limited due to too many failed attempts';
COMMENT ON FUNCTION record_failed_login IS 'Record a failed login attempt (called before auth)';
COMMENT ON FUNCTION clear_failed_login_attempts IS 'Clear failed attempts after successful login';
