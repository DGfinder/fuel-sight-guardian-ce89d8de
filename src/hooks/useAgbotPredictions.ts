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
  customer_name: string;
  location_guid: string;
  latest_calibrated_fill_percentage: number | null;
  assets: {
    id: string;
    asset_guid: string;
    device_battery_voltage: number | null;
    device_temperature: number | null;
    device_online: boolean;
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
        .from('agbot_locations')
        .select(`
          id,
          customer_name,
          location_guid,
          latest_calibrated_fill_percentage,
          assets:agbot_assets(
            id,
            asset_guid,
            device_battery_voltage,
            device_temperature,
            device_online
          )
        `)
        .order('customer_name');

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
        .from('agbot_readings_history')
        .select('*')
        .in('asset_id', assetIds)
        .gte('reading_timestamp', fromDate.toISOString())
        .order('reading_timestamp', { ascending: true });

      if (readingsError) throw readingsError;

      // Step 3: Group readings by asset
      const readingsByAsset = new Map<string, AgbotHistoricalReading[]>();

      for (const reading of readings || []) {
        const assetReadings = readingsByAsset.get(reading.asset_id) || [];
        assetReadings.push({
          id: reading.id,
          asset_id: reading.asset_id,
          calibrated_fill_percentage: parseFloat(reading.calibrated_fill_percentage) || 0,
          raw_fill_percentage: parseFloat(reading.raw_fill_percentage) || 0,
          reading_timestamp: reading.reading_timestamp,
          device_online: reading.device_online,
          asset_reported_litres: reading.asset_reported_litres ? parseFloat(reading.asset_reported_litres) : null,
          daily_consumption: reading.daily_consumption ? parseFloat(reading.daily_consumption) : null,
          days_remaining: reading.days_remaining ? parseInt(reading.days_remaining) : null,
          asset_depth: reading.asset_depth ? parseFloat(reading.asset_depth) : null,
          asset_pressure: reading.asset_pressure ? parseFloat(reading.asset_pressure) : null,
          asset_pressure_bar: reading.asset_pressure_bar ? parseFloat(reading.asset_pressure_bar) : null,
          tank_depth: reading.tank_depth ? parseFloat(reading.tank_depth) : null,
          tank_pressure: reading.tank_pressure ? parseFloat(reading.tank_pressure) : null,
          device_battery_voltage: reading.device_battery_voltage ? parseFloat(reading.device_battery_voltage) : null,
          device_temperature: reading.device_temperature ? parseFloat(reading.device_temperature) : null,
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

        if (assetReadings.length >= 5) {
          // Device health prediction
          const healthPrediction = predictDeviceHealth(
            assetReadings,
            asset.id,
            location.customer_name
          );
          deviceHealth.push(healthPrediction);

          // Consumption forecast
          const forecast = forecastConsumption(
            assetReadings,
            asset.id,
            location.customer_name
          );
          consumptionForecasts.push(forecast);

          // Anomaly detection
          const anomalies = detectAnomalies(
            assetReadings,
            asset.id,
            location.customer_name
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
        .from('agbot_assets')
        .select(`
          id,
          asset_guid,
          device_battery_voltage,
          device_temperature,
          device_online,
          location:agbot_locations(
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
        .from('agbot_readings_history')
        .select('*')
        .eq('asset_id', assetId)
        .gte('reading_timestamp', fromDate.toISOString())
        .order('reading_timestamp', { ascending: true });

      if (readingsError) throw readingsError;

      const historicalReadings: AgbotHistoricalReading[] = (readings || []).map(reading => ({
        id: reading.id,
        asset_id: reading.asset_id,
        calibrated_fill_percentage: parseFloat(reading.calibrated_fill_percentage) || 0,
        raw_fill_percentage: parseFloat(reading.raw_fill_percentage) || 0,
        reading_timestamp: reading.reading_timestamp,
        device_online: reading.device_online,
        asset_reported_litres: reading.asset_reported_litres ? parseFloat(reading.asset_reported_litres) : null,
        daily_consumption: reading.daily_consumption ? parseFloat(reading.daily_consumption) : null,
        days_remaining: reading.days_remaining ? parseInt(reading.days_remaining) : null,
        asset_depth: reading.asset_depth ? parseFloat(reading.asset_depth) : null,
        asset_pressure: reading.asset_pressure ? parseFloat(reading.asset_pressure) : null,
        asset_pressure_bar: reading.asset_pressure_bar ? parseFloat(reading.asset_pressure_bar) : null,
        tank_depth: reading.tank_depth ? parseFloat(reading.tank_depth) : null,
        tank_pressure: reading.tank_pressure ? parseFloat(reading.tank_pressure) : null,
        device_battery_voltage: reading.device_battery_voltage ? parseFloat(reading.device_battery_voltage) : null,
        device_temperature: reading.device_temperature ? parseFloat(reading.device_temperature) : null,
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
 */
export function useFleetHealthSummary(options?: { enabled?: boolean }) {
  const { enabled = true } = options || {};

  return useQuery({
    queryKey: ['fleet-health-summary'],
    queryFn: async () => {
      // Quick count queries
      const [
        { count: totalDevices },
        { count: lowBattery },
        { count: offlineDevices },
        { count: criticalFuel }
      ] = await Promise.all([
        supabase.from('agbot_assets').select('*', { count: 'exact', head: true }),
        supabase.from('agbot_assets').select('*', { count: 'exact', head: true }).lt('device_battery_voltage', 3.3),
        supabase.from('agbot_assets').select('*', { count: 'exact', head: true }).eq('device_online', false),
        supabase.from('agbot_locations').select('*', { count: 'exact', head: true }).lt('latest_calibrated_fill_percentage', 20)
      ]);

      return {
        totalDevices: totalDevices || 0,
        lowBattery: lowBattery || 0,
        offlineDevices: offlineDevices || 0,
        criticalFuel: criticalFuel || 0,
        healthyDevices: (totalDevices || 0) - (lowBattery || 0) - (offlineDevices || 0)
      };
    },
    enabled,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000 // 5 minutes
  });
}
