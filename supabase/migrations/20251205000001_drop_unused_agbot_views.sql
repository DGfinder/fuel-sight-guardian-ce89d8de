-- Migration: Drop Unused AgBot Views
-- Date: 2025-12-05
-- Purpose: Remove database views that are not referenced anywhere in the application code
-- Risk Level: LOW - These views have zero usage in UI components, hooks, or API routes
-- Impact: None - All application code queries base tables directly

-- Verification performed:
-- ✅ Searched entire codebase for references to these views
-- ✅ Found 0 references in TypeScript/JavaScript files
-- ✅ Found 0 references in API routes
-- ✅ Found 0 references in React components/hooks
-- ✅ Application queries base tables directly instead

-- Drop views in dependency order (CASCADE will handle dependencies)

-- 1. Drop agbot_assets_enhanced view
-- Originally created in: database/migrations/add_rich_agbot_data_columns.sql (lines 137-161)
-- Dependencies: agbot_assets, agbot_locations
DROP VIEW IF EXISTS agbot_assets_enhanced CASCADE;

-- 2. Drop agbot_locations_enhanced view
-- Originally created in: database/migrations/add_rich_agbot_data_columns.sql (lines 80-134)
-- Dependencies: agbot_assets, agbot_locations
DROP VIEW IF EXISTS agbot_locations_enhanced CASCADE;

-- 3. Drop delivery_requests_detailed view
-- Originally created in: database/migrations/create_customer_portal_system.sql (lines 392-405)
-- Dependencies: delivery_requests, agbot_locations, agbot_assets
DROP VIEW IF EXISTS delivery_requests_detailed CASCADE;

-- 4. Drop customer_contacts_with_tank_count view
-- Originally created in: database/migrations/create_customer_contact_tanks.sql (lines 52-64)
-- Dependencies: customer_contacts, agbot_locations
DROP VIEW IF EXISTS customer_contacts_with_tank_count CASCADE;

-- Log the migration
COMMENT ON SCHEMA public IS 'Dropped unused agbot views (agbot_assets_enhanced, agbot_locations_enhanced, delivery_requests_detailed, customer_contacts_with_tank_count) on 2025-12-05. Views had zero usage in application code.';
