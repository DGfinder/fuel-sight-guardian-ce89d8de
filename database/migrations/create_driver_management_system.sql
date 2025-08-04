-- ============================================================================
-- DRIVER MANAGEMENT SYSTEM
-- Comprehensive driver database with multi-system name mapping and performance tracking
-- ============================================================================

-- Drivers table - Master driver registry
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Personal information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  preferred_name TEXT, -- e.g., "Mike" instead of "Michael"
  
  -- Employment details
  employee_id TEXT UNIQUE, -- Company employee ID
  fleet TEXT NOT NULL CHECK (fleet IN ('Stevemacs', 'Great Southern Fuels')),
  depot TEXT NOT NULL,
  hire_date DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'On Leave', 'Terminated')),
  
  -- Contact information
  email TEXT,
  phone TEXT,
  address TEXT,
  
  -- Licensing and certifications
  drivers_license TEXT,
  license_expiry DATE,
  certifications JSONB DEFAULT '[]', -- Array of certifications with expiry dates
  
  -- Performance metrics (cached from performance_metrics table)
  safety_score DECIMAL(3,1) DEFAULT 0.0 CHECK (safety_score >= 0 AND safety_score <= 10),
  lytx_score DECIMAL(3,1) DEFAULT 0.0,
  guardian_score DECIMAL(3,1) DEFAULT 0.0,
  overall_performance_rating TEXT CHECK (overall_performance_rating IN ('Excellent', 'Good', 'Average', 'Below Average', 'Poor')),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Driver name mappings table - Handle name variations across different systems
CREATE TABLE IF NOT EXISTS driver_name_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  
  -- System and name mapping
  system_name TEXT NOT NULL CHECK (system_name IN ('Standard', 'LYTX', 'MYOB', 'MtData', 'SmartFuel', 'Guardian', 'Hours')),
  mapped_name TEXT NOT NULL,
  
  -- Additional context
  is_primary BOOLEAN DEFAULT false, -- Primary name for this system
  confidence_score DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Ensure unique system-name combinations per driver
  UNIQUE(driver_id, system_name, mapped_name)
);

-- Driver performance metrics table - Aggregated performance data from all sources
CREATE TABLE IF NOT EXISTS driver_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  
  -- Time period for metrics
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly')),
  
  -- LYTX safety metrics
  lytx_events_count INTEGER DEFAULT 0,
  lytx_safety_score DECIMAL(3,1) DEFAULT 0.0,
  lytx_harsh_acceleration INTEGER DEFAULT 0,
  lytx_harsh_braking INTEGER DEFAULT 0,
  lytx_harsh_cornering INTEGER DEFAULT 0,
  lytx_speeding_events INTEGER DEFAULT 0,
  lytx_following_too_close INTEGER DEFAULT 0,
  
  -- Guardian safety metrics
  guardian_events_count INTEGER DEFAULT 0,
  guardian_safety_score DECIMAL(3,1) DEFAULT 0.0,
  guardian_fuel_events INTEGER DEFAULT 0,
  guardian_safety_violations INTEGER DEFAULT 0,
  
  -- Delivery and operational metrics
  total_deliveries INTEGER DEFAULT 0,
  total_kilometers DECIMAL(10,2) DEFAULT 0.0,
  average_delivery_time DECIMAL(5,2), -- in hours
  fuel_efficiency DECIMAL(4,2) DEFAULT 0.0, -- km per liter
  
  -- Performance indicators
  on_time_delivery_rate DECIMAL(5,2) DEFAULT 0.0, -- percentage
  customer_feedback_score DECIMAL(3,1) DEFAULT 0.0,
  
  -- Risk assessment
  risk_level TEXT CHECK (risk_level IN ('Very Low', 'Low', 'Medium', 'High', 'Very High')),
  trend TEXT CHECK (trend IN ('Improving', 'Stable', 'Declining')),
  
  -- Metadata
  last_calculated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique period per driver
  UNIQUE(driver_id, period_start, period_end, period_type)
);

-- Driver incidents table - Track all safety incidents and violations
CREATE TABLE IF NOT EXISTS driver_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  
  -- Incident details
  incident_type TEXT NOT NULL CHECK (incident_type IN ('Safety Event', 'Traffic Violation', 'Customer Complaint', 'Equipment Damage', 'Policy Violation', 'Accident')),
  source_system TEXT NOT NULL CHECK (source_system IN ('LYTX', 'Guardian', 'Manual', 'Customer', 'Police', 'Insurance')),
  external_incident_id TEXT, -- ID from external system (LYTX, Guardian, etc.)
  
  -- When and where
  incident_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Incident details
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Under Review', 'Resolved', 'Closed', 'Disputed')),
  
  -- Resolution
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  
  -- Actions taken
  actions_taken TEXT,
  training_required BOOLEAN DEFAULT false,
  disciplinary_action TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- ENHANCE EXISTING DRIVER_ASSIGNMENTS TABLE
-- ============================================================================

-- Add driver_id column to existing driver_assignments table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'driver_assignments' AND column_name = 'driver_id'
  ) THEN
    ALTER TABLE driver_assignments ADD COLUMN driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Driver indexes
CREATE INDEX IF NOT EXISTS idx_drivers_fleet ON drivers(fleet);
CREATE INDEX IF NOT EXISTS idx_drivers_depot ON drivers(depot);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_employee_id ON drivers(employee_id);
CREATE INDEX IF NOT EXISTS idx_drivers_name ON drivers(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_drivers_license_expiry ON drivers(license_expiry);

-- Driver name mappings indexes
CREATE INDEX IF NOT EXISTS idx_driver_mappings_driver_id ON driver_name_mappings(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_mappings_system ON driver_name_mappings(system_name);
CREATE INDEX IF NOT EXISTS idx_driver_mappings_name ON driver_name_mappings(mapped_name);
CREATE INDEX IF NOT EXISTS idx_driver_mappings_primary ON driver_name_mappings(driver_id, system_name) WHERE is_primary = true;

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_performance_driver_id ON driver_performance_metrics(driver_id);
CREATE INDEX IF NOT EXISTS idx_performance_period ON driver_performance_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_performance_type ON driver_performance_metrics(period_type);
CREATE INDEX IF NOT EXISTS idx_performance_risk ON driver_performance_metrics(risk_level);

-- Incidents indexes
CREATE INDEX IF NOT EXISTS idx_incidents_driver_id ON driver_incidents(driver_id);
CREATE INDEX IF NOT EXISTS idx_incidents_vehicle_id ON driver_incidents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_incidents_date ON driver_incidents(incident_date DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON driver_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON driver_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON driver_incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_external_id ON driver_incidents(external_incident_id);

-- Enhanced driver assignments indexes
CREATE INDEX IF NOT EXISTS idx_driver_assignments_driver_id ON driver_assignments(driver_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update triggers for updated_at
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_driver_incidents_updated_at BEFORE UPDATE ON driver_incidents 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Complete driver profile view with current assignment
CREATE OR REPLACE VIEW driver_profiles AS
SELECT 
  d.*,
  da.vehicle_id as current_vehicle_id,
  v.registration as current_vehicle_registration,
  da.assigned_at as current_assignment_date,
  
  -- Name mappings as JSON
  COALESCE(
    json_object_agg(
      dnm.system_name, 
      json_build_object(
        'name', dnm.mapped_name,
        'is_primary', dnm.is_primary,
        'confidence', dnm.confidence_score
      )
    ) FILTER (WHERE dnm.id IS NOT NULL),
    '{}'::json
  ) as name_mappings,
  
  -- Latest performance metrics
  dpm.lytx_safety_score as latest_lytx_score,
  dpm.guardian_safety_score as latest_guardian_score,
  dpm.risk_level as current_risk_level,
  dpm.trend as performance_trend,
  
  -- Incident counts (last 30 days)
  COALESCE(di_counts.total_incidents, 0) as recent_incidents,
  COALESCE(di_counts.high_severity_incidents, 0) as recent_high_severity_incidents

FROM drivers d
LEFT JOIN driver_assignments da ON d.id = da.driver_id AND da.unassigned_at IS NULL
LEFT JOIN vehicles v ON da.vehicle_id = v.id
LEFT JOIN driver_name_mappings dnm ON d.id = dnm.driver_id
LEFT JOIN driver_performance_metrics dpm ON d.id = dpm.driver_id 
  AND dpm.period_type = 'Monthly' 
  AND dpm.period_end = (
    SELECT MAX(period_end) 
    FROM driver_performance_metrics dpm2 
    WHERE dpm2.driver_id = d.id AND dpm2.period_type = 'Monthly'
  )
LEFT JOIN (
  SELECT 
    driver_id,
    COUNT(*) as total_incidents,
    COUNT(*) FILTER (WHERE severity IN ('High', 'Critical')) as high_severity_incidents
  FROM driver_incidents 
  WHERE incident_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY driver_id
) di_counts ON d.id = di_counts.driver_id

GROUP BY d.id, da.vehicle_id, v.registration, da.assigned_at, 
         dpm.lytx_safety_score, dpm.guardian_safety_score, dpm.risk_level, dpm.trend,
         di_counts.total_incidents, di_counts.high_severity_incidents;

-- Driver performance summary view
CREATE OR REPLACE VIEW driver_performance_summary AS
SELECT 
  d.id as driver_id,
  d.first_name,
  d.last_name,
  d.fleet,
  d.depot,
  d.status,
  
  -- Latest monthly metrics
  dpm.lytx_safety_score,
  dpm.guardian_safety_score,
  dpm.total_deliveries,
  dpm.total_kilometers,
  dpm.fuel_efficiency,
  dpm.on_time_delivery_rate,
  dpm.risk_level,
  dpm.trend,
  
  -- YTD aggregates
  ytd.ytd_deliveries,
  ytd.ytd_kilometers,
  ytd.ytd_incidents,
  
  -- Rankings (percentile within fleet)
  PERCENT_RANK() OVER (
    PARTITION BY d.fleet 
    ORDER BY dpm.lytx_safety_score DESC
  ) * 100 as lytx_percentile,
  
  PERCENT_RANK() OVER (
    PARTITION BY d.fleet 
    ORDER BY dpm.guardian_safety_score DESC
  ) * 100 as guardian_percentile

FROM drivers d
LEFT JOIN driver_performance_metrics dpm ON d.id = dpm.driver_id 
  AND dpm.period_type = 'Monthly' 
  AND dpm.period_end = (
    SELECT MAX(period_end) 
    FROM driver_performance_metrics dpm2 
    WHERE dpm2.driver_id = d.id AND dpm2.period_type = 'Monthly'
  )
LEFT JOIN (
  SELECT 
    driver_id,
    SUM(total_deliveries) as ytd_deliveries,
    SUM(total_kilometers) as ytd_kilometers,
    SUM(lytx_events_count + guardian_events_count) as ytd_incidents
  FROM driver_performance_metrics 
  WHERE period_start >= DATE_TRUNC('year', CURRENT_DATE)
  GROUP BY driver_id
) ytd ON d.id = ytd.driver_id

WHERE d.status = 'Active';

SELECT 'Driver management system created successfully' as result;