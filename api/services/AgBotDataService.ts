/**
 * AgBot Data Service
 * Core business logic for AgBot data operations
 *
 * Responsibilities:
 * - Query location and asset data from database
 * - Calculate health metrics and statistics
 * - Coordinate repositories for data access
 * - Error handling and logging
 *
 * NOTE: AgBot uses WEBHOOK/PUSH model (Gasbot calls US)
 * Data ingestion happens via api/gasbot-webhook endpoint
 * This service queries data that was pushed to our database
 *
 * Dependencies:
 * - AgBotLocationRepository (location data access)
 * - AgBotAssetRepository (asset data access)
 * - ReadingsHistoryRepository (readings data access)
 */

import { AgBotLocationRepository } from '../repositories/AgBotLocationRepository.js';
import { AgBotAssetRepository } from '../repositories/AgBotAssetRepository.js';
import { ReadingsHistoryRepository } from '../repositories/ReadingsHistoryRepository.js';

export interface HealthStatus {
  healthy: boolean;
  lastSync: string | null;
  locationsCount: number;
  assetsCount: number;
  onlineAssetsCount: number;
  issues: string[];
}

export interface FleetHealthStatus {
  totalLocations: number;
  totalAssets: number;
  onlineAssets: number;
  offlineAssets: number;
  lowFuelLocations: number;
  criticalFuelLocations: number;
  healthScore: number;
}

export class AgBotDataService {
  constructor(
    private locationRepo: AgBotLocationRepository,
    private assetRepo: AgBotAssetRepository,
    private readingsRepo: ReadingsHistoryRepository
  ) {}

  /**
   * Gets health status for a specific location
   */
  async getLocationHealth(locationId: string): Promise<HealthStatus> {
    const issues: string[] = [];

    try {
      const location = await this.locationRepo.findById(locationId);

      if (!location) {
        return {
          healthy: false,
          lastSync: null,
          locationsCount: 0,
          assetsCount: 0,
          onlineAssetsCount: 0,
          issues: ['Location not found'],
        };
      }

      const assets = await this.assetRepo.findByLocation(locationId);
      const onlineAssets = assets.filter((a) => a.is_online);

      // Check for issues
      if (location.calibrated_fill_level !== null && location.calibrated_fill_level < 25) {
        issues.push(`Low fuel: ${location.calibrated_fill_level}%`);
      }

      if (onlineAssets.length < assets.length) {
        issues.push(`${assets.length - onlineAssets.length} offline assets`);
      }

      const healthy = issues.length === 0;

      return {
        healthy,
        lastSync: location.last_telemetry_at,
        locationsCount: 1,
        assetsCount: assets.length,
        onlineAssetsCount: onlineAssets.length,
        issues,
      };
    } catch (error) {
      return {
        healthy: false,
        lastSync: null,
        locationsCount: 0,
        assetsCount: 0,
        onlineAssetsCount: 0,
        issues: [`Failed to get health status: ${(error as Error).message}`],
      };
    }
  }

  /**
   * Gets fleet-wide health status
   */
  async getFleetHealth(): Promise<FleetHealthStatus> {
    try {
      const locationStats = await this.locationRepo.countByStatus();
      const assetStats = await this.assetRepo.countByStatus();
      const lowFuelLocations = await this.locationRepo.findLowFuel(30);
      const criticalFuelLocations = await this.locationRepo.findCriticalFuel(15);

      // Calculate health score (0-100)
      const onlineRatio = assetStats.total > 0 ? assetStats.online / assetStats.total : 1;
      const lowFuelRatio = locationStats.total > 0 ? lowFuelLocations.length / locationStats.total : 0;
      const healthScore = Math.round(
        onlineRatio * 60 + // 60% weight for device connectivity
        (1 - lowFuelRatio) * 40 // 40% weight for fuel levels
      );

      return {
        totalLocations: locationStats.total,
        totalAssets: assetStats.total,
        onlineAssets: assetStats.online,
        offlineAssets: assetStats.offline,
        lowFuelLocations: lowFuelLocations.length,
        criticalFuelLocations: criticalFuelLocations.length,
        healthScore,
      };
    } catch (error) {
      console.error('[AgBotDataService] Failed to get fleet health:', error);
      return {
        totalLocations: 0,
        totalAssets: 0,
        onlineAssets: 0,
        offlineAssets: 0,
        lowFuelLocations: 0,
        criticalFuelLocations: 0,
        healthScore: 0,
      };
    }
  }

  /**
   * Gets all locations (convenience method)
   */
  async getAllLocations(includeDisabled: boolean = false) {
    return this.locationRepo.findAll(includeDisabled);
  }

  /**
   * Gets locations by customer
   */
  async getLocationsByCustomer(customerName: string, includeDisabled: boolean = false) {
    return this.locationRepo.findByCustomer(customerName, includeDisabled);
  }

  /**
   * Gets a specific location with its assets
   */
  async getLocationWithAssets(locationId: string) {
    const location = await this.locationRepo.findById(locationId);
    if (!location) {
      return null;
    }

    const assets = await this.assetRepo.findByLocation(locationId);

    return {
      ...location,
      assets,
    };
  }

}
