/**
 * AgBot Data Service
 * Core business logic for AgBot data synchronization
 *
 * Responsibilities:
 * - Fetch data from external provider (Athara API)
 * - Transform external data to domain models
 * - Orchestrate sync operations
 * - Coordinate repositories for data persistence
 * - Error handling and retry logic
 *
 * Dependencies:
 * - IAgBotProvider (external API abstraction)
 * - AgBotLocationRepository (location data access)
 * - AgBotAssetRepository (asset data access)
 * - ReadingsHistoryRepository (readings data access)
 */

import {
  IAgBotProvider,
  AgBotLocation as ProviderLocation,
  AgBotAsset as ProviderAsset,
  AgBotReading as ProviderReading,
  SyncResult,
} from '../infrastructure/agbot/IAgBotProvider.js';
import {
  AgBotLocationRepository,
  LocationCreateInput,
} from '../repositories/AgBotLocationRepository.js';
import {
  AgBotAssetRepository,
  AssetCreateInput,
} from '../repositories/AgBotAssetRepository.js';
import {
  ReadingsHistoryRepository,
  ReadingCreateInput,
} from '../repositories/ReadingsHistoryRepository.js';

export interface SyncOptions {
  syncType?: 'full' | 'incremental' | 'manual';
  includeReadings?: boolean;
  maxRetries?: number;
}

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
    private provider: IAgBotProvider,
    private locationRepo: AgBotLocationRepository,
    private assetRepo: AgBotAssetRepository,
    private readingsRepo: ReadingsHistoryRepository
  ) {}

  /**
   * Syncs all locations from the provider to the database
   */
  async syncAllLocations(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      synced: 0,
      failed: 0,
      errors: [],
      duration: 0,
    };

    try {
      console.log('[AgBotDataService] Starting full location sync');

      // 1. Fetch locations from provider
      const providerLocations = await this.provider.fetchLocations();
      console.log(`[AgBotDataService] Fetched ${providerLocations.length} locations from provider`);

      // 2. Transform and persist locations
      const locationInputs: LocationCreateInput[] = providerLocations.map((loc) =>
        this.transformProviderLocation(loc)
      );

      const syncedCount = await this.locationRepo.bulkUpsert(locationInputs);
      result.synced = syncedCount;

      // 3. Sync assets for each location if requested
      if (options.includeReadings !== false) {
        for (const providerLocation of providerLocations) {
          try {
            const assets = await this.provider.fetchAssets(providerLocation.id);

            // Find the location in DB by external_guid
            const dbLocation = await this.locationRepo.findByExternalGuid(providerLocation.id);

            if (dbLocation && assets.length > 0) {
              await this.syncAssetsForLocation(dbLocation.id, assets);
            }
          } catch (error) {
            const err = error as Error;
            result.errors.push(`Failed to sync assets for location ${providerLocation.name}: ${err.message}`);
          }
        }
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      console.log(`[AgBotDataService] Sync completed: ${result.synced} locations synced`);
      return result;
    } catch (error) {
      const err = error as Error;
      result.errors.push(`Sync failed: ${err.message}`);
      result.duration = Date.now() - startTime;
      console.error('[AgBotDataService] Sync failed:', error);
      return result;
    }
  }

  /**
   * Syncs a specific location by ID
   */
  async syncLocation(locationId: string): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      synced: 0,
      failed: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Fetch location from provider
      const providerLocation = await this.provider.fetchLocation(locationId);

      if (!providerLocation) {
        result.errors.push(`Location ${locationId} not found in provider`);
        result.failed = 1;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Transform and upsert location
      const locationInput = this.transformProviderLocation(providerLocation);
      await this.locationRepo.upsert(locationInput);
      result.synced = 1;

      // Sync assets
      const assets = await this.provider.fetchAssets(locationId);
      const dbLocation = await this.locationRepo.findByExternalGuid(locationId);

      if (dbLocation && assets.length > 0) {
        await this.syncAssetsForLocation(dbLocation.id, assets);
      }

      result.success = true;
      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      const err = error as Error;
      result.errors.push(`Failed to sync location: ${err.message}`);
      result.failed = 1;
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Syncs assets for a specific location
   */
  private async syncAssetsForLocation(
    dbLocationId: string,
    providerAssets: ProviderAsset[]
  ): Promise<void> {
    for (const providerAsset of providerAssets) {
      try {
        const assetInput = this.transformProviderAsset(providerAsset, dbLocationId);
        const dbAsset = await this.assetRepo.upsert(assetInput);

        // Create a historical reading
        const reading: ReadingCreateInput = {
          asset_id: dbAsset.id,
          level_liters: providerAsset.currentLevelLiters,
          level_percent: (providerAsset.currentLevelLiters / providerAsset.capacityLiters) * 100,
          is_online: providerAsset.isOnline,
          battery_voltage: providerAsset.batteryVoltage,
          reading_at: new Date().toISOString(),
        };

        await this.readingsRepo.create(reading);
      } catch (error) {
        console.error(`[AgBotDataService] Failed to sync asset ${providerAsset.deviceSerial}:`, error);
      }
    }
  }

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

  /**
   * Checks provider connection health
   */
  async checkProviderConnection() {
    return this.provider.checkConnection();
  }

  /**
   * Transforms provider location to database input format
   */
  private transformProviderLocation(providerLocation: ProviderLocation): LocationCreateInput {
    return {
      external_guid: providerLocation.id,
      name: providerLocation.name,
      customer_name: providerLocation.customerName,
      address: providerLocation.address,
      latitude: providerLocation.latitude,
      longitude: providerLocation.longitude,
      calibrated_fill_level: providerLocation.calibratedFillLevel,
      last_telemetry_at: providerLocation.lastTelemetryAt,
      is_disabled: providerLocation.isDisabled || false,
    };
  }

  /**
   * Transforms provider asset to database input format
   */
  private transformProviderAsset(providerAsset: ProviderAsset, dbLocationId: string): AssetCreateInput {
    return {
      location_id: dbLocationId,
      external_guid: providerAsset.id,
      name: providerAsset.deviceSerial || 'Unknown Asset',
      serial_number: providerAsset.deviceSerial,
      commodity: providerAsset.commodity,
      capacity_liters: providerAsset.capacityLiters,
      current_level_liters: providerAsset.currentLevelLiters,
      current_level_percent: (providerAsset.currentLevelLiters / providerAsset.capacityLiters) * 100,
      ullage_liters: providerAsset.ullageLiters,
      daily_consumption_liters: providerAsset.dailyConsumptionLiters,
      days_remaining: providerAsset.daysRemaining,
      device_serial: providerAsset.deviceSerial,
      is_online: providerAsset.isOnline,
      battery_voltage: providerAsset.batteryVoltage,
      last_telemetry_at: new Date().toISOString(),
    };
  }
}
