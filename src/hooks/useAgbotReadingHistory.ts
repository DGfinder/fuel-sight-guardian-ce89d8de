import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface AgbotHistoricalReading {
  id: string;
  asset_id: string;
  calibrated_fill_percentage: number;
  raw_fill_percentage: number;
  reading_timestamp: string;
  device_online: boolean;
  asset_reported_litres: number | null;
  daily_consumption: number | null;
  days_remaining: number | null;
  asset_depth: number | null;
  asset_pressure: number | null;
  asset_pressure_bar: number | null;
  tank_depth: number | null;
  tank_pressure: number | null;
  device_battery_voltage: number | null;
  device_temperature: number | null;
  device_state: string | null;
  created_at: string;
}

interface UseAgbotReadingHistoryParams {
  locationId: string;
  enabled?: boolean;
  days?: number;
  dateFrom?: Date;
  dateTo?: Date;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

export function useAgbotReadingHistory({
  locationId,
  enabled = true,
  days = 30,
  dateFrom,
  dateTo,
  sortOrder = 'desc',
  limit = 1000
}: UseAgbotReadingHistoryParams) {
  return useQuery({
    queryKey: [
      'agbot-reading-history',
      locationId,
      days,
      dateFrom?.toISOString(),
      dateTo?.toISOString(),
      sortOrder,
      limit
    ],
    queryFn: async () => {
      console.log(`Fetching agbot reading history for location ${locationId}`);

      // First get the location with its assets
      const { data: location, error: locationError } = await supabase
        .from('agbot_locations')
        .select(`
          id,
          location_id,
          customer_name,
          assets:agbot_assets(
            asset_guid,
            asset_profile_water_capacity,
            asset_refill_capacity_litres,
            asset_profile_max_depth,
            asset_profile_max_pressure,
            asset_profile_max_pressure_bar,
            asset_profile_commodity,
            device_battery_voltage,
            device_temperature,
            device_state,
            device_network_id,
            helmet_serial_number,
            device_sku
          )
        `)
        .eq('id', locationId)
        .single();

      if (locationError) {
        console.error('Error fetching agbot location:', locationError);
        throw locationError;
      }

      if (!location || !location.assets || location.assets.length === 0) {
        console.log('No assets found for location');
        return {
          readings: [],
          totalCount: 0,
          waterCapacity: 0,
          locationName: location?.customer_name || 'Unknown',
          asset: null
        };
      }

      const mainAsset = location.assets[0];
      const assetId = mainAsset.asset_guid;

      // Build query for readings
      let query = supabase
        .from('agbot_readings_history')
        .select('*', { count: 'exact' })
        .eq('asset_id', assetId);

      // Date filtering
      if (dateFrom && dateTo) {
        query = query
          .gte('reading_timestamp', dateFrom.toISOString())
          .lte('reading_timestamp', dateTo.toISOString());
      } else if (days) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        query = query.gte('reading_timestamp', fromDate.toISOString());
      }

      // Sorting
      query = query.order('reading_timestamp', { ascending: sortOrder === 'asc' });

      // Limit
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching agbot reading history:', error);
        throw error;
      }

      console.log(`Fetched ${data?.length || 0} readings for location ${locationId} (total: ${count})`);

      const readings = (data || []).map((reading: any): AgbotHistoricalReading => ({
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
        created_at: reading.created_at,
      }));

      return {
        readings,
        totalCount: count || 0,
        waterCapacity: location.water_capacity || mainAsset?.asset_profile_water_capacity || 0,
        locationName: location.customer_name,
        asset: mainAsset // Include full asset details
      };
    },
    enabled: enabled && !!locationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

// Hook for getting reading statistics
export function useAgbotReadingStats(locationId: string, dateFrom?: Date, dateTo?: Date) {
  const { data: historyData } = useAgbotReadingHistory({
    locationId,
    dateFrom,
    dateTo,
    enabled: !!locationId,
  });

  return useQuery({
    queryKey: ['agbot-reading-stats', locationId, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      const readings = historyData?.readings || [];

      if (readings.length === 0) {
        return {
          count: 0,
          minPercentage: 0,
          maxPercentage: 0,
          avgPercentage: 0,
          minLitres: 0,
          maxLitres: 0,
          avgLitres: 0,
          totalConsumption: 0,
          avgDailyConsumption: 0,
          latest: null,
          oldest: null,
        };
      }

      const percentages = readings.map(r => r.calibrated_fill_percentage);
      const litres = readings.map(r => r.asset_reported_litres).filter(l => l !== null) as number[];
      const consumptions = readings.map(r => r.daily_consumption).filter(c => c !== null) as number[];

      const sortedByDate = [...readings].sort(
        (a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime()
      );

      return {
        count: readings.length,
        minPercentage: Math.min(...percentages),
        maxPercentage: Math.max(...percentages),
        avgPercentage: percentages.reduce((sum, val) => sum + val, 0) / percentages.length,
        minLitres: litres.length > 0 ? Math.min(...litres) : 0,
        maxLitres: litres.length > 0 ? Math.max(...litres) : 0,
        avgLitres: litres.length > 0 ? litres.reduce((sum, val) => sum + val, 0) / litres.length : 0,
        totalConsumption: consumptions.reduce((sum, val) => sum + val, 0),
        avgDailyConsumption: consumptions.length > 0 ? consumptions.reduce((sum, val) => sum + val, 0) / consumptions.length : 0,
        latest: sortedByDate[sortedByDate.length - 1],
        oldest: sortedByDate[0],
      };
    },
    enabled: !!historyData && historyData.readings.length > 0,
  });
}
