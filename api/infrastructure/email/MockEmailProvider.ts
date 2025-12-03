/**
 * Mock Email Provider for Testing
 * Simulates email sending without actually sending emails
 * Useful for unit tests and development
 */

import type { IEmailProvider, EmailOptions, EmailResult } from './IEmailProvider.js';

export class MockEmailProvider implements IEmailProvider {
  public sentEmails: EmailOptions[] = [];
  public shouldFail: boolean = false;
  public failureMessage: string = 'Mock failure';

  async send(options: EmailOptions): Promise<EmailResult> {
    console.log('[MockEmailProvider] Simulating email send');
    console.log('[MockEmailProvider] To:', options.to);
    console.log('[MockEmailProvider] Subject:', options.subject);

    // Record the email
    this.sentEmails.push(options);

    // Simulate API delay
    await this.sleep(10);

    if (this.shouldFail) {
      return {
        id: '',
        success: false,
        error: this.failureMessage
      };
    }

    return {
      id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      success: true
    };
  }

  async sendBatch(emails: EmailOptions[]): Promise<EmailResult[]> {
    const results: EmailResult[] = [];

    for (const email of emails) {
      const result = await this.send(email);
      results.push(result);
    }

    return results;
  }

  /**
   * Reset the mock state (useful between tests)
   */
  reset(): void {
    this.sentEmails = [];
    this.shouldFail = false;
    this.failureMessage = 'Mock failure';
  }

  /**
   * Get count of sent emails
   */
  getSentCount(): number {
    return this.sentEmails.length;
  }

  /**
   * Get last sent email
   */
  getLastSent(): EmailOptions | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
