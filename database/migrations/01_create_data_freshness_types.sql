-- =====================================================
-- DATA FRESHNESS SYSTEM - STEP 1: CREATE TYPES
-- =====================================================
-- This creates only the required types
-- Run this first, then continue with subsequent steps
-- =====================================================

-- Create enum for data source types (idempotent)
DO $$ BEGIN
  CREATE TYPE data_source_type AS ENUM (
    'csv_upload', 'api_sync', 'manual_entry', 'webhook', 'scheduled_import'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for freshness status (idempotent)
DO $$ BEGIN
  CREATE TYPE freshness_status AS ENUM (
    'fresh', 'stale', 'very_stale', 'critical'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

SELECT 'Data freshness types created successfully' as result;