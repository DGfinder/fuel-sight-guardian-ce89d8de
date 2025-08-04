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
  assigned_at: string;
  unassigned_at?: string;
  created_by?: string;
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