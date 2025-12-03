/**
 * Gasbot Webhook Endpoint
 * Receives hourly JSON data from Gasbot dashboard
 *
 * REFACTORED: Now uses service-oriented architecture
 * Original: 625 lines of procedural code in gasbot-webhook.mjs
 * New: 65 lines delegating to services (~90% reduction)
 *
 * URL: https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook
 * Method: POST
 * Auth: Bearer FSG-gasbot-webhook-2025
 * Content-Type: application/json
 *
 * Architecture:
 * ┌─────────────────────────────────────┐
 * │ gasbot-webhook.ts (Thin wrapper)    │
 * ├─────────────────────────────────────┤
 * │ AgBotWebhookController (HTTP)       │
 * ├─────────────────────────────────────┤
 * │ AgBotWebhookOrchestrator (Flow)     │
 * ├─────────────────────────────────────┤
 * │ Services & Repositories (Logic)     │
 * └─────────────────────────────────────┘
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { AgBotWebhookController } from './controllers/AgBotWebhookController.js';
import { AgBotWebhookOrchestrator } from './services/AgBotWebhookOrchestrator.js';
import { AlertGenerationService } from './services/AlertGenerationService.js';
import { ConsumptionAnalysisService } from './services/ConsumptionAnalysisService.js';
import { WebhookSyncLogService } from './services/WebhookSyncLogService.js';
import { AgBotLocationRepository } from './repositories/AgBotLocationRepository.js';
import { AgBotAssetRepository } from './repositories/AgBotAssetRepository.js';
import { ReadingsHistoryRepository } from './repositories/ReadingsHistoryRepository.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Initialize repositories
    const locationRepo = new AgBotLocationRepository(supabase);
    const assetRepo = new AgBotAssetRepository(supabase);
    const readingsRepo = new ReadingsHistoryRepository(supabase);

    // Initialize services
    const alertService = new AlertGenerationService(supabase);
    const consumptionService = new ConsumptionAnalysisService(readingsRepo, assetRepo);
    const syncLogService = new WebhookSyncLogService(supabase);

    // Initialize orchestrator
    const orchestrator = new AgBotWebhookOrchestrator(
      supabase,
      locationRepo,
      assetRepo,
      readingsRepo,
      alertService,
      consumptionService,
      syncLogService
    );

    // Initialize controller
    const webhookSecret = process.env.GASBOT_WEBHOOK_SECRET || 'FSG-gasbot-webhook-2025';
    const controller = new AgBotWebhookController(orchestrator, webhookSecret);

    // Delegate to controller
    return controller.handleWebhook(req, res);
  } catch (error) {
    console.error('[Gasbot Webhook] Fatal initialization error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}
