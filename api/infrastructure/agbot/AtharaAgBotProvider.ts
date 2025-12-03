/**
 * Athara AgBot Provider Implementation
 * Production provider connecting to Athara/GasBot API
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Request timeout handling
 * - Authentication via API key and secret
 * - Response validation
 * - Health monitoring
 */

import {
  IAgBotProvider,
  AgBotLocation,
  AgBotAsset,
  AgBotReading,
  HealthCheckResult,
  ProviderConfig,
} from './IAgBotProvider.js';

/**
 * AtharaAgBotProvider
 * Connects to Athara/GasBot API for production data
 */
export class AtharaAgBotProvider implements IAgBotProvider {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;

  // Health tracking
  private lastSuccessfulCall: Date | null = null;
  private lastError: string | null = null;
  private consecutiveFailures: number = 0;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey || '';
    this.apiSecret = config.baseUrl?.includes('apiSecret=')
      ? new URL(config.baseUrl).searchParams.get('apiSecret') || ''
      : '';
    this.baseUrl = config.baseUrl || 'https://dashboard2-production.prod.gasbot.io';
    this.timeout = config.timeout || 30000; // 30 seconds default
    this.retryAttempts = config.retryAttempts || 3;

    if (!this.apiKey || this.apiKey === 'your-api-key-here') {
      throw new Error('Invalid or missing Athara API key');
    }

    if (!this.apiSecret || this.apiSecret === 'your-api-secret-here') {
      throw new Error('Invalid or missing Athara API secret');
    }
  }

  /**
   * Makes authenticated HTTP request to Athara API with retry logic
   */
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'X-API-Key': this.apiKey,
            'X-API-Secret': this.apiSecret,
            'Content-Type': 'application/json',
            ...options.headers,
          },
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
          const errorText = await response.text();

          // Don't retry on authentication errors
          if (response.status === 401 || response.status === 403) {
            throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
          }

          throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();

        // Update health tracking on success
        this.lastSuccessfulCall = new Date();
        this.lastError = null;
        this.consecutiveFailures = 0;

        return data as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on auth errors
        if (lastError.message.includes('Authentication failed')) {
          this.updateHealthOnFailure(lastError.message);
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.retryAttempts) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    const errorMessage = `Request failed after ${this.retryAttempts} attempts: ${lastError?.message}`;
    this.updateHealthOnFailure(errorMessage);
    throw new Error(errorMessage);
  }

  /**
   * Updates health tracking on failure
   */
  private updateHealthOnFailure(error: string): void {
    this.lastError = error;
    this.consecutiveFailures++;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Transforms Athara API location response to domain model
   */
  private transformLocation(raw: any): AgBotLocation {
    return {
      id: raw.locationGuid || raw.id,
      name: raw.locationId || 'Unknown Location',
      address: raw.address1 || '',
      customerName: raw.customerName || 'Unknown Customer',
      calibratedFillLevel: raw.latestCalibratedFillPercentage || 0,
      lastTelemetryAt: this.transformTimestamp(raw.latestTelemetryEpoch, raw.latestTelemetry),
      isDisabled: raw.disabled || false,
      latitude: raw.lat,
      longitude: raw.lng,
    };
  }

  /**
   * Transforms Athara API asset response to domain model
   */
  private transformAsset(raw: any): AgBotAsset {
    return {
      id: raw.assetGuid || raw.id,
      locationId: raw.locationGuid || '',
      isOnline: raw.deviceOnline || false,
      capacityLiters: raw.assetProfileWaterCapacity || 0,
      currentLevelLiters: raw.assetReportedLitres || 0,
      dailyConsumptionLiters: raw.assetDailyConsumption || null,
      daysRemaining: raw.assetDaysRemaining || null,
      deviceSerial: raw.deviceSerialNumber || '',
      batteryVoltage: raw.deviceBatteryVoltage || null,
      commodity: raw.assetProfileCommodity || 'Diesel',
      ullageLiters: raw.assetRefillCapacityLitres,
    };
  }

  /**
   * Transforms timestamp from epoch or string format
   */
  private transformTimestamp(epoch?: number, isoString?: string): string {
    if (epoch) {
      // Handle both seconds and milliseconds format
      const timestamp = epoch > 10000000000 ? epoch : epoch * 1000;
      return new Date(timestamp).toISOString();
    }
    return isoString || new Date().toISOString();
  }

  /**
   * Fetches all locations from Athara API
   */
  async fetchLocations(): Promise<AgBotLocation[]> {
    const response = await this.makeRequest<any[]>('/locations');

    if (!Array.isArray(response)) {
      throw new Error('Invalid API response: expected array of locations');
    }

    return response.map((loc) => this.transformLocation(loc));
  }

  /**
   * Fetches a specific location by ID
   */
  async fetchLocation(locationId: string): Promise<AgBotLocation | null> {
    try {
      const response = await this.makeRequest<any>(`/locations/${locationId}`);
      return this.transformLocation(response);
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetches all assets for a specific location
   */
  async fetchAssets(locationId: string): Promise<AgBotAsset[]> {
    // Athara API returns assets nested within locations
    const location = await this.makeRequest<any>(`/locations/${locationId}`);

    if (!location.assets || !Array.isArray(location.assets)) {
      return [];
    }

    return location.assets.map((asset: any) => this.transformAsset(asset));
  }

  /**
   * Fetches a specific asset by ID
   */
  async fetchAsset(assetId: string): Promise<AgBotAsset | null> {
    try {
      // Note: Athara API may not have a direct asset endpoint
      // This implementation assumes assets are always fetched via locations
      // If a direct endpoint exists, update this method
      const response = await this.makeRequest<any>(`/assets/${assetId}`);
      return this.transformAsset(response);
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetches historical readings for an asset within a date range
   */
  async fetchReadings(
    assetId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AgBotReading[]> {
    // Note: This endpoint may not exist in Athara API
    // Athara typically provides only the latest reading in the location/asset data
    // Historical data may need to be built from sync operations storing readings over time

    try {
      const response = await this.makeRequest<any[]>(
        `/assets/${assetId}/readings?start=${startDate.toISOString()}&end=${endDate.toISOString()}`
      );

      if (!Array.isArray(response)) {
        return [];
      }

      return response.map((reading: any) => ({
        id: reading.id || `${assetId}-${reading.timestamp}`,
        assetId,
        timestamp: reading.timestamp || new Date().toISOString(),
        levelLiters: reading.levelLiters || 0,
        levelPercentage: reading.levelPercentage || 0,
        batteryVoltage: reading.batteryVoltage || null,
        temperature: reading.temperature || null,
        signalStrength: reading.signalStrength || null,
      }));
    } catch (error) {
      // If endpoint doesn't exist, return empty array
      console.warn(`[AtharaAgBotProvider] Historical readings not available for asset ${assetId}:`, error);
      return [];
    }
  }

  /**
   * Fetches the most recent reading for an asset
   */
  async fetchLatestReading(assetId: string): Promise<AgBotReading | null> {
    try {
      // Attempt to fetch asset data which includes latest reading
      const asset = await this.fetchAsset(assetId);

      if (!asset) {
        return null;
      }

      // Construct reading from asset's current state
      return {
        id: `${assetId}-latest`,
        assetId,
        timestamp: new Date().toISOString(),
        levelLiters: asset.currentLevelLiters,
        levelPercentage: (asset.currentLevelLiters / asset.capacityLiters) * 100,
        batteryVoltage: asset.batteryVoltage,
        temperature: null,
        signalStrength: null,
      };
    } catch (error) {
      console.warn(`[AtharaAgBotProvider] Could not fetch latest reading for asset ${assetId}:`, error);
      return null;
    }
  }

  /**
   * Performs a health check on the Athara API connection
   */
  async checkConnection(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Make a lightweight request to test connectivity
      await this.makeRequest('/locations');

      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latencyMs: latency,
        message: 'Athara API connection successful',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const err = error as Error;

      return {
        healthy: false,
        latencyMs: latency,
        message: `Athara API connection failed: ${err.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Gets current health status
   */
  getHealthStatus(): {
    lastSuccessfulCall: Date | null;
    lastError: string | null;
    consecutiveFailures: number;
  } {
    return {
      lastSuccessfulCall: this.lastSuccessfulCall,
      lastError: this.lastError,
      consecutiveFailures: this.consecutiveFailures,
    };
  }
}
