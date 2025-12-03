/**
 * Email Log Repository
 * Data access layer for customer_email_logs table
 * Abstracts all database queries for email logging and tracking
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface EmailLog {
  id?: string;
  customer_contact_id: string;
  customer_name: string;
  recipient_email: string;
  cc_recipients?: string | null;
  email_type: string;
  email_subject: string;
  sent_at: Date | string;
  delivery_status: 'sent' | 'delivered' | 'failed' | 'bounced' | 'complained';
  external_email_id?: string | null;
  error_message?: string | null;
  bounce_type?: string | null;
  bounce_reason?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  locations_count?: number | null;
  low_fuel_alerts?: number | null;
  critical_alerts?: number | null;
  tenant_id?: string | null;
  created_at?: string;
}

export class EmailLogRepository {
  constructor(private db: SupabaseClient) {}

  /**
   * Create a new email log entry
   * Called after sending an email
   */
  async create(log: EmailLog): Promise<EmailLog> {
    const { data, error } = await this.db
      .from('customer_email_logs')
      .insert({
        customer_contact_id: log.customer_contact_id,
        customer_name: log.customer_name,
        recipient_email: log.recipient_email,
        cc_recipients: log.cc_recipients,
        email_type: log.email_type,
        email_subject: log.email_subject,
        sent_at: typeof log.sent_at === 'string' ? log.sent_at : log.sent_at.toISOString(),
        delivery_status: log.delivery_status,
        external_email_id: log.external_email_id,
        error_message: log.error_message,
        locations_count: log.locations_count,
        low_fuel_alerts: log.low_fuel_alerts,
        critical_alerts: log.critical_alerts,
        tenant_id: log.tenant_id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create email log: ${error.message}`);
    }

    return data as EmailLog;
  }

  /**
   * Find recent email sends for a contact
   * Used for idempotency checks
   */
  async findRecentSend(
    contactId: string,
    emailType: string,
    since: Date
  ): Promise<EmailLog | null> {
    const { data, error } = await this.db
      .from('customer_email_logs')
      .select('*')
      .eq('customer_contact_id', contactId)
      .eq('email_type', emailType)
      .gte('sent_at', since.toISOString())
      .order('sent_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw new Error(`Failed to find recent send: ${error.message}`);
    }

    return data as EmailLog;
  }

  /**
   * Find all email logs for a contact
   */
  async findByContact(contactId: string, limit: number = 50): Promise<EmailLog[]> {
    const { data, error } = await this.db
      .from('customer_email_logs')
      .select('*')
      .eq('customer_contact_id', contactId)
      .order('sent_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch email logs by contact: ${error.message}`);
    }

    return (data || []) as EmailLog[];
  }

  /**
   * Find email log by external email ID (Resend ID)
   */
  async findByExternalId(externalEmailId: string): Promise<EmailLog | null> {
    const { data, error } = await this.db
      .from('customer_email_logs')
      .select('*')
      .eq('external_email_id', externalEmailId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch email log by external ID: ${error.message}`);
    }

    return data as EmailLog;
  }

  /**
   * Update delivery status
   * Called by webhook handler
   */
  async updateDeliveryStatus(
    externalEmailId: string,
    status: 'delivered' | 'bounced' | 'complained',
    metadata?: {
      bounce_type?: string;
      bounce_reason?: string;
    }
  ): Promise<void> {
    const updateData: any = { delivery_status: status };

    if (metadata?.bounce_type) {
      updateData.bounce_type = metadata.bounce_type;
    }

    if (metadata?.bounce_reason) {
      updateData.bounce_reason = metadata.bounce_reason;
    }

    const { error } = await this.db
      .from('customer_email_logs')
      .update(updateData)
      .eq('external_email_id', externalEmailId);

    if (error) {
      throw new Error(`Failed to update delivery status: ${error.message}`);
    }
  }

  /**
   * Record email opened event
   * Called by webhook handler
   */
  async recordOpened(externalEmailId: string, openedAt: Date): Promise<void> {
    const { error } = await this.db
      .from('customer_email_logs')
      .update({ opened_at: openedAt.toISOString() })
      .eq('external_email_id', externalEmailId);

    if (error) {
      throw new Error(`Failed to record email opened: ${error.message}`);
    }
  }

  /**
   * Record email clicked event
   * Called by webhook handler
   */
  async recordClicked(externalEmailId: string, clickedAt: Date): Promise<void> {
    const { error } = await this.db
      .from('customer_email_logs')
      .update({ clicked_at: clickedAt.toISOString() })
      .eq('external_email_id', externalEmailId);

    if (error) {
      throw new Error(`Failed to record email clicked: ${error.message}`);
    }
  }

  /**
   * Get email statistics for a date range
   */
  async getStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    delivered: number;
    failed: number;
    bounced: number;
    opened: number;
    clicked: number;
  }> {
    const { data, error } = await this.db
      .from('customer_email_logs')
      .select('delivery_status, opened_at, clicked_at')
      .gte('sent_at', startDate.toISOString())
      .lte('sent_at', endDate.toISOString());

    if (error) {
      throw new Error(`Failed to fetch email statistics: ${error.message}`);
    }

    const logs = data || [];

    return {
      total: logs.length,
      delivered: logs.filter(l => l.delivery_status === 'delivered').length,
      failed: logs.filter(l => l.delivery_status === 'failed').length,
      bounced: logs.filter(l => l.delivery_status === 'bounced').length,
      opened: logs.filter(l => l.opened_at !== null).length,
      clicked: logs.filter(l => l.clicked_at !== null).length,
    };
  }

  /**
   * Find failed emails that need retry
   */
  async findFailedEmails(limit: number = 100): Promise<EmailLog[]> {
    const { data, error } = await this.db
      .from('customer_email_logs')
      .select('*')
      .eq('delivery_status', 'failed')
      .order('sent_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch failed emails: ${error.message}`);
    }

    return (data || []) as EmailLog[];
  }

  /**
   * Get count of bounces for a specific email address
   * Used to auto-disable contacts after too many bounces
   */
  async countBounces(recipientEmail: string): Promise<number> {
    const { count, error } = await this.db
      .from('customer_email_logs')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_email', recipientEmail)
      .eq('delivery_status', 'bounced')
      .eq('bounce_type', 'hard');

    if (error) {
      throw new Error(`Failed to count bounces: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Get recent logs (for admin dashboard)
   */
  async getRecent(limit: number = 100): Promise<EmailLog[]> {
    const { data, error } = await this.db
      .from('customer_email_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch recent logs: ${error.message}`);
    }

    return (data || []) as EmailLog[];
  }
}
