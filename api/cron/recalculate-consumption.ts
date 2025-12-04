import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ConsumptionAnalysisService } from '../services/ConsumptionAnalysisService.js';
import { ReadingsHistoryRepository } from '../repositories/ReadingsHistoryRepository.js';
import { AgBotAssetRepository } from '../repositories/AgBotAssetRepository.js';

/**
 * Recalculate Consumption Cron Job
 * Scheduled job to recalculate consumption metrics for all active AgBot assets
 *
 * Schedule: Every 6 hours (configured in vercel.json)
 * Authentication: Vercel Cron signature or Bearer token
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('[Recalculate Consumption] Starting consumption recalculation job');

    // Authentication (same pattern as send-agbot-reports cron)
    const isVercelCron = !!req.headers['x-vercel-signature'] ||
                         (req.headers['user-agent'] as string)?.includes('vercel-cron');
    const authHeader = req.headers.authorization;
    const hasValidAuth = isVercelCron || (authHeader && authHeader.startsWith('Bearer '));

    console.log('[Recalculate Consumption] Auth check:', {
      hasVercelSignature: !!req.headers['x-vercel-signature'],
      hasVercelUserAgent: (req.headers['user-agent'] as string)?.includes('vercel-cron'),
      hasAuthorization: !!authHeader,
    });

    if (!hasValidAuth) {
      console.error('[Recalculate Consumption] Unauthorized - no valid auth method');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.log('[Recalculate Consumption] ✅ Authorized');

    // Get Supabase credentials - use service role key for schema access
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Recalculate Consumption] Missing Supabase environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize services
    const readingsRepo = new ReadingsHistoryRepository(supabase);
    const assetRepo = new AgBotAssetRepository(supabase);
    const consumptionService = new ConsumptionAnalysisService(readingsRepo, assetRepo);

    // Start recalculation
    const startTime = Date.now();
    const result = await consumptionService.recalculateAll();
    const duration = Date.now() - startTime;

    console.log('[Recalculate Consumption] Recalculation complete:', {
      processed: result.processed,
      updated: result.updated,
      failed: result.failed,
      duration_ms: duration,
    });

    // Log to ta_agbot_sync_log table in great_southern_fuels schema
    try {
      await supabase.schema('great_southern_fuels').from('ta_agbot_sync_log').insert({
        sync_type: 'consumption_recalc',
        sync_status: result.failed === 0 ? 'success' : 'partial',
        assets_processed: result.processed,
        sync_duration_ms: duration,
        error_message: result.failed > 0 ? `${result.failed} assets failed` : null,
      });
    } catch (logError) {
      console.error('[Recalculate Consumption] Failed to log to ta_agbot_sync_log:', logError);
      // Don't fail the entire job if logging fails
    }

    return res.status(200).json({
      success: true,
      processed: result.processed,
      updated: result.updated,
      failed: result.failed,
      duration_ms: duration,
      message: `Successfully recalculated consumption for ${result.updated} assets`,
    });
  } catch (error) {
    console.error('[Recalculate Consumption] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    });
  }
}
