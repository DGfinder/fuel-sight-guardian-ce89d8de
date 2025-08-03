-- Add missing priority column to tank_alerts table
-- Run this in Supabase Dashboard SQL Editor

-- ============================================================================
-- Add missing priority column to tank_alerts table
-- ============================================================================

DO $$ 
BEGIN
    -- Check if priority column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tank_alerts' 
        AND column_name = 'priority'
    ) THEN
        -- Add the missing priority column
        ALTER TABLE tank_alerts ADD COLUMN priority TEXT;
        
        -- Update existing records with a default priority based on alert_type
        UPDATE tank_alerts 
        SET priority = CASE 
            WHEN alert_type = 'critical_fuel' THEN 'high'
            WHEN alert_type = 'low_fuel' THEN 'medium'
            WHEN alert_type = 'no_reading' THEN 'high'
            WHEN alert_type = 'maintenance' THEN 'low'
            ELSE 'medium'
        END 
        WHERE priority IS NULL;
        
        -- Add NOT NULL constraint after setting default values
        ALTER TABLE tank_alerts ALTER COLUMN priority SET NOT NULL;
        
        -- Add check constraint for valid priority levels
        ALTER TABLE tank_alerts ADD CONSTRAINT tank_alerts_priority_check 
            CHECK (priority IN ('high', 'medium', 'low'));
            
        RAISE NOTICE 'Added priority column to tank_alerts table';
    ELSE
        RAISE NOTICE 'priority column already exists in tank_alerts table';
    END IF;
END $$;

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify priority column was added successfully
SELECT 
    'tank_alerts priority verification' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'tank_alerts' 
AND column_name = 'priority';

-- Show sample data with both alert_type and priority
SELECT 
    id,
    tank_id,
    alert_type,
    priority,
    message,
    created_at
FROM tank_alerts 
LIMIT 5;

SELECT 'Priority column fix completed successfully' as result;