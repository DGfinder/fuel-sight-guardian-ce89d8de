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
        .schema('great_southern_fuels').from('customer_accounts')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!customerAccount) throw new Error('Customer account not found');

      // Get tank access
      const { data: tankAccess } = await supabase
        .schema('great_southern_fuels').from('customer_tank_access')
        .select('agbot_location_id')
        .eq('customer_account_id', customerAccount.id);

      if (!tankAccess || tankAccess.length === 0) {
        return [];
      }

      const tankIds = tankAccess.map(access => access.agbot_location_id);

      // Get tank locations with assets
      const { data: tanks, error: tanksError } = await supabase
        .schema('great_southern_fuels').from('ta_agbot_locations')
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
        .schema('great_southern_fuels').from('ta_agbot_readings')
        .select('asset_id, reading_at, is_online, battery_voltage, signal_strength')
        .in('asset_id', assetIds)
        .order('reading_at', { ascending: false });

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

        return {
          tank_id: tank.id,
          tank_name: tank.name,
          tank_address: tank.address,
          asset_id: asset?.id,
          asset_serial: asset?.serial_number,
          is_online: asset?.is_online || false,
          battery_voltage: latestReading?.battery_voltage || null,
          signal_strength: latestReading?.signal_strength || null,
          last_reading_at: lastReadingTime?.toISOString() || null,
          hours_since_reading: hourssinceLastReading,
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
