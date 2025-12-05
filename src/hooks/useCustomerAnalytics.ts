import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Customer Analytics Hooks
 * Provides consumption history, device health, and analytics data
 */

export interface ConsumptionReading {
  asset_id: string;
  level_percent: number | null;
  reading_at: string;
  is_online: boolean;
  tank_id: string;
  tank_name: string;
  tank_address: string;
}

export interface ConsumptionStats {
  total_readings: number;
  avg_level: number;
  min_level: number;
  max_level: number;
  current_level: number | null;
  level_change: number;
  avg_daily_consumption: number;
  date_range: {
    start: string;
    end: string;
  };
}

export interface ConsumptionHistoryResponse {
  readings: ConsumptionReading[];
  stats: ConsumptionStats | null;
}

/**
 * Hook to get consumption history for a specific tank or all tanks
 */
export function useConsumptionHistory(
  tankId?: string,
  days: number = 7,
  includeStats: boolean = true
) {
  return useQuery<ConsumptionHistoryResponse>({
    queryKey: ['consumption-history', tankId, days, includeStats],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const params = new URLSearchParams({
        days: days.toString(),
        includeStats: includeStats.toString(),
      });

      if (tankId) {
        params.append('tankId', tankId);
      }

      const response = await fetch(`/api/customer/consumption-history?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch consumption history');
      }

      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to get 7-day consumption for all tanks (fleet view)
 */
export function useFleetConsumption(days: number = 7) {
  return useConsumptionHistory(undefined, days, true);
}

/**
 * Hook to get consumption statistics for a specific tank
 */
export function useConsumptionStats(tankId: string, days: number = 30) {
  const { data } = useConsumptionHistory(tankId, days, true);
  return {
    stats: data?.stats || null,
    isLoading: !data,
  };
}

/**
 * Hook to get device health for all customer tanks
 */
export function useFleetHealth() {
  return useQuery({
    queryKey: ['fleet-health'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Get customer account
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { data: customerAccount } = await supabase
        .from('customer_accounts')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!customerAccount) throw new Error('Customer account not found');

      // Get tank access
      const { data: tankAccess } = await supabase
        .from('customer_tank_access')
        .select('agbot_location_id')
        .eq('customer_account_id', customerAccount.id);

      if (!tankAccess || tankAccess.length === 0) {
        return [];
      }

      const tankIds = tankAccess.map(access => access.agbot_location_id);

      // Get tank locations with assets
      const { data: tanks, error: tanksError } = await supabase
        .from('ta_agbot_locations')
        .select(`
          id,
          name,
          address,
          calibrated_fill_level,
          last_telemetry_epoch,
          ta_agbot_assets (
            id,
            serial_number,
            is_online,
            battery_voltage,
            signal_strength,
            last_reading_at
          )
        `)
        .in('id', tankIds);

      if (tanksError) throw tanksError;

      // Get latest readings for each asset
      const assetIds = tanks
        .map(tank => {
          const assets = Array.isArray(tank.ta_agbot_assets) ? tank.ta_agbot_assets : [];
          return assets[0]?.id;
        })
        .filter(Boolean);

      const { data: latestReadings } = await supabase
        .from('ta_agbot_readings')
        .select('asset_id, reading_at, is_online, battery_voltage, signal_strength, temperature_c')
        .in('asset_id', assetIds)
        .order('reading_at', { ascending: false });

      // Get reading frequency (count readings in last 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentReadings } = await supabase
        .from('ta_agbot_readings')
        .select('asset_id, reading_at')
        .in('asset_id', assetIds)
        .gte('reading_at', oneDayAgo);

      // Build health data
      return tanks.map(tank => {
        const assets = Array.isArray(tank.ta_agbot_assets) ? tank.ta_agbot_assets : [];
        const asset = assets[0];
        const latestReading = latestReadings?.find(r => r.asset_id === asset?.id);

        const lastReadingTime = latestReading?.reading_at || tank.last_telemetry_epoch
          ? new Date(latestReading?.reading_at || tank.last_telemetry_epoch! * 1000)
          : null;

        const hourssinceLastReading = lastReadingTime
          ? (Date.now() - lastReadingTime.getTime()) / (1000 * 60 * 60)
          : null;

        // Calculate reading frequency
        const readingCount = recentReadings?.filter(r => r.asset_id === asset?.id).length || 0;
        const readingsPerHour = readingCount > 0 ? readingCount / 24 : 0;

        return {
          tank_id: tank.id,
          tank_name: tank.name,
          tank_address: tank.address,
          asset_id: asset?.id,
          asset_serial: asset?.serial_number,
          is_online: asset?.is_online || false,
          battery_voltage: latestReading?.battery_voltage || null,
          temperature_c: latestReading?.temperature_c || null,
          signal_strength: latestReading?.signal_strength || null,
          last_reading_at: lastReadingTime?.toISOString() || null,
          hours_since_reading: hourssinceLastReading,
          reading_frequency: readingsPerHour,
          health_status: getHealthStatus(
            asset?.is_online || false,
            hourssinceLastReading,
            latestReading?.battery_voltage
          ),
          current_level: tank.calibrated_fill_level,
        };
      });
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Hook to get device health for a specific tank
 */
export function useDeviceHealth(tankId: string | undefined) {
  const { data: fleetHealth, isLoading } = useFleetHealth();

  return {
    data: fleetHealth?.find(h => h.tank_id === tankId) || null,
    isLoading,
  };
}

/**
 * Determine overall health status based on metrics
 */
function getHealthStatus(
  isOnline: boolean,
  hoursSinceReading: number | null,
  batteryVoltage: number | null
): 'good' | 'warning' | 'critical' | 'offline' {
  if (!isOnline) return 'offline';

  // Critical if no reading in > 25 hours (should report hourly)
  if (hoursSinceReading !== null && hoursSinceReading > 25) {
    return 'critical';
  }

  // Warning if battery is low
  if (batteryVoltage !== null && batteryVoltage < 3.0) {
    return 'warning';
  }

  // Warning if reading is > 2 hours old
  if (hoursSinceReading !== null && hoursSinceReading > 2) {
    return 'warning';
  }

  return 'good';
}

/**
 * Hook to get consumption chart data formatted for Recharts
 */
export function useConsumptionChartData(tankId?: string, days: number = 7) {
  const { data, isLoading } = useConsumptionHistory(tankId, days, false);

  const chartData = (data?.readings || []).map(reading => ({
    date: new Date(reading.reading_at).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
    }),
    fullDate: reading.reading_at,
    level: reading.level_percent,
    tankName: reading.tank_name,
    isOnline: reading.is_online,
  }));

  return {
    data: chartData,
    isLoading,
  };
}

/**
 * Hook to get aggregate fleet consumption (average level across all tanks)
 */
export function useFleetConsumptionChart(days: number = 7) {
  const { data, isLoading } = useFleetConsumption(days);

  if (!data?.readings || data.readings.length === 0) {
    return { data: [], isLoading };
  }

  // Group readings by date and calculate average level
  const readingsByDate = data.readings.reduce((acc, reading) => {
    const date = new Date(reading.reading_at).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
    });

    if (!acc[date]) {
      acc[date] = {
        date,
        fullDate: reading.reading_at,
        levels: [],
      };
    }

    if (reading.level_percent !== null) {
      acc[date].levels.push(reading.level_percent);
    }

    return acc;
  }, {} as Record<string, { date: string; fullDate: string; levels: number[] }>);

  const chartData = Object.values(readingsByDate)
    .map(entry => ({
      date: entry.date,
      fullDate: entry.fullDate,
      avgLevel: entry.levels.length > 0
        ? entry.levels.reduce((sum, level) => sum + level, 0) / entry.levels.length
        : null,
      tankCount: entry.levels.length,
    }))
    .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());

  return {
    data: chartData,
    isLoading,
  };
}

/**
 * Interface for last refill data
 */
export interface LastRefillData {
  daysSinceRefill: number;
  lastRefillDate: string;
  refillVolume: number;
  daysAgo: number;
}

/**
 * Hook to get last refill information for a tank asset
 * Detects refill by finding significant level increases (> 500L or > 20%)
 */
export function useLastRefill(assetId: string | undefined) {
  return useQuery<LastRefillData | null>({
    queryKey: ['last-refill', assetId],
    queryFn: async () => {
      if (!assetId) return null;

      const { data, error } = await supabase.rpc('get_last_refill', {
        p_asset_id: assetId
      });

      if (error) {
        // If RPC doesn't exist, fall back to client-side calculation
        console.warn('get_last_refill RPC not found, using fallback');

        // Get readings for last 90 days
        const { data: readings, error: readingsError } = await supabase
          .from('ta_agbot_readings')
          .select('reading_at, level_liters, level_percent')
          .eq('asset_id', assetId)
          .gte('reading_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
          .order('reading_at', { ascending: false });

        if (readingsError || !readings || readings.length < 2) {
          return null;
        }

        // Find most recent significant level increase
        for (let i = 0; i < readings.length - 1; i++) {
          const current = readings[i];
          const previous = readings[i + 1];

          if (!current.level_liters || !previous.level_liters) continue;

          const levelIncrease = current.level_liters - previous.level_liters;
          const percentIncrease = current.level_percent && previous.level_percent
            ? current.level_percent - previous.level_percent
            : 0;

          // Detect refill: increase > 500L or > 20%
          if (levelIncrease > 500 || percentIncrease > 20) {
            const refillDate = new Date(current.reading_at);
            const daysAgo = Math.floor((Date.now() - refillDate.getTime()) / (1000 * 60 * 60 * 24));

            return {
              daysSinceRefill: daysAgo,
              lastRefillDate: current.reading_at,
              refillVolume: Math.round(levelIncrease),
              daysAgo,
            };
          }
        }

        return null;
      }

      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!assetId,
  });
}

/**
 * Interface for readings with consumption data
 */
export interface ReadingWithConsumption {
  reading_at: string;
  level_liters: number | null;
  level_percent: number | null;
  daily_consumption: number | null;
  is_refill: boolean;
  is_online: boolean;
  temperature_c: number | null;
  battery_voltage: number | null;
}

/**
 * Hook to get tank readings enriched with consumption calculations
 * Automatically detects refills and calculates consumption between readings
 */
export function useTankReadingsWithConsumption(
  assetId: string | undefined,
  days: number = 7
) {
  return useQuery<ReadingWithConsumption[]>({
    queryKey: ['tank-readings-consumption', assetId, days],
    queryFn: async () => {
      if (!assetId) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: readings, error } = await supabase
        .from('ta_agbot_readings')
        .select('reading_at, level_liters, level_percent, is_online, temperature_c, battery_voltage')
        .eq('asset_id', assetId)
        .gte('reading_at', startDate.toISOString())
        .order('reading_at', { ascending: true });

      if (error) throw error;
      if (!readings || readings.length === 0) return [];

      // Enrich readings with consumption calculations
      return readings.map((reading, index) => {
        if (index === 0) {
          return {
            ...reading,
            daily_consumption: null,
            is_refill: false,
          };
        }

        const prevReading = readings[index - 1];
        const levelChange = reading.level_liters && prevReading.level_liters
          ? reading.level_liters - prevReading.level_liters
          : null;

        // Detect refill (significant increase)
        const isRefill = levelChange !== null && levelChange > 500;

        // Calculate consumption (only if not a refill and level decreased)
        let dailyConsumption: number | null = null;
        if (!isRefill && levelChange !== null && levelChange < 0) {
          const hoursDiff = (new Date(reading.reading_at).getTime() - new Date(prevReading.reading_at).getTime()) / (1000 * 60 * 60);
          if (hoursDiff > 0) {
            dailyConsumption = Math.abs(levelChange) * (24 / hoursDiff);
          }
        }

        return {
          ...reading,
          daily_consumption: dailyConsumption,
          is_refill: isRefill,
        };
      });
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!assetId,
  });
}
