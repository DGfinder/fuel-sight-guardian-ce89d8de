-- Create analytics tables for Data Centre Supabase integration
-- This migration creates tables for LYTX events, Guardian events, and data import tracking
-- NOTE: Captive payments tables already exist (captive_payment_records and captive_deliveries materialized view)

-- LYTX Safety Events Table
CREATE TABLE IF NOT EXISTS lytx_safety_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE,
    vehicle_registration TEXT,
    device_serial TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    employee_id TEXT,
    group_name TEXT NOT NULL,
    depot TEXT NOT NULL,
    carrier TEXT NOT NULL CHECK (carrier IN ('Stevemacs', 'Great Southern Fuels')),
    event_datetime TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Australia/Perth',
    score INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('New', 'Face-To-Face', 'FYI Notify', 'Resolved')),
    trigger TEXT NOT NULL,
    behaviors TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('Coachable', 'Driver Tagged')),
    excluded BOOLEAN DEFAULT FALSE,
    assigned_date TIMESTAMPTZ,
    reviewed_by TEXT,
    notes TEXT,
    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LYTX Event Behaviors Table (normalized behaviors data)
CREATE TABLE IF NOT EXISTS lytx_event_behaviors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES lytx_safety_events(event_id) ON DELETE CASCADE,
    behavior_id INTEGER NOT NULL,
    behavior_name TEXT NOT NULL,
    score INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guardian Events Table
CREATE TABLE IF NOT EXISTS guardian_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_registration TEXT NOT NULL,
    guardian_unit TEXT,
    event_type TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    location TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    driver_name TEXT,
    duration INTEGER, -- in seconds
    speed DECIMAL(6,2), -- km/h
    severity TEXT NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    verified BOOLEAN DEFAULT FALSE,
    status TEXT,
    fleet TEXT NOT NULL CHECK (fleet IN ('Stevemacs', 'Great Southern Fuels')),
    depot TEXT,
    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data Import Batches Table (tracking data imports)
CREATE TABLE IF NOT EXISTS data_import_batches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_type TEXT NOT NULL CHECK (source_type IN ('captive_payments', 'lytx_events', 'guardian_events', 'driver_data')),
    source_subtype TEXT, -- e.g., 'SMB', 'GSF', 'API', 'CSV'
    file_name TEXT,
    batch_reference TEXT NOT NULL,
    records_processed INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
    error_summary JSONB,
    processing_metadata JSONB,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for performance (captive payments indexes already exist)

CREATE INDEX IF NOT EXISTS idx_lytx_safety_events_vehicle ON lytx_safety_events(vehicle_registration);
CREATE INDEX IF NOT EXISTS idx_lytx_safety_events_driver ON lytx_safety_events(driver_name);
CREATE INDEX IF NOT EXISTS idx_lytx_safety_events_carrier_date ON lytx_safety_events(carrier, event_datetime);
CREATE INDEX IF NOT EXISTS idx_lytx_safety_events_depot_date ON lytx_safety_events(depot, event_datetime);
CREATE INDEX IF NOT EXISTS idx_lytx_safety_events_status ON lytx_safety_events(status);
CREATE INDEX IF NOT EXISTS idx_lytx_safety_events_datetime ON lytx_safety_events(event_datetime);

CREATE INDEX IF NOT EXISTS idx_lytx_event_behaviors_event_id ON lytx_event_behaviors(event_id);
CREATE INDEX IF NOT EXISTS idx_lytx_event_behaviors_behavior_name ON lytx_event_behaviors(behavior_name);

CREATE INDEX IF NOT EXISTS idx_guardian_events_vehicle ON guardian_events(vehicle_registration);
CREATE INDEX IF NOT EXISTS idx_guardian_events_fleet_date ON guardian_events(fleet, occurred_at);
CREATE INDEX IF NOT EXISTS idx_guardian_events_depot_date ON guardian_events(depot, occurred_at);
CREATE INDEX IF NOT EXISTS idx_guardian_events_driver ON guardian_events(driver_name);
CREATE INDEX IF NOT EXISTS idx_guardian_events_severity ON guardian_events(severity);
CREATE INDEX IF NOT EXISTS idx_guardian_events_occurred_at ON guardian_events(occurred_at);

CREATE INDEX IF NOT EXISTS idx_data_import_batches_source_type ON data_import_batches(source_type);
CREATE INDEX IF NOT EXISTS idx_data_import_batches_status ON data_import_batches(status);
CREATE INDEX IF NOT EXISTS idx_data_import_batches_started_at ON data_import_batches(started_at);

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers
CREATE TRIGGER update_captive_payment_records_updated_at 
    BEFORE UPDATE ON captive_payment_records 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lytx_safety_events_updated_at 
    BEFORE UPDATE ON lytx_safety_events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guardian_events_updated_at 
    BEFORE UPDATE ON guardian_events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();