/**
 * Contact Repository
 * Data access layer for customer_contacts table
 * Abstracts all database queries for contacts
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface Contact {
  id: string;
  customer_name: string;
  contact_email: string;
  contact_name: string | null;
  report_frequency: 'daily' | 'weekly' | 'monthly';
  preferred_send_hour: number;
  cc_emails: string | null;
  enabled: boolean;
  unsubscribe_token: string;
  last_email_sent_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export class ContactRepository {
  constructor(private db: SupabaseClient) {}

  /**
   * Find all enabled contacts scheduled for a specific hour
   * Used by cron job to determine which contacts to email
   */
  async findByPreferredHour(hour: number): Promise<Contact[]> {
    const { data, error } = await this.db
      .from('customer_contacts')
      .select('*')
      .eq('enabled', true)
      .eq('preferred_send_hour', hour)
      .in('report_frequency', ['daily', 'weekly', 'monthly'])
      .order('customer_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch contacts by preferred hour: ${error.message}`);
    }

    return (data || []) as Contact[];
  }

  /**
   * Find contact by ID
   */
  async findById(contactId: string): Promise<Contact | null> {
    const { data, error } = await this.db
      .from('customer_contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw new Error(`Failed to fetch contact by ID: ${error.message}`);
    }

    return data as Contact;
  }

  /**
   * Find contact by unsubscribe token
   * Used for unsubscribe functionality
   */
  async findByToken(token: string): Promise<Contact | null> {
    const { data, error } = await this.db
      .from('customer_contacts')
      .select('*')
      .eq('unsubscribe_token', token)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw new Error(`Failed to fetch contact by token: ${error.message}`);
    }

    return data as Contact;
  }

  /**
   * Find all contacts for a specific customer
   */
  async findByCustomerName(customerName: string): Promise<Contact[]> {
    const { data, error } = await this.db
      .from('customer_contacts')
      .select('*')
      .eq('customer_name', customerName)
      .order('contact_email', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch contacts by customer name: ${error.message}`);
    }

    return (data || []) as Contact[];
  }

  /**
   * Update last email sent timestamp
   * Called after successfully sending an email
   */
  async updateLastEmailSent(contactId: string, timestamp: Date): Promise<void> {
    const { error } = await this.db
      .from('customer_contacts')
      .update({ last_email_sent_at: timestamp.toISOString() })
      .eq('id', contactId);

    if (error) {
      throw new Error(`Failed to update last email sent: ${error.message}`);
    }
  }

  /**
   * Update unsubscribe token
   * Used when generating a new token for a contact
   */
  async updateUnsubscribeToken(contactId: string, token: string): Promise<void> {
    const { error } = await this.db
      .from('customer_contacts')
      .update({ unsubscribe_token: token })
      .eq('id', contactId);

    if (error) {
      throw new Error(`Failed to update unsubscribe token: ${error.message}`);
    }
  }

  /**
   * Disable contact (soft delete)
   * Used for unsubscribe or bounce handling
   */
  async disable(contactId: string): Promise<void> {
    const { error } = await this.db
      .from('customer_contacts')
      .update({ enabled: false })
      .eq('id', contactId);

    if (error) {
      throw new Error(`Failed to disable contact: ${error.message}`);
    }
  }

  /**
   * Enable contact
   */
  async enable(contactId: string): Promise<void> {
    const { error } = await this.db
      .from('customer_contacts')
      .update({ enabled: true })
      .eq('id', contactId);

    if (error) {
      throw new Error(`Failed to enable contact: ${error.message}`);
    }
  }

  /**
   * Update contact preferences
   */
  async updatePreferences(
    contactId: string,
    preferences: {
      report_frequency?: 'daily' | 'weekly' | 'monthly';
      preferred_send_hour?: number;
      cc_emails?: string | null;
    }
  ): Promise<void> {
    const { error } = await this.db
      .from('customer_contacts')
      .update(preferences)
      .eq('id', contactId);

    if (error) {
      throw new Error(`Failed to update contact preferences: ${error.message}`);
    }
  }

  /**
   * Get count of enabled contacts
   */
  async countEnabled(): Promise<number> {
    const { count, error } = await this.db
      .from('customer_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true);

    if (error) {
      throw new Error(`Failed to count enabled contacts: ${error.message}`);
    }

    return count || 0;
  }
}
