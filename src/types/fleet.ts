// Fleet Management Types

export type FleetName = 'Stevemacs' | 'Great Southern Fuels';
export type VehicleStatus = 'Active' | 'Maintenance' | 'Out of Service' | 'Available';
export type MaintenanceType = 'Preventive' | 'Corrective' | 'Inspection' | 'Emergency';
export type MaintenanceStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type ComplianceType = 'registration' | 'insurance' | 'inspection' | 'service';
export type ComplianceStatus = 'Pending' | 'Due Soon' | 'Overdue' | 'Completed';
export type EventSource = 'Guardian' | 'Lytx' | 'Manual';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

// Driver management types
export type DriverStatus = 'Active' | 'Inactive' | 'On Leave' | 'Terminated';
export type SystemName = 'Standard' | 'LYTX' | 'MYOB' | 'MtData' | 'SmartFuel' | 'Guardian' | 'Hours';
export type PeriodType = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
export type PerformanceRating = 'Excellent' | 'Good' | 'Average' | 'Below Average' | 'Poor';
export type RiskLevel = 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
export type Trend = 'Improving' | 'Stable' | 'Declining';
export type IncidentType = 'Safety Event' | 'Traffic Violation' | 'Customer Complaint' | 'Equipment Damage' | 'Policy Violation' | 'Accident';
export type IncidentSourceSystem = 'LYTX' | 'Guardian' | 'Manual' | 'Customer' | 'Police' | 'Insurance';
export type IncidentStatus = 'Open' | 'Under Review' | 'Resolved' | 'Closed' | 'Disputed';

export interface Vehicle {
  id: string;
  registration: string;
  fleet: FleetName;
  depot: string;
  status: VehicleStatus;
  
  // Vehicle specifications
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  
  // Device associations
  guardian_unit?: string;
  lytx_device?: string;
  
  // Metrics
  safety_score: number;
  fuel_efficiency: number;
  utilization: number;
  
  // Counters
  total_deliveries: number;
  total_kilometers: number;
  fatigue_events: number;
  safety_events: number;
  
  // Service dates
  last_service?: string;
  next_service?: string;
  
  // Compliance dates
  registration_expiry?: string;
  insurance_expiry?: string;
  inspection_due?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  
  // Relations
  current_driver?: string;
  driver_assigned_at?: string;
}

export interface DriverAssignment {
  id: string;
  vehicle_id: string;
  driver_name: string;
  driver_id?: string; // New field linking to drivers table
  assigned_at: string;
  unassigned_at?: string;
  created_by?: string;
}

// New driver management interfaces
export interface Driver {
  id: string;
  
  // Personal information
  first_name: string;
  last_name: string;
  preferred_name?: string;
  
  // Employment details
  employee_id?: string;
  fleet: FleetName;
  depot: string;
  hire_date?: string;
  status: DriverStatus;
  
  // Contact information
  email?: string;
  phone?: string;
  address?: string;
  
  // Licensing and certifications
  drivers_license?: string;
  license_expiry?: string;
  certifications: Array<{
    name: string;
    expiry_date?: string;
    issuer?: string;
  }>;
  
  // Performance metrics (cached)
  safety_score: number;
  lytx_score: number;
  guardian_score: number;
  overall_performance_rating?: PerformanceRating;
  
  // Metadata
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface DriverNameMapping {
  id: string;
  driver_id: string;
  system_name: SystemName;
  mapped_name: string;
  is_primary: boolean;
  confidence_score: number;
  created_at: string;
  created_by?: string;
}

export interface DriverPerformanceMetrics {
  id: string;
  driver_id: string;
  
  // Time period
  period_start: string;
  period_end: string;
  period_type: PeriodType;
  
  // LYTX safety metrics
  lytx_events_count: number;
  lytx_safety_score: number;
  lytx_harsh_acceleration: number;
  lytx_harsh_braking: number;
  lytx_harsh_cornering: number;
  lytx_speeding_events: number;
  lytx_following_too_close: number;
  
  // Guardian safety metrics
  guardian_events_count: number;
  guardian_safety_score: number;
  guardian_fuel_events: number;
  guardian_safety_violations: number;
  
  // Delivery and operational metrics
  total_deliveries: number;
  total_kilometers: number;
  average_delivery_time?: number;
  fuel_efficiency: number;
  
  // Performance indicators
  on_time_delivery_rate: number;
  customer_feedback_score: number;
  
  // Risk assessment
  risk_level?: RiskLevel;
  trend?: Trend;
  
  // Metadata
  last_calculated: string;
  created_at: string;
}

export interface DriverIncident {
  id: string;
  driver_id: string;
  vehicle_id?: string;
  
  // Incident details
  incident_type: IncidentType;
  source_system: IncidentSourceSystem;
  external_incident_id?: string;
  
  // When and where
  incident_date: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  
  // Incident details
  description: string;
  severity: Severity;
  status: IncidentStatus;
  
  // Resolution
  resolution?: string;
  resolved_at?: string;
  resolved_by?: string;
  
  // Actions taken
  actions_taken?: string;
  training_required: boolean;
  disciplinary_action?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by?: string;
  
  // Relations
  driver?: Driver;
  vehicle?: Vehicle;
}

export interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  record_number: string;
  
  type: MaintenanceType;
  status: MaintenanceStatus;
  priority: Priority;
  
  description: string;
  scheduled_date: string;
  completed_date?: string;
  
  // Cost tracking
  estimated_cost?: number;
  actual_cost?: number;
  
  // Work details
  workshop?: string;
  technician?: string;
  kilometers?: number;
  estimated_hours?: number;
  actual_hours?: number;
  
  // Parts used
  parts: string[];
  
  notes?: string;
  
  created_at: string;
  updated_at: string;
  created_by?: string;
  
  // Relations
  vehicle?: Vehicle;
}

export interface VehicleEvent {
  id: string;
  vehicle_id: string;
  event_id: string;
  source: EventSource;
  event_type: string;
  
  // Event details
  occurred_at: string;
  duration?: number;
  speed?: number;
  location?: string;
  latitude?: number;
  longitude?: number;
  
  // Driver information
  driver_name?: string;
  
  // Event status
  verified: boolean;
  status?: string;
  severity?: Severity;
  
  // Additional data
  metadata?: Record<string, any>;
  
  created_at: string;
  
  // Relations
  vehicle?: Vehicle;
}

export interface AssetCompliance {
  id: string;
  vehicle_id: string;
  compliance_type: ComplianceType;
  
  due_date: string;
  completed_date?: string;
  status: ComplianceStatus;
  
  // Alert tracking
  alert_sent_at?: string;
  
  notes?: string;
  document_url?: string;
  
  created_at: string;
  updated_at: string;
  created_by?: string;
  
  // Relations
  vehicle?: Vehicle;
}

// View types
export interface ActiveVehicle extends Vehicle {
  current_driver?: string;
  driver_assigned_at?: string;
}

export interface UpcomingMaintenance extends MaintenanceRecord {
  registration: string;
  fleet: FleetName;
  depot: string;
}

export interface ComplianceOverview {
  registration: string;
  fleet: FleetName;
  depot: string;
  registration_expiry?: string;
  insurance_expiry?: string;
  inspection_due?: string;
  service_due?: string;
  days_until_next_compliance?: number;
}

// Filter and query types
export interface VehicleFilters {
  fleet?: FleetName;
  depot?: string;
  status?: VehicleStatus;
  search?: string;
}

export interface MaintenanceFilters {
  vehicle_id?: string;
  type?: MaintenanceType;
  status?: MaintenanceStatus;
  from_date?: string;
  to_date?: string;
}

export interface EventFilters {
  vehicle_id?: string;
  source?: EventSource;
  event_type?: string;
  from_date?: string;
  to_date?: string;
  verified?: boolean;
}

// Driver view types
export interface DriverProfile extends Driver {
  current_vehicle_id?: string;
  current_vehicle_registration?: string;
  current_assignment_date?: string;
  
  // Name mappings as object
  name_mappings: Record<string, {
    name: string;
    is_primary: boolean;
    confidence: number;
  }>;
  
  // Latest performance data
  latest_lytx_score?: number;
  latest_guardian_score?: number;
  current_risk_level?: RiskLevel;
  performance_trend?: Trend;
  
  // Recent incident counts
  recent_incidents: number;
  recent_high_severity_incidents: number;
}

export interface DriverPerformanceSummary {
  driver_id: string;
  first_name: string;
  last_name: string;
  fleet: FleetName;
  depot: string;
  status: DriverStatus;
  
  // Latest metrics
  lytx_safety_score?: number;
  guardian_safety_score?: number;
  total_deliveries?: number;
  total_kilometers?: number;
  fuel_efficiency?: number;
  on_time_delivery_rate?: number;
  risk_level?: RiskLevel;
  trend?: Trend;
  
  // YTD aggregates
  ytd_deliveries?: number;
  ytd_kilometers?: number;
  ytd_incidents?: number;
  
  // Performance rankings (percentile within fleet)
  lytx_percentile?: number;
  guardian_percentile?: number;
}

// Driver filter types
export interface DriverFilters {
  fleet?: FleetName;
  depot?: string;
  status?: DriverStatus;
  risk_level?: RiskLevel;
  search?: string;
  has_incidents?: boolean;
  license_expiring?: boolean; // within 30 days
}

export interface DriverPerformanceFilters {
  driver_id?: string;
  period_type?: PeriodType;
  from_date?: string;
  to_date?: string;
  risk_level?: RiskLevel;
  trend?: Trend;
}

export interface DriverIncidentFilters {
  driver_id?: string;
  vehicle_id?: string;
  incident_type?: IncidentType;
  source_system?: IncidentSourceSystem;
  severity?: Severity;
  status?: IncidentStatus;
  from_date?: string;
  to_date?: string;
}