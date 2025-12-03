/**
 * Unified Location Data Endpoint
 * POST /api/agbot/unified-location - Get unified location data from all systems
 *
 * This endpoint combines data from SmartFill, AgBot, and Captive Payments
 * to provide a unified view of a location across all systems.
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Support both GET (for API info) and POST (for data retrieval)
  if (req.method === 'GET') {
    return res.json({
      success: true,
      service: 'Unified Location Data API',
      timestamp: new Date().toISOString(),
      features: [
        'Multi-system data integration',
        'Data correlation and quality assessment',
        'Historical data aggregation',
        'Intelligent caching',
      ],
    });
  }

  if (req.method !== 'POST') {
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

    // Initialize services
    const dataService = new AgBotDataService(locationRepo, assetRepo, readingsRepo);
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

    return controller.getUnifiedLocation(req, res);
  } catch (error) {
    console.error('[Unified Location] Request failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}
