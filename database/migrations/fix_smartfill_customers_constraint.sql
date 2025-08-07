-- Migration: Fix SmartFill Customers Table Constraint
-- This adds the missing UNIQUE constraint to api_reference column
-- Run this if the table was already created without the UNIQUE constraint

-- Add UNIQUE constraint to api_reference column if it doesn't already exist
-- This enables ON CONFLICT (api_reference) to work in population scripts
DO $$ 
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'smartfill_customers_api_reference_key' 
        AND table_name = 'smartfill_customers'
    ) THEN
        -- Add the UNIQUE constraint
        ALTER TABLE smartfill_customers 
        ADD CONSTRAINT smartfill_customers_api_reference_key 
        UNIQUE (api_reference);
        
        RAISE NOTICE 'Added UNIQUE constraint to smartfill_customers.api_reference';
    ELSE
        RAISE NOTICE 'UNIQUE constraint on smartfill_customers.api_reference already exists';
    END IF;
END $$;

-- Verify the constraint was added
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'smartfill_customers'
AND contype = 'u';  -- unique constraints only