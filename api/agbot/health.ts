/**
 * AgBot Health Endpoint
 * GET /api/agbot/health - Get fleet health status
 * GET /api/agbot/health?id=:id - Get location health status
 * GET /api/agbot/health?provider=true - Check provider connection
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { AgBotController } from '../controllers/AgBotController.js';
import { AgBotDataService } from '../services/AgBotDataService.js';
import { AgBotAnalyticsService } from '../services/AgBotAnalyticsService.js';
import { ConsumptionAnalysisService } from '../services/ConsumptionAnalysisService.js';
import { LocationIntegrationService } from '../services/LocationIntegrationService.js';
import { AgBotLocationRepository } from '../repositories/AgBotLocationRepository.js';
import { AgBotAssetRepository } from '../repositories/AgBotAssetRepository.js';
import { ReadingsHistoryRepository } from '../repositories/ReadingsHistoryRepository.js';
import { AtharaAgBotProvider } from '../infrastructure/agbot/AtharaAgBotProvider.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

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

    // Initialize provider
    const provider = new AtharaAgBotProvider(
      process.env.ATHARA_API_KEY || '',
      process.env.ATHARA_API_SECRET || '',
      process.env.ATHARA_BASE_URL || 'https://api.athara.io'
    );

    // Initialize services
    const dataService = new AgBotDataService(provider, locationRepo, assetRepo, readingsRepo);
    const analyticsService = new AgBotAnalyticsService(readingsRepo, assetRepo, locationRepo);
    const consumptionService = new ConsumptionAnalysisService(readingsRepo, assetRepo);
    const integrationService = new LocationIntegrationService(
      supabase,
      locationRepo,
      assetRepo,
      readingsRepo
    );

    // Initialize controller
    const controller = new AgBotController(
      dataService,
      analyticsService,
      consumptionService,
      integrationService
    );

    // Route to appropriate method
    const { id, provider: checkProvider } = req.query;

    if (checkProvider === 'true') {
      return controller.checkProviderConnection(req, res);
    } else if (id) {
      return controller.getLocationHealth(req, res);
    } else {
      return controller.getFleetHealth(req, res);
    }
  } catch (error) {
    console.error('[AgBot Health] Request failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}
