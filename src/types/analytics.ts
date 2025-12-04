// Analytics platform type definitions
// Supporting LYTX Safety, Guardian Events, MYOB Deliveries, and cross-source analytics

export interface DataSource {
  id: string;
  name: string;
  type: 'daily_api' | 'monthly_upload' | 'csv_import' | 'webhook';
  description: string;
  upload_frequency: 'daily' | 'monthly' | 'on_demand';
  file_format: string[];
  schema_definition: Record<string, any>;
  connection_config?: Record<string, any>;
  last_sync?: string;
  sync_status: 'active' | 'inactive' | 'error';
  created_at: string;
  updated_at: string;
}

export interface UploadBatch {
  id: string;
  data_source_id: string;
  filename: string;
  upload_type: 'monthly_cfo' | 'historical_import' | 'api_sync';
  file_size: number;
  record_count: number;
  duplicate_count: number;
  error_count: number;
  uploaded_by: string;
  upload_status: 'processing' | 'completed' | 'error';
  processing_notes?: string;
  uploaded_at: string;
  completed_at?: string;
}

// Guardian Events
export interface GuardianEvent {
  id: string;
  event_id: number;
  vehicle_id?: number;
  vehicle: string;
  driver?: string;
  detection_time: string;
  utc_offset?: number;
  event_type: 'distraction' | 'fatigue';
  detected_event_type?: string;
  duration_seconds?: number;
  speed_kph?: number;
  travel_metres?: number;
  latitude?: number;
  longitude?: number;
  audio_alert: boolean;
  vibration_alert: boolean;
  trip_distance_metres?: number;
  trip_time_seconds?: number;
  
  // Verification workflow
  confirmation?: 'verified' | 'normal driving' | 'criteria not met' | 'system error';
  confirmation_time?: string;
  classification?: string;
  
  // Fleet and system info
  fleet?: string;
  timezone?: string;
  account?: string;
  service_provider?: string;
  guardian_unit?: string;
  software_version?: string;
  labels?: string;
  
  // Internal tracking
  monthly_period: string;
  reviewed_by?: string;
  reviewed_at?: string;
  upload_batch_id?: string;
  created_at: string;
  updated_at: string;
}

// MYOB Carrier Deliveries
export interface CarrierDelivery {
  id: string;
  carrier: 'SMB' | 'GSF';
  delivery_date: string;
  bill_of_lading?: string;
  location?: string;
  customer?: string;
  product?: string;
  volume_litres?: number;
  
  // Data management
  is_adjustment: boolean;
  net_volume_litres?: number;
  monthly_period: string;
  upload_batch_id?: string;
  data_checksum?: string;
  created_at: string;
  updated_at: string;
}

// LYTX Safety Events
export interface LytxSafetyEvent {
  id: string;
  event_id: string;
  driver_name?: string;
  employee_id?: string;
  group_location?: string;
  vehicle?: string;
  device?: string;
  event_date: string;
  event_time?: string;
  timezone?: string;
  safety_score?: number;
  status?: 'Resolved' | 'Face-To-Face';
  trigger_type?: string;
  behaviors?: string[];
  
  // Driver assignment workflow
  assigned_driver_id?: string;
  assignment_status: 'unassigned' | 'assigned' | 'reviewed';
  assigned_by?: string;
  assigned_at?: string;
  
  // Review workflow
  video_reviewed: boolean;
  video_url?: string;
  coaching_required: boolean;
  coaching_completed: boolean;
  tags?: string[];
  
  // Data management
  monthly_period: string;
  upload_batch_id?: string;
  created_at: string;
  updated_at: string;
}

// Driver Performance Analytics
export interface DriverPerformanceMonthly {
  id: string;
  driver_name: string;
  employee_id?: string;
  month_year: string;
  
  // LYTX Safety Metrics
  lytx_total_events: number;
  lytx_avg_safety_score?: number;
  lytx_severe_events: number;
  lytx_coaching_sessions: number;
  
  // Guardian Metrics
  guardian_distraction_total: number;
  guardian_distraction_verified: number;
  guardian_fatigue_total: number;
  guardian_fatigue_verified: number;
  guardian_verification_rate?: number;
  
  // MYOB Delivery Metrics
  deliveries_completed: number;
  total_volume_delivered: number;
  delivery_efficiency_score?: number;
  
  // Composite Metrics
  overall_safety_score?: number;
  risk_category: 'low' | 'medium' | 'high' | 'critical';
  performance_trend: 'improving' | 'stable' | 'declining';
  
  // Metadata
  calculated_at: string;
  calculation_version: string;
  created_at: string;
  updated_at: string;
}

// Guardian Compliance Reports
export interface GuardianComplianceReport {
  id: string;
  month_year: string;
  
  // Distraction Summary
  distraction_total_events: number;
  distraction_verified_events: number;
  distraction_verification_rate?: number;
  distraction_false_positives: number;
  distraction_system_errors: number;
  
  // Fatigue Summary
  fatigue_total_events: number;
  fatigue_verified_events: number;
  fatigue_verification_rate?: number;
  fatigue_false_positives: number;
  fatigue_system_errors: number;
  
  // Trends and Analysis
  month_over_month_change?: number;
  year_over_year_change?: number;
  top_risk_vehicles?: string[];
  calibration_issues?: string[];
  
  // Metadata
  generated_by: string;
  generated_at: string;
  report_status: 'draft' | 'final' | 'sent';
  sent_to_compliance_manager: boolean;
}

// Analytics Permissions
export interface AnalyticsPermission {
  id: string;
  user_id: string;
  permission_name: AnalyticsPermissionName;
  granted: boolean;
  granted_by?: string;
  granted_at: string;
}

export type AnalyticsPermissionName = 
  | 'view_guardian_events'
  | 'manage_guardian_verification'
  | 'view_myob_deliveries'
  | 'upload_myob_data'
  | 'view_lytx_events'
  | 'assign_lytx_drivers'
  | 'generate_compliance_reports'
  | 'view_driver_performance'
  | 'manage_data_sources'
  | 'view_analytics_dashboard';

// API Response Types
export interface AnalyticsApiResponse<T> {
  data: T;
  count?: number;
  error?: string;
  status: 'success' | 'error';
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Dashboard Metrics
export interface GuardianMonthlyMetrics {
  month_year: string;
  distraction: {
    total: number;
    verified: number;
    rate: number;
    trend: number;
  };
  fatigue: {
    total: number;
    verified: number;
    rate: number;
    trend: number;
  };
  top_vehicles: string[];
  calibration_issues: string[];
}

export interface DriverRiskProfile {
  driver_name: string;
  employee_id?: string;
  
  // Multi-source risk assessment
  lytx_safety_score: number;
  guardian_verification_rate: number;
  delivery_performance_score: number;
  
  // Composite metrics
  overall_risk_score: number;
  risk_category: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: string[];
  improvement_recommendations: string[];
  
  // Trends
  safety_trend: 'improving' | 'stable' | 'declining';
  recent_incidents: number;
  coaching_status: 'not_required' | 'scheduled' | 'in_progress' | 'completed';
}

export interface FleetAnalytics {
  total_drivers: number;
  active_vehicles: number;
  
  // Safety overview
  monthly_safety_events: number;
  safety_improvement: number;
  high_risk_drivers: number;
  
  // Guardian compliance
  guardian_verification_rate: number;
  monthly_verified_events: number;
  system_performance: number;
  
  // Delivery performance
  monthly_deliveries: number;
  total_volume: number;
  delivery_efficiency: number;
  
  // Cross-source correlations
  safety_delivery_correlation: number;
  risk_optimization_potential: number;
}

// File Upload Types
export interface FileUploadConfig {
  accepted_formats: string[];
  max_file_size: number;
  requires_approval: boolean;
  auto_processing: boolean;
  schema_validation: boolean;
}

export interface FileProcessingResult {
  success: boolean;
  records_processed: number;
  duplicates_found: number;
  errors: string[];
  upload_batch_id: string;
  preview_data?: any[];
}

// Chart and Visualization Types
export interface ChartDataPoint {
  date: string;
  value: number;
  category?: string;
  metadata?: Record<string, any>;
}

export interface TrendAnalysis {
  current_value: number;
  previous_value: number;
  change_percentage: number;
  trend_direction: 'up' | 'down' | 'stable';
  significance: 'low' | 'medium' | 'high';
}

// Filter and Search Types
export interface AnalyticsFilter {
  date_range?: {
    start_date: string;
    end_date: string;
  };
  vehicle?: string[];
  driver?: string[];
  event_type?: string[];
  carrier?: ('SMB' | 'GSF')[];
  verification_status?: string[];
  risk_category?: string[];
}

export interface SearchParams {
  query?: string;
  filters?: AnalyticsFilter;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

// Webhook and Real-time Types
export interface WebhookPayload {
  source: string;
  event_type: string;
  data: Record<string, any>;
  timestamp: string;
  signature?: string;
}

export interface RealtimeUpdate {
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  record: Record<string, any>;
  old_record?: Record<string, any>;
  timestamp: string;
}