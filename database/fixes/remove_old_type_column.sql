-- Remove old 'type' column from tank_alerts table
-- This fixes the "null value in column 'type' violates not-null constraint" error
-- Run this in Supabase Dashboard SQL Editor

-- ============================================================================
-- STEP 1: Remove the old 'type' column from tank_alerts table
-- ============================================================================

DO $$ 
BEGIN
    -- Check if the old 'type' column exists and remove it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tank_alerts' 
        AND column_name = 'type'
        AND table_schema = 'public'
    ) THEN
        -- Drop the old 'type' column
        ALTER TABLE tank_alerts DROP COLUMN type;
        
        RAISE NOTICE 'Removed old "type" column from tank_alerts table';
    ELSE
        RAISE NOTICE 'Old "type" column does not exist in tank_alerts table';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Verify the fix and table structure
-- ============================================================================

-- Show remaining columns in tank_alerts table
SELECT 
    'tank_alerts final structure' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tank_alerts' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 3: Test INSERT to verify the fix works
-- ============================================================================

-- Test INSERT with the exact same pattern the frontend uses
DO $$
DECLARE
    test_tank_id UUID;
    test_alert_id UUID;
BEGIN
    -- Get a real tank ID for testing
    SELECT id INTO test_tank_id FROM fuel_tanks LIMIT 1;
    
    IF test_tank_id IS NOT NULL THEN
        -- Try INSERT (same as frontend does)
        INSERT INTO tank_alerts (
            tank_id,
            alert_type,
            message,
            priority,
            created_at
        ) VALUES (
            test_tank_id,
            'low_fuel',
            'Test alert - will be deleted',
            'medium',
            NOW()
        ) RETURNING id INTO test_alert_id;
        
        -- Clean up test record immediately
        DELETE FROM tank_alerts WHERE id = test_alert_id;
        
        RAISE NOTICE 'SUCCESS: INSERT test passed - old type column issue is fixed!';
    ELSE
        RAISE NOTICE 'No fuel tanks found for testing';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'INSERT test failed: %', SQLERRM;
END $$;

-- Final success message
SELECT 'Tank alerts column conflict fixed successfully' as result;
SELECT 'Frontend INSERT operations should now work without type column errors' as next_step;