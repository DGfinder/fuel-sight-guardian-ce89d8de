-- =====================================================
-- Complete Guardian Driver Associations Migration
-- =====================================================
-- Extends the Guardian driver associations with vehicle-based assignment support
-- and implements the vehicle-to-driver association strategy
--
-- Author: Claude Code  
-- Created: 2025-08-25

BEGIN;

-- =====================================================
-- 1. APPLY BASE GUARDIAN DRIVER ASSOCIATIONS
-- =====================================================

-- Add driver association fields to guardian_events table
ALTER TABLE guardian_events 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS driver_association_confidence DECIMAL(3,2) CHECK (driver_association_confidence >= 0.0 AND driver_association_confidence <= 1.0),
ADD COLUMN IF NOT EXISTS driver_association_method TEXT CHECK (driver_association_method IN ('exact_match', 'fuzzy_match', 'manual_assignment', 'employee_id_match', 'vehicle_assignment')),
ADD COLUMN IF NOT EXISTS driver_association_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_guardian_events_driver_id ON guardian_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_guardian_events_driver_name ON guardian_events(driver_name);
CREATE INDEX IF NOT EXISTS idx_guardian_events_driver_confidence ON guardian_events(driver_association_confidence);
CREATE INDEX IF NOT EXISTS idx_guardian_events_vehicle_reg ON guardian_events(vehicle_registration);

-- Create composite index for vehicle-based queries
CREATE INDEX IF NOT EXISTS idx_guardian_events_vehicle_driver ON guardian_events(vehicle_registration, driver_id);
CREATE INDEX IF NOT EXISTS idx_guardian_events_driver_date ON guardian_events(driver_id, detection_time) WHERE driver_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN guardian_events.driver_id IS 'Foreign key reference to drivers table - resolved driver association';
COMMENT ON COLUMN guardian_events.driver_association_confidence IS 'Confidence score (0.0-1.0) indicating quality of driver association match';
COMMENT ON COLUMN guardian_events.driver_association_method IS 'Method used to associate driver: exact_match, fuzzy_match, manual_assignment, employee_id_match, vehicle_assignment';
COMMENT ON COLUMN guardian_events.driver_association_updated_at IS 'Timestamp when driver association was last updated';

-- Create trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_guardian_driver_association_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.driver_id IS DISTINCT FROM OLD.driver_id OR
       NEW.driver_association_confidence IS DISTINCT FROM OLD.driver_association_confidence OR
       NEW.driver_association_method IS DISTINCT FROM OLD.driver_association_method THEN
        NEW.driver_association_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_guardian_driver_association_timestamp ON guardian_events;
CREATE TRIGGER trigger_update_guardian_driver_association_timestamp
    BEFORE UPDATE ON guardian_events
    FOR EACH ROW
    EXECUTE FUNCTION update_guardian_driver_association_timestamp();

COMMIT;