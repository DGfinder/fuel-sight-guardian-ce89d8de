export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      depots: {
        Row: {
          id: string
          location: string | null
          name: string | null
        }
        Insert: {
          id?: string
          location?: string | null
          name?: string | null
        }
        Update: {
          id?: string
          location?: string | null
          name?: string | null
        }
        Relationships: []
      }
      dips: {
        Row: {
          created_at: string | null
          dip_amount: number | null
          id: string
          tank_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          dip_amount?: number | null
          id?: string
          tank_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          dip_amount?: number | null
          id?: string
          tank_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dips_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "fuel_tanks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fuel_tanks: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          location: string
          depot_id: string
          group_id: string
          product_type: 'ADF' | 'ULP' | 'Premium' | 'Diesel'
          current_level: number
          capacity: number
          min_level: number
          safe_level: number
          last_dip_date: string | null
          last_dip_by: string | null
          rolling_avg: number | null
          days_to_min_level: number | null
        }
        Insert: Omit<Database['public']['Tables']['fuel_tanks']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['fuel_tanks']['Insert']>
        Relationships: [
          {
            foreignKeyName: "fuel_tanks_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["id"]
          }
        ]
      }
      tank_alerts: {
        Row: {
          id: string
          tank_id: string
          message: string
          type: 'critical' | 'warning' | 'info'
          acknowledged: boolean
          snooze_until: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tank_alerts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tank_alerts']['Insert']>
        Relationships: [
          {
            foreignKeyName: "tank_alerts_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "fuel_tanks"
            referencedColumns: ["id"]
          }
        ]
      }
      swan_burn_rates: {
        Row: {
          rolling_avg: number | null
          tank_id: string
        }
        Insert: {
          rolling_avg?: number | null
          tank_id: string
        }
        Update: {
          rolling_avg?: number | null
          tank_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swan_burn_rates_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: true
            referencedRelation: "swan_dips_latest"
            referencedColumns: ["tank_id"]
          },
          {
            foreignKeyName: "swan_burn_rates_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: true
            referencedRelation: "swan_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      swan_dips: {
        Row: {
          created_at: string | null
          dip_litres: number | null
          id: string
          refill_detected: boolean | null
          tank_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          dip_litres?: number | null
          id?: string
          refill_detected?: boolean | null
          tank_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          dip_litres?: number | null
          id?: string
          refill_detected?: boolean | null
          tank_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swan_dips_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "swan_dips_latest"
            referencedColumns: ["tank_id"]
          },
          {
            foreignKeyName: "swan_dips_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "swan_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      swan_refills: {
        Row: {
          id: string
          recorded_by: string | null
          refill_litres: number | null
          refill_time: string | null
          tank_id: string | null
        }
        Insert: {
          id?: string
          recorded_by?: string | null
          refill_litres?: number | null
          refill_time?: string | null
          tank_id?: string | null
        }
        Update: {
          id?: string
          recorded_by?: string | null
          refill_litres?: number | null
          refill_time?: string | null
          tank_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swan_refills_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "swan_dips_latest"
            referencedColumns: ["tank_id"]
          },
          {
            foreignKeyName: "swan_refills_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "swan_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      swan_tanks: {
        Row: {
          depot_name: string | null
          id: string
          location: string
          min_level: number | null
          safe_fill: number | null
        }
        Insert: {
          depot_name?: string | null
          id?: string
          location: string
          min_level?: number | null
          safe_fill?: number | null
        }
        Update: {
          depot_name?: string | null
          id?: string
          location?: string
          min_level?: number | null
          safe_fill?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          depot_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          depot_id?: string | null
          role: string
          user_id?: string
        }
        Update: {
          depot_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      swan_dips_latest: {
        Row: {
          days_to_min: number | null
          last_dip_time: string | null
          last_refill_time: string | null
          latest_dip: number | null
          location: string | null
          min_level: number | null
          percent_full: number | null
          safe_fill: number | null
          tank_id: string | null
        }
        Relationships: []
      }
      swan_recent_refills: {
        Row: {
          last_refill_time: string | null
          refill_litres: number | null
          tank_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swan_dips_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "swan_dips_latest"
            referencedColumns: ["tank_id"]
          },
          {
            foreignKeyName: "swan_dips_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "swan_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      swan_rising_after_refill: {
        Row: {
          dip_litres: number | null
          dip_time: string | null
          id: string | null
          last_refill_time: string | null
          location: string | null
          previous_dip: number | null
          tank_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swan_dips_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "swan_dips_latest"
            referencedColumns: ["tank_id"]
          },
          {
            foreignKeyName: "swan_dips_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "swan_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      update_swan_burn_rates: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
