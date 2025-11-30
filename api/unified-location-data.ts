/**
 * UNIFIED LOCATION DATA API ENDPOINT
 * 
 * Provides unified location data combining SmartFill, AgBot, and Captive Payments data
 */

import { 
  getUnifiedLocationData,
  unifiedDataIntegrator 
} from './lib/unified-data-integration';
import { cacheSet, cacheGet, CACHE_CONFIG } from './lib/vercel-kv';
import { isFeatureEnabled, CONFIG_KEYS } from './lib/vercel-edge-config';

interface UnifiedLocationRequest {
  locationId: string;
  includeSystems?: string[];
  includeHistory?: boolean;
  timeRange?: {
    startDate: string;
    endDate: string;
  };
}

export default async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    try {
      // Check if unified data integration is enabled
      const integrationEnabled = await isFeatureEnabled(CONFIG_KEYS.FEATURES.ADVANCED_ANALYTICS);
      if (!integrationEnabled) {
        return res.status(503).json({
          success: false, 
          error: 'Unified data integration is disabled'
        });
      }

      const body: UnifiedLocationRequest = req.body;
      const { locationId, includeSystems, includeHistory = false, timeRange } = body;

      if (!locationId) {
        return res.status(400).json({
          success: false, 
          error: 'Location ID is required'
        });
      }

      // Create cache key including all parameters
      const cacheKey = `unified_location_${locationId}_${JSON.stringify({
        includeSystems,
        includeHistory,
        timeRange
      })}`;

      // Check cache first
      const cached = await cacheGet<any>(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }

      // Get unified location data
      const locationData = await getUnifiedLocationData(locationId);
      
      if (!locationData) {
        return res.status(404).json({
          success: false, 
          error: 'Location not found'
        });
      }

      // Optionally include historical data
      let historicalData = null;
      if (includeHistory && timeRange) {
        try {
          historicalData = await getLocationHistoricalData(
            locationId, 
            timeRange.startDate, 
            timeRange.endDate,
            includeSystems
          );
        } catch (error) {
          console.warn('[UNIFIED_LOCATION] Historical data fetch failed:', error);
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
          lastUpdated: locationData.lastUpdated
        }
      };

      // Cache the result
      await cacheSet(cacheKey, result, CACHE_CONFIG.UNIFIED_DATA);

      return res.json({
        success: true,
        data: result,
        cached: false,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[UNIFIED_LOCATION_API] Request failed:', error);
      return res.status(500).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }
  
  if (req.method === 'GET') {
    try {
      return res.json({
        success: true,
        service: 'Unified Location Data API',
        timestamp: new Date().toISOString(),
        features: [
          'Multi-system data integration',
          'Data correlation and quality assessment',
          'Historical data aggregation',
          'Intelligent caching'
        ]
      });
    } catch (error) {
      return res.status(503).json({
        success: false, 
        error: 'Service unavailable'
      });
    }
  }

  // Method not allowed
  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
}

/**
 * Get historical data for a location
 */
async function getLocationHistoricalData(
  locationId: string,
  startDate: string,
  endDate: string,
  includeSystems?: string[]
) {
  const systems = includeSystems || ['smartfill', 'agbot', 'captive_payments'];
  const historicalData: any = {
    fuelLevels: [],
    deliveries: [],
    alerts: [],
    systemEvents: []
  };

  // Get SmartFill historical readings
  if (systems.includes('smartfill')) {
    try {
      const { supabase } = await import('./lib/supabase');
      const { data: readings } = await supabase
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

      if (readings) {
        historicalData.fuelLevels.push(...readings.map(reading => ({
          timestamp: reading.update_time,
          tankId: reading.tank_id,
          tankNumber: reading.tank?.tank_number,
          volume: reading.volume,
          volumePercent: reading.volume_percent,
          status: reading.status,
          source: 'smartfill'
        })));
      }
    } catch (error) {
      console.warn('[UNIFIED_LOCATION] SmartFill historical data failed:', error);
    }
  }

  // Get AgBot historical readings
  if (systems.includes('agbot')) {
    try {
      const { supabase } = await import('./lib/supabase');
      const { data: readings } = await supabase
        .from('ta_agbot_readings')
        .select(`
          *,
          asset:ta_agbot_assets(
            name,
            location:ta_agbot_locations(external_guid)
          )
        `)
        .eq('asset.location.external_guid', locationId)
        .gte('reading_at', startDate)
        .lte('reading_at', endDate)
        .order('reading_at', { ascending: true });

      if (readings) {
        historicalData.fuelLevels.push(...readings.map(reading => ({
          timestamp: reading.reading_at,
          tankId: reading.asset_id,
          tankName: reading.asset?.name,
          volumePercent: reading.level_percent,
          status: reading.device_state,
          source: 'agbot'
        })));
      }
    } catch (error) {
      console.warn('[UNIFIED_LOCATION] AgBot historical data failed:', error);
    }
  }

  // Get delivery history from Captive Payments
  if (systems.includes('captive_payments')) {
    try {
      const { supabase } = await import('./lib/supabase');
      const { data: deliveries } = await supabase
        .from('captive_deliveries')
        .select('*')
        .ilike('customer', `%${locationId}%`) // This would need proper location correlation
        .gte('delivery_date', startDate)
        .lte('delivery_date', endDate)
        .order('delivery_date', { ascending: true });

      if (deliveries) {
        historicalData.deliveries.push(...deliveries.map(delivery => ({
          timestamp: delivery.delivery_date,
          volume: Math.abs(delivery.total_volume_litres || 0),
          carrier: delivery.carrier,
          terminal: delivery.terminal,
          fuelType: delivery.fuel_type,
          source: 'captive_payments'
        })));
      }
    } catch (error) {
      console.warn('[UNIFIED_LOCATION] Captive Payments historical data failed:', error);
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

