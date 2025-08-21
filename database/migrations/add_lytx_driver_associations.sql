-- Migration: Add driver association fields to lytx_safety_events
-- Purpose: Enable proper foreign key relationships between LYTX events and drivers
-- Date: 2025-08-21

-- Add driver association fields to lytx_safety_events table
ALTER TABLE lytx_safety_events 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS driver_association_confidence DECIMAL(3,2) CHECK (driver_association_confidence >= 0.0 AND driver_association_confidence <= 1.0),
ADD COLUMN IF NOT EXISTS driver_association_method TEXT CHECK (driver_association_method IN ('exact_match', 'fuzzy_match', 'manual_assignment', 'employee_id_match')),
ADD COLUMN IF NOT EXISTS driver_association_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lytx_events_driver_id ON lytx_safety_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_lytx_events_driver_name ON lytx_safety_events(driver_name);
CREATE INDEX IF NOT EXISTS idx_lytx_events_driver_confidence ON lytx_safety_events(driver_association_confidence);
CREATE INDEX IF NOT EXISTS idx_lytx_events_carrier_driver ON lytx_safety_events(carrier, driver_id);

-- Create composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_lytx_events_driver_date ON lytx_safety_events(driver_id, event_datetime) WHERE driver_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN lytx_safety_events.driver_id IS 'Foreign key reference to drivers table - resolved driver association';
COMMENT ON COLUMN lytx_safety_events.driver_association_confidence IS 'Confidence score (0.0-1.0) indicating quality of driver association match';
COMMENT ON COLUMN lytx_safety_events.driver_association_method IS 'Method used to associate driver: exact_match, fuzzy_match, manual_assignment, employee_id_match';
COMMENT ON COLUMN lytx_safety_events.driver_association_updated_at IS 'Timestamp when driver association was last updated';

-- Create function to update driver association timestamp
CREATE OR REPLACE FUNCTION update_lytx_driver_association_timestamp()
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

-- Create trigger to automatically update timestamp when driver association changes
DROP TRIGGER IF EXISTS trigger_update_lytx_driver_association_timestamp ON lytx_safety_events;
CREATE TRIGGER trigger_update_lytx_driver_association_timestamp
    BEFORE UPDATE ON lytx_safety_events
    FOR EACH ROW
    EXECUTE FUNCTION update_lytx_driver_association_timestamp();

-- Create view for driver association quality metrics
CREATE OR REPLACE VIEW lytx_driver_association_quality AS
SELECT 
    carrier,
    depot,
    COUNT(*) as total_events,
    COUNT(driver_id) as associated_events,
    COUNT(*) - COUNT(driver_id) as unassociated_events,
    ROUND((COUNT(driver_id)::DECIMAL / COUNT(*)) * 100, 2) as association_rate_percent,
    ROUND(AVG(driver_association_confidence), 3) as avg_confidence,
    COUNT(CASE WHEN driver_association_confidence >= 0.9 THEN 1 END) as high_confidence_matches,
    COUNT(CASE WHEN driver_association_confidence BETWEEN 0.7 AND 0.89 THEN 1 END) as medium_confidence_matches,
    COUNT(CASE WHEN driver_association_confidence < 0.7 THEN 1 END) as low_confidence_matches,
    COUNT(DISTINCT driver_id) as unique_drivers,
    COUNT(DISTINCT CASE WHEN driver_association_method = 'manual_assignment' THEN event_id END) as manual_assignments
FROM lytx_safety_events
GROUP BY carrier, depot
ORDER BY carrier, depot;

-- Create summary view for overall association metrics
CREATE OR REPLACE VIEW lytx_driver_association_summary AS
SELECT 
    COUNT(*) as total_lytx_events,
    COUNT(driver_id) as events_with_drivers,
    COUNT(*) - COUNT(driver_id) as events_without_drivers,
    ROUND((COUNT(driver_id)::DECIMAL / COUNT(*)) * 100, 2) as overall_association_rate,
    ROUND(AVG(driver_association_confidence), 3) as average_confidence,
    COUNT(DISTINCT driver_id) as unique_drivers_in_lytx,
    COUNT(CASE WHEN driver_association_method = 'exact_match' THEN 1 END) as exact_matches,
    COUNT(CASE WHEN driver_association_method = 'fuzzy_match' THEN 1 END) as fuzzy_matches,
    COUNT(CASE WHEN driver_association_method = 'employee_id_match' THEN 1 END) as employee_id_matches,
    COUNT(CASE WHEN driver_association_method = 'manual_assignment' THEN 1 END) as manual_assignments,
    MAX(driver_association_updated_at) as last_association_update
FROM lytx_safety_events;

-- Grant necessary permissions
GRANT SELECT ON lytx_driver_association_quality TO authenticated;
GRANT SELECT ON lytx_driver_association_summary TO authenticated;