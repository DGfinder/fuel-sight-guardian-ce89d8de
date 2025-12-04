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

      // First get the location with its assets
      // OPTIMIZED: Only fetch columns that are actually used
      const { data: location, error: locationError } = await supabase
        .from('ta_agbot_locations')
        .select(`
          id,
          customer_name,
          assets:ta_agbot_assets(
            id,
            capacity_liters
          )
        `)
        .eq('id', locationId)
        .single();

      if (locationError) {
        console.error('Error fetching agbot location:', locationError);
        throw locationError;
      }

      if (!location || !location.assets || location.assets.length === 0) {
        return {
          readings: [],
          totalCount: 0,
          waterCapacity: 0,
          locationName: location?.customer_name || 'Unknown',
          asset: null
        };
      }

      const mainAsset = location.assets[0];
      const assetId = mainAsset.id;

      // Build query for readings
      // OPTIMIZED: Only select columns that are mapped to interface
      let query = supabase
        .from('ta_agbot_readings')
        .select(`
          id,
          asset_id,
          level_percent,
          raw_percent,
          reading_at,
          is_online,
          level_liters,
          daily_consumption,
          days_remaining,
          depth_m,
          pressure_bar,
          battery_voltage,
          temperature_c,
          device_state,
          created_at
        `, { count: 'exact' })
        .eq('asset_id', assetId);

      // Date filtering
      if (dateFrom && dateTo) {
        query = query
          .gte('reading_at', dateFrom.toISOString())
          .lte('reading_at', dateTo.toISOString());
      } else if (days) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        query = query.gte('reading_at', fromDate.toISOString());
      }

      // Sorting
      query = query.order('reading_at', { ascending: sortOrder === 'asc' });

      // Limit
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      const readings = (data || []).map((reading: any): AgbotHistoricalReading => ({
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
        created_at: reading.created_at,
      }));

      return {
        readings,
        totalCount: count || 0,
        waterCapacity: mainAsset?.capacity_liters || 0,
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
