/**
 * Location Integration Service
 * Unified location data combining SmartFill, AgBot, and Captive Payments
 *
 * Responsibilities:
 * - Cross-system data integration
 * - Historical data aggregation from multiple sources
 * - Data correlation and reconciliation
 * - Unified location view generation
 * - Conflict resolution between systems
 *
 * Migrated from: api/unified-location-data.ts (270 lines)
 *
 * Dependencies:
 * - AgBotLocationRepository (AgBot locations)
 * - AgBotAssetRepository (AgBot assets)
 * - ReadingsHistoryRepository (AgBot readings)
 * - SupabaseClient (SmartFill and Captive Payments - legacy)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { AgBotLocationRepository } from '../repositories/AgBotLocationRepository.js';
import { AgBotAssetRepository } from '../repositories/AgBotAssetRepository.js';
import { ReadingsHistoryRepository } from '../repositories/ReadingsHistoryRepository.js';

export interface UnifiedLocationRequest {
  locationId: string;
  includeSystems?: string[];
  includeHistory?: boolean;
  timeRange?: {
    startDate: string;
    endDate: string;
  };
}

export interface UnifiedLocation {
  locationId: string;
  sources: {
    agbot?: AgBotLocationData;
    smartfill?: SmartFillLocationData;
    captive_payments?: CaptivePaymentsData;
  };
  correlationScore: number;
  dataQuality: 'high' | 'medium' | 'low';
  lastUpdated: string;
}

export interface AgBotLocationData {
  id: string;
  name: string;
  address: string;
  customerName: string;
  calibratedFillLevel: number;
  lastTelemetryAt: string;
  assets: any[];
}

export interface SmartFillLocationData {
  location_guid: string;
  location_name: string;
  tanks: any[];
}

export interface CaptivePaymentsData {
  customer: string;
  recentDeliveries: any[];
}

export interface HistoricalData {
  fuelLevels: FuelLevelReading[];
  deliveries: DeliveryRecord[];
  alerts: AlertRecord[];
  systemEvents: SystemEvent[];
}

export interface FuelLevelReading {
  timestamp: string;
  tankId: string;
  tankNumber?: string;
  tankName?: string;
  volume?: number;
  volumePercent?: number;
  status: string;
  source: 'smartfill' | 'agbot';
}

export interface DeliveryRecord {
  timestamp: string;
  volume: number;
  carrier?: string;
  terminal?: string;
  fuelType?: string;
  source: 'captive_payments';
}

export interface AlertRecord {
  timestamp: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  source: string;
}

export interface SystemEvent {
  timestamp: string;
  event: string;
  details: any;
  source: string;
}

export class LocationIntegrationService {
  constructor(
    private db: SupabaseClient,
    private agbotLocationRepo: AgBotLocationRepository,
    private agbotAssetRepo: AgBotAssetRepository,
    private agbotReadingsRepo: ReadingsHistoryRepository
  ) {}

  /**
   * Get unified location data from all systems
   */
  async getUnifiedLocation(locationId: string, systems: string[] = ['agbot', 'smartfill', 'captive_payments']): Promise<UnifiedLocation> {
    const sources: UnifiedLocation['sources'] = {};
    let correlationScore = 0;
    let dataQualityCount = 0;

    // Fetch AgBot data
    if (systems.includes('agbot')) {
      try {
        const agbotData = await this.getAgBotLocationData(locationId);
        if (agbotData) {
          sources.agbot = agbotData;
          correlationScore += 1;
          dataQualityCount += 1;
        }
      } catch (error) {
        console.warn('[LocationIntegrationService] AgBot data fetch failed:', error);
      }
    }

    // Fetch SmartFill data
    if (systems.includes('smartfill')) {
      try {
        const smartfillData = await this.getSmartFillLocationData(locationId);
        if (smartfillData) {
          sources.smartfill = smartfillData;
          correlationScore += 1;
          dataQualityCount += 1;
        }
      } catch (error) {
        console.warn('[LocationIntegrationService] SmartFill data fetch failed:', error);
      }
    }

    // Fetch Captive Payments data
    if (systems.includes('captive_payments')) {
      try {
        const captiveData = await this.getCaptivePaymentsData(locationId);
        if (captiveData) {
          sources.captive_payments = captiveData;
          correlationScore += 0.5; // Partial correlation (only delivery data)
          dataQualityCount += 0.5;
        }
      } catch (error) {
        console.warn('[LocationIntegrationService] Captive Payments data fetch failed:', error);
      }
    }

    // Calculate correlation score (0-1)
    const normalizedScore = dataQualityCount > 0 ? correlationScore / dataQualityCount : 0;

    // Determine data quality
    let dataQuality: 'high' | 'medium' | 'low' = 'low';
    if (normalizedScore >= 0.8) dataQuality = 'high';
    else if (normalizedScore >= 0.5) dataQuality = 'medium';

    return {
      locationId,
      sources,
      correlationScore: Math.round(normalizedScore * 100) / 100,
      dataQuality,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get historical data for a location across all systems
   */
  async getLocationHistoricalData(
    locationId: string,
    startDate: string,
    endDate: string,
    includeSystems: string[] = ['smartfill', 'agbot', 'captive_payments']
  ): Promise<HistoricalData> {
    const historicalData: HistoricalData = {
      fuelLevels: [],
      deliveries: [],
      alerts: [],
      systemEvents: [],
    };

    // Get SmartFill historical readings
    if (includeSystems.includes('smartfill')) {
      try {
        const smartfillReadings = await this.getSmartFillHistoricalReadings(locationId, startDate, endDate);
        historicalData.fuelLevels.push(...smartfillReadings);
      } catch (error) {
        console.warn('[LocationIntegrationService] SmartFill historical data failed:', error);
      }
    }

    // Get AgBot historical readings
    if (includeSystems.includes('agbot')) {
      try {
        const agbotReadings = await this.getAgBotHistoricalReadings(locationId, startDate, endDate);
        historicalData.fuelLevels.push(...agbotReadings);
      } catch (error) {
        console.warn('[LocationIntegrationService] AgBot historical data failed:', error);
      }
    }

    // Get delivery history from Captive Payments
    if (includeSystems.includes('captive_payments')) {
      try {
        const deliveries = await this.getCaptivePaymentsHistoricalDeliveries(locationId, startDate, endDate);
        historicalData.deliveries.push(...deliveries);
      } catch (error) {
        console.warn('[LocationIntegrationService] Captive Payments historical data failed:', error);
      }
    }

    // Sort all data by timestamp
    historicalData.fuelLevels.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    historicalData.deliveries.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return historicalData;
  }

  /**
   * Get AgBot location data with assets
   */
  private async getAgBotLocationData(locationId: string): Promise<AgBotLocationData | null> {
    // Try finding by external_guid first (most common case)
    let location = await this.agbotLocationRepo.findByExternalGuid(locationId);

    // If not found, try by database ID
    if (!location) {
      location = await this.agbotLocationRepo.findById(locationId);
    }

    if (!location) {
      return null;
    }

    // Get assets for this location
    const assets = await this.agbotAssetRepo.findByLocation(location.id);

    return {
      id: location.id,
      name: location.name,
      address: location.address || '',
      customerName: location.customer_name,
      calibratedFillLevel: location.calibrated_fill_level || 0,
      lastTelemetryAt: location.last_telemetry_at || '',
      assets: assets.map(asset => ({
        id: asset.id,
        name: asset.name,
        serialNumber: asset.serial_number,
        commodity: asset.commodity,
        capacityLiters: asset.capacity_liters,
        currentLevelLiters: asset.current_level_liters,
        currentLevelPercent: asset.current_level_percent,
        daysRemaining: asset.days_remaining,
        isOnline: asset.is_online,
      })),
    };
  }

  /**
   * Get SmartFill location data (legacy direct query)
   */
  private async getSmartFillLocationData(locationId: string): Promise<SmartFillLocationData | null> {
    const { data, error } = await this.db
      .from('smartfill_locations')
      .select(`
        *,
        tanks:smartfill_tanks(*)
      `)
      .eq('location_guid', locationId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      location_guid: data.location_guid,
      location_name: data.location_name,
      tanks: data.tanks || [],
    };
  }

  /**
   * Get Captive Payments data (legacy direct query)
   */
  private async getCaptivePaymentsData(locationId: string): Promise<CaptivePaymentsData | null> {
    // Query recent deliveries for this customer
    const { data: deliveries } = await this.db
      .from('captive_deliveries')
      .select('*')
      .ilike('customer', `%${locationId}%`) // This would need proper location correlation
      .order('delivery_date', { ascending: false })
      .limit(10);

    if (!deliveries || deliveries.length === 0) {
      return null;
    }

    return {
      customer: locationId,
      recentDeliveries: deliveries,
    };
  }

  /**
   * Get SmartFill historical readings
   */
  private async getSmartFillHistoricalReadings(
    locationId: string,
    startDate: string,
    endDate: string
  ): Promise<FuelLevelReading[]> {
    const { data: readings } = await this.db
      .from('smartfill_readings_history')
      .select(`
        *,
        tank:smartfill_tanks(
          tank_number,
          description,
          location:smartfill_locations(location_guid)
        )
      `)
      .eq('tank.location.location_guid', locationId)
      .gte('update_time', startDate)
      .lte('update_time', endDate)
      .order('update_time', { ascending: true });

    if (!readings) {
      return [];
    }

    return readings.map(reading => ({
      timestamp: reading.update_time,
      tankId: reading.tank_id,
      tankNumber: reading.tank?.tank_number,
      volume: reading.volume,
      volumePercent: reading.volume_percent,
      status: reading.status,
      source: 'smartfill' as const,
    }));
  }

  /**
   * Get AgBot historical readings
   */
  private async getAgBotHistoricalReadings(
    locationId: string,
    startDate: string,
    endDate: string
  ): Promise<FuelLevelReading[]> {
    // First, find the AgBot location
    let location = await this.agbotLocationRepo.findByExternalGuid(locationId);
    if (!location) {
      location = await this.agbotLocationRepo.findById(locationId);
    }

    if (!location) {
      return [];
    }

    // Get all assets for this location
    const assets = await this.agbotAssetRepo.findByLocation(location.id);

    // Get readings for all assets
    const allReadings: FuelLevelReading[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (const asset of assets) {
      try {
        const readings = await this.agbotReadingsRepo.findByDateRange(asset.id, start, end);

        allReadings.push(
          ...readings.map(reading => ({
            timestamp: reading.reading_at,
            tankId: reading.asset_id,
            tankName: asset.name,
            volumePercent: reading.level_percent || undefined,
            volume: reading.level_liters || undefined,
            status: reading.device_state || 'unknown',
            source: 'agbot' as const,
          }))
        );
      } catch (error) {
        console.warn(`[LocationIntegrationService] Failed to fetch readings for asset ${asset.id}:`, error);
      }
    }

    return allReadings;
  }

  /**
   * Get Captive Payments historical deliveries
   */
  private async getCaptivePaymentsHistoricalDeliveries(
    locationId: string,
    startDate: string,
    endDate: string
  ): Promise<DeliveryRecord[]> {
    const { data: deliveries } = await this.db
      .from('captive_deliveries')
      .select('*')
      .ilike('customer', `%${locationId}%`) // This would need proper location correlation
      .gte('delivery_date', startDate)
      .lte('delivery_date', endDate)
      .order('delivery_date', { ascending: true });

    if (!deliveries) {
      return [];
    }

    return deliveries.map(delivery => ({
      timestamp: delivery.delivery_date,
      volume: Math.abs(delivery.total_volume_litres || 0),
      carrier: delivery.carrier,
      terminal: delivery.terminal,
      fuelType: delivery.fuel_type,
      source: 'captive_payments' as const,
    }));
  }

  /**
   * Reconcile conflicts between different data sources
   * Used when multiple systems report different values for the same metric
   */
  reconcileConflicts(agbotData: any, smartfillData: any): any {
    // Prefer AgBot data when available (more reliable sensors)
    // Fall back to SmartFill for missing data
    return {
      ...smartfillData,
      ...agbotData,
      _sources: {
        agbot: !!agbotData,
        smartfill: !!smartfillData,
      },
    };
  }

  /**
   * Normalize timezones across different data sources
   */
  normalizeTimezones(data: any): any {
    // Convert all timestamps to UTC
    if (data.timestamp) {
      data.timestamp = new Date(data.timestamp).toISOString();
    }
    if (data.fuelLevels) {
      data.fuelLevels = data.fuelLevels.map((reading: any) => ({
        ...reading,
        timestamp: new Date(reading.timestamp).toISOString(),
      }));
    }
    if (data.deliveries) {
      data.deliveries = data.deliveries.map((delivery: any) => ({
        ...delivery,
        timestamp: new Date(delivery.timestamp).toISOString(),
      }));
    }
    return data;
  }

  /**
   * Calculate data quality score based on availability and freshness
   */
  calculateDataQuality(sources: UnifiedLocation['sources']): number {
    let score = 0;
    let maxScore = 0;

    // AgBot data (40% of quality score)
    if (sources.agbot) {
      maxScore += 40;
      const ageDays = sources.agbot.lastTelemetryAt
        ? (Date.now() - new Date(sources.agbot.lastTelemetryAt).getTime()) / (1000 * 60 * 60 * 24)
        : 999;

      if (ageDays < 1) score += 40; // Fresh data
      else if (ageDays < 7) score += 30; // Recent data
      else if (ageDays < 30) score += 20; // Stale data
      else score += 10; // Very stale data
    }

    // SmartFill data (40% of quality score)
    if (sources.smartfill) {
      maxScore += 40;
      score += 40; // Assume fresh if available
    }

    // Captive Payments data (20% of quality score)
    if (sources.captive_payments) {
      maxScore += 20;
      score += 20; // Assume fresh if available
    }

    return maxScore > 0 ? score / maxScore : 0;
  }
}
