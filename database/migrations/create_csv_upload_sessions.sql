-- Migration: Create CSV Upload Sessions Table for Vercel Blob Storage
-- This creates the tracking table for file uploads using Vercel Blob storage

CREATE TABLE IF NOT EXISTS csv_upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- References auth.users
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL, -- File size in bytes
  file_type TEXT NOT NULL,
  blob_path TEXT, -- Path in blob storage
  blob_url TEXT, -- URL from blob storage after upload
  blob_size BIGINT, -- Actual blob size (may differ from file_size)
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'processing', 'completed', 'failed', 'deleted')),
  description TEXT,
  tags TEXT, -- Comma-separated tags
  error_message TEXT, -- Error details if upload fails
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT csv_upload_sessions_file_size_positive CHECK (file_size > 0),
  CONSTRAINT csv_upload_sessions_blob_size_positive CHECK (blob_size IS NULL OR blob_size > 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_csv_upload_sessions_user_id ON csv_upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_csv_upload_sessions_status ON csv_upload_sessions(upload_status);
CREATE INDEX IF NOT EXISTS idx_csv_upload_sessions_created_at ON csv_upload_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_csv_upload_sessions_filename ON csv_upload_sessions(original_filename);

-- RLS Policies
ALTER TABLE csv_upload_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own upload sessions
CREATE POLICY "Users can view their own upload sessions" ON csv_upload_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can only insert their own upload sessions
CREATE POLICY "Users can create their own upload sessions" ON csv_upload_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update their own upload sessions (for status updates)
CREATE POLICY "Users can update their own upload sessions" ON csv_upload_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- System/API can manage all upload sessions (for server-side operations)
CREATE POLICY "System can manage all upload sessions" ON csv_upload_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admins can view all upload sessions
CREATE POLICY "Admins can view all upload sessions" ON csv_upload_sessions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Add trigger to update timestamps
CREATE OR REPLACE FUNCTION update_csv_upload_sessions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Update completed_at when status changes to completed
    IF OLD.upload_status != 'completed' AND NEW.upload_status = 'completed' THEN
      NEW.completed_at = NOW();
    END IF;
    
    -- Update deleted_at when status changes to deleted
    IF OLD.upload_status != 'deleted' AND NEW.upload_status = 'deleted' THEN
      NEW.deleted_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER csv_upload_sessions_timestamp_trigger
  BEFORE UPDATE ON csv_upload_sessions
  FOR EACH ROW EXECUTE FUNCTION update_csv_upload_sessions_timestamp();

-- Create view for easy monitoring
CREATE OR REPLACE VIEW csv_upload_sessions_summary AS
SELECT 
  upload_status,
  COUNT(*) as count,
  SUM(file_size) as total_size_bytes,
  AVG(file_size) as avg_size_bytes,
  MIN(created_at) as oldest_upload,
  MAX(created_at) as newest_upload
FROM csv_upload_sessions
GROUP BY upload_status
ORDER BY upload_status;

SELECT 'CSV upload sessions table created successfully' as result;