-- Disable Row Level Security on lytx_safety_events table
-- This allows data centre users unrestricted access to all LYTX safety data
-- Run this in Supabase SQL Editor

ALTER TABLE lytx_safety_events DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled (should return 'f' for false)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'lytx_safety_events';

-- Optional: Check total events count to confirm data accessibility
-- This should return your 34,000+ rows
SELECT COUNT(*) as total_events FROM lytx_safety_events;

-- Optional: Sample carrier distribution
SELECT carrier, COUNT(*) as event_count 
FROM lytx_safety_events 
GROUP BY carrier 
ORDER BY event_count DESC;