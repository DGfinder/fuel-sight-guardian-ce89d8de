/**
 * Email Controller
 * Thin HTTP handler layer for email endpoints
 * Handles authentication, validation, and response formatting
 * Delegates all business logic to EmailService
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { EmailService } from '../services/EmailService.js';
import { ReportGeneratorService } from '../services/ReportGeneratorService.js';
import { ContactRepository } from '../repositories/ContactRepository.js';
import { TankRepository } from '../repositories/TankRepository.js';
import { EmailLogRepository } from '../repositories/EmailLogRepository.js';
import { ResendEmailProvider } from '../infrastructure/email/ResendEmailProvider.js';

export class EmailController {
  private emailService: EmailService;
  private contactRepo: ContactRepository;
  private tankRepo: TankRepository;
  private supabase: any;

  constructor() {
    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize repositories
    this.contactRepo = new ContactRepository(this.supabase);
    this.tankRepo = new TankRepository(this.supabase);
    const emailLogRepo = new EmailLogRepository(this.supabase);

    // Initialize services
    const reportGenerator = new ReportGeneratorService(this.supabase);

    // Initialize email provider
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error('Missing RESEND_API_KEY environment variable');
    }
    const emailProvider = new ResendEmailProvider(resendApiKey, 3, 1000);

    // Initialize email service
    this.emailService = new EmailService(
      emailProvider,
      this.contactRepo,
      this.tankRepo,
      emailLogRepo,
      reportGenerator
    );
  }

  /**
   * Send scheduled reports (cron endpoint)
   * POST /api/cron/send-agbot-reports
   */
  async sendScheduledReports(req: VercelRequest, res: VercelResponse) {
    const startTime = Date.now();

    console.log('[EmailController] Send scheduled reports endpoint called');
    console.log('[EmailController] Method:', req.method);

    // Accept GET (Vercel Cron) or POST (manual trigger)
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({
        error: 'Method not allowed',
        expected: 'GET or POST',
        received: req.method,
      });
    }

    // Authentication
    if (!(await this.isAuthorizedAsync(req))) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication required',
      });
    }

    console.log('[EmailController] Request authenticated successfully');

    try {
      // Calculate Perth time
      const now = new Date();
      const perthHour = (now.getUTCHours() + 8) % 24;
      const perthMinutes = now.getUTCMinutes();

      console.log(`[EmailController] Current Perth time: ${perthHour}:${perthMinutes.toString().padStart(2, '0')}`);

      // Delegate to service
      const result = await this.emailService.sendScheduledReports(perthHour);

      const duration = Date.now() - startTime;

      return res.status(200).json({
        success: true,
        message: `Reports sent for Perth hour ${perthHour}:${perthMinutes.toString().padStart(2, '0')}`,
        results: {
          emails_sent: result.sent,
          emails_failed: result.failed,
          emails_skipped: result.skipped,
          errors: result.errors,
        },
        duration_ms: duration,
        timestamp: now.toISOString(),
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[EmailController] Error in sendScheduledReports:', error);

      return res.status(500).json({
        success: false,
        error: 'Failed to send scheduled reports',
        message: (error as Error).message,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Send test email
   * POST /api/test-send-email
   */
  async sendTestEmail(req: VercelRequest, res: VercelResponse) {
    const startTime = Date.now();

    console.log('[EmailController] Send test email endpoint called');

    // Only accept POST
    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'Method not allowed',
        expected: 'POST',
        received: req.method,
      });
    }

    // Authentication
    if (!(await this.isAuthorizedAsync(req))) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid Bearer token required. Set ADMIN_API_SECRET environment variable.',
      });
    }

    console.log('[EmailController] Test email request authenticated');

    try {
      const { contact_id, frequency = 'daily' } = req.body;

      // Validate input
      if (!contact_id) {
        return res.status(400).json({
          error: 'Missing required parameter',
          message: 'contact_id is required',
        });
      }

      // Fetch contact
      const contact = await this.contactRepo.findById(contact_id);
      if (!contact) {
        return res.status(404).json({
          error: 'Contact not found',
          message: `No customer contact found with ID: ${contact_id}`,
        });
      }

      console.log(`[EmailController] Sending test email to ${contact.contact_email}`);

      // Fetch tanks
      const tanks = await this.tankRepo.findTanksForContact(
        contact.id,
        contact.customer_name
      );

      if (tanks.length === 0) {
        return res.status(400).json({
          error: 'No tanks found',
          message: `No tanks found for customer: ${contact.customer_name}`,
        });
      }

      console.log(`[EmailController] Found ${tanks.length} tanks for test email`);

      // Get email config
      const config = await this.emailService.getEmailConfig();

      // Send email via service
      const result = await this.emailService.sendEmail({
        contact,
        tanks,
        frequency: frequency as 'daily' | 'weekly' | 'monthly',
        config,
        isTest: true,
      });

      const duration = Date.now() - startTime;

      if (result.success) {
        return res.status(200).json({
          success: true,
          message: `Test email sent successfully to ${contact.contact_email}`,
          email_id: result.id,
          contact: {
            id: contact.id,
            customer_name: contact.customer_name,
            contact_email: contact.contact_email,
          },
          tanks_count: tanks.length,
          duration_ms: duration,
          timestamp: new Date().toISOString(),
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Failed to send test email',
          message: result.error,
          duration_ms: duration,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[EmailController] Error in sendTestEmail:', error);

      return res.status(500).json({
        success: false,
        error: 'Failed to send test email',
        message: (error as Error).message,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Preview email without sending
   * POST /api/email/preview
   */
  async previewEmail(req: VercelRequest, res: VercelResponse) {
    console.log('[EmailController] Preview email endpoint called');

    // Only accept POST
    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'Method not allowed',
        expected: 'POST',
        received: req.method,
      });
    }

    // Authentication
    if (!(await this.isAuthorizedAsync(req))) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid Bearer token required',
      });
    }

    try {
      const {
        contact_id,
        frequency = 'daily',
        format = 'html',
      } = req.body;

      if (!contact_id) {
        return res.status(400).json({
          error: 'Missing required parameter',
          message: 'contact_id is required',
        });
      }

      // Fetch contact and tanks (same as preview.ts)
      const contact = await this.contactRepo.findById(contact_id);
      if (!contact) {
        return res.status(404).json({
          error: 'Contact not found',
        });
      }

      const tanks = await this.tankRepo.findTanksForContact(
        contact.id,
        contact.customer_name
      );

      if (tanks.length === 0) {
        return res.status(400).json({
          error: 'No tanks found',
          message: `No tanks found for customer: ${contact.customer_name}`,
        });
      }

      // Generate report (don't send)
      const reportGenerator = new ReportGeneratorService(this.supabase);
      const config = await this.emailService.getEmailConfig();

      const report = await reportGenerator.generate({
        tanks,
        frequency: frequency as 'daily' | 'weekly' | 'monthly',
        customerName: contact.customer_name,
        contactName: contact.contact_name || undefined,
        contactEmail: contact.contact_email,
        unsubscribeToken: contact.unsubscribe_token,
        config,
        isTest: true,
      });

      // Return based on format
      if (format === 'html') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(report.html);
      } else if (format === 'text') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(report.text);
      } else {
        return res.status(200).json({
          success: true,
          preview: {
            subject: report.subject,
            html: report.html,
            text: report.text,
            analytics: report.analytics,
          },
        });
      }
    } catch (error) {
      console.error('[EmailController] Error in previewEmail:', error);

      return res.status(500).json({
        success: false,
        error: 'Failed to generate preview',
        message: (error as Error).message,
      });
    }
  }

  /**
   * Check if request is authorized
   * Supports three authentication methods:
   * 1. Vercel Cron signature (x-vercel-signature header)
   * 2. Static Bearer token (ADMIN_API_SECRET or CRON_SECRET)
   * 3. Supabase authenticated admin/manager user
   */
  private async isAuthorizedAsync(req: VercelRequest): Promise<boolean> {
    // Check 1: Vercel Cron signature
    const isVercelCron = req.headers['x-vercel-signature'] !== undefined;
    if (isVercelCron) {
      console.log('[EmailController AUTH] Vercel Cron signature detected');
      return true;
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    // Check 2: Static Bearer token (for external services)
    const adminSecret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET;
    if (token && adminSecret && token === adminSecret) {
      console.log('[EmailController AUTH] Static Bearer token validated');
      return true;
    }

    // Check 3: Supabase authenticated admin user
    if (authHeader?.startsWith('Bearer ') && token) {
      try {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        // Use VITE_SUPABASE_ANON_KEY as it has the actual anon key (not service role)
        const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          console.error('[EmailController AUTH] Supabase env vars missing');
          return false;
        }

        // Create a new Supabase client with the user's token
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } }
        });

        // Verify the user token
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
          console.error('[EmailController AUTH] Invalid Supabase token:', error?.message);
          return false;
        }

        // Check user role
        const { data: roles, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (roleError) {
          console.error('[EmailController AUTH] Failed to fetch user role:', roleError.message);
          return false;
        }

        const isAdmin = roles?.role === 'admin' || roles?.role === 'manager';

        if (isAdmin) {
          console.log(`[EmailController AUTH] Authenticated admin user: ${user.email}`);
          return true;
        } else {
          console.warn(`[EmailController AUTH] User ${user.email} lacks admin role (role: ${roles?.role})`);
          return false;
        }
      } catch (error) {
        console.error('[EmailController AUTH] Supabase auth check failed:', error);
        return false;
      }
    }

    console.error('[EmailController AUTH] Unauthorized request - no valid credentials');
    return false;
  }
}
