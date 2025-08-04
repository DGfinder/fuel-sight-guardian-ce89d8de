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
    }
    Views: {
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
