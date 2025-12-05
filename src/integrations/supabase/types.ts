export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      customer_account_preferences: {
        Row: {
          created_at: string | null
          customer_account_id: string
          default_chart_days: number | null
          default_critical_threshold_pct: number | null
          default_warning_threshold_pct: number | null
          delivery_notification_email: string | null
          enable_delivery_confirmations: boolean | null
          enable_low_fuel_alerts: boolean | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_account_id: string
          default_chart_days?: number | null
          default_critical_threshold_pct?: number | null
          default_warning_threshold_pct?: number | null
          delivery_notification_email?: string | null
          enable_delivery_confirmations?: boolean | null
          enable_low_fuel_alerts?: boolean | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_account_id?: string
          default_chart_days?: number | null
          default_critical_threshold_pct?: number | null
          default_warning_threshold_pct?: number | null
          delivery_notification_email?: string | null
          enable_delivery_confirmations?: boolean | null
          enable_low_fuel_alerts?: boolean | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_account_preferences_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: true
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_account_preferences_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: true
            referencedRelation: "customer_accounts_with_tank_count"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_accounts: {
        Row: {
          account_type: string | null
          admin_notes: string | null
          company_name: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          customer_contact_id: string | null
          customer_guid: string | null
          customer_name: string
          email_notifications: boolean | null
          force_password_change: boolean | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          logo_url: string | null
          logo_url_dark: string | null
          password_changed_at: string | null
          primary_color: string | null
          primary_color_dark: string | null
          secondary_color: string | null
          secondary_color_dark: string | null
          sms_notifications: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_type?: string | null
          admin_notes?: string | null
          company_name?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_contact_id?: string | null
          customer_guid?: string | null
          customer_name: string
          email_notifications?: boolean | null
          force_password_change?: boolean | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          logo_url?: string | null
          logo_url_dark?: string | null
          password_changed_at?: string | null
          primary_color?: string | null
          primary_color_dark?: string | null
          secondary_color?: string | null
          secondary_color_dark?: string | null
          sms_notifications?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_type?: string | null
          admin_notes?: string | null
          company_name?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_contact_id?: string | null
          customer_guid?: string | null
          customer_name?: string
          email_notifications?: boolean | null
          force_password_change?: boolean | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          logo_url?: string | null
          logo_url_dark?: string | null
          password_changed_at?: string | null
          primary_color?: string | null
          primary_color_dark?: string | null
          secondary_color?: string | null
          secondary_color_dark?: string | null
          sms_notifications?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_accounts_customer_contact_id_fkey"
            columns: ["customer_contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contact_tanks: {
        Row: {
          agbot_location_id: string
          created_at: string | null
          created_by: string | null
          customer_contact_id: string
          id: string
          notes: string | null
        }
        Insert: {
          agbot_location_id: string
          created_at?: string | null
          created_by?: string | null
          customer_contact_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          agbot_location_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_contact_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contact_tanks_agbot_location_id_fkey"
            columns: ["agbot_location_id"]
            isOneToOne: false
            referencedRelation: "agbot_fleet_overview"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "customer_contact_tanks_agbot_location_id_fkey"
            columns: ["agbot_location_id"]
            isOneToOne: false
            referencedRelation: "ta_agbot_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contact_tanks_customer_contact_id_fkey"
            columns: ["customer_contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          cc_emails: string | null
          contact_email: string
          contact_name: string | null
          contact_phone: string | null
          contact_position: string | null
          created_at: string | null
          customer_guid: string | null
          customer_name: string
          email_verification_token: string | null
          email_verified: boolean | null
          enabled: boolean | null
          id: string
          last_email_sent_at: string | null
          notes: string | null
          preferred_send_hour: number | null
          report_format: string | null
          report_frequency: string | null
          unsubscribe_token: string
          updated_at: string | null
        }
        Insert: {
          cc_emails?: string | null
          contact_email: string
          contact_name?: string | null
          contact_phone?: string | null
          contact_position?: string | null
          created_at?: string | null
          customer_guid?: string | null
          customer_name: string
          email_verification_token?: string | null
          email_verified?: boolean | null
          enabled?: boolean | null
          id?: string
          last_email_sent_at?: string | null
          notes?: string | null
          preferred_send_hour?: number | null
          report_format?: string | null
          report_frequency?: string | null
          unsubscribe_token: string
          updated_at?: string | null
        }
        Update: {
          cc_emails?: string | null
          contact_email?: string
          contact_name?: string | null
          contact_phone?: string | null
          contact_position?: string | null
          created_at?: string | null
          customer_guid?: string | null
          customer_name?: string
          email_verification_token?: string | null
          email_verified?: boolean | null
          enabled?: boolean | null
          id?: string
          last_email_sent_at?: string | null
          notes?: string | null
          preferred_send_hour?: number | null
          report_format?: string | null
          report_frequency?: string | null
          unsubscribe_token?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_email_logs: {
        Row: {
          bounce_reason: string | null
          bounce_type: string | null
          cc_recipients: string | null
          clicked_at: string | null
          critical_alerts: number | null
          customer_contact_id: string | null
          customer_name: string
          delivered_at: string | null
          delivery_status: string | null
          email_metadata: Json | null
          email_subject: string | null
          email_type: string
          error_message: string | null
          external_email_id: string | null
          id: string
          locations_count: number | null
          low_fuel_alerts: number | null
          opened_at: string | null
          recipient_email: string
          sent_at: string | null
        }
        Insert: {
          bounce_reason?: string | null
          bounce_type?: string | null
          cc_recipients?: string | null
          clicked_at?: string | null
          critical_alerts?: number | null
          customer_contact_id?: string | null
          customer_name: string
          delivered_at?: string | null
          delivery_status?: string | null
          email_metadata?: Json | null
          email_subject?: string | null
          email_type: string
          error_message?: string | null
          external_email_id?: string | null
          id?: string
          locations_count?: number | null
          low_fuel_alerts?: number | null
          opened_at?: string | null
          recipient_email: string
          sent_at?: string | null
        }
        Update: {
          bounce_reason?: string | null
          bounce_type?: string | null
          cc_recipients?: string | null
          clicked_at?: string | null
          critical_alerts?: number | null
          customer_contact_id?: string | null
          customer_name?: string
          delivered_at?: string | null
          delivery_status?: string | null
          email_metadata?: Json | null
          email_subject?: string | null
          email_type?: string
          error_message?: string | null
          external_email_id?: string | null
          id?: string
          locations_count?: number | null
          low_fuel_alerts?: number | null
          opened_at?: string | null
          recipient_email?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_email_logs_customer_contact_id_fkey"
            columns: ["customer_contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tank_access: {
        Row: {
          access_level: string | null
          agbot_location_id: string
          assigned_at: string | null
          assigned_by: string | null
          customer_account_id: string
          id: string
          notes: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          access_level?: string | null
          agbot_location_id: string
          assigned_at?: string | null
          assigned_by?: string | null
          customer_account_id: string
          id?: string
          notes?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          access_level?: string | null
          agbot_location_id?: string
          assigned_at?: string | null
          assigned_by?: string | null
          customer_account_id?: string
          id?: string
          notes?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_tank_access_agbot_location_id_fkey"
            columns: ["agbot_location_id"]
            isOneToOne: false
            referencedRelation: "agbot_fleet_overview"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "customer_tank_access_agbot_location_id_fkey"
            columns: ["agbot_location_id"]
            isOneToOne: false
            referencedRelation: "ta_agbot_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tank_access_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tank_access_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts_with_tank_count"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tank_thresholds: {
        Row: {
          created_at: string | null
          critical_threshold_pct: number | null
          customer_tank_access_id: string
          id: string
          notes: string | null
          updated_at: string | null
          warning_threshold_pct: number | null
        }
        Insert: {
          created_at?: string | null
          critical_threshold_pct?: number | null
          customer_tank_access_id: string
          id?: string
          notes?: string | null
          updated_at?: string | null
          warning_threshold_pct?: number | null
        }
        Update: {
          created_at?: string | null
          critical_threshold_pct?: number | null
          customer_tank_access_id?: string
          id?: string
          notes?: string | null
          updated_at?: string | null
          warning_threshold_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_tank_thresholds_customer_tank_access_id_fkey"
            columns: ["customer_tank_access_id"]
            isOneToOne: true
            referencedRelation: "customer_tank_access"
            referencedColumns: ["id"]
          },
        ]
      }
      data_freshness_tracking: {
        Row: {
          checked_at: string | null
          created_at: string | null
          freshness_status: Database["public"]["Enums"]["freshness_status"]
          hours_since_update: number | null
          id: string
          last_updated_at: string
          last_upload_filename: string | null
          last_upload_session_id: string | null
          last_upload_user_id: string | null
          record_count: number | null
          source_key: string
          total_records: number | null
        }
        Insert: {
          checked_at?: string | null
          created_at?: string | null
          freshness_status: Database["public"]["Enums"]["freshness_status"]
          hours_since_update?: number | null
          id?: string
          last_updated_at: string
          last_upload_filename?: string | null
          last_upload_session_id?: string | null
          last_upload_user_id?: string | null
          record_count?: number | null
          source_key: string
          total_records?: number | null
        }
        Update: {
          checked_at?: string | null
          created_at?: string | null
          freshness_status?: Database["public"]["Enums"]["freshness_status"]
          hours_since_update?: number | null
          id?: string
          last_updated_at?: string
          last_upload_filename?: string | null
          last_upload_session_id?: string | null
          last_upload_user_id?: string | null
          record_count?: number | null
          source_key?: string
          total_records?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "data_freshness_tracking_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "data_freshness_dashboard"
            referencedColumns: ["source_key"]
          },
          {
            foreignKeyName: "data_freshness_tracking_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "data_source_registry"
            referencedColumns: ["source_key"]
          },
        ]
      }
      data_import_batches: {
        Row: {
          batch_reference: string
          completed_at: string | null
          created_by: string | null
          error_summary: Json | null
          file_name: string | null
          id: string
          processing_metadata: Json | null
          records_failed: number | null
          records_processed: number | null
          source_subtype: string | null
          source_type: string
          started_at: string | null
          status: string
        }
        Insert: {
          batch_reference: string
          completed_at?: string | null
          created_by?: string | null
          error_summary?: Json | null
          file_name?: string | null
          id?: string
          processing_metadata?: Json | null
          records_failed?: number | null
          records_processed?: number | null
          source_subtype?: string | null
          source_type: string
          started_at?: string | null
          status?: string
        }
        Update: {
          batch_reference?: string
          completed_at?: string | null
          created_by?: string | null
          error_summary?: Json | null
          file_name?: string | null
          id?: string
          processing_metadata?: Json | null
          records_failed?: number | null
          records_processed?: number | null
          source_subtype?: string | null
          source_type?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      data_source_registry: {
        Row: {
          color_class: string | null
          created_at: string | null
          critical_threshold_hours: number | null
          description: string | null
          display_name: string
          fresh_threshold_hours: number | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          route_path: string | null
          source_key: string
          source_type: Database["public"]["Enums"]["data_source_type"]
          stale_threshold_hours: number | null
          table_name: string
          timestamp_column: string
          updated_at: string | null
        }
        Insert: {
          color_class?: string | null
          created_at?: string | null
          critical_threshold_hours?: number | null
          description?: string | null
          display_name: string
          fresh_threshold_hours?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          route_path?: string | null
          source_key: string
          source_type?: Database["public"]["Enums"]["data_source_type"]
          stale_threshold_hours?: number | null
          table_name: string
          timestamp_column?: string
          updated_at?: string | null
        }
        Update: {
          color_class?: string | null
          created_at?: string | null
          critical_threshold_hours?: number | null
          description?: string | null
          display_name?: string
          fresh_threshold_hours?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          route_path?: string | null
          source_key?: string
          source_type?: Database["public"]["Enums"]["data_source_type"]
          stale_threshold_hours?: number | null
          table_name?: string
          timestamp_column?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      delivery_request_notifications: {
        Row: {
          created_at: string | null
          delivery_request_id: string
          delivery_status: string | null
          error_message: string | null
          external_email_id: string | null
          id: string
          notification_type: string
          recipient_email: string
          recipient_type: string
          sent_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_request_id: string
          delivery_status?: string | null
          error_message?: string | null
          external_email_id?: string | null
          id?: string
          notification_type: string
          recipient_email: string
          recipient_type: string
          sent_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_request_id?: string
          delivery_status?: string | null
          error_message?: string | null
          external_email_id?: string | null
          id?: string
          notification_type?: string
          recipient_email?: string
          recipient_type?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_request_notifications_delivery_request_id_fkey"
            columns: ["delivery_request_id"]
            isOneToOne: false
            referencedRelation: "delivery_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_requests: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          actual_litres_delivered: number | null
          agbot_location_id: string
          assigned_driver: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          current_level_pct: number | null
          customer_account_id: string
          customer_email: string | null
          delivery_notes: string | null
          depot_email: string | null
          id: string
          notes: string | null
          notification_error: string | null
          notification_sent_at: string | null
          predicted_empty_date: string | null
          request_type: string
          requested_date: string | null
          requested_litres: number | null
          scheduled_date: string | null
          scheduled_notes: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_litres_delivered?: number | null
          agbot_location_id: string
          assigned_driver?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          current_level_pct?: number | null
          customer_account_id: string
          customer_email?: string | null
          delivery_notes?: string | null
          depot_email?: string | null
          id?: string
          notes?: string | null
          notification_error?: string | null
          notification_sent_at?: string | null
          predicted_empty_date?: string | null
          request_type?: string
          requested_date?: string | null
          requested_litres?: number | null
          scheduled_date?: string | null
          scheduled_notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_litres_delivered?: number | null
          agbot_location_id?: string
          assigned_driver?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          current_level_pct?: number | null
          customer_account_id?: string
          customer_email?: string | null
          delivery_notes?: string | null
          depot_email?: string | null
          id?: string
          notes?: string | null
          notification_error?: string | null
          notification_sent_at?: string | null
          predicted_empty_date?: string | null
          request_type?: string
          requested_date?: string | null
          requested_litres?: number | null
          scheduled_date?: string | null
          scheduled_notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_requests_agbot_location_id_fkey"
            columns: ["agbot_location_id"]
            isOneToOne: false
            referencedRelation: "agbot_fleet_overview"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "delivery_requests_agbot_location_id_fkey"
            columns: ["agbot_location_id"]
            isOneToOne: false
            referencedRelation: "ta_agbot_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_requests_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_requests_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts_with_tank_count"
            referencedColumns: ["id"]
          },
        ]
      }
      depot_contacts: {
        Row: {
          created_at: string | null
          hours_close: string | null
          hours_open: string | null
          id: string
          is_active: boolean | null
          name: string
          orders_email: string
          phone: string | null
          postcode_ranges: string[] | null
          region: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hours_close?: string | null
          hours_open?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          orders_email: string
          phone?: string | null
          postcode_ranges?: string[] | null
          region?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hours_close?: string | null
          hours_open?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          orders_email?: string
          phone?: string | null
          postcode_ranges?: string[] | null
          region?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dip_readings: {
        Row: {
          archived_at: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          deleted_by: string | null
          deletion_reason: string | null
          full_name: string | null
          id: string
          notes: string | null
          recorded_by: string
          tank_id: string
          updated_at: string | null
          updated_by: string | null
          updated_by_name: string | null
          value: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          full_name?: string | null
          id?: string
          notes?: string | null
          recorded_by: string
          tank_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_by_name?: string | null
          value: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          full_name?: string | null
          id?: string
          notes?: string | null
          recorded_by?: string
          tank_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_by_name?: string | null
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
        ]
      }
      fuel_tanks: {
        Row: {
          address: string | null
          afterhours_contact: string | null
          bp_portal: string | null
          created_at: string | null
          current_level: number
          days_to_min_level: number | null
          delivery_window: string | null
          discharge: string | null
          group_id: string
          id: string
          last_dip_by: string | null
          last_dip_date: string | null
          latitude: number | null
          location: string
          longitude: number | null
          min_level: number | null
          notes: string | null
          product_type: Database["public"]["Enums"]["product_type"]
          rolling_avg: number | null
          safe_level: number
          serviced_by: string | null
          serviced_on: string | null
          status: Database["public"]["Enums"]["tank_status_enum"]
          subgroup: string | null
          subgroup_id: string | null
          updated_at: string | null
          vehicle: string | null
        }
        Insert: {
          address?: string | null
          afterhours_contact?: string | null
          bp_portal?: string | null
          created_at?: string | null
          current_level?: number
          days_to_min_level?: number | null
          delivery_window?: string | null
          discharge?: string | null
          group_id: string
          id?: string
          last_dip_by?: string | null
          last_dip_date?: string | null
          latitude?: number | null
          location: string
          longitude?: number | null
          min_level?: number | null
          notes?: string | null
          product_type: Database["public"]["Enums"]["product_type"]
          rolling_avg?: number | null
          safe_level: number
          serviced_by?: string | null
          serviced_on?: string | null
          status?: Database["public"]["Enums"]["tank_status_enum"]
          subgroup?: string | null
          subgroup_id?: string | null
          updated_at?: string | null
          vehicle?: string | null
        }
        Update: {
          address?: string | null
          afterhours_contact?: string | null
          bp_portal?: string | null
          created_at?: string | null
          current_level?: number
          days_to_min_level?: number | null
          delivery_window?: string | null
          discharge?: string | null
          group_id?: string
          id?: string
          last_dip_by?: string | null
          last_dip_date?: string | null
          latitude?: number | null
          location?: string
          longitude?: number | null
          min_level?: number | null
          notes?: string | null
          product_type?: Database["public"]["Enums"]["product_type"]
          rolling_avg?: number | null
          safe_level?: number
          serviced_by?: string | null
          serviced_on?: string | null
          status?: Database["public"]["Enums"]["tank_status_enum"]
          subgroup?: string | null
          subgroup_id?: string | null
          updated_at?: string | null
          vehicle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_tanks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tank_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_tanks_subgroup_id_fkey"
            columns: ["subgroup_id"]
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
          "First Name": string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          "First Name"?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          "First Name"?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      smartfill_customers: {
        Row: {
          active: boolean | null
          api_reference: string
          api_secret: string
          created_at: string | null
          id: number
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          api_reference: string
          api_secret: string
          created_at?: string | null
          id?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          api_reference?: string
          api_secret?: string
          created_at?: string | null
          id?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      smartfill_locations: {
        Row: {
          created_at: string | null
          customer_guid: string | null
          customer_id: number | null
          customer_name: string | null
          description: string | null
          id: string
          latest_status: string | null
          latest_update_time: string | null
          latest_volume: number | null
          latest_volume_percent: number | null
          latitude: number | null
          location_guid: string
          longitude: number | null
          raw_data: Json | null
          timezone: string | null
          unit_number: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_guid?: string | null
          customer_id?: number | null
          customer_name?: string | null
          description?: string | null
          id?: string
          latest_status?: string | null
          latest_update_time?: string | null
          latest_volume?: number | null
          latest_volume_percent?: number | null
          latitude?: number | null
          location_guid: string
          longitude?: number | null
          raw_data?: Json | null
          timezone?: string | null
          unit_number: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_guid?: string | null
          customer_id?: number | null
          customer_name?: string | null
          description?: string | null
          id?: string
          latest_status?: string | null
          latest_update_time?: string | null
          latest_volume?: number | null
          latest_volume_percent?: number | null
          latitude?: number | null
          location_guid?: string
          longitude?: number | null
          raw_data?: Json | null
          timezone?: string | null
          unit_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smartfill_locations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "smartfill_active_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartfill_locations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "smartfill_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      smartfill_readings_history: {
        Row: {
          capacity: number | null
          created_at: string | null
          id: string
          safe_fill_level: number | null
          status: string | null
          tank_id: string | null
          timezone: string | null
          ullage: number | null
          update_time: string | null
          volume: number | null
          volume_percent: number | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          safe_fill_level?: number | null
          status?: string | null
          tank_id?: string | null
          timezone?: string | null
          ullage?: number | null
          update_time?: string | null
          volume?: number | null
          volume_percent?: number | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          safe_fill_level?: number | null
          status?: string | null
          tank_id?: string | null
          timezone?: string | null
          ullage?: number | null
          update_time?: string | null
          volume?: number | null
          volume_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "smartfill_readings_history_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "smartfill_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      smartfill_sync_logs: {
        Row: {
          assets_processed: number | null
          completed_at: string | null
          error_message: string | null
          id: string
          locations_processed: number | null
          readings_processed: number | null
          started_at: string | null
          sync_duration_ms: number | null
          sync_status: string
          sync_type: string
          tanks_processed: number | null
        }
        Insert: {
          assets_processed?: number | null
          completed_at?: string | null
          error_message?: string | null
          id?: string
          locations_processed?: number | null
          readings_processed?: number | null
          started_at?: string | null
          sync_duration_ms?: number | null
          sync_status: string
          sync_type: string
          tanks_processed?: number | null
        }
        Update: {
          assets_processed?: number | null
          completed_at?: string | null
          error_message?: string | null
          id?: string
          locations_processed?: number | null
          readings_processed?: number | null
          started_at?: string | null
          sync_duration_ms?: number | null
          sync_status?: string
          sync_type?: string
          tanks_processed?: number | null
        }
        Relationships: []
      }
      smartfill_tanks: {
        Row: {
          capacity: number | null
          created_at: string | null
          customer_id: number | null
          description: string | null
          id: string
          latest_status: string | null
          latest_update_time: string | null
          latest_volume: number | null
          latest_volume_percent: number | null
          location_id: string | null
          raw_data: Json | null
          safe_fill_level: number | null
          tank_guid: string
          tank_number: string
          unit_number: string
          updated_at: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          customer_id?: number | null
          description?: string | null
          id?: string
          latest_status?: string | null
          latest_update_time?: string | null
          latest_volume?: number | null
          latest_volume_percent?: number | null
          location_id?: string | null
          raw_data?: Json | null
          safe_fill_level?: number | null
          tank_guid: string
          tank_number: string
          unit_number: string
          updated_at?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          customer_id?: number | null
          description?: string | null
          id?: string
          latest_status?: string | null
          latest_update_time?: string | null
          latest_volume?: number | null
          latest_volume_percent?: number | null
          location_id?: string | null
          raw_data?: Json | null
          safe_fill_level?: number | null
          tank_guid?: string
          tank_number?: string
          unit_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smartfill_tanks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "smartfill_active_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartfill_tanks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "smartfill_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartfill_tanks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "smartfill_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      system_config: {
        Row: {
          category: string
          created_at: string | null
          data_type: string
          description: string | null
          is_secret: boolean | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          category: string
          created_at?: string | null
          data_type: string
          description?: string | null
          is_secret?: boolean | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          category?: string
          created_at?: string | null
          data_type?: string
          description?: string | null
          is_secret?: boolean | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      system_config_audit: {
        Row: {
          change_reason: string | null
          changed_at: string | null
          changed_by: string | null
          config_key: string
          id: string
          new_value: string
          old_value: string | null
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          config_key: string
          id?: string
          new_value: string
          old_value?: string | null
        }
        Update: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          config_key?: string
          id?: string
          new_value?: string
          old_value?: string | null
        }
        Relationships: []
      }
      tank_alerts: {
        Row: {
          acknowledged_at: string | null
          alert_type: string
          created_at: string | null
          id: string
          message: string
          priority: string
          snoozed_until: string | null
          tank_id: string
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          alert_type: string
          created_at?: string | null
          id?: string
          message: string
          priority: string
          snoozed_until?: string | null
          tank_id: string
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          alert_type?: string
          created_at?: string | null
          id?: string
          message?: string
          priority?: string
          snoozed_until?: string | null
          tank_id?: string
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
      user_group_permissions: {
        Row: {
          created_at: string
          group_id: string
          group_name: string | null
          subgroup_id: string | null
          ta_group_id: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          group_id: string
          group_name?: string | null
          subgroup_id?: string | null
          ta_group_id?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string
          group_name?: string | null
          subgroup_id?: string | null
          ta_group_id?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_group_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tank_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_permissions_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "tank_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          alert_critical_tanks: boolean | null
          alert_low_fuel: boolean | null
          alert_maintenance: boolean | null
          alert_system_updates: boolean | null
          created_at: string | null
          critical_fuel_threshold: number | null
          default_depot_group: string | null
          email_alerts: boolean | null
          id: string
          low_fuel_threshold: number | null
          phone_number: string | null
          preferred_map_style: string | null
          sms_alerts: boolean | null
          theme: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
          webhook_alerts: boolean | null
          webhook_url: string | null
        }
        Insert: {
          alert_critical_tanks?: boolean | null
          alert_low_fuel?: boolean | null
          alert_maintenance?: boolean | null
          alert_system_updates?: boolean | null
          created_at?: string | null
          critical_fuel_threshold?: number | null
          default_depot_group?: string | null
          email_alerts?: boolean | null
          id?: string
          low_fuel_threshold?: number | null
          phone_number?: string | null
          preferred_map_style?: string | null
          sms_alerts?: boolean | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
          webhook_alerts?: boolean | null
          webhook_url?: string | null
        }
        Update: {
          alert_critical_tanks?: boolean | null
          alert_low_fuel?: boolean | null
          alert_maintenance?: boolean | null
          alert_system_updates?: boolean | null
          created_at?: string | null
          critical_fuel_threshold?: number | null
          default_depot_group?: string | null
          email_alerts?: boolean | null
          id?: string
          low_fuel_threshold?: number | null
          phone_number?: string | null
          preferred_map_style?: string | null
          sms_alerts?: boolean | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
          webhook_alerts?: boolean | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_subgroup_permissions: {
        Row: {
          created_at: string | null
          group_id: string
          subgroup_name: string
          ta_group_id: string | null
          ta_subgroup_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          subgroup_name: string
          ta_group_id?: string | null
          ta_subgroup_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          subgroup_name?: string
          ta_group_id?: string | null
          ta_subgroup_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subgroup_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tank_groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_swan_burn_rates: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      alert_type: "low" | "critical" | "offline"
      data_source_type: "csv_upload" | "api_sync" | "manual_entry" | "webhook" | "scheduled_import"
      freshness_status: "fresh" | "stale" | "very_stale" | "critical"
      product_type: "ADF" | "ULP" | "ULP98" | "Diesel"
      tank_status_enum: "active" | "archived" | "decommissioned"
      user_role: "admin" | "swan_transit" | "gsfs_depots" | "kalgoorlie" | "manager" | "operator" | "depot_manager" | "scheduler"
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
      user_role: ["admin", "swan_transit", "gsfs_depots", "kalgoorlie", "manager", "operator", "depot_manager", "scheduler"],
      data_source_type: ["csv_upload", "api_sync", "manual_entry", "webhook", "scheduled_import"],
      freshness_status: ["fresh", "stale", "very_stale", "critical"],
      tank_status_enum: ["active", "archived", "decommissioned"],
    },
  },
} as const
