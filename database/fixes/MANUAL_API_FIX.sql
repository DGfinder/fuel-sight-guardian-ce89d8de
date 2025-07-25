-- MANUAL API FIX - Run this in Supabase Dashboard SQL Editor
-- This fixes the current API issues by adding missing columns and tables

-- ============================================================================
-- STEP 1: Add missing alert_type column to tank_alerts table
-- ============================================================================

-- Check if alert_type column exists, if not add it
DO $$ 
BEGIN
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tank_alerts' 
        AND column_name = 'alert_type'
    ) THEN
        -- Add the missing column with proper constraints
        ALTER TABLE tank_alerts ADD COLUMN alert_type TEXT;
        
        -- Update existing records with a default alert type
        UPDATE tank_alerts SET alert_type = 'low_fuel' WHERE alert_type IS NULL;
        
        -- Add NOT NULL constraint after setting default values
        ALTER TABLE tank_alerts ALTER COLUMN alert_type SET NOT NULL;
        
        -- Add check constraint for valid alert types
        ALTER TABLE tank_alerts ADD CONSTRAINT tank_alerts_alert_type_check 
            CHECK (alert_type IN ('low_fuel', 'critical_fuel', 'no_reading', 'maintenance'));
            
        RAISE NOTICE 'Added alert_type column to tank_alerts table';
    ELSE
        RAISE NOTICE 'alert_type column already exists in tank_alerts table';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Create agbot_alerts table if it doesn't exist
-- ============================================================================

-- Create agbot_alerts table to support Agbot device alert functionality
CREATE TABLE IF NOT EXISTS agbot_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agbot_asset_id VARCHAR(255) NOT NULL, -- Agbot asset ID (string format from Athara API)
  alert_type TEXT NOT NULL CHECK (alert_type IN ('device_offline', 'signal_issue', 'data_stale', 'maintenance')),
  message TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying of active alerts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'agbot_alerts' AND indexname = 'idx_agbot_alerts_active') THEN
        CREATE INDEX idx_agbot_alerts_active ON agbot_alerts(agbot_asset_id, acknowledged_at, snoozed_until);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'agbot_alerts' AND indexname = 'idx_agbot_alerts_created_at') THEN
        CREATE INDEX idx_agbot_alerts_created_at ON agbot_alerts(created_at);
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Add RLS policies for agbot_alerts
-- ============================================================================

-- Enable RLS if not already enabled
DO $$
BEGIN
    -- Check if RLS is already enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'agbot_alerts' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE agbot_alerts ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Enabled RLS on agbot_alerts table';
    ELSE
        RAISE NOTICE 'RLS already enabled on agbot_alerts table';
    END IF;
END $$;

-- Create RLS policies for agbot_alerts (only if they don't exist)
DO $$
BEGIN
    -- Policy for viewing agbot alerts
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'agbot_alerts' 
        AND policyname = 'Users can view agbot alerts for accessible groups'
    ) THEN
        CREATE POLICY "Users can view agbot alerts for accessible groups" ON agbot_alerts
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM auth.users
              WHERE auth.users.id = auth.uid()
            )
          );
        RAISE NOTICE 'Created SELECT policy for agbot_alerts';
    ELSE
        RAISE NOTICE 'SELECT policy already exists for agbot_alerts';
    END IF;

    -- Policy for creating agbot alerts
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'agbot_alerts' 
        AND policyname = 'System can create agbot alerts'
    ) THEN
        CREATE POLICY "System can create agbot alerts" ON agbot_alerts
          FOR INSERT WITH CHECK (true);
        RAISE NOTICE 'Created INSERT policy for agbot_alerts';
    ELSE
        RAISE NOTICE 'INSERT policy already exists for agbot_alerts';
    END IF;

    -- Policy for updating agbot alerts
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'agbot_alerts' 
        AND policyname = 'Users can update agbot alerts they can view'
    ) THEN
        CREATE POLICY "Users can update agbot alerts they can view" ON agbot_alerts
          FOR UPDATE USING (
            EXISTS (
              SELECT 1 FROM auth.users
              WHERE auth.users.id = auth.uid()
            )
          );
        RAISE NOTICE 'Created UPDATE policy for agbot_alerts';
    ELSE
        RAISE NOTICE 'UPDATE policy already exists for agbot_alerts';
    END IF;
END $$;

-- Grant necessary permissions (safe to run multiple times)
GRANT SELECT, INSERT, UPDATE ON agbot_alerts TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================================================
-- STEP 4: Verification queries
-- ============================================================================

-- Verify tank_alerts table now has alert_type column
SELECT 
    'tank_alerts verification' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'tank_alerts' 
AND column_name = 'alert_type';

-- Verify agbot_alerts table exists and has proper structure
SELECT 
    'agbot_alerts verification' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'agbot_alerts' 
ORDER BY ordinal_position
LIMIT 10;

-- Check RLS is enabled on both tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    'RLS Status Check' as verification_type
FROM pg_tables 
WHERE tablename IN ('tank_alerts', 'agbot_alerts');

-- Final success message
SELECT 'API Issues Manual Fix Completed Successfully' as result;

-- Instructions for next steps
SELECT 'Next: Test frontend to verify console errors are resolved' as next_step;