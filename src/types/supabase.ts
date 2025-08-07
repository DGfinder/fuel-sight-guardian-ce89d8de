/*
 * FIXED: Replaced corrupted terminal output with proper TypeScript
 * FIXED: Added comprehensive Database type to resolve import errors
 * OPTIMIZED: Included actual table definitions used in the application
 * UPDATED: RBAC schema migration - added user_group_permissions, removed group_id from user_roles
 * MANUAL REVIEW: Replace with actual generated types from Supabase CLI when authenticated
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tank_groups: {
        Row: {
          id: string
          name: string
          created_at?: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      fuel_tanks: {
        Row: {
          id: string
          location: string
          group_id: string
          subgroup: string | null
          safe_level: number
          current_level: number
          min_level?: number | null
          created_at?: string
        }
        Insert: {
          id?: string
          location: string
          group_id: string
          subgroup?: string | null
          safe_level: number
          current_level: number
          min_level?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          location?: string
          group_id?: string
          subgroup?: string | null
          safe_level?: number
          current_level?: number
          min_level?: number | null
          created_at?: string
        }
      }
      dip_readings: {
        Row: {
          id: string
          tank_id: string
          value: number
          created_at: string
          recorded_by: string
          notes: string | null
          created_by_name: string | null
          archived_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
        }
        Insert: {
          id?: string
          tank_id: string
          value: number
          created_at: string
          recorded_by: string
          notes?: string | null
          created_by_name?: string | null
          archived_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
        }
        Update: {
          id?: string
          tank_id?: string
          value?: number
          created_at?: string
          recorded_by?: string
          notes?: string | null
          created_by_name?: string | null
          archived_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          created_at?: string
        }
        Insert: {
          id?: string
          full_name?: string | null
          email?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          created_at?: string
        }
      }
      user_roles: {
        Row: {
          user_id: string
          role: string
          created_at?: string
        }
        Insert: {
          user_id: string
          role: string
          created_at?: string
        }
        Update: {
          user_id?: string
          role?: string
          created_at?: string
        }
      }
      user_group_permissions: {
        Row: {
          user_id: string
          group_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          group_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          group_id?: string
          created_at?: string
        }
      }
      user_subgroup_permissions: {
        Row: {
          user_id: string
          group_id: string
          subgroup_name: string
          created_at: string
        }
        Insert: {
          user_id: string
          group_id: string
          subgroup_name: string
          created_at?: string
        }
        Update: {
          user_id?: string
          group_id?: string
          subgroup_name?: string
          created_at?: string
        }
      }
      vehicles: {
        Row: {
          id: string
          registration: string
          fleet: 'Stevemacs' | 'Great Southern Fuels'
          depot: string
          status: 'Active' | 'Maintenance' | 'Out of Service' | 'Available'
          make: string | null
          model: string | null
          year: number | null
          vin: string | null
          guardian_unit: string | null
          lytx_device: string | null
          safety_score: number
          fuel_efficiency: number
          utilization: number
          total_deliveries: number
          total_kilometers: number
          fatigue_events: number
          safety_events: number
          last_service: string | null
          next_service: string | null
          registration_expiry: string | null
          insurance_expiry: string | null
          inspection_due: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          registration: string
          fleet: 'Stevemacs' | 'Great Southern Fuels'
          depot: string
          status?: 'Active' | 'Maintenance' | 'Out of Service' | 'Available'
          make?: string | null
          model?: string | null
          year?: number | null
          vin?: string | null
          guardian_unit?: string | null
          lytx_device?: string | null
          safety_score?: number
          fuel_efficiency?: number
          utilization?: number
          total_deliveries?: number
          total_kilometers?: number
          fatigue_events?: number
          safety_events?: number
          last_service?: string | null
          next_service?: string | null
          registration_expiry?: string | null
          insurance_expiry?: string | null
          inspection_due?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          registration?: string
          fleet?: 'Stevemacs' | 'Great Southern Fuels'
          depot?: string
          status?: 'Active' | 'Maintenance' | 'Out of Service' | 'Available'
          make?: string | null
          model?: string | null
          year?: number | null
          vin?: string | null
          guardian_unit?: string | null
          lytx_device?: string | null
          safety_score?: number
          fuel_efficiency?: number
          utilization?: number
          total_deliveries?: number
          total_kilometers?: number
          fatigue_events?: number
          safety_events?: number
          last_service?: string | null
          next_service?: string | null
          registration_expiry?: string | null
          insurance_expiry?: string | null
          inspection_due?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      driver_assignments: {
        Row: {
          id: string
          vehicle_id: string
          driver_name: string
          assigned_at: string
          unassigned_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          vehicle_id: string
          driver_name: string
          assigned_at?: string
          unassigned_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          vehicle_id?: string
          driver_name?: string
          assigned_at?: string
          unassigned_at?: string | null
          created_by?: string | null
        }
      }
      maintenance_records: {
        Row: {
          id: string
          vehicle_id: string
          record_number: string
          type: 'Preventive' | 'Corrective' | 'Inspection' | 'Emergency'
          status: 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled'
          priority: 'Low' | 'Medium' | 'High' | 'Critical'
          description: string
          scheduled_date: string
          completed_date: string | null
          estimated_cost: number | null
          actual_cost: number | null
          workshop: string | null
          technician: string | null
          kilometers: number | null
          estimated_hours: number | null
          actual_hours: number | null
          parts: Json
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          vehicle_id: string
          record_number: string
          type: 'Preventive' | 'Corrective' | 'Inspection' | 'Emergency'
          status?: 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled'
          priority?: 'Low' | 'Medium' | 'High' | 'Critical'
          description: string
          scheduled_date: string
          completed_date?: string | null
          estimated_cost?: number | null
          actual_cost?: number | null
          workshop?: string | null
          technician?: string | null
          kilometers?: number | null
          estimated_hours?: number | null
          actual_hours?: number | null
          parts?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          vehicle_id?: string
          record_number?: string
          type?: 'Preventive' | 'Corrective' | 'Inspection' | 'Emergency'
          status?: 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled'
          priority?: 'Low' | 'Medium' | 'High' | 'Critical'
          description?: string
          scheduled_date?: string
          completed_date?: string | null
          estimated_cost?: number | null
          actual_cost?: number | null
          workshop?: string | null
          technician?: string | null
          kilometers?: number | null
          estimated_hours?: number | null
          actual_hours?: number | null
          parts?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      vehicle_events: {
        Row: {
          id: string
          vehicle_id: string
          event_id: string
          source: 'Guardian' | 'Lytx' | 'Manual'
          event_type: string
          occurred_at: string
          duration: number | null
          speed: number | null
          location: string | null
          latitude: number | null
          longitude: number | null
          driver_name: string | null
          verified: boolean
          status: string | null
          severity: 'Low' | 'Medium' | 'High' | 'Critical' | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          event_id: string
          source: 'Guardian' | 'Lytx' | 'Manual'
          event_type: string
          occurred_at: string
          duration?: number | null
          speed?: number | null
          location?: string | null
          latitude?: number | null
          longitude?: number | null
          driver_name?: string | null
          verified?: boolean
          status?: string | null
          severity?: 'Low' | 'Medium' | 'High' | 'Critical' | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string
          event_id?: string
          source?: 'Guardian' | 'Lytx' | 'Manual'
          event_type?: string
          occurred_at?: string
          duration?: number | null
          speed?: number | null
          location?: string | null
          latitude?: number | null
          longitude?: number | null
          driver_name?: string | null
          verified?: boolean
          status?: string | null
          severity?: 'Low' | 'Medium' | 'High' | 'Critical' | null
          metadata?: Json
          created_at?: string
        }
      }
      asset_compliance: {
        Row: {
          id: string
          vehicle_id: string
          compliance_type: 'registration' | 'insurance' | 'inspection' | 'service'
          due_date: string
          completed_date: string | null
          status: 'Pending' | 'Due Soon' | 'Overdue' | 'Completed'
          alert_sent_at: string | null
          notes: string | null
          document_url: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          vehicle_id: string
          compliance_type: 'registration' | 'insurance' | 'inspection' | 'service'
          due_date: string
          completed_date?: string | null
          status?: 'Pending' | 'Due Soon' | 'Overdue' | 'Completed'
          alert_sent_at?: string | null
          notes?: string | null
          document_url?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          vehicle_id?: string
          compliance_type?: 'registration' | 'insurance' | 'inspection' | 'service'
          due_date?: string
          completed_date?: string | null
          status?: 'Pending' | 'Due Soon' | 'Overdue' | 'Completed'
          alert_sent_at?: string | null
          notes?: string | null
          document_url?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      captive_payment_records: {
        Row: {
          id: string
          bill_of_lading: string
          delivery_date: string
          terminal: string
          customer: string
          product: string
          volume_litres: number
          carrier: 'SMB' | 'GSF' | 'Combined'
          raw_location: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          source_file: string | null
          import_batch_id: string | null
        }
        Insert: {
          id?: string
          bill_of_lading: string
          delivery_date: string
          terminal: string
          customer: string
          product: string
          volume_litres: number
          carrier?: 'SMB' | 'GSF' | 'Combined'
          raw_location?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          source_file?: string | null
          import_batch_id?: string | null
        }
        Update: {
          id?: string
          bill_of_lading?: string
          delivery_date?: string
          terminal?: string
          customer?: string
          product?: string
          volume_litres?: number
          carrier?: 'SMB' | 'GSF' | 'Combined'
          raw_location?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          source_file?: string | null
          import_batch_id?: string | null
        }
      }
      lytx_safety_events: {
        Row: {
          id: string
          event_id: string
          vehicle_registration: string | null
          device_serial: string
          driver_name: string
          employee_id: string | null
          group_name: string
          depot: string
          carrier: 'Stevemacs' | 'Great Southern Fuels'
          event_datetime: string
          timezone: string
          score: number
          status: 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved'
          trigger: string
          behaviors: string
          event_type: 'Coachable' | 'Driver Tagged'
          excluded: boolean
          assigned_date: string | null
          reviewed_by: string | null
          notes: string | null
          raw_data: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          vehicle_registration?: string | null
          device_serial: string
          driver_name: string
          employee_id?: string | null
          group_name: string
          depot: string
          carrier: 'Stevemacs' | 'Great Southern Fuels'
          event_datetime: string
          timezone: string
          score: number
          status: 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved'
          trigger: string
          behaviors: string
          event_type: 'Coachable' | 'Driver Tagged'
          excluded?: boolean
          assigned_date?: string | null
          reviewed_by?: string | null
          notes?: string | null
          raw_data?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          vehicle_registration?: string | null
          device_serial?: string
          driver_name?: string
          employee_id?: string | null
          group_name?: string
          depot?: string
          carrier?: 'Stevemacs' | 'Great Southern Fuels'
          event_datetime?: string
          timezone?: string
          score?: number
          status?: 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved'
          trigger?: string
          behaviors?: string
          event_type?: 'Coachable' | 'Driver Tagged'
          excluded?: boolean
          assigned_date?: string | null
          reviewed_by?: string | null
          notes?: string | null
          raw_data?: Json
          created_at?: string
          updated_at?: string
        }
      }
      lytx_event_behaviors: {
        Row: {
          id: string
          event_id: string
          behavior_id: number
          behavior_name: string
          score: number | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          behavior_id: number
          behavior_name: string
          score?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          behavior_id?: number
          behavior_name?: string
          score?: number | null
          created_at?: string
        }
      }
      guardian_events: {
        Row: {
          id: string
          external_event_id: string
          vehicle_id: string | null
          vehicle_registration: string
          driver_name: string | null
          detection_time: string
          utc_offset: number | null
          timezone: string | null
          latitude: number | null
          longitude: number | null
          event_type: string
          detected_event_type: string | null
          confirmation: string | null
          confirmation_time: string | null
          classification: string | null
          duration_seconds: number | null
          speed_kph: number | null
          travel_metres: number | null
          trip_distance_metres: number | null
          trip_time_seconds: number | null
          audio_alert: boolean
          vibration_alert: boolean
          fleet: string
          account: string | null
          service_provider: string | null
          shift_info: string | null
          crew: string | null
          guardian_unit: string | null
          software_version: string | null
          tags: string | null
          severity: 'Low' | 'Medium' | 'High' | 'Critical'
          verified: boolean
          status: string | null
          depot: string | null
          raw_data: Json | null
          import_batch_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          external_event_id: string
          vehicle_id?: string | null
          vehicle_registration: string
          driver_name?: string | null
          detection_time: string
          utc_offset?: number | null
          timezone?: string | null
          latitude?: number | null
          longitude?: number | null
          event_type: string
          detected_event_type?: string | null
          confirmation?: string | null
          confirmation_time?: string | null
          classification?: string | null
          duration_seconds?: number | null
          speed_kph?: number | null
          travel_metres?: number | null
          trip_distance_metres?: number | null
          trip_time_seconds?: number | null
          audio_alert?: boolean
          vibration_alert?: boolean
          fleet: string
          account?: string | null
          service_provider?: string | null
          shift_info?: string | null
          crew?: string | null
          guardian_unit?: string | null
          software_version?: string | null
          tags?: string | null
          severity?: 'Low' | 'Medium' | 'High' | 'Critical'
          verified?: boolean
          status?: string | null
          depot?: string | null
          raw_data?: Json | null
          import_batch_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          external_event_id?: string
          vehicle_id?: string | null
          vehicle_registration?: string
          driver_name?: string | null
          detection_time?: string
          utc_offset?: number | null
          timezone?: string | null
          latitude?: number | null
          longitude?: number | null
          event_type?: string
          detected_event_type?: string | null
          confirmation?: string | null
          confirmation_time?: string | null
          classification?: string | null
          duration_seconds?: number | null
          speed_kph?: number | null
          travel_metres?: number | null
          trip_distance_metres?: number | null
          trip_time_seconds?: number | null
          audio_alert?: boolean
          vibration_alert?: boolean
          fleet?: string
          account?: string | null
          service_provider?: string | null
          shift_info?: string | null
          crew?: string | null
          guardian_unit?: string | null
          software_version?: string | null
          tags?: string | null
          severity?: 'Low' | 'Medium' | 'High' | 'Critical'
          verified?: boolean
          status?: string | null
          depot?: string | null
          raw_data?: Json | null
          import_batch_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      data_import_batches: {
        Row: {
          id: string
          source_type: 'captive_payments' | 'lytx_events' | 'guardian_events' | 'driver_data'
          source_subtype: string | null
          file_name: string | null
          batch_reference: string
          records_processed: number
          records_failed: number
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial'
          error_summary: Json | null
          processing_metadata: Json | null
          started_at: string
          completed_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          source_type: 'captive_payments' | 'lytx_events' | 'guardian_events' | 'driver_data'
          source_subtype?: string | null
          file_name?: string | null
          batch_reference: string
          records_processed?: number
          records_failed?: number
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'partial'
          error_summary?: Json | null
          processing_metadata?: Json | null
          started_at?: string
          completed_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          source_type?: 'captive_payments' | 'lytx_events' | 'guardian_events' | 'driver_data'
          source_subtype?: string | null
          file_name?: string | null
          batch_reference?: string
          records_processed?: number
          records_failed?: number
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'partial'
          error_summary?: Json | null
          processing_metadata?: Json | null
          started_at?: string
          completed_at?: string | null
          created_by?: string | null
        }
      }
    }
    Views: {
      captive_deliveries: {
        Row: {
          bill_of_lading: string
          delivery_date: string
          customer: string
          terminal: string
          carrier: 'SMB' | 'GSF' | 'Combined'
          products: string[]
          total_volume_litres: number
          total_volume_litres_abs: number
          record_count: number
          first_created_at: string
          last_updated_at: string
          delivery_key: string
        }
      }
      active_vehicles: {
        Row: {
          id: string
          registration: string
          fleet: 'Stevemacs' | 'Great Southern Fuels'
          depot: string
          status: 'Active' | 'Maintenance' | 'Out of Service' | 'Available'
          make: string | null
          model: string | null
          year: number | null
          vin: string | null
          guardian_unit: string | null
          lytx_device: string | null
          safety_score: number
          fuel_efficiency: number
          utilization: number
          total_deliveries: number
          total_kilometers: number
          fatigue_events: number
          safety_events: number
          last_service: string | null
          next_service: string | null
          registration_expiry: string | null
          insurance_expiry: string | null
          inspection_due: string | null
          created_at: string
          updated_at: string
          current_driver: string | null
          driver_assigned_at: string | null
        }
      }
      upcoming_maintenance: {
        Row: {
          id: string
          vehicle_id: string
          record_number: string
          type: 'Preventive' | 'Corrective' | 'Inspection' | 'Emergency'
          status: 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled'
          priority: 'Low' | 'Medium' | 'High' | 'Critical'
          description: string
          scheduled_date: string
          completed_date: string | null
          estimated_cost: number | null
          actual_cost: number | null
          workshop: string | null
          technician: string | null
          kilometers: number | null
          estimated_hours: number | null
          actual_hours: number | null
          parts: Json
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          registration: string
          fleet: 'Stevemacs' | 'Great Southern Fuels'
          depot: string
        }
      }
      compliance_overview: {
        Row: {
          registration: string
          fleet: 'Stevemacs' | 'Great Southern Fuels'
          depot: string
          registration_expiry: string | null
          insurance_expiry: string | null
          inspection_due: string | null
          service_due: string | null
          days_until_next_compliance: number | null
        }
      }
      captive_payments_analytics: {
        Row: {
          carrier: 'SMB' | 'GSF'
          month: string
          year: number
          month_num: number
          total_deliveries: number
          total_volume_litres: number
          total_volume_megalitres: number
          unique_customers: number
          top_customer: string
          top_customer_volume: number
          avg_delivery_size: number
        }
      }
      lytx_safety_analytics: {
        Row: {
          carrier: 'Stevemacs' | 'Great Southern Fuels'
          depot: string
          month: string
          year: number
          month_num: number
          total_events: number
          coachable_events: number
          driver_tagged_events: number
          new_events: number
          resolved_events: number
          avg_score: number
          unique_drivers: number
          high_risk_drivers: number
        }
      }
      cross_analytics_summary: {
        Row: {
          fleet: 'Stevemacs' | 'Great Southern Fuels'
          depot: string
          month: string
          year: number
          month_num: number
          captive_deliveries: number
          captive_volume_ml: number
          safety_events: number
          guardian_events: number
          active_vehicles: number
          avg_safety_score: number
          events_per_vehicle: number
          volume_per_vehicle: number
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper type for table rows
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

// TODO: Replace this placeholder with actual generated types
// Run: supabase login && supabase gen types typescript --project-id wjzsdsvbtapriiuxzmih > src/types/supabase.ts
