/**
 * Email Preview API Endpoint (Refactored)
 * Thin wrapper that delegates to EmailController
 *
 * Allows admins to preview email content before sending
 * Returns HTML, text, or JSON with both
 *
 * Authentication: Requires Bearer token (ADMIN_API_SECRET)
 *
 * Previous version backed up to: preview.ts.backup
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { EmailController } from '../controllers/EmailController.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[PREVIEW] Email preview endpoint called');
  console.log('[PREVIEW] Timestamp:', new Date().toISOString());

  try {
    // Initialize controller and delegate
    const controller = new EmailController();
    return await controller.previewEmail(req, res);
  } catch (error) {
    console.error('[PREVIEW] Fatal error initializing EmailController:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
}
