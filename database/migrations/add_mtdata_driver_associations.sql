-- Migration: Add driver association fields to mtdata_trip_history
-- Purpose: Enable foreign key relationships between MtData trips and drivers
-- Date: 2025-08-21

-- Add driver association fields to mtdata_trip_history table
ALTER TABLE mtdata_trip_history 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS driver_association_confidence DECIMAL(3,2) CHECK (driver_association_confidence >= 0.0 AND driver_association_confidence <= 1.0),
ADD COLUMN IF NOT EXISTS driver_association_method TEXT CHECK (driver_association_method IN ('exact_match', 'fuzzy_match', 'manual_assignment', 'employee_id_match')),
ADD COLUMN IF NOT EXISTS driver_association_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mtdata_trips_driver_id ON mtdata_trip_history(driver_id);
CREATE INDEX IF NOT EXISTS idx_mtdata_trips_driver_name ON mtdata_trip_history(driver_name);
CREATE INDEX IF NOT EXISTS idx_mtdata_trips_driver_confidence ON mtdata_trip_history(driver_association_confidence);

-- Add comments for documentation
COMMENT ON COLUMN mtdata_trip_history.driver_id IS 'Foreign key reference to drivers table - resolved driver association';
COMMENT ON COLUMN mtdata_trip_history.driver_association_confidence IS 'Confidence score (0.0-1.0) indicating quality of driver association match';
COMMENT ON COLUMN mtdata_trip_history.driver_association_method IS 'Method used to associate driver: exact_match, fuzzy_match, manual_assignment, employee_id_match';
COMMENT ON COLUMN mtdata_trip_history.driver_association_updated_at IS 'Timestamp when driver association was last updated';