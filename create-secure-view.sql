-- Create secure view for captive deliveries
CREATE OR REPLACE VIEW secure_captive_deliveries 
WITH (security_barrier = true) AS
SELECT * FROM captive_deliveries;

-- Grant permissions
GRANT SELECT ON secure_captive_deliveries TO authenticated;
GRANT SELECT ON secure_captive_deliveries TO anon;