/**
 * Email Provider Interface
 * Defines the contract for email sending services
 * Enables swapping between Resend, Sendgrid, AWS SES, etc.
 */

export interface EmailOptions {
  from: string;
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
}

export interface EmailResult {
  id: string;
  success: boolean;
  error?: string;
}

/**
 * Interface that all email providers must implement
 * Allows dependency injection and easy testing with mocks
 */
export interface IEmailProvider {
  /**
   * Send a single email
   */
  send(options: EmailOptions): Promise<EmailResult>;

  /**
   * Send multiple emails in batch
   * Default implementation sends sequentially
   */
  sendBatch(emails: EmailOptions[]): Promise<EmailResult[]>;
}
