/**
 * AgBot Provider Interface
 * Abstraction layer for AgBot data sources (Athara API, GasBot API, etc.)
 *
 * Purpose:
 * - Enables swapping between different AgBot providers without changing business logic
 * - Facilitates testing with mock implementations
 * - Centralizes external API communication
 */

/**
 * Represents an AgBot location (tank site)
 */
export interface AgBotLocation {
  id: string;
  name: string;
  address: string;
  customerName: string;
  calibratedFillLevel: number;
  lastTelemetryAt: string;
  isDisabled?: boolean;
  latitude?: number;
  longitude?: number;
}

/**
 * Represents an AgBot asset (physical tank/sensor)
 */
export interface AgBotAsset {
  id: string;
  locationId: string;
  isOnline: boolean;
  capacityLiters: number;
  currentLevelLiters: number;
  dailyConsumptionLiters: number | null;
  daysRemaining: number | null;
  deviceSerial: string;
  batteryVoltage: number | null;
  commodity: string;
  ullageLiters?: number;
}

/**
 * Represents a single reading from an AgBot sensor
 */
export interface AgBotReading {
  id: string;
  assetId: string;
  timestamp: string;
  levelLiters: number;
  levelPercentage: number;
  batteryVoltage: number | null;
  temperature?: number | null;
  signalStrength?: number | null;
}

/**
 * Result of a data synchronization operation
 */
export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
  duration?: number;
}

/**
 * Provider configuration options
 */
export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  latencyMs?: number;
  message?: string;
  timestamp: string;
}

/**
 * AgBot Provider Interface
 *
 * Implementations:
 * - AtharaAgBotProvider: Production implementation connecting to Athara API
 * - MockAgBotProvider: Testing implementation with controllable responses
 *
 * Future providers could include:
 * - GasBotAgBotProvider
 * - SmartFillAgBotProvider
 */
export interface IAgBotProvider {
  /**
   * Fetches all locations from the external provider
   * @returns Array of AgBot locations
   * @throws Error if API request fails after retries
   */
  fetchLocations(): Promise<AgBotLocation[]>;

  /**
   * Fetches a specific location by ID
   * @param locationId - Unique identifier for the location
   * @returns Location data or null if not found
   * @throws Error if API request fails
   */
  fetchLocation(locationId: string): Promise<AgBotLocation | null>;

  /**
   * Fetches all assets for a specific location
   * @param locationId - Unique identifier for the location
   * @returns Array of assets at this location
   * @throws Error if API request fails
   */
  fetchAssets(locationId: string): Promise<AgBotAsset[]>;

  /**
   * Fetches a specific asset by ID
   * @param assetId - Unique identifier for the asset
   * @returns Asset data or null if not found
   * @throws Error if API request fails
   */
  fetchAsset(assetId: string): Promise<AgBotAsset | null>;

  /**
   * Fetches historical readings for an asset within a date range
   * @param assetId - Unique identifier for the asset
   * @param startDate - Beginning of date range (inclusive)
   * @param endDate - End of date range (inclusive)
   * @returns Array of readings sorted by timestamp (ascending)
   * @throws Error if API request fails
   */
  fetchReadings(
    assetId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AgBotReading[]>;

  /**
   * Fetches the most recent reading for an asset
   * @param assetId - Unique identifier for the asset
   * @returns Latest reading or null if no readings exist
   * @throws Error if API request fails
   */
  fetchLatestReading(assetId: string): Promise<AgBotReading | null>;

  /**
   * Performs a health check on the provider connection
   * @returns Health check result with status and latency
   */
  checkConnection(): Promise<HealthCheckResult>;
}
