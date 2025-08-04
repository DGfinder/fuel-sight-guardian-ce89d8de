-- ============================================================================
-- FLEET MANAGEMENT TABLES
-- ============================================================================

-- Vehicles table - Core asset registry
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration TEXT NOT NULL UNIQUE,
  fleet TEXT NOT NULL CHECK (fleet IN ('Stevemacs', 'Great Southern Fuels')),
  depot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Active', 'Maintenance', 'Out of Service', 'Available')),
  
  -- Vehicle specifications
  make TEXT,
  model TEXT,
  year INTEGER,
  vin TEXT UNIQUE,
  
  -- Device associations
  guardian_unit TEXT,
  lytx_device TEXT,
  
  -- Metrics
  safety_score DECIMAL(3,1) DEFAULT 0.0 CHECK (safety_score >= 0 AND safety_score <= 10),
  fuel_efficiency DECIMAL(4,2) DEFAULT 0.0,
  utilization INTEGER DEFAULT 0 CHECK (utilization >= 0 AND utilization <= 100),
  
  -- Counters
  total_deliveries INTEGER DEFAULT 0,
  total_kilometers INTEGER DEFAULT 0,
  fatigue_events INTEGER DEFAULT 0,
  safety_events INTEGER DEFAULT 0,
  
  -- Service dates
  last_service DATE,
  next_service DATE,
  
  -- Compliance dates
  registration_expiry DATE,
  insurance_expiry DATE,
  inspection_due DATE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Driver assignments table
CREATE TABLE IF NOT EXISTS driver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_name TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Maintenance records table
CREATE TABLE IF NOT EXISTS maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  record_number TEXT NOT NULL UNIQUE, -- e.g., 'MNT-2025-001'
  
  type TEXT NOT NULL CHECK (type IN ('Preventive', 'Corrective', 'Inspection', 'Emergency')),
  status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Overdue', 'Cancelled')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  
  description TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  completed_date DATE,
  
  -- Cost tracking
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  
  -- Work details
  workshop TEXT,
  technician TEXT,
  kilometers INTEGER,
  estimated_hours DECIMAL(4,2),
  actual_hours DECIMAL(4,2),
  
  -- Parts used (stored as JSON array)
  parts JSONB DEFAULT '[]',
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Vehicle events table (for Guardian/Lytx events)
CREATE TABLE IF NOT EXISTS vehicle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL UNIQUE, -- External event ID from Guardian/Lytx
  source TEXT NOT NULL CHECK (source IN ('Guardian', 'Lytx', 'Manual')),
  event_type TEXT NOT NULL,
  
  -- Event details
  occurred_at TIMESTAMPTZ NOT NULL,
  duration DECIMAL(5,2), -- seconds
  speed INTEGER, -- km/h
  location TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Driver information
  driver_name TEXT,
  
  -- Event status
  verified BOOLEAN DEFAULT false,
  status TEXT,
  severity TEXT CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  
  -- Additional data (JSON for flexibility)
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asset compliance tracking (separate from vehicles for detailed tracking)
CREATE TABLE IF NOT EXISTS asset_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  compliance_type TEXT NOT NULL CHECK (compliance_type IN ('registration', 'insurance', 'inspection', 'service')),
  
  due_date DATE NOT NULL,
  completed_date DATE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Due Soon', 'Overdue', 'Completed')),
  
  -- Alert tracking
  alert_sent_at TIMESTAMPTZ,
  
  notes TEXT,
  document_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Vehicle indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_fleet ON vehicles(fleet);
CREATE INDEX IF NOT EXISTS idx_vehicles_depot ON vehicles(depot);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_registration ON vehicles(registration);
CREATE INDEX IF NOT EXISTS idx_vehicles_next_service ON vehicles(next_service);

-- Driver assignment indexes
CREATE INDEX IF NOT EXISTS idx_driver_assignments_vehicle_id ON driver_assignments(vehicle_id);
-- Partial unique index to ensure only one active assignment per vehicle
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_assignments_active_unique 
  ON driver_assignments(vehicle_id) 
  WHERE unassigned_at IS NULL;

-- Maintenance indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_id ON maintenance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_records(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_scheduled_date ON maintenance_records(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_type ON maintenance_records(type);

-- Vehicle events indexes
CREATE INDEX IF NOT EXISTS idx_vehicle_events_vehicle_id ON vehicle_events(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_events_occurred_at ON vehicle_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_events_source ON vehicle_events(source);
CREATE INDEX IF NOT EXISTS idx_vehicle_events_type ON vehicle_events(event_type);

-- Compliance indexes
CREATE INDEX IF NOT EXISTS idx_compliance_vehicle_id ON asset_compliance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_compliance_type ON asset_compliance(compliance_type);
CREATE INDEX IF NOT EXISTS idx_compliance_due_date ON asset_compliance(due_date);
CREATE INDEX IF NOT EXISTS idx_compliance_status ON asset_compliance(status);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update triggers for updated_at
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_maintenance_updated_at BEFORE UPDATE ON maintenance_records 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_compliance_updated_at BEFORE UPDATE ON asset_compliance 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active vehicles with current driver
CREATE OR REPLACE VIEW active_vehicles AS
SELECT 
  v.*,
  da.driver_name as current_driver,
  da.assigned_at as driver_assigned_at
FROM vehicles v
LEFT JOIN driver_assignments da ON v.id = da.vehicle_id AND da.unassigned_at IS NULL
WHERE v.status != 'Out of Service';

-- Upcoming maintenance view
CREATE OR REPLACE VIEW upcoming_maintenance AS
SELECT 
  mr.*,
  v.registration,
  v.fleet,
  v.depot
FROM maintenance_records mr
JOIN vehicles v ON mr.vehicle_id = v.id
WHERE mr.status IN ('Scheduled', 'Overdue')
  AND mr.scheduled_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY mr.scheduled_date;

-- Compliance overview
CREATE OR REPLACE VIEW compliance_overview AS
SELECT 
  v.registration,
  v.fleet,
  v.depot,
  MAX(CASE WHEN ac.compliance_type = 'registration' THEN ac.due_date END) as registration_expiry,
  MAX(CASE WHEN ac.compliance_type = 'insurance' THEN ac.due_date END) as insurance_expiry,
  MAX(CASE WHEN ac.compliance_type = 'inspection' THEN ac.due_date END) as inspection_due,
  MAX(CASE WHEN ac.compliance_type = 'service' THEN ac.due_date END) as service_due,
  MIN(ac.due_date - CURRENT_DATE) as days_until_next_compliance
FROM vehicles v
LEFT JOIN asset_compliance ac ON v.id = ac.vehicle_id
GROUP BY v.id, v.registration, v.fleet, v.depot;

SELECT 'Fleet management tables created successfully' as result;