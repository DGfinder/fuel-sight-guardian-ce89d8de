/**
 * Kalgoorlie Dip Webhook
 * Receives manual tank dip readings from Power Automate (SharePoint Excel)
 *
 * Endpoint: POST /api/kalgoorlie-dip-webhook
 * Auth: X-API-Key header
 *
 * Payload example:
 * {
 *   "dips": [
 *     { "tank_name": "MILLENNIUM STHP", "dip_value": 42342, "dip_date": "2025-12-09" },
 *     { "tank_name": "KUNDANA Gen 1", "dip_value": 87867, "dip_date": "2025-12-09" }
 *   ]
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { KalgoorlieTankMatcher } from './services/KalgoorlieTankMatcher';
import { DipRecordingService } from './services/DipRecordingService';

interface DipInput {
  tank_name: string;
  dip_value: number;
  dip_date: string;
}

interface WebhookPayload {
  dips: DipInput[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Authenticate request
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.KALGOORLIE_WEBHOOK_KEY;

  if (!expectedKey) {
    console.error('[KalgoorlieDipWebhook] KALGOORLIE_WEBHOOK_KEY not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  if (apiKey !== expectedKey) {
    console.warn('[KalgoorlieDipWebhook] Invalid API key attempt');
    return res.status(401).json({ error: 'Unauthorized. Invalid API key.' });
  }

  try {
    // Parse and validate payload
    const payload = req.body as WebhookPayload;

    if (!payload.dips || !Array.isArray(payload.dips)) {
      return res.status(400).json({
        error: 'Invalid payload. Expected { dips: [...] }',
      });
    }

    if (payload.dips.length === 0) {
      return res.status(400).json({
        error: 'No dips provided',
      });
    }

    console.log(`[KalgoorlieDipWebhook] Processing ${payload.dips.length} dip readings`);

    // Process each dip
    const dipService = new DipRecordingService();
    const results = [];

    for (const dip of payload.dips) {
      // Validate dip structure
      if (!dip.tank_name || typeof dip.dip_value !== 'number' || !dip.dip_date) {
        results.push({
          tank_name: dip.tank_name || 'Unknown',
          success: false,
          error: 'Invalid dip structure. Required: tank_name, dip_value, dip_date',
        });
        continue;
      }

      // Match tank name to ID
      const tankId = KalgoorlieTankMatcher.matchTankId(dip.tank_name);

      if (!tankId) {
        results.push({
          tank_name: dip.tank_name,
          success: false,
          error: `Tank not found in mapping: "${dip.tank_name}"`,
        });
        continue;
      }

      // Record the dip
      const result = await dipService.recordDip(
        tankId,
        dip.dip_value,
        dip.dip_date
      );

      results.push({
        tank_name: dip.tank_name,
        ...result,
      });
    }

    // Summary stats
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const alertsCount = results.reduce(
      (sum, r) => sum + (r.alertsTriggered?.length || 0),
      0
    );

    console.log(
      `[KalgoorlieDipWebhook] Completed: ${successCount} success, ${failureCount} failed, ${alertsCount} alerts`
    );

    // Return detailed results
    return res.status(200).json({
      success: true,
      summary: {
        total: payload.dips.length,
        successful: successCount,
        failed: failureCount,
        alerts_triggered: alertsCount,
      },
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[KalgoorlieDipWebhook] Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
