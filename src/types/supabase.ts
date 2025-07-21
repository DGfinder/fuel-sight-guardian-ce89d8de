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
      tanks_with_rolling_avg: {
        Row: {
          id: string
          location: string
          group_id: string
          subgroup: string | null
          safe_level: number
          current_level: number
          current_level_percent: number
          min_level?: number | null
        }
        Insert: never
        Update: never
      }
    }
    Views: {
      [_ in never]: never
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
