/**
 * Resend Email Provider Implementation
 * Implements IEmailProvider using Resend API
 */

import { Resend } from 'resend';
import type { IEmailProvider, EmailOptions, EmailResult } from './IEmailProvider.js';

export class ResendEmailProvider implements IEmailProvider {
  private client: Resend;
  private retryMaxAttempts: number;
  private retryBaseDelayMs: number;

  constructor(apiKey: string, retryMaxAttempts = 3, retryBaseDelayMs = 1000) {
    this.client = new Resend(apiKey);
    this.retryMaxAttempts = retryMaxAttempts;
    this.retryBaseDelayMs = retryBaseDelayMs;
  }

  /**
   * Send email with automatic retry logic and exponential backoff
   */
  async send(options: EmailOptions): Promise<EmailResult> {
    for (let attempt = 1; attempt <= this.retryMaxAttempts; attempt++) {
      try {
        const result = await this.client.emails.send({
          from: options.from,
          to: options.to,
          cc: options.cc,
          subject: options.subject,
          html: options.html,
          text: options.text,
          replyTo: options.replyTo,
          headers: options.headers,
          tags: options.tags,
        });

        if (result.error) {
          // Resend API returned an error
          if (attempt < this.retryMaxAttempts) {
            const delay = Math.pow(2, attempt - 1) * this.retryBaseDelayMs;
            console.log(`[ResendProvider] Attempt ${attempt}/${this.retryMaxAttempts} failed: ${result.error.message}`);
            console.log(`[ResendProvider] Retrying in ${delay}ms...`);
            await this.sleep(delay);
            continue;
          }
          // Max retries reached
          return {
            id: '',
            success: false,
            error: result.error.message
          };
        }

        // Success
        if (attempt > 1) {
          console.log(`[ResendProvider] Email sent successfully on attempt ${attempt}/${this.retryMaxAttempts}`);
        }

        return {
          id: result.data?.id || '',
          success: true
        };
      } catch (error) {
        // Network error or exception
        if (attempt < this.retryMaxAttempts) {
          const delay = Math.pow(2, attempt - 1) * this.retryBaseDelayMs;
          console.log(`[ResendProvider] Attempt ${attempt}/${this.retryMaxAttempts} threw error: ${(error as Error).message}`);
          console.log(`[ResendProvider] Retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }
        // Max retries reached
        return {
          id: '',
          success: false,
          error: (error as Error).message
        };
      }
    }

    // Should never reach here
    return {
      id: '',
      success: false,
      error: 'Max retries exceeded'
    };
  }

  /**
   * Send multiple emails in batch
   * Sends sequentially with rate limiting between emails
   */
  async sendBatch(emails: EmailOptions[]): Promise<EmailResult[]> {
    const results: EmailResult[] = [];

    for (let i = 0; i < emails.length; i++) {
      const result = await this.send(emails[i]);
      results.push(result);

      // Add small delay between emails to respect rate limits
      if (i < emails.length - 1) {
        await this.sleep(100); // 100ms between emails
      }
    }

    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
