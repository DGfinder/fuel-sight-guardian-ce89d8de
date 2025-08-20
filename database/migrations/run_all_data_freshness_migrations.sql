-- =====================================================
-- DATA FRESHNESS SYSTEM - COMPLETE MIGRATION RUNNER
-- =====================================================
-- This runs all the data freshness migrations in order
-- Use this for a complete setup
-- =====================================================

\echo 'Starting data freshness system migration...'

-- Step 1: Create types
\i 01_create_data_freshness_types.sql

-- Step 2: Create tables  
\i 02_create_data_freshness_tables.sql

-- Step 3: Create indexes
\i 03_create_data_freshness_indexes.sql

-- Step 4: Create functions
\i 04_create_data_freshness_functions.sql

-- Step 5: Create views
\i 05_create_data_freshness_views.sql

-- Step 6: Populate data sources
\i 06_populate_data_freshness_sources.sql

-- Step 7: Setup security
\i 07_setup_data_freshness_security.sql

\echo 'Data freshness system migration completed successfully!'