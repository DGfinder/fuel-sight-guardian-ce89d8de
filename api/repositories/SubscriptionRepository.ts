/**
 * Subscription Repository
 * Data access layer for customer_contact_tanks (subscriptions)
 *
 * Each subscription represents one contact subscribed to one tank
 * with independent settings (frequency, send hour, alerts, etc)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tank } from './TankRepository.js';

export interface Subscription {
  // Subscription metadata
  id: string;
  subscription_id: string; // customer_contact_tanks.id

  // Contact information
  contact_id: string;
  contact_name: string | null;
  contact_email: string;
  customer_name: string;
  unsubscribe_token: string;
  email_verified: boolean;

  // Tank information
  tank_id: string;
  tank: Tank;

  // Subscription-level settings (from customer_contact_tanks)
  report_frequency: 'daily' | 'weekly' | 'monthly';
  preferred_send_hour: number;
  enabled: boolean;
  alert_threshold_percent: number;
  cc_emails: string | null;
  last_email_sent_at: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export class SubscriptionRepository {
  constructor(private db: SupabaseClient) {}

  /**
   * Find all enabled subscriptions scheduled for a specific hour
   * Used by cron job to determine which subscriptions to process
   */
  async findByPreferredHour(hour: number): Promise<Subscription[]> {
    const { data, error } = await this.db
      .from('customer_contact_tanks')
      .select(`
        id,
        customer_contact_id,
        agbot_location_id,
        report_frequency,
        preferred_send_hour,
        enabled,
        alert_threshold_percent,
        cc_emails,
        last_email_sent_at,
        created_at,
        updated_at,
        customer_contacts!inner (
          id,
          customer_name,
          contact_email,
          contact_name,
          unsubscribe_token,
          email_verified,
          enabled
        ),
        ta_agbot_locations!inner (
          id,
          name,
          address,
          customer_name,
          calibrated_fill_level,
          last_telemetry_at,
          is_disabled,
          ta_agbot_assets (
            id,
            is_online,
            capacity_liters,
            daily_consumption_liters,
            days_remaining,
            device_serial,
            current_level_liters,
            ullage_liters,
            battery_voltage,
            commodity
          )
        )
      `)
      .eq('enabled', true)
      .eq('customer_contacts.enabled', true)
      .eq('preferred_send_hour', hour)
      .in('report_frequency', ['daily', 'weekly', 'monthly'])
      .order('customer_contacts.customer_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch subscriptions by preferred hour: ${error.message}`);
    }

    // Transform and filter
    return this.transformSubscriptions(data || []);
  }

  /**
   * Find subscription by ID
   */
  async findById(subscriptionId: string): Promise<Subscription | null> {
    const { data, error } = await this.db
      .from('customer_contact_tanks')
      .select(`
        id,
        customer_contact_id,
        agbot_location_id,
        report_frequency,
        preferred_send_hour,
        enabled,
        alert_threshold_percent,
        cc_emails,
        last_email_sent_at,
        created_at,
        updated_at,
        customer_contacts!inner (
          id,
          customer_name,
          contact_email,
          contact_name,
          unsubscribe_token,
          email_verified,
          enabled
        ),
        ta_agbot_locations!inner (
          id,
          name,
          address,
          customer_name,
          calibrated_fill_level,
          last_telemetry_at,
          is_disabled,
          ta_agbot_assets (
            id,
            is_online,
            capacity_liters,
            daily_consumption_liters,
            days_remaining,
            device_serial,
            current_level_liters,
            ullage_liters,
            battery_voltage,
            commodity
          )
        )
      `)
      .eq('id', subscriptionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch subscription by ID: ${error.message}`);
    }

    const subscriptions = this.transformSubscriptions([data]);
    return subscriptions[0] || null;
  }

  /**
   * Find all subscriptions for a contact
   */
  async findByContactId(contactId: string): Promise<Subscription[]> {
    const { data, error } = await this.db
      .from('customer_contact_tanks')
      .select(`
        id,
        customer_contact_id,
        agbot_location_id,
        report_frequency,
        preferred_send_hour,
        enabled,
        alert_threshold_percent,
        cc_emails,
        last_email_sent_at,
        created_at,
        updated_at,
        customer_contacts!inner (
          id,
          customer_name,
          contact_email,
          contact_name,
          unsubscribe_token,
          email_verified,
          enabled
        ),
        ta_agbot_locations!inner (
          id,
          name,
          address,
          customer_name,
          calibrated_fill_level,
          last_telemetry_at,
          is_disabled,
          ta_agbot_assets (
            id,
            is_online,
            capacity_liters,
            daily_consumption_liters,
            days_remaining,
            device_serial,
            current_level_liters,
            ullage_liters,
            battery_voltage,
            commodity
          )
        )
      `)
      .eq('customer_contact_id', contactId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch subscriptions by contact ID: ${error.message}`);
    }

    return this.transformSubscriptions(data || []);
  }

  /**
   * Find all subscriptions for a tank
   */
  async findByTankId(tankId: string): Promise<Subscription[]> {
    const { data, error } = await this.db
      .from('customer_contact_tanks')
      .select(`
        id,
        customer_contact_id,
        agbot_location_id,
        report_frequency,
        preferred_send_hour,
        enabled,
        alert_threshold_percent,
        cc_emails,
        last_email_sent_at,
        created_at,
        updated_at,
        customer_contacts!inner (
          id,
          customer_name,
          contact_email,
          contact_name,
          unsubscribe_token,
          email_verified,
          enabled
        ),
        ta_agbot_locations!inner (
          id,
          name,
          address,
          customer_name,
          calibrated_fill_level,
          last_telemetry_at,
          is_disabled,
          ta_agbot_assets (
            id,
            is_online,
            capacity_liters,
            daily_consumption_liters,
            days_remaining,
            device_serial,
            current_level_liters,
            ullage_liters,
            battery_voltage,
            commodity
          )
        )
      `)
      .eq('agbot_location_id', tankId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch subscriptions by tank ID: ${error.message}`);
    }

    return this.transformSubscriptions(data || []);
  }

  /**
   * Update last email sent timestamp for a subscription
   */
  async updateLastEmailSent(subscriptionId: string, timestamp: Date): Promise<void> {
    const { error } = await this.db
      .from('customer_contact_tanks')
      .update({ last_email_sent_at: timestamp.toISOString() })
      .eq('id', subscriptionId);

    if (error) {
      throw new Error(`Failed to update last email sent: ${error.message}`);
    }
  }

  /**
   * Update subscription settings
   */
  async updateSettings(
    subscriptionId: string,
    settings: {
      report_frequency?: 'daily' | 'weekly' | 'monthly';
      preferred_send_hour?: number;
      enabled?: boolean;
      alert_threshold_percent?: number;
      cc_emails?: string | null;
    }
  ): Promise<void> {
    const { error } = await this.db
      .from('customer_contact_tanks')
      .update(settings)
      .eq('id', subscriptionId);

    if (error) {
      throw new Error(`Failed to update subscription settings: ${error.message}`);
    }
  }

  /**
   * Enable subscription
   */
  async enable(subscriptionId: string): Promise<void> {
    await this.updateSettings(subscriptionId, { enabled: true });
  }

  /**
   * Disable subscription
   */
  async disable(subscriptionId: string): Promise<void> {
    await this.updateSettings(subscriptionId, { enabled: false });
  }

  /**
   * Get count of enabled subscriptions
   */
  async countEnabled(): Promise<number> {
    const { count, error } = await this.db
      .from('customer_contact_tanks')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true);

    if (error) {
      throw new Error(`Failed to count enabled subscriptions: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Transform raw database results to Subscription objects
   * Filters out tanks with no online assets
   */
  private transformSubscriptions(data: any[]): Subscription[] {
    return data
      .map((row) => {
        const contact = Array.isArray(row.customer_contacts)
          ? row.customer_contacts[0]
          : row.customer_contacts;

        const tank = Array.isArray(row.ta_agbot_locations)
          ? row.ta_agbot_locations[0]
          : row.ta_agbot_locations;

        // Skip if tank is disabled or contact is not verified
        if (!tank || tank.is_disabled) {
          return null;
        }

        // Filter to only include tanks with at least one online asset
        const assets = tank.ta_agbot_assets || [];
        const onlineAssets = assets.filter((asset: any) => asset.is_online === true);

        if (onlineAssets.length === 0) {
          return null;
        }

        // Update tank with only online assets
        const filteredTank = {
          ...tank,
          ta_agbot_assets: onlineAssets,
        };

        return {
          // Subscription metadata
          id: row.id,
          subscription_id: row.id,

          // Contact information
          contact_id: contact.id,
          contact_name: contact.contact_name,
          contact_email: contact.contact_email,
          customer_name: contact.customer_name,
          unsubscribe_token: contact.unsubscribe_token,
          email_verified: contact.email_verified,

          // Tank information
          tank_id: tank.id,
          tank: filteredTank,

          // Subscription-level settings
          report_frequency: row.report_frequency || 'daily',
          preferred_send_hour: row.preferred_send_hour ?? 7,
          enabled: row.enabled ?? true,
          alert_threshold_percent: row.alert_threshold_percent ?? 30,
          cc_emails: row.cc_emails,
          last_email_sent_at: row.last_email_sent_at,

          // Timestamps
          created_at: row.created_at,
          updated_at: row.updated_at,
        } as Subscription;
      })
      .filter((sub): sub is Subscription => sub !== null);
  }
}
