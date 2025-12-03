/**
 * AgBot Controller
 * HTTP request/response handlers for AgBot endpoints
 *
 * Responsibilities:
 * - HTTP request/response handling
 * - Authentication and authorization
 * - Input validation
 * - Response formatting
 * - Error handling and logging
 *
 * Dependencies:
 * - AgBotDataService (data sync operations)
 * - AgBotAnalyticsService (analytics and reporting)
 * - ConsumptionAnalysisService (consumption calculations)
 * - LocationIntegrationService (unified location data)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AgBotDataService } from '../services/AgBotDataService.js';
import { AgBotAnalyticsService } from '../services/AgBotAnalyticsService.js';
import { ConsumptionAnalysisService } from '../services/ConsumptionAnalysisService.js';
import { LocationIntegrationService } from '../services/LocationIntegrationService.js';

export class AgBotController {
  constructor(
    private dataService: AgBotDataService,
    private analyticsService: AgBotAnalyticsService,
    private consumptionService: ConsumptionAnalysisService,
    private integrationService: LocationIntegrationService
  ) {}

  /**
   * GET /api/agbot/locations
   * Get all locations with optional customer filtering
   */
  async getLocations(req: VercelRequest, res: VercelResponse) {
    if (!this.isAuthorized(req)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { customer_name, include_disabled } = req.query;

      const locations = customer_name
        ? await this.dataService.getLocationsByCustomer(
            customer_name as string,
            include_disabled === 'true'
          )
        : await this.dataService.getAllLocations(include_disabled === 'true');

      return res.status(200).json({
        success: true,
        data: locations,
        count: locations.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AgBotController] Error fetching locations:', error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/agbot/location/:id
   * Get a specific location with its assets
   */
  async getLocation(req: VercelRequest, res: VercelResponse) {
    if (!this.isAuthorized(req)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Location ID is required',
        });
      }

      const location = await this.dataService.getLocationWithAssets(id);

      if (!location) {
        return res.status(404).json({
          success: false,
          error: 'Location not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: location,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AgBotController] Error fetching location:', error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/agbot/location/:id/health
   * Get health status for a specific location
   */
  async getLocationHealth(req: VercelRequest, res: VercelResponse) {
    if (!this.isAuthorized(req)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Location ID is required',
        });
      }

      const health = await this.dataService.getLocationHealth(id);

      return res.status(200).json({
        success: true,
        data: health,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AgBotController] Error fetching location health:', error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/agbot/sync
   * Sync all locations from provider
   */
  async syncAll(req: VercelRequest, res: VercelResponse) {
    if (!this.isAuthorized(req)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { include_readings = true } = req.body || {};

      console.log('[AgBotController] Starting full sync...');

      const result = await this.dataService.syncAllLocations({
        syncType: 'manual',
        includeReadings: include_readings,
      });

      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result,
          message: `Successfully synced ${result.synced} locations`,
          timestamp: new Date().toISOString(),
        });
      } else {
        return res.status(500).json({
          success: false,
          data: result,
          error: 'Sync completed with errors',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('[AgBotController] Error during sync:', error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/agbot/sync/:id
   * Sync a specific location
   */
  async syncLocation(req: VercelRequest, res: VercelResponse) {
    if (!this.isAuthorized(req)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Location ID is required',
        });
      }

      console.log(`[AgBotController] Syncing location ${id}...`);

      const result = await this.dataService.syncLocation(id);

      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result,
          message: `Successfully synced location ${id}`,
          timestamp: new Date().toISOString(),
        });
      } else {
        return res.status(500).json({
          success: false,
          data: result,
          error: `Failed to sync location ${id}`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('[AgBotController] Error syncing location:', error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/agbot/analytics/fleet
   * Get fleet-wide summary analytics
   */
  async getFleetSummary(req: VercelRequest, res: VercelResponse) {
    if (!this.isAuthorized(req)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const summary = await this.analyticsService.getFleetSummary();

      return res.status(200).json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AgBotController] Error fetching fleet summary:', error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/agbot/analytics/tank/:assetId
   * Get analytics for a specific tank
   */
  async getTankAnalytics(req: VercelRequest, res: VercelResponse) {
    if (!this.isAuthorized(req)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { assetId } = req.query;

      if (!assetId || typeof assetId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Asset ID is required',
        });
      }

      const analytics = await this.analyticsService.getTankAnalytics(assetId);

      if (!analytics) {
        return res.status(404).json({
          success: false,
          error: 'Tank not found or no analytics available',
        });
      }

      return res.status(200).json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AgBotController] Error fetching tank analytics:', error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/agbot/recalculate-consumption
   * Recalculate consumption for all active assets
   */
  async recalculateConsumption(req: VercelRequest, res: VercelResponse) {
    if (!this.isAuthorized(req)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      console.log('[AgBotController] Starting consumption recalculation...');

      const result = await this.consumptionService.recalculateAll();

      return res.status(200).json({
        success: true,
        data: result,
        message: `Recalculated ${result.updated} assets (${result.failed} failed)`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AgBotController] Error recalculating consumption:', error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/agbot/health
   * Get overall fleet health status
   */
  async getFleetHealth(req: VercelRequest, res: VercelResponse) {
    if (!this.isAuthorized(req)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const health = await this.dataService.getFleetHealth();

      return res.status(200).json({
        success: true,
        data: health,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AgBotController] Error fetching fleet health:', error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/agbot/unified-location
   * Get unified location data from all systems
   */
  async getUnifiedLocation(req: VercelRequest, res: VercelResponse) {
    if (!this.isAuthorized(req)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { locationId, includeSystems, includeHistory, timeRange } = req.body;

      if (!locationId) {
        return res.status(400).json({
          success: false,
          error: 'Location ID is required',
        });
      }

      // Get unified location data
      const locationData = await this.integrationService.getUnifiedLocation(
        locationId,
        includeSystems
      );

      if (!locationData) {
        return res.status(404).json({
          success: false,
          error: 'Location not found',
        });
      }

      // Optionally include historical data
      let historicalData = null;
      if (includeHistory && timeRange) {
        try {
          historicalData = await this.integrationService.getLocationHistoricalData(
            locationId,
            timeRange.startDate,
            timeRange.endDate,
            includeSystems
          );
        } catch (error) {
          console.warn('[AgBotController] Historical data fetch failed:', error);
          // Continue without historical data
        }
      }

      const result = {
        location: locationData,
        historical: historicalData,
        metadata: {
          systemsAvailable: Object.keys(locationData.sources),
          correlationScore: locationData.correlationScore,
          dataQuality: locationData.dataQuality,
          lastUpdated: locationData.lastUpdated,
        },
      };

      return res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AgBotController] Error fetching unified location:', error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/agbot/provider/health
   * Check provider connection health
   */
  async checkProviderConnection(req: VercelRequest, res: VercelResponse) {
    if (!this.isAuthorized(req)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const health = await this.dataService.checkProviderConnection();

      return res.status(200).json({
        success: true,
        data: health,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AgBotController] Error checking provider connection:', error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Authorization check
   * Supports both Vercel Cron secret and Bearer token
   */
  private isAuthorized(req: VercelRequest): boolean {
    // Check for Vercel Cron secret (for scheduled jobs)
    const cronSecret = req.headers['authorization'];
    if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) {
      return true;
    }

    // Check for API key in headers
    const apiKey = req.headers['x-api-key'];
    if (apiKey === process.env.INTERNAL_API_KEY) {
      return true;
    }

    // Check for Bearer token (for manual API calls)
    if (typeof cronSecret === 'string' && cronSecret.startsWith('Bearer ')) {
      const token = cronSecret.substring(7);
      return token === process.env.API_SECRET || token === process.env.CRON_SECRET;
    }

    return false;
  }
}
