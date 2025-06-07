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
      dip_readings: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          recorded_by: string
          tank_id: string
          updated_at: string | null
          value: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          recorded_by: string
          tank_id: string
          updated_at?: string | null
          value: number
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          recorded_by?: string
          tank_id?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "dip_readings_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "fuel_tanks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dip_readings_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "tanks_with_latest_dip"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_tanks: {
        Row: {
          created_at: string | null
          current_level: number
          days_to_min_level: number | null
          group_id: string
          id: string
          last_dip_by: string | null
          last_dip_date: string | null
          location: string
          min_level: number | null
          product_type: Database["public"]["Enums"]["product_type"]
          rolling_avg: number | null
          safe_level: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_level?: number
          days_to_min_level?: number | null
          group_id: string
          id?: string
          last_dip_by?: string | null
          last_dip_date?: string | null
          location: string
          min_level?: number | null
          product_type: Database["public"]["Enums"]["product_type"]
          rolling_avg?: number | null
          safe_level: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_level?: number
          days_to_min_level?: number | null
          group_id?: string
          id?: string
          last_dip_by?: string | null
          last_dip_date?: string | null
          location?: string
          min_level?: number | null
          product_type?: Database["public"]["Enums"]["product_type"]
          rolling_avg?: number | null
          safe_level?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_tanks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tank_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tank_alerts: {
        Row: {
          acknowledged_at: string | null
          created_at: string | null
          id: string
          message: string
          snoozed_until: string | null
          tank_id: string
          type: Database["public"]["Enums"]["alert_type"]
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string | null
          id?: string
          message: string
          snoozed_until?: string | null
          tank_id: string
          type: Database["public"]["Enums"]["alert_type"]
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string | null
          id?: string
          message?: string
          snoozed_until?: string | null
          tank_id?: string
          type?: Database["public"]["Enums"]["alert_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tank_alerts_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "fuel_tanks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tank_alerts_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "tanks_with_latest_dip"
            referencedColumns: ["id"]
          },
        ]
      }
      tank_groups: {
        Row: {
          description: string | null
          id: string
          name: string
        }
        Insert: {
          description?: string | null
          id: string
          name: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          group_id: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tank_groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      tanks_with_latest_dip: {
        Row: {
          created_at: string | null
          current_level: number | null
          days_to_min_level: number | null
          group_id: string | null
          group_name: string | null
          id: string | null
          last_dip_by: string | null
          last_dip_date: string | null
          latest_dip_date: string | null
          latest_dip_value: number | null
          location: string | null
          min_level: number | null
          product_type: Database["public"]["Enums"]["product_type"] | null
          rolling_avg: number | null
          safe_level: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_tanks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tank_groups"
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
      alert_type: "low" | "critical" | "offline"
      product_type: "ADF" | "ULP" | "ULP98" | "Diesel"
      user_role: "admin" | "swan_transit" | "gsfs_depots" | "kalgoorlie"
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
    Enums: {
      alert_type: ["low", "critical", "offline"],
      product_type: ["ADF", "ULP", "ULP98", "Diesel"],
      user_role: ["admin", "swan_transit", "gsfs_depots", "kalgoorlie"],
    },
  },
} as const
