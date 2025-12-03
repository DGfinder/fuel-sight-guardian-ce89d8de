/**
 * Email Service
 * Core business logic for email sending orchestration
 * Handles retry logic, idempotency, and email delivery
 */

import type { IEmailProvider, EmailOptions, EmailResult } from '../infrastructure/email/IEmailProvider.js';
import type { ContactRepository, Contact } from '../repositories/ContactRepository.js';
import type { TankRepository, Tank } from '../repositories/TankRepository.js';
import type { EmailLogRepository } from '../repositories/EmailLogRepository.js';
import type { ReportGeneratorService } from './ReportGeneratorService.js';

export interface EmailConfig {
  from_email: string;
  from_name: string;
  reply_to: string;
  support_email: string;
  logo_url: string;
  primary_color?: string;
  low_fuel_threshold?: number;
  critical_threshold?: number;
}

export interface SendEmailOptions {
  contact: Contact;
  tanks: Tank[];
  frequency: 'daily' | 'weekly' | 'monthly';
  config: EmailConfig;
  isTest?: boolean;
}

export interface SendResult {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export class EmailService {
  constructor(
    private emailProvider: IEmailProvider,
    private contactRepo: ContactRepository,
    private tankRepo: TankRepository,
    private emailLogRepo: EmailLogRepository,
    private reportGenerator: ReportGeneratorService
  ) {}

  /**
   * Send scheduled reports for a specific hour
   * Main entry point for cron job
   */
  async sendScheduledReports(perthHour: number): Promise<SendResult> {
    console.log(`[EmailService] Sending scheduled reports for Perth hour: ${perthHour}`);

    // Fetch contacts for this hour
    const contacts = await this.contactRepo.findByPreferredHour(perthHour);
    console.log(`[EmailService] Found ${contacts.length} contacts scheduled for hour ${perthHour}`);

    if (contacts.length === 0) {
      return { sent: 0, failed: 0, skipped: 0, errors: [] };
    }

    // Filter by frequency (daily/weekly/monthly logic)
    const eligibleContacts = this.filterByFrequency(contacts, new Date());
    console.log(`[EmailService] ${eligibleContacts.length} contacts eligible after frequency filter`);

    // Get email configuration
    const config = await this.getEmailConfig();

    // Send emails in batches
    return this.batchSendEmails(eligibleContacts, config);
  }

  /**
   * Send email to a single contact
   * Used by test endpoints and retry logic
   */
  async sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    const { contact, tanks, frequency, config, isTest = false } = options;

    console.log(`[EmailService] Sending ${frequency} report to ${contact.contact_email}`);

    // Check idempotency (skip if sent recently, unless it's a test)
    if (!isTest) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentSend = await this.emailLogRepo.findRecentSend(
        contact.id,
        `${frequency}_report`,
        oneHourAgo
      );

      if (recentSend) {
        console.log(`[EmailService] Idempotency check: Email already sent at ${recentSend.sent_at}`);
        return {
          id: '',
          success: false,
          error: 'Email already sent recently (idempotent skip)',
        };
      }
    }

    // Validate tanks
    if (!tanks || tanks.length === 0) {
      const error = 'No tanks found for contact';
      console.error(`[EmailService] ${error}`);
      return { id: '', success: false, error };
    }

    try {
      // Generate report content
      const { html, text, subject, analytics } = await this.reportGenerator.generate({
        tanks,
        frequency,
        customerName: contact.customer_name,
        contactName: contact.contact_name || undefined,
        contactEmail: contact.contact_email,
        unsubscribeToken: contact.unsubscribe_token,
        config,
        isTest,
      });

      // Prepare email options
      const emailOptions: EmailOptions = {
        from: `${config.from_name} <${config.from_email}>`,
        to: contact.contact_email,
        subject,
        html,
        text,
        replyTo: config.reply_to,
        tags: [
          { name: 'type', value: `${frequency}_report` },
          { name: 'customer', value: this.sanitizeTag(contact.customer_name) },
          { name: 'test', value: isTest ? 'true' : 'false' },
        ],
      };

      // Add CC if specified
      if (contact.cc_emails) {
        emailOptions.cc = contact.cc_emails.split(',').map(e => e.trim()).filter(e => e);
      }

      // Send with retry logic
      const result = await this.emailProvider.send(emailOptions);

      // Log the result
      await this.emailLogRepo.create({
        customer_contact_id: contact.id,
        customer_name: contact.customer_name,
        recipient_email: contact.contact_email,
        cc_recipients: contact.cc_emails,
        email_type: isTest ? 'test_email' : `${frequency}_report`,
        email_subject: subject,
        sent_at: new Date(),
        delivery_status: result.success ? 'sent' : 'failed',
        external_email_id: result.id || null,
        error_message: result.error || null,
        locations_count: tanks.length,
        low_fuel_alerts: analytics?.lowFuelCount || null,
        critical_alerts: analytics?.criticalCount || null,
      });

      // Update contact last sent timestamp if successful
      if (result.success && !isTest) {
        await this.contactRepo.updateLastEmailSent(contact.id, new Date());
      }

      console.log(
        `[EmailService] Email ${result.success ? 'sent successfully' : 'failed'} - ID: ${result.id}`
      );

      return result;
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(`[EmailService] Error sending email:`, errorMessage);

      // Log the failure
      await this.emailLogRepo.create({
        customer_contact_id: contact.id,
        customer_name: contact.customer_name,
        recipient_email: contact.contact_email,
        cc_recipients: contact.cc_emails,
        email_type: isTest ? 'test_email' : `${frequency}_report`,
        email_subject: `Failed: ${frequency} report`,
        sent_at: new Date(),
        delivery_status: 'failed',
        error_message: errorMessage,
        locations_count: tanks.length,
      });

      return { id: '', success: false, error: errorMessage };
    }
  }

  /**
   * Send emails in batches with delay between batches
   */
  private async batchSendEmails(
    contacts: Contact[],
    config: EmailConfig,
    batchSize: number = 50,
    delayMs: number = 2000
  ): Promise<SendResult> {
    const result: SendResult = {
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    // Process in batches
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      console.log(`[EmailService] Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} contacts)`);

      // Process batch
      for (const contact of batch) {
        try {
          // Fetch tanks for this contact
          const tanks = await this.tankRepo.findTanksForContact(
            contact.id,
            contact.customer_name
          );

          if (tanks.length === 0) {
            console.warn(`[EmailService] No tanks found for ${contact.customer_name}`);
            result.skipped++;
            continue;
          }

          // Send email
          const emailResult = await this.sendEmail({
            contact,
            tanks,
            frequency: contact.report_frequency,
            config,
          });

          if (emailResult.success) {
            result.sent++;
          } else {
            if (emailResult.error?.includes('idempotent')) {
              result.skipped++;
            } else {
              result.failed++;
              result.errors.push(`${contact.customer_name}: ${emailResult.error}`);
            }
          }
        } catch (error) {
          const errorMessage = (error as Error).message;
          console.error(`[EmailService] Error processing ${contact.customer_name}:`, errorMessage);
          result.failed++;
          result.errors.push(`${contact.customer_name}: ${errorMessage}`);
        }
      }

      // Delay between batches (except after last batch)
      if (i + batchSize < contacts.length) {
        console.log(`[EmailService] Waiting ${delayMs}ms before next batch...`);
        await this.sleep(delayMs);
      }
    }

    console.log(`[EmailService] Batch send complete: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
    return result;
  }

  /**
   * Filter contacts by frequency based on current date
   */
  private filterByFrequency(contacts: Contact[], date: Date): Contact[] {
    return contacts.filter(contact => {
      const frequency = contact.report_frequency;

      if (frequency === 'daily') {
        return true; // Always send daily
      }

      if (frequency === 'weekly') {
        // Send on Monday (day 1)
        return date.getDay() === 1;
      }

      if (frequency === 'monthly') {
        // Send on 1st of month
        return date.getDate() === 1;
      }

      return false;
    });
  }

  /**
   * Get email configuration from environment/database
   * TODO: Replace with database-driven config
   */
  public async getEmailConfig(): Promise<EmailConfig> {
    const fromEmail = (process.env.RESEND_VERIFIED_EMAIL ||
      'alert@tankalert.greatsouthernfuels.com.au').trim();
    const fromName = 'Tank Alert';
    const replyTo = 'hayden@stevemacs.com.au';

    // Validate critical config
    if (!fromEmail || !fromEmail.includes('@')) {
      throw new Error(`Invalid FROM email configuration: "${fromEmail}"`);
    }

    if (!fromName || fromName.trim() === '') {
      throw new Error(`Invalid FROM name configuration: "${fromName}"`);
    }

    console.log(`[EmailService] Email config loaded - FROM: "${fromName} <${fromEmail}>"`);

    return {
      from_email: fromEmail,
      from_name: fromName,
      reply_to: replyTo,
      support_email: 'support@greatsouthernfuel.com.au',
      logo_url:
        'https://www.greatsouthernfuels.com.au/wp-content/uploads/2024/08/9d8131_1317ed20e5274adc9fd15fe2196d2cb8mv2.webp',
      primary_color: '#059669',
      low_fuel_threshold: 30,
      critical_threshold: 15,
    };
  }

  /**
   * Sanitize tag value for email provider
   */
  private sanitizeTag(value: string): string {
    return value
      .replace(/[^a-zA-Z0-9_-\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
