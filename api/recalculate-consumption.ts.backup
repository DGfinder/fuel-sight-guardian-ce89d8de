// Recalculate Consumption API Endpoint
// Triggers recalculation of daily consumption for all active tanks
// URL: POST /api/recalculate-consumption

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { recalculateAllAssets } from './lib/consumption-calculator.js';

// Simple auth for manual triggers (use cron secret or custom key)
const AUTH_KEY = process.env.CRON_SECRET || 'FSG-cron-secret-2025';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Use POST to trigger recalculation'
    });
  }

  // Check authorization
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  // Also allow key in body for easier testing
  const bodyKey = req.body?.auth_key;

  if (token !== AUTH_KEY && bodyKey !== AUTH_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid auth_key required'
    });
  }

  try {
    console.log('[RECALCULATE] Starting consumption recalculation for all assets...');

    const result = await recalculateAllAssets();

    const duration = Date.now() - startTime;

    console.log(`[RECALCULATE] Complete: ${result.updated} updated, ${result.failed} failed`);

    return res.status(200).json({
      success: true,
      message: 'Consumption recalculation complete',
      results: {
        processed: result.processed,
        updated: result.updated,
        failed: result.failed,
        duration
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[RECALCULATE ERROR]', (error as Error).message);

    return res.status(500).json({
      success: false,
      error: 'Recalculation failed',
      message: (error as Error).message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
}
