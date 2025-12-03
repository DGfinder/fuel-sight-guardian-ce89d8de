/**
 * Test Email API Endpoint (Refactored)
 * Thin wrapper that delegates to EmailController
 *
 * Sends a test email to a specific customer contact
 * Useful for testing email templates and delivery
 *
 * Authentication: Requires Bearer token (ADMIN_API_SECRET)
 *
 * Previous version backed up to: test-send-email.ts.backup
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { EmailController } from './controllers/EmailController.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[TEST EMAIL] Test email endpoint called');
  console.log('[TEST EMAIL] Timestamp:', new Date().toISOString());

  try {
    // Initialize controller and delegate
    const controller = new EmailController();
    return await controller.sendTestEmail(req, res);
  } catch (error) {
    console.error('[TEST EMAIL] Fatal error initializing EmailController:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
}
