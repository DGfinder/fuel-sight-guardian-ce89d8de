/**
 * AgBot Report Cron Job (Refactored)
 * Thin wrapper that delegates to EmailController
 *
 * Schedule: Runs every hour at :15 (e.g., 7:15, 8:15, 9:15, etc.)
 * Sends reports based on contact preferred_send_hour and report_frequency
 *
 * Authentication: Vercel Cron signature or Bearer token
 *
 * Previous version (477 lines) backed up to: send-agbot-reports.ts.backup
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { EmailController } from '../controllers/EmailController.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('='.repeat(80));
  console.log('[CRON] AgBot Reports - Starting');
  console.log('[CRON] Timestamp:', new Date().toISOString());
  console.log('='.repeat(80));

  try {
    // Initialize controller and delegate
    const controller = new EmailController();
    return await controller.sendScheduledReports(req, res);
  } catch (error) {
    console.error('[CRON] Fatal error initializing EmailController:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
}
