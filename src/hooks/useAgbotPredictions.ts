/**
 * Hook for Agbot Predictive Analytics
 * Fetches historical data and runs prediction algorithms
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AgbotHistoricalReading } from './useAgbotReadingHistory';
import {
  predictDeviceHealth,
  forecastConsumption,
  detectAnomalies,
  calculateFleetHealth,
  DeviceHealthPrediction,
  ConsumptionForecast,
  AnomalyReport,
  FleetHealthScore
} from '@/utils/agbotPredictions';

interface AgbotLocation {
  id: string;
  name: string;
  customer_name: string;
  external_guid: string;
  calibrated_fill_level: number | null;
  assets: {
    id: string;
    external_guid: string;
    battery_voltage: number | null;
    temperature_c: number | null;
    is_online: boolean;
  }[];
}

interface AgbotPredictionsData {
  deviceHealth: DeviceHealthPrediction[];
  consumptionForecasts: ConsumptionForecast[];
  anomalyReports: AnomalyReport[];
  fleetHealth: FleetHealthScore;
}

/**
 * Hook to fetch all Agbot predictions for the fleet
 */
export function useAgbotPredictions(options?: { days?: number; enabled?: boolean }) {
  const { days = 30, enabled = true } = options || {};

  return useQuery<AgbotPredictionsData>({
    queryKey: ['agbot-predictions', days],
    queryFn: async () => {
      // Step 1: Fetch all Agbot locations with their assets
      const { data: locations, error: locationsError } = await supabase
        .from('ta_agbot_locations')
        .select(`
          id,
          name,
          customer_name,
          external_guid,
          calibrated_fill_level,
          assets:ta_agbot_assets(
            id,
            external_guid,
            battery_voltage,
            temperature_c,
            is_online
          )
        `)
        .order('name');

      if (locationsError) throw locationsError;

      const validLocations = (locations as AgbotLocation[])?.filter(
        loc => loc.assets && loc.assets.length > 0
      ) || [];

      // Step 2: Fetch historical readings for all assets
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const assetIds = validLocations.flatMap(loc => loc.assets.map(a => a.id));

      if (assetIds.length === 0) {
        return {
          deviceHealth: [],
          consumptionForecasts: [],
          anomalyReports: [],
          fleetHealth: calculateFleetHealth([], [], [])
        };
      }

      const { data: readings, error: readingsError } = await supabase
        .from('ta_agbot_readings')
        .select('*')
        .in('asset_id', assetIds)
        .gte('reading_at', fromDate.toISOString())
        .order('reading_at', { ascending: true });

      if (readingsError) throw readingsError;

      // Step 3: Group readings by asset
      const readingsByAsset = new Map<string, AgbotHistoricalReading[]>();

      for (const reading of readings || []) {
        const assetReadings = readingsByAsset.get(reading.asset_id) || [];
        assetReadings.push({
          id: reading.id,
          asset_id: reading.asset_id,
          calibrated_fill_percentage: parseFloat(reading.level_percent) || 0,
          raw_fill_percentage: parseFloat(reading.raw_percent) || 0,
          reading_timestamp: reading.reading_at,
          device_online: reading.is_online,
          asset_reported_litres: reading.level_liters ? parseFloat(reading.level_liters) : null,
          daily_consumption: reading.daily_consumption ? parseFloat(reading.daily_consumption) : null,
          days_remaining: reading.days_remaining ? parseInt(reading.days_remaining) : null,
          asset_depth: reading.depth_m ? parseFloat(reading.depth_m) : null,
          asset_pressure: null,
          asset_pressure_bar: reading.pressure_bar ? parseFloat(reading.pressure_bar) : null,
          tank_depth: reading.depth_m ? parseFloat(reading.depth_m) : null,
          tank_pressure: null,
          device_battery_voltage: reading.battery_voltage ? parseFloat(reading.battery_voltage) : null,
          device_temperature: reading.temperature_c ? parseFloat(reading.temperature_c) : null,
          device_state: reading.device_state,
          created_at: reading.created_at
        });
        readingsByAsset.set(reading.asset_id, assetReadings);
      }

      // Step 4: Run predictions for each location/asset
      const deviceHealth: DeviceHealthPrediction[] = [];
      const consumptionForecasts: ConsumptionForecast[] = [];
      const anomalyReports: AnomalyReport[] = [];

      for (const location of validLocations) {
        const asset = location.assets[0]; // Primary asset
        const assetReadings = readingsByAsset.get(asset.id) || [];
        // Use tank name, fallback to customer name if not available
        const displayName = location.name?.trim() || location.customer_name;

        if (assetReadings.length >= 5) {
          // Device health prediction
          const healthPrediction = predictDeviceHealth(
            assetReadings,
            asset.id,
            displayName
          );
          deviceHealth.push(healthPrediction);

          // Consumption forecast
          const forecast = forecastConsumption(
            assetReadings,
            asset.id,
            displayName
          );
          consumptionForecasts.push(forecast);

          // Anomaly detection
          const anomalies = detectAnomalies(
            assetReadings,
            asset.id,
            displayName
          );
          anomalyReports.push(anomalies);
        }
      }

      // Step 5: Calculate fleet health
      const fleetHealth = calculateFleetHealth(
        deviceHealth,
        consumptionForecasts,
        anomalyReports
      );

      return {
        deviceHealth,
        consumptionForecasts,
        anomalyReports,
        fleetHealth
      };
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000 // 30 minutes
  });
}

/**
 * Hook to fetch predictions for a single device
 */
export function useDevicePrediction(assetId: string, options?: { days?: number; enabled?: boolean }) {
  const { days = 30, enabled = true } = options || {};

  return useQuery({
    queryKey: ['device-prediction', assetId, days],
    queryFn: async () => {
      // Fetch asset details
      const { data: asset, error: assetError } = await supabase
        .from('ta_agbot_assets')
        .select(`
          id,
          external_guid,
          battery_voltage,
          temperature_c,
          is_online,
          location:ta_agbot_locations(
            id,
            customer_name
          )
        `)
        .eq('id', assetId)
        .single();

      if (assetError) throw assetError;

      // Fetch historical readings
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const { data: readings, error: readingsError } = await supabase
        .from('ta_agbot_readings')
        .select('*')
        .eq('asset_id', assetId)
        .gte('reading_at', fromDate.toISOString())
        .order('reading_at', { ascending: true });

      if (readingsError) throw readingsError;

      const historicalReadings: AgbotHistoricalReading[] = (readings || []).map(reading => ({
        id: reading.id,
        asset_id: reading.asset_id,
        calibrated_fill_percentage: parseFloat(reading.level_percent) || 0,
        raw_fill_percentage: parseFloat(reading.raw_percent) || 0,
        reading_timestamp: reading.reading_at,
        device_online: reading.is_online,
        asset_reported_litres: reading.level_liters ? parseFloat(reading.level_liters) : null,
        daily_consumption: reading.daily_consumption ? parseFloat(reading.daily_consumption) : null,
        days_remaining: reading.days_remaining ? parseInt(reading.days_remaining) : null,
        asset_depth: reading.depth_m ? parseFloat(reading.depth_m) : null,
        asset_pressure: null,
        asset_pressure_bar: reading.pressure_bar ? parseFloat(reading.pressure_bar) : null,
        tank_depth: reading.depth_m ? parseFloat(reading.depth_m) : null,
        tank_pressure: null,
        device_battery_voltage: reading.battery_voltage ? parseFloat(reading.battery_voltage) : null,
        device_temperature: reading.temperature_c ? parseFloat(reading.temperature_c) : null,
        device_state: reading.device_state,
        created_at: reading.created_at
      }));

      const locationName = (asset.location as any)?.customer_name || 'Unknown';

      return {
        deviceHealth: predictDeviceHealth(historicalReadings, assetId, locationName),
        consumptionForecast: forecastConsumption(historicalReadings, assetId, locationName),
        anomalyReport: detectAnomalies(historicalReadings, assetId, locationName),
        readings: historicalReadings
      };
    },
    enabled: enabled && !!assetId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000
  });
}

/**
 * Hook to get just the fleet health summary (lighter query)
 * OPTIMIZED: Uses agbot_fleet_overview view instead of 4 separate COUNT queries
 */
export function useFleetHealthSummary(options?: { enabled?: boolean }) {
  const { enabled = true } = options || {};

  return useQuery({
    queryKey: ['fleet-health-summary'],
    queryFn: async () => {
      // Single view query replaces 4 separate COUNT queries
      const { data: fleetData, error } = await supabase
        .from('agbot_fleet_overview')
        .select('total_assets, assets_online, avg_fill_percent, low_battery_devices, tanks_need_refill');

      if (error) {
        console.error('Error fetching fleet overview:', error);
        // Fallback to original queries if view fails
        const [
          { count: totalDevices },
          { count: lowBattery },
          { count: offlineDevices },
          { count: criticalFuel }
        ] = await Promise.all([
          supabase.from('ta_agbot_assets').select('*', { count: 'exact', head: true }),
          supabase.from('ta_agbot_assets').select('*', { count: 'exact', head: true }).lt('battery_voltage', 3.3),
          supabase.from('ta_agbot_assets').select('*', { count: 'exact', head: true }).eq('is_online', false),
          supabase.from('ta_agbot_locations').select('*', { count: 'exact', head: true }).lt('calibrated_fill_level', 20)
        ]);
        return {
          totalDevices: totalDevices || 0,
          lowBattery: lowBattery || 0,
          offlineDevices: offlineDevices || 0,
          criticalFuel: criticalFuel || 0,
          healthyDevices: (totalDevices || 0) - (lowBattery || 0) - (offlineDevices || 0)
        };
      }

      // Aggregate across all rows in the view (one row per location)
      const totals = (fleetData || []).reduce((acc, row) => ({
        totalDevices: acc.totalDevices + (row.total_assets || 0),
        assetsOnline: acc.assetsOnline + (row.assets_online || 0),
        lowBattery: acc.lowBattery + (row.low_battery_devices || 0),
        criticalFuel: acc.criticalFuel + (row.tanks_need_refill || 0)
      }), { totalDevices: 0, assetsOnline: 0, lowBattery: 0, criticalFuel: 0 });

      const offlineDevices = totals.totalDevices - totals.assetsOnline;

      return {
        totalDevices: totals.totalDevices,
        lowBattery: totals.lowBattery,
        offlineDevices: offlineDevices,
        criticalFuel: totals.criticalFuel,
        healthyDevices: totals.totalDevices - totals.lowBattery - offlineDevices
      };
    },
    enabled,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000 // 5 minutes
  });
}

/**
 * Hook to get device health summary from pre-computed database view
 * OPTIMIZED: Uses agbot_device_health_summary view for quick health checks
 * Use this for dashboards/summaries, use predictDeviceHealth() for detailed analysis
 */
export interface DeviceHealthSummary {
  assetId: string;
  locationName: string;
  isOnline: boolean;
  healthStatus: 'healthy' | 'warning' | 'critical';
  batteryVoltage: number | null;
  avgBattery7d: number | null;
  batteryChange: number;
  offlineEvents7d: number;
  calibrationDrift: number;
  lastSeen: string | null;
}

export function useDeviceHealthSummary(assetIds?: string[], options?: { enabled?: boolean }) {
  const { enabled = true } = options || {};

  return useQuery<DeviceHealthSummary[]>({
    queryKey: ['device-health-summary', assetIds],
    queryFn: async () => {
      let query = supabase
        .from('agbot_device_health_summary')
        .select(`
          asset_id,
          customer_name,
          is_online,
          health_status,
          battery_voltage,
          avg_battery_7d,
          battery_change_total,
          offline_events_7d,
          calibration_drift,
          last_reading_at
        `);

      if (assetIds && assetIds.length > 0) {
        query = query.in('asset_id', assetIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching device health summary:', error);
        throw error;
      }

      return (data || []).map((d: any): DeviceHealthSummary => ({
        assetId: d.asset_id,
        locationName: d.customer_name || 'Unknown',
        isOnline: d.is_online,
        healthStatus: d.health_status || 'healthy',
        batteryVoltage: d.battery_voltage,
        avgBattery7d: d.avg_battery_7d,
        batteryChange: d.battery_change_total || 0,
        offlineEvents7d: d.offline_events_7d || 0,
        calibrationDrift: d.calibration_drift || 0,
        lastSeen: d.last_reading_at
      }));
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  });
}

// ============================================
// EDGE FUNCTION VARIANTS (Server-Side Computation)
// ============================================

/**
 * Server-side prediction types
 */
export interface EdgeBatteryPrediction {
  currentVoltage: number | null;
  voltageDeclineRate: number;
  estimatedDaysRemaining: number | null;
  healthScore: number;
  alertLevel: 'good' | 'warning' | 'critical' | 'unknown';
  trend: 'stable' | 'declining' | 'rapid_decline';
}

export interface EdgeConsumptionForecast {
  currentLevel: number;
  avgDailyConsumption: number;
  daysRemaining: number | null;
  predictedEmptyDate: string | null;
  urgency: 'critical' | 'warning' | 'normal' | 'good';
}

export interface EdgeAnomaly {
  type: 'sudden_drop' | 'unusual_rate' | 'sensor_drift' | 'night_consumption';
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  value: number;
}

export interface EdgePredictionResult {
  assetId: string;
  battery: EdgeBatteryPrediction;
  consumption: EdgeConsumptionForecast;
  anomalies: EdgeAnomaly[];
  deviceHealth: {
    overallHealth: 'good' | 'warning' | 'critical';
    failureProbability: number;
    offlineFrequency: number;
    sensorDrift: number;
  };
  calculatedAt: string;
}

/**
 * Hook for server-side predictions via Edge Function
 * Use this instead of useDevicePrediction for ~50% faster client performance
 */
export function useEdgePrediction(assetId: string, options?: { daysBack?: number; enabled?: boolean }) {
  const { daysBack = 30, enabled = true } = options || {};

  return useQuery<EdgePredictionResult>({
    queryKey: ['edge-prediction', assetId, daysBack],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('agbot-predictions', {
        body: { asset_id: assetId, days_back: daysBack }
      });

      if (error) throw new Error(error.message || 'Edge function failed');
      if (data.error) throw new Error(data.error);

      return data as EdgePredictionResult;
    },
    enabled: enabled && !!assetId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2
  });
}
