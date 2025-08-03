-- Migration: Add deletion audit trail columns to dip_readings table
-- Purpose: Support auditable deletion of dip readings with user tracking and reason logging
-- This allows controlled deletion with full audit trail for compliance and debugging

-- Add deletion audit columns
ALTER TABLE dip_readings 
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL;

ALTER TABLE dip_readings 
ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

-- Create indexes for performance when querying deletions
CREATE INDEX IF NOT EXISTS idx_dip_readings_deleted_by 
ON dip_readings (deleted_by) 
WHERE deleted_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dip_readings_deletion_audit 
ON dip_readings (archived_at, deleted_by) 
WHERE archived_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN dip_readings.deleted_by IS 'UUID of user who deleted this reading. NULL means not deleted.';
COMMENT ON COLUMN dip_readings.deletion_reason IS 'Reason provided by user for deleting this reading. Required for audit trail.';

-- Create view for deleted readings (admin only)
CREATE OR REPLACE VIEW deleted_dip_readings AS
SELECT 
  dr.*,
  p.full_name as deleted_by_name,
  dr.archived_at as deleted_at
FROM dip_readings dr
LEFT JOIN profiles p ON dr.deleted_by = p.id
WHERE dr.archived_at IS NOT NULL 
  AND dr.deleted_by IS NOT NULL
ORDER BY dr.archived_at DESC;

-- Add RLS policy for deleted readings view (admin access only)
ALTER TABLE dip_readings ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view deleted readings
CREATE POLICY view_deleted_readings ON dip_readings
FOR SELECT USING (
  archived_at IS NOT NULL 
  AND deleted_by IS NOT NULL
  AND (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin'
  )
);

SELECT 'Successfully added deletion audit columns to dip_readings table' as result;