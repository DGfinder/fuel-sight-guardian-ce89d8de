/**
 * Email Service - Wrapper for Resend API
 * Handles sending emails to customers for AgBot reports and alerts
 */

import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Default sender email (update with your verified domain)
const DEFAULT_FROM_EMAIL = 'AgBot Alerts <alerts@greatsouthernfuel.com.au>';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export interface EmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

/**
 * Send an email using Resend API
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY environment variable is not set');
      return {
        success: false,
        error: 'Email service not configured - missing API key'
      };
    }

    const response = await resend.emails.send({
      from: options.from || DEFAULT_FROM_EMAIL,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
      tags: options.tags
    });

    if (response.error) {
      console.error('Resend API error:', response.error);
      return {
        success: false,
        error: response.error.message || 'Failed to send email'
      };
    }

    return {
      success: true,
      emailId: response.data?.id
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending email'
    };
  }
}

/**
 * Send AgBot daily report email to a customer
 */
export async function sendAgBotDailyReport(
  recipientEmail: string,
  recipientName: string,
  customerName: string,
  emailHtml: string
): Promise<EmailResult> {
  return sendEmail({
    to: recipientEmail,
    subject: `Daily AgBot Report - ${customerName}`,
    html: emailHtml,
    from: DEFAULT_FROM_EMAIL,
    replyTo: 'support@greatsouthernfuel.com.au',
    tags: [
      { name: 'type', value: 'daily_report' },
      { name: 'customer', value: customerName }
    ]
  });
}

/**
 * Send low fuel alert email
 */
export async function sendLowFuelAlert(
  recipientEmail: string,
  locationName: string,
  fuelLevel: number,
  daysRemaining: number
): Promise<EmailResult> {
  const emailHtml = `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #d97706;">⚠️ Low Fuel Alert</h2>
        <p>Your tank at <strong>${locationName}</strong> is running low on fuel.</p>
        <ul>
          <li><strong>Current Level:</strong> ${fuelLevel}%</li>
          <li><strong>Days Remaining:</strong> ${daysRemaining} days</li>
        </ul>
        <p>Please schedule a refill soon to avoid running out.</p>
        <hr/>
        <p style="color: #666; font-size: 12px;">
          This is an automated alert from your AgBot monitoring system.
        </p>
      </body>
    </html>
  `;

  return sendEmail({
    to: recipientEmail,
    subject: `🚨 Low Fuel Alert - ${locationName}`,
    html: emailHtml,
    tags: [
      { name: 'type', value: 'alert' },
      { name: 'alert_type', value: 'low_fuel' }
    ]
  });
}

/**
 * Test email sending (for debugging)
 */
export async function sendTestEmail(recipientEmail: string): Promise<EmailResult> {
  const emailHtml = `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>AgBot Email Service Test</h2>
        <p>If you're receiving this, the email service is configured correctly!</p>
        <p style="color: #666; font-size: 12px;">
          Sent at: ${new Date().toISOString()}
        </p>
      </body>
    </html>
  `;

  return sendEmail({
    to: recipientEmail,
    subject: 'AgBot Email Service Test',
    html: emailHtml,
    tags: [{ name: 'type', value: 'test' }]
  });
}
