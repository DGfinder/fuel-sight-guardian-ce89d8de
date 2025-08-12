-- Agbot Readings History Table Diagnostic SQL Script
-- Run this directly in Supabase SQL Editor to examine agbot_readings_history table

-- 1. Check if table exists and basic structure
SELECT 
  'TABLE EXISTENCE CHECK' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'agbot_readings_history' 
      AND table_schema = 'public'
    ) THEN '✅ Table exists'
    ELSE '❌ Table does not exist'
  END as result;

-- 2. Get table structure
SELECT 
  'TABLE STRUCTURE' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'agbot_readings_history' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Count total records
SELECT 
  'RECORD COUNT' as check_type,
  COUNT(*) as total_records
FROM agbot_readings_history;

-- 4. Get date range of data
SELECT 
  'DATE RANGE' as check_type,
  MIN(reading_timestamp) as earliest_reading,
  MAX(reading_timestamp) as latest_reading,
  EXTRACT(DAY FROM (MAX(reading_timestamp) - MIN(reading_timestamp))) as span_days,
  EXTRACT(HOUR FROM (NOW() - MAX(reading_timestamp))) as hours_since_latest
FROM agbot_readings_history;

-- 5. Count unique assets
SELECT 
  'ASSET COUNT' as check_type,
  COUNT(DISTINCT asset_id) as unique_assets,
  ROUND(COUNT(*)::numeric / COUNT(DISTINCT asset_id), 1) as avg_readings_per_asset
FROM agbot_readings_history;

-- 6. Data quality checks
SELECT 
  'DATA QUALITY' as check_type,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE asset_id IS NULL) as null_asset_id,
  COUNT(*) FILTER (WHERE calibrated_fill_percentage IS NULL) as null_fuel_percentage,
  COUNT(*) FILTER (WHERE reading_timestamp IS NULL) as null_timestamps,
  COUNT(*) FILTER (WHERE calibrated_fill_percentage < 0) as negative_percentages,
  COUNT(*) FILTER (WHERE calibrated_fill_percentage > 100) as over_100_percentages,
  COUNT(*) FILTER (WHERE reading_timestamp > NOW()) as future_timestamps
FROM agbot_readings_history;

-- 7. Most recent readings sample
SELECT 
  'RECENT READINGS' as check_type,
  LEFT(asset_id, 8) as asset_short,
  calibrated_fill_percentage,
  raw_fill_percentage,
  reading_timestamp,
  device_online,
  EXTRACT(HOUR FROM (NOW() - reading_timestamp)) as hours_ago
FROM agbot_readings_history
ORDER BY reading_timestamp DESC
LIMIT 5;

-- 8. Assets with most readings (top 10)
SELECT 
  'TOP ASSETS BY READINGS' as check_type,
  LEFT(asset_id, 12) as asset_short,
  COUNT(*) as reading_count,
  MIN(reading_timestamp) as first_reading,
  MAX(reading_timestamp) as last_reading
FROM agbot_readings_history
GROUP BY asset_id
ORDER BY COUNT(*) DESC
LIMIT 10;

-- 9. Readings per day over last 30 days
SELECT 
  'DAILY ACTIVITY' as check_type,
  DATE(reading_timestamp) as reading_date,
  COUNT(*) as readings_count,
  COUNT(DISTINCT asset_id) as unique_assets
FROM agbot_readings_history
WHERE reading_timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE(reading_timestamp)
ORDER BY reading_date DESC
LIMIT 10;

-- 10. Check related tables existence and counts
SELECT 
  'RELATED TABLES' as check_type,
  'agbot_locations' as table_name,
  (SELECT COUNT(*) FROM agbot_locations) as record_count
UNION ALL
SELECT 
  'RELATED TABLES' as check_type,
  'agbot_assets' as table_name,
  (SELECT COUNT(*) FROM agbot_assets) as record_count
UNION ALL
SELECT 
  'RELATED TABLES' as check_type,
  'agbot_sync_logs' as table_name,
  (SELECT COUNT(*) FROM agbot_sync_logs) as record_count;

-- 11. Check indexes on the table
SELECT 
  'INDEXES' as check_type,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'agbot_readings_history' 
AND schemaname = 'public'
ORDER BY indexname;

-- 12. Storage and performance info
SELECT 
  'TABLE STATISTICS' as check_type,
  schemaname,
  tablename,
  attname as column_name,
  n_distinct,
  correlation
FROM pg_stats 
WHERE tablename = 'agbot_readings_history' 
AND schemaname = 'public'
ORDER BY attname;