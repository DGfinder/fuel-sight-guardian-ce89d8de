/**
 * Mock AgBot Provider Implementation
 * Testing provider with controllable responses
 *
 * Features:
 * - Controllable test data
 * - Simulated failures for error testing
 * - Request history tracking
 * - No actual API calls
 *
 * Usage in tests:
 * ```typescript
 * const mockProvider = new MockAgBotProvider();
 * mockProvider.mockLocations = [testLocation1, testLocation2];
 * mockProvider.shouldFail = false;
 *
 * const service = new AgBotDataService(mockProvider, ...);
 * const result = await service.fetchLocations();
 *
 * expect(result).toEqual(mockProvider.mockLocations);
 * expect(mockProvider.getCallCount('fetchLocations')).toBe(1);
 * ```
 */

import {
  IAgBotProvider,
  AgBotLocation,
  AgBotAsset,
  AgBotReading,
  HealthCheckResult,
} from './IAgBotProvider.js';

/**
 * Call history entry for tracking method calls
 */
interface CallHistory {
  method: string;
  args: any[];
  timestamp: Date;
}

/**
 * MockAgBotProvider
 * Test implementation with controllable responses and failure simulation
 */
export class MockAgBotProvider implements IAgBotProvider {
  // Test data - set these before calling methods
  public mockLocations: AgBotLocation[] = [];
  public mockAssets: Map<string, AgBotAsset[]> = new Map();
  public mockReadings: Map<string, AgBotReading[]> = new Map();

  // Failure simulation
  public shouldFail: boolean = false;
  public failureMessage: string = 'Mock provider failure';
  public failOnMethods: Set<string> = new Set();

  // Response delays (for testing timeout behavior)
  public delayMs: number = 0;

  // Call tracking
  private callHistory: CallHistory[] = [];

  // Health status simulation
  public mockHealthy: boolean = true;
  public mockLatency: number = 50;

  /**
   * Resets all mock state to defaults
   */
  reset(): void {
    this.mockLocations = [];
    this.mockAssets.clear();
    this.mockReadings.clear();
    this.shouldFail = false;
    this.failureMessage = 'Mock provider failure';
    this.failOnMethods.clear();
    this.delayMs = 0;
    this.callHistory = [];
    this.mockHealthy = true;
    this.mockLatency = 50;
  }

  /**
   * Records a method call in history
   */
  private recordCall(method: string, args: any[]): void {
    this.callHistory.push({
      method,
      args,
      timestamp: new Date(),
    });
  }

  /**
   * Gets total number of calls made
   */
  getTotalCalls(): number {
    return this.callHistory.length;
  }

  /**
   * Gets number of calls for a specific method
   */
  getCallCount(method: string): number {
    return this.callHistory.filter((call) => call.method === method).length;
  }

  /**
   * Gets all calls for a specific method
   */
  getCallsFor(method: string): CallHistory[] {
    return this.callHistory.filter((call) => call.method === method);
  }

  /**
   * Gets complete call history
   */
  getCallHistory(): CallHistory[] {
    return [...this.callHistory];
  }

  /**
   * Clears call history
   */
  clearCallHistory(): void {
    this.callHistory = [];
  }

  /**
   * Simulates network delay
   */
  private async delay(): Promise<void> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
  }

  /**
   * Checks if method should fail
   */
  private shouldMethodFail(method: string): boolean {
    return this.shouldFail || this.failOnMethods.has(method);
  }

  /**
   * Throws mock error if configured to fail
   */
  private throwIfShouldFail(method: string): void {
    if (this.shouldMethodFail(method)) {
      throw new Error(this.failureMessage);
    }
  }

  // IAgBotProvider implementation

  async fetchLocations(): Promise<AgBotLocation[]> {
    this.recordCall('fetchLocations', []);
    await this.delay();
    this.throwIfShouldFail('fetchLocations');
    return [...this.mockLocations];
  }

  async fetchLocation(locationId: string): Promise<AgBotLocation | null> {
    this.recordCall('fetchLocation', [locationId]);
    await this.delay();
    this.throwIfShouldFail('fetchLocation');

    const location = this.mockLocations.find((loc) => loc.id === locationId);
    return location ? { ...location } : null;
  }

  async fetchAssets(locationId: string): Promise<AgBotAsset[]> {
    this.recordCall('fetchAssets', [locationId]);
    await this.delay();
    this.throwIfShouldFail('fetchAssets');

    const assets = this.mockAssets.get(locationId) || [];
    return assets.map((asset) => ({ ...asset }));
  }

  async fetchAsset(assetId: string): Promise<AgBotAsset | null> {
    this.recordCall('fetchAsset', [assetId]);
    await this.delay();
    this.throwIfShouldFail('fetchAsset');

    // Search all locations for the asset
    for (const assets of this.mockAssets.values()) {
      const asset = assets.find((a) => a.id === assetId);
      if (asset) {
        return { ...asset };
      }
    }

    return null;
  }

  async fetchReadings(
    assetId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AgBotReading[]> {
    this.recordCall('fetchReadings', [assetId, startDate, endDate]);
    await this.delay();
    this.throwIfShouldFail('fetchReadings');

    const readings = this.mockReadings.get(assetId) || [];

    // Filter readings by date range
    return readings
      .filter((reading) => {
        const timestamp = new Date(reading.timestamp);
        return timestamp >= startDate && timestamp <= endDate;
      })
      .map((reading) => ({ ...reading }));
  }

  async fetchLatestReading(assetId: string): Promise<AgBotReading | null> {
    this.recordCall('fetchLatestReading', [assetId]);
    await this.delay();
    this.throwIfShouldFail('fetchLatestReading');

    const readings = this.mockReadings.get(assetId) || [];

    if (readings.length === 0) {
      return null;
    }

    // Return the most recent reading
    const sorted = [...readings].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return { ...sorted[0] };
  }

  async checkConnection(): Promise<HealthCheckResult> {
    this.recordCall('checkConnection', []);
    await this.delay();
    this.throwIfShouldFail('checkConnection');

    return {
      healthy: this.mockHealthy,
      latencyMs: this.mockLatency,
      message: this.mockHealthy ? 'Mock connection successful' : 'Mock connection failed',
      timestamp: new Date().toISOString(),
    };
  }

  // Helper methods for setting up test data

  /**
   * Adds a mock location
   */
  addMockLocation(location: AgBotLocation): void {
    this.mockLocations.push(location);
  }

  /**
   * Adds mock assets for a location
   */
  addMockAssets(locationId: string, assets: AgBotAsset[]): void {
    const existing = this.mockAssets.get(locationId) || [];
    this.mockAssets.set(locationId, [...existing, ...assets]);
  }

  /**
   * Adds mock readings for an asset
   */
  addMockReadings(assetId: string, readings: AgBotReading[]): void {
    const existing = this.mockReadings.get(assetId) || [];
    this.mockReadings.set(assetId, [...existing, ...readings]);
  }

  /**
   * Sets up a complete mock scenario with locations, assets, and readings
   */
  setupScenario(scenario: {
    locations: AgBotLocation[];
    assets: Map<string, AgBotAsset[]>;
    readings?: Map<string, AgBotReading[]>;
  }): void {
    this.mockLocations = [...scenario.locations];
    this.mockAssets = new Map(scenario.assets);
    if (scenario.readings) {
      this.mockReadings = new Map(scenario.readings);
    }
  }

  /**
   * Creates a sample location for testing
   */
  static createSampleLocation(overrides?: Partial<AgBotLocation>): AgBotLocation {
    return {
      id: 'loc-123',
      name: 'Test Location',
      address: '123 Test St',
      customerName: 'Test Customer',
      calibratedFillLevel: 75,
      lastTelemetryAt: new Date().toISOString(),
      isDisabled: false,
      latitude: -31.9505,
      longitude: 115.8605,
      ...overrides,
    };
  }

  /**
   * Creates a sample asset for testing
   */
  static createSampleAsset(overrides?: Partial<AgBotAsset>): AgBotAsset {
    return {
      id: 'asset-456',
      locationId: 'loc-123',
      isOnline: true,
      capacityLiters: 10000,
      currentLevelLiters: 7500,
      dailyConsumptionLiters: 200,
      daysRemaining: 37,
      deviceSerial: 'DEV-001',
      batteryVoltage: 12.5,
      commodity: 'Diesel',
      ullageLiters: 2500,
      ...overrides,
    };
  }

  /**
   * Creates a sample reading for testing
   */
  static createSampleReading(overrides?: Partial<AgBotReading>): AgBotReading {
    return {
      id: 'reading-789',
      assetId: 'asset-456',
      timestamp: new Date().toISOString(),
      levelLiters: 7500,
      levelPercentage: 75,
      batteryVoltage: 12.5,
      temperature: 22,
      signalStrength: -70,
      ...overrides,
    };
  }

  /**
   * Creates a series of readings over time for testing consumption analysis
   */
  static createReadingsSeries(
    assetId: string,
    count: number,
    startDate: Date,
    options?: {
      initialLevel?: number;
      dailyConsumption?: number;
      refillAt?: number[]; // Indices where refills occur
    }
  ): AgBotReading[] {
    const readings: AgBotReading[] = [];
    const initialLevel = options?.initialLevel || 8000;
    const dailyConsumption = options?.dailyConsumption || 200;
    const refillIndices = new Set(options?.refillAt || []);

    let currentLevel = initialLevel;
    const msPerDay = 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      // Check if this is a refill point
      if (refillIndices.has(i)) {
        currentLevel = 9500; // Refill to 95%
      } else {
        // Simulate consumption
        currentLevel -= dailyConsumption;
      }

      const timestamp = new Date(startDate.getTime() + i * msPerDay);

      readings.push({
        id: `reading-${assetId}-${i}`,
        assetId,
        timestamp: timestamp.toISOString(),
        levelLiters: Math.max(0, currentLevel),
        levelPercentage: Math.max(0, (currentLevel / 10000) * 100),
        batteryVoltage: 12.5 - Math.random() * 0.5,
        temperature: 20 + Math.random() * 10,
        signalStrength: -70 - Math.random() * 10,
      });
    }

    return readings;
  }
}
