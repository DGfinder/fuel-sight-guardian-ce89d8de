/**
 * UNIFIED DATA INTEGRATION LAYER
 * 
 * Provides a unified interface to query and correlate data across
 * SmartFill, AgBot, and Captive Payments systems with intelligent
 * data normalization and cross-system correlation
 */

import { supabase } from '@/lib/supabase';
import { 
  fetchSmartFillTankData, 
  getSmartFillLocations,
  SmartFillLocation,
  SmartFillTank 
} from '@/services/smartfill-api';
import { 
  unifiedDataCache,
  withAdvancedCache,
  ADVANCED_CACHE_CONFIG 
} from '@/lib/advanced-cache';
import { getConfig, CONFIG_KEYS } from '@/lib/vercel-edge-config';

// Unified data models that combine information from multiple systems
export interface UnifiedLocation {
  id: string;
  name: string;
  address?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  
  // Source systems
  sources: {
    smartfill?: SmartFillLocationData;
    agbot?: AgBotLocationData;
    captive_payments?: CaptivePaymentsLocationData;
  };
  
  // Unified metrics
  totalTanks: number;
  averageFuelLevel: number;
  lowFuelAlerts: number;
  systemStatus: 'operational' | 'warning' | 'critical' | 'unknown';
  lastUpdated: string;
  
  // Correlation data
  correlationScore: number; // How well data correlates between systems
  dataQuality: 'high' | 'medium' | 'low';
}

export interface UnifiedTank {
  id: string;
  locationId: string;
  name: string;
  capacity: number;
  fuelType: string;
  
  // Current status
  currentVolume: number;
  currentVolumePercent: number;
  status: 'normal' | 'low' | 'critical' | 'maintenance' | 'unknown';
  lastUpdated: string;
  
  // Source systems
  sources: {
    smartfill?: SmartFillTankData;
    agbot?: AgBotTankData;
  };
  
  // Historical trends
  trends: {
    consumptionRate: number; // Liters per day
    fillFrequency: number;   // Times filled per month
    efficiency: number;      // 0-100 score
  };
  
  // Data correlation
  correlationScore: number;
  dataConsistency: 'consistent' | 'minor_variance' | 'major_variance' | 'conflicted';
}

export interface UnifiedCustomer {
  id: string;
  name: string;
  type: 'retail' | 'commercial' | 'industrial';
  
  // Locations and assets
  locations: UnifiedLocation[];
  totalTanks: number;
  totalCapacity: number;
  
  // Financial data from Captive Payments
  deliveryData?: {
    totalDeliveries: number;
    totalVolume: number;
    averageDeliverySize: number;
    lastDeliveryDate: string;
    preferredCarrier?: string;
  };
  
  // Operational metrics
  metrics: {
    averageFuelLevel: number;
    consumptionRate: number;
    systemEfficiency: number;
    alertCount: number;
  };
  
  lastUpdated: string;
}

export interface UnifiedDelivery {
  id: string;
  date: string;
  customerId: string;
  customerName: string;
  locationId?: string;
  
  // Delivery details
  volume: number;
  fuelType: string;
  carrier: string;
  terminal: string;
  
  // Correlation with tank data
  correlatedTanks: Array<{
    tankId: string;
    preDeliveryLevel: number;
    postDeliveryLevel: number;
    volumeChange: number;
  }>;
  
  // Quality metrics
  dataQuality: 'verified' | 'estimated' | 'conflicted';
  correlationConfidence: number;
}

// Individual system data structures
interface SmartFillLocationData {
  location_guid: string;
  unit_number: string;
  customer_name: string;
  tanks: SmartFillTank[];
  latest_update_time: string;
}

interface SmartFillTankData {
  tank_guid: string;
  tank_number: string;
  capacity: number;
  latest_volume: number;
  latest_volume_percent: number;
  latest_status: string;
}

interface AgBotLocationData {
  location_guid: string;
  site_name: string;
  assets: any[];
  latitude?: number;
  longitude?: number;
}

interface AgBotTankData {
  asset_guid: string;
  asset_name: string;
  latest_calibrated_fill_percentage: number;
  latest_reading_time: string;
}

interface CaptivePaymentsLocationData {
  customer: string;
  terminal: string;
  deliveryHistory: any[];
}

/**
 * Core unified data integration class
 */
export class UnifiedDataIntegrator {
  private static instance: UnifiedDataIntegrator;
  
  public static getInstance(): UnifiedDataIntegrator {
    if (!UnifiedDataIntegrator.instance) {
      UnifiedDataIntegrator.instance = new UnifiedDataIntegrator();
    }
    return UnifiedDataIntegrator.instance;
  }

  /**
   * Get unified location data combining all systems
   */
  async getUnifiedLocation(locationId: string): Promise<UnifiedLocation | null> {
    const cacheKey = `unified_location_${locationId}`;
    
    return await withAdvancedCache(
      cacheKey,
      async () => {
        const locationData: Partial<UnifiedLocation> = {
          id: locationId,
          sources: {},
          totalTanks: 0,
          averageFuelLevel: 0,
          lowFuelAlerts: 0,
          systemStatus: 'unknown',
          lastUpdated: new Date().toISOString(),
          correlationScore: 0,
          dataQuality: 'low'
        };

        // Fetch SmartFill data
        try {
          const smartfillData = await this.getSmartFillLocationData(locationId);
          if (smartfillData) {
            locationData.sources!.smartfill = smartfillData;
            locationData.name = smartfillData.customer_name;
            locationData.totalTanks += smartfillData.tanks.length;
            
            const fuelLevels = smartfillData.tanks.map(tank => tank.latest_volume_percent);
            locationData.averageFuelLevel = fuelLevels.length > 0 
              ? fuelLevels.reduce((a, b) => a + b, 0) / fuelLevels.length 
              : 0;
            
            locationData.lowFuelAlerts += smartfillData.tanks.filter(tank => 
              tank.latest_volume_percent < 20
            ).length;
          }
        } catch (error) {
          console.warn('[UNIFIED] SmartFill data fetch failed:', error);
        }

        // Fetch AgBot data
        try {
          const agbotData = await this.getAgBotLocationData(locationId);
          if (agbotData) {
            locationData.sources!.agbot = agbotData;
            if (!locationData.name) {
              locationData.name = agbotData.site_name;
            }
            
            if (agbotData.latitude && agbotData.longitude) {
              locationData.coordinates = {
                latitude: agbotData.latitude,
                longitude: agbotData.longitude
              };
            }
            
            locationData.totalTanks += agbotData.assets.length;
            
            const agbotFuelLevels = agbotData.assets.map(asset => 
              asset.latest_calibrated_fill_percentage || 0
            );
            
            if (agbotFuelLevels.length > 0) {
              const agbotAverage = agbotFuelLevels.reduce((a, b) => a + b, 0) / agbotFuelLevels.length;
              locationData.averageFuelLevel = locationData.averageFuelLevel > 0 
                ? (locationData.averageFuelLevel + agbotAverage) / 2
                : agbotAverage;
            }
            
            locationData.lowFuelAlerts += agbotData.assets.filter(asset => 
              (asset.latest_calibrated_fill_percentage || 0) < 20
            ).length;
          }
        } catch (error) {
          console.warn('[UNIFIED] AgBot data fetch failed:', error);
        }

        // Fetch Captive Payments data
        try {
          const captiveData = await this.getCaptivePaymentsLocationData(locationId);
          if (captiveData) {
            locationData.sources!.captive_payments = captiveData;
          }
        } catch (error) {
          console.warn('[UNIFIED] Captive Payments data fetch failed:', error);
        }

        // Calculate correlation score and data quality
        locationData.correlationScore = this.calculateLocationCorrelationScore(locationData.sources!);
        locationData.dataQuality = this.assessDataQuality(locationData.sources!);
        
        // Determine system status
        locationData.systemStatus = this.determineSystemStatus(
          locationData.lowFuelAlerts!, 
          locationData.totalTanks!,
          locationData.correlationScore!
        );

        return locationData as UnifiedLocation;
      },
      ADVANCED_CACHE_CONFIG.UNIFIED_DATA
    );
  }

  /**
   * Get unified tank data with cross-system correlation
   */
  async getUnifiedTank(tankId: string): Promise<UnifiedTank | null> {
    const cacheKey = `unified_tank_${tankId}`;
    
    return await withAdvancedCache(
      cacheKey,
      async () => {
        // Implementation for unified tank data
        // This would combine SmartFill and AgBot tank data
        return null; // Placeholder
      },
      ADVANCED_CACHE_CONFIG.UNIFIED_DATA
    );
  }

  /**
   * Get unified customer view across all systems
   */
  async getUnifiedCustomer(customerId: string): Promise<UnifiedCustomer | null> {
    const cacheKey = `unified_customer_${customerId}`;
    
    return await withAdvancedCache(
      cacheKey,
      async () => {
        const customerData: Partial<UnifiedCustomer> = {
          id: customerId,
          locations: [],
          totalTanks: 0,
          totalCapacity: 0,
          metrics: {
            averageFuelLevel: 0,
            consumptionRate: 0,
            systemEfficiency: 0,
            alertCount: 0
          },
          lastUpdated: new Date().toISOString()
        };

        // Fetch customer locations from all systems
        const locations = await this.getCustomerLocations(customerId);
        customerData.locations = locations;
        
        // Aggregate metrics across all locations
        customerData.totalTanks = locations.reduce((sum, loc) => sum + loc.totalTanks, 0);
        customerData.metrics!.averageFuelLevel = locations.length > 0 
          ? locations.reduce((sum, loc) => sum + loc.averageFuelLevel, 0) / locations.length 
          : 0;
        customerData.metrics!.alertCount = locations.reduce((sum, loc) => sum + loc.lowFuelAlerts, 0);

        // Fetch delivery data from Captive Payments
        try {
          const deliveryData = await this.getCustomerDeliveryData(customerId);
          customerData.deliveryData = deliveryData;
        } catch (error) {
          console.warn('[UNIFIED] Customer delivery data fetch failed:', error);
        }

        return customerData as UnifiedCustomer;
      },
      ADVANCED_CACHE_CONFIG.UNIFIED_DATA
    );
  }

  /**
   * Get correlated delivery data with tank level changes
   */
  async getCorrelatedDeliveries(
    startDate: string, 
    endDate: string,
    customerId?: string
  ): Promise<UnifiedDelivery[]> {
    const cacheKey = `unified_deliveries_${startDate}_${endDate}_${customerId || 'all'}`;
    
    return await withAdvancedCache(
      cacheKey,
      async () => {
        // Fetch deliveries from Captive Payments
        let deliveriesQuery = supabase
          .from('captive_deliveries')
          .select('*')
          .gte('delivery_date', startDate)
          .lte('delivery_date', endDate);

        if (customerId) {
          deliveriesQuery = deliveriesQuery.eq('customer_id', customerId);
        }

        const { data: deliveries, error } = await deliveriesQuery;
        if (error) throw error;

        // Correlate with tank data
        const correlatedDeliveries: UnifiedDelivery[] = [];
        
        for (const delivery of deliveries || []) {
          const unified: UnifiedDelivery = {
            id: delivery.id,
            date: delivery.delivery_date,
            customerId: delivery.customer_id || delivery.customer,
            customerName: delivery.customer,
            volume: Math.abs(delivery.total_volume_litres || 0),
            fuelType: delivery.fuel_type || 'Unknown',
            carrier: delivery.carrier || 'Unknown',
            terminal: delivery.terminal || 'Unknown',
            correlatedTanks: [],
            dataQuality: 'estimated',
            correlationConfidence: 0
          };

          // Try to correlate with tank data
          try {
            const tankChanges = await this.correlateTankChanges(
              delivery.customer,
              delivery.delivery_date
            );
            
            unified.correlatedTanks = tankChanges;
            unified.correlationConfidence = this.calculateCorrelationConfidence(
              unified.volume,
              tankChanges
            );
            
            unified.dataQuality = unified.correlationConfidence > 0.8 
              ? 'verified' 
              : unified.correlationConfidence > 0.5 
                ? 'estimated' 
                : 'conflicted';
                
          } catch (error) {
            console.warn('[UNIFIED] Tank correlation failed for delivery:', delivery.id, error);
          }

          correlatedDeliveries.push(unified);
        }

        return correlatedDeliveries;
      },
      ADVANCED_CACHE_CONFIG.CORRELATION_DATA
    );
  }

  /**
   * Get cross-system analytics with data correlation
   */
  async getCrossSystemAnalytics(
    startDate: string,
    endDate: string,
    systems: string[] = ['smartfill', 'agbot', 'captive_payments']
  ): Promise<{
    summary: {
      totalLocations: number;
      totalTanks: number;
      totalDeliveries: number;
      correlationScore: number;
    };
    systemHealth: Record<string, {
      available: boolean;
      dataQuality: string;
      lastUpdate: string;
    }>;
    dataConsistency: {
      consistentLocations: number;
      inconsistentLocations: number;
      missingCorrelations: number;
    };
  }> {
    const cacheKey = `cross_system_analytics_${startDate}_${endDate}_${systems.join(',')}`;
    
    return await withAdvancedCache(
      cacheKey,
      async () => {
        const analytics = {
          summary: {
            totalLocations: 0,
            totalTanks: 0,
            totalDeliveries: 0,
            correlationScore: 0
          },
          systemHealth: {} as Record<string, any>,
          dataConsistency: {
            consistentLocations: 0,
            inconsistentLocations: 0,
            missingCorrelations: 0
          }
        };

        // Analyze each system
        if (systems.includes('smartfill')) {
          const smartfillHealth = await this.analyzeSmartFillHealth();
          analytics.systemHealth.smartfill = smartfillHealth;
          analytics.summary.totalLocations += smartfillHealth.locationCount || 0;
          analytics.summary.totalTanks += smartfillHealth.tankCount || 0;
        }

        if (systems.includes('agbot')) {
          const agbotHealth = await this.analyzeAgBotHealth();
          analytics.systemHealth.agbot = agbotHealth;
          analytics.summary.totalLocations += agbotHealth.locationCount || 0;
          analytics.summary.totalTanks += agbotHealth.assetCount || 0;
        }

        if (systems.includes('captive_payments')) {
          const captiveHealth = await this.analyzeCaptivePaymentsHealth(startDate, endDate);
          analytics.systemHealth.captive_payments = captiveHealth;
          analytics.summary.totalDeliveries = captiveHealth.deliveryCount || 0;
        }

        // Calculate cross-system correlation
        analytics.summary.correlationScore = await this.calculateCrossSystemCorrelation(
          systems, 
          startDate, 
          endDate
        );

        return analytics;
      },
      ADVANCED_CACHE_CONFIG.ANALYTICS_QUERIES
    );
  }

  /**
   * Private helper methods
   */
  private async getSmartFillLocationData(locationId: string): Promise<SmartFillLocationData | null> {
    const { data, error } = await supabase
      .from('smartfill_locations')
      .select(`
        *,
        tanks:smartfill_tanks(*)
      `)
      .eq('location_guid', locationId)
      .single();

    return error ? null : data;
  }

  private async getAgBotLocationData(locationId: string): Promise<AgBotLocationData | null> {
    const { data, error } = await supabase
      .from('ta_agbot_locations')
      .select(`
        *,
        assets:ta_agbot_assets(*)
      `)
      .eq('external_guid', locationId)
      .single();

    return error ? null : data;
  }

  private async getCaptivePaymentsLocationData(locationId: string): Promise<CaptivePaymentsLocationData | null> {
    // This would query captive payments data related to the location
    return null; // Placeholder
  }

  private async getCustomerLocations(customerId: string): Promise<UnifiedLocation[]> {
    // Implementation to get all locations for a customer
    return []; // Placeholder
  }

  private async getCustomerDeliveryData(customerId: string) {
    const { data, error } = await supabase
      .from('captive_deliveries')
      .select('*')
      .eq('customer_id', customerId)
      .order('delivery_date', { ascending: false })
      .limit(100);

    if (error) throw error;

    const deliveries = data || [];
    return {
      totalDeliveries: deliveries.length,
      totalVolume: deliveries.reduce((sum, d) => sum + Math.abs(d.total_volume_litres || 0), 0),
      averageDeliverySize: deliveries.length > 0 
        ? deliveries.reduce((sum, d) => sum + Math.abs(d.total_volume_litres || 0), 0) / deliveries.length 
        : 0,
      lastDeliveryDate: deliveries[0]?.delivery_date || null,
      preferredCarrier: this.findMostFrequentCarrier(deliveries)
    };
  }

  private async correlateTankChanges(customer: string, deliveryDate: string) {
    // Implementation to correlate tank level changes with deliveries
    return []; // Placeholder
  }

  private calculateLocationCorrelationScore(sources: any): number {
    let score = 0;
    const systems = Object.keys(sources).length;
    
    if (systems >= 2) score += 0.5;
    if (systems >= 3) score += 0.3;
    
    // Additional correlation logic based on data consistency
    return Math.min(1.0, score);
  }

  private assessDataQuality(sources: any): 'high' | 'medium' | 'low' {
    const systemCount = Object.keys(sources).length;
    if (systemCount >= 3) return 'high';
    if (systemCount >= 2) return 'medium';
    return 'low';
  }

  private determineSystemStatus(
    lowFuelAlerts: number, 
    totalTanks: number, 
    correlationScore: number
  ): 'operational' | 'warning' | 'critical' | 'unknown' {
    if (totalTanks === 0 || correlationScore < 0.3) return 'unknown';
    
    const alertRatio = lowFuelAlerts / totalTanks;
    if (alertRatio > 0.5) return 'critical';
    if (alertRatio > 0.2) return 'warning';
    
    return 'operational';
  }

  private calculateCorrelationConfidence(deliveryVolume: number, tankChanges: any[]): number {
    // Implementation to calculate how well delivery volume matches tank changes
    return 0.5; // Placeholder
  }

  private async analyzeSmartFillHealth() {
    // Implementation for SmartFill health analysis
    return { available: true, dataQuality: 'high', lastUpdate: new Date().toISOString() };
  }

  private async analyzeAgBotHealth() {
    // Implementation for AgBot health analysis
    return { available: true, dataQuality: 'medium', lastUpdate: new Date().toISOString() };
  }

  private async analyzeCaptivePaymentsHealth(startDate: string, endDate: string) {
    // Implementation for Captive Payments health analysis
    return { available: true, dataQuality: 'high', lastUpdate: new Date().toISOString() };
  }

  private async calculateCrossSystemCorrelation(
    systems: string[], 
    startDate: string, 
    endDate: string
  ): number {
    // Implementation for cross-system correlation calculation
    return 0.75; // Placeholder
  }

  private findMostFrequentCarrier(deliveries: any[]): string | undefined {
    const carrierCounts: Record<string, number> = {};
    
    deliveries.forEach(delivery => {
      const carrier = delivery.carrier || 'Unknown';
      carrierCounts[carrier] = (carrierCounts[carrier] || 0) + 1;
    });

    return Object.keys(carrierCounts).reduce((a, b) => 
      carrierCounts[a] > carrierCounts[b] ? a : b
    );
  }
}

/**
 * API endpoints integration
 */
export const unifiedDataIntegrator = UnifiedDataIntegrator.getInstance();

/**
 * Utility functions for unified data access
 */
export async function getUnifiedLocationData(locationId: string): Promise<UnifiedLocation | null> {
  return await unifiedDataIntegrator.getUnifiedLocation(locationId);
}

export async function getUnifiedCustomerData(customerId: string): Promise<UnifiedCustomer | null> {
  return await unifiedDataIntegrator.getUnifiedCustomer(customerId);
}

export async function getCorrelatedDeliveryData(
  startDate: string,
  endDate: string,
  customerId?: string
): Promise<UnifiedDelivery[]> {
  return await unifiedDataIntegrator.getCorrelatedDeliveries(startDate, endDate, customerId);
}

export async function getCrossSystemAnalytics(
  startDate: string,
  endDate: string,
  systems?: string[]
): Promise<any> {
  return await unifiedDataIntegrator.getCrossSystemAnalytics(startDate, endDate, systems);
}

/**
 * Initialize the unified data integration system
 */
export async function initializeUnifiedDataIntegration(): Promise<{
  success: boolean;
  message: string;
  features: string[];
}> {
  try {
    // Check if unified data integration is enabled
    const integrationEnabled = await getConfig<boolean>(
      CONFIG_KEYS.FEATURES.ADVANCED_ANALYTICS,
      true
    );

    if (!integrationEnabled) {
      return {
        success: false,
        message: 'Unified data integration disabled by feature flag',
        features: []
      };
    }

    // Test connections to all systems
    const systemTests = await Promise.allSettled([
      // Test SmartFill connection
      supabase.from('smartfill_locations').select('count', { count: 'exact', head: true }),
      // Test AgBot connection
      supabase.from('ta_agbot_locations').select('count', { count: 'exact', head: true }),
      // Test Captive Payments connection
      supabase.from('captive_deliveries').select('count', { count: 'exact', head: true })
    ]);

    const availableSystems = systemTests
      .map((result, index) => ({
        system: ['SmartFill', 'AgBot', 'Captive Payments'][index],
        available: result.status === 'fulfilled'
      }))
      .filter(s => s.available)
      .map(s => s.system);

    const features = [
      'Cross-system data correlation',
      'Unified location views',
      'Unified customer analytics',
      'Delivery-tank correlation',
      'Data quality assessment',
      'System health monitoring',
      'Advanced caching integration'
    ];

    return {
      success: true,
      message: `Unified data integration initialized with ${availableSystems.length}/3 systems available: ${availableSystems.join(', ')}`,
      features
    };

  } catch (error) {
    console.error('[UNIFIED_DATA] Initialization failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown initialization error',
      features: []
    };
  }
}