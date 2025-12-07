-- ============================================================================
-- Add Industry Type to Customer Accounts
-- Enables industry-based feature visibility in customer portal
-- Date: 2024-12-07
-- ============================================================================
--
-- Industry Types:
-- - 'farming': Full agricultural intelligence, road risk, weather
-- - 'mining': Road risk + extreme weather (heat/cyclone), no farming features
-- - 'general': Core tank monitoring only (IndusSOlutions, engineering firms)
-- ============================================================================

-- Create industry type enum
DO $$ BEGIN
    CREATE TYPE customer_industry_type AS ENUM ('farming', 'mining', 'general');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add industry_type column to customer_accounts
-- Default to 'farming' since most existing customers are farms
ALTER TABLE customer_accounts
ADD COLUMN IF NOT EXISTS industry_type customer_industry_type DEFAULT 'farming';

-- Add comment for documentation
COMMENT ON COLUMN customer_accounts.industry_type IS
  'Industry type determines feature visibility in customer portal:
   - farming: Full agricultural intelligence (harvest, seeding, spray windows), road risk, weather
   - mining: Road risk + extreme weather warnings (heat, cyclone), no agricultural features
   - general: Core tank monitoring only (basic weather, no road risk, no ag intel)';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_customer_accounts_industry_type
ON customer_accounts(industry_type);

-- ============================================================================
-- Update specific customers to correct industry types
-- ============================================================================

-- Set IndusSOlutions to 'general' (engineering firm, not farming)
UPDATE customer_accounts
SET industry_type = 'general'
WHERE customer_name ILIKE '%indusolution%'
   OR company_name ILIKE '%indusolution%'
   OR customer_name ILIKE '%indosolution%'
   OR company_name ILIKE '%indosolution%';

-- Mining customers would be set like this (uncomment and adjust as needed):
-- UPDATE customer_accounts
-- SET industry_type = 'mining'
-- WHERE customer_name ILIKE '%kalgoorlie%'
--    OR customer_name ILIKE '%pilbara%'
--    OR customer_name ILIKE '%mining%';

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 'Industry type column added to customer_accounts' as result;

-- Show distribution of industry types
SELECT
  industry_type,
  COUNT(*) as customer_count
FROM customer_accounts
GROUP BY industry_type
ORDER BY customer_count DESC;
