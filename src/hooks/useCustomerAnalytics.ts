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
 * Uses customer_tanks_unified view for RLS-safe access to all tank sources
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

      // Use unified view for RLS-safe access to all tank types
      const { data: unifiedTanks, error: unifiedError } = await supabase
        .from('customer_tanks_unified')
        .select('*')
        .eq('customer_account_id', customerAccount.id);

      if (unifiedError) {
        console.error('Error fetching unified tanks:', unifiedError);
        // Fall back to empty array if view doesn't exist
        return [];
      }

      if (!unifiedTanks || unifiedTanks.length === 0) {
        return [];
      }

      // Build health data from unified view
      return unifiedTanks.map(tank => {
        const lastReadingTime = tank.last_reading_at
          ? new Date(tank.last_reading_at)
          : null;

        const hoursSinceReading = lastReadingTime
          ? (Date.now() - lastReadingTime.getTime()) / (1000 * 60 * 60)
          : null;

        return {
          tank_id: tank.tank_id || tank.agbot_location_id || tank.smartfill_tank_id,
          tank_name: tank.tank_name || tank.location_name,
          tank_address: tank.address,
          asset_id: tank.agbot_asset_id,
          asset_serial: null, // Not in unified view
          is_online: tank.device_online || false,
          battery_voltage: tank.battery_voltage || null,
          temperature_c: tank.temperature_c || null,
          signal_strength: null, // Not in unified view - could add
          last_reading_at: lastReadingTime?.toISOString() || null,
          hours_since_reading: hoursSinceReading,
          reading_frequency: 0, // Would need separate query
          health_status: getHealthStatus(
            tank.device_online || false,
            hoursSinceReading,
            tank.battery_voltage
          ),
          current_level: tank.current_level_percent,
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
 * Returns both fuel level and daily consumption for the fleet
 */
export function useFleetConsumptionChart(days: number = 7) {
  const { data, isLoading } = useFleetConsumption(days);

  if (!data?.readings || data.readings.length === 0) {
    return { data: [], isLoading };
  }

  // Group readings by date (using ISO date for proper sorting)
  const readingsByDate = data.readings.reduce((acc, reading) => {
    const dateKey = new Date(reading.reading_at).toISOString().split('T')[0];
    const displayDate = new Date(reading.reading_at).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
    });

    if (!acc[dateKey]) {
      acc[dateKey] = {
        dateKey,
        displayDate,
        fullDate: reading.reading_at,
        levels: [],
        tankReadings: [] as { tankId: string; level: number }[],
      };
    }

    if (reading.level_percent !== null) {
      acc[dateKey].levels.push(reading.level_percent);
      acc[dateKey].tankReadings.push({
        tankId: reading.tank_id,
        level: reading.level_percent,
      });
    }

    return acc;
  }, {} as Record<string, {
    dateKey: string;
    displayDate: string;
    fullDate: string;
    levels: number[];
    tankReadings: { tankId: string; level: number }[];
  }>);

  // Sort dates and calculate consumption
  const sortedDates = Object.keys(readingsByDate).sort();

  const chartData = sortedDates.map((dateKey, index) => {
    const entry = readingsByDate[dateKey];
    const avgLevel = entry.levels.length > 0
      ? entry.levels.reduce((sum, level) => sum + level, 0) / entry.levels.length
      : null;

    // Calculate consumption by comparing to previous day
    let consumption: number | null = null;
    if (index > 0 && avgLevel !== null) {
      const prevDateKey = sortedDates[index - 1];
      const prevEntry = readingsByDate[prevDateKey];
      const prevAvgLevel = prevEntry.levels.length > 0
        ? prevEntry.levels.reduce((sum, level) => sum + level, 0) / prevEntry.levels.length
        : null;

      if (prevAvgLevel !== null) {
        const levelDiff = prevAvgLevel - avgLevel;
        // Only show consumption if level decreased (not a refill)
        if (levelDiff > 0) {
          consumption = levelDiff; // This is percentage points drop
        }
      }
    }

    return {
      date: entry.displayDate,
      fullDate: entry.fullDate,
      avgLevel,
      consumption,
      tankCount: entry.levels.length,
    };
  });

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

// Thresholds for consumption calculation (consistent with AgBot & SmartFill)
const NOISE_THRESHOLD = 5; // Ignore changes < 5L (sensor noise)
const REFILL_THRESHOLD = 250; // Increases > 250L = refill (bulk fuel deliveries)

/**
 * Hook to get tank readings enriched with consumption calculations
 * Uses hourly decrease summation: tracks all decreases throughout the day,
 * ignores increases (refills), and sums to get true daily consumption
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

      // Group readings by date (YYYY-MM-DD) to aggregate per day
      const readingsByDate: Record<string, typeof readings> = {};
      readings.forEach(reading => {
        const dateKey = new Date(reading.reading_at).toISOString().split('T')[0];
        if (!readingsByDate[dateKey]) {
          readingsByDate[dateKey] = [];
        }
        readingsByDate[dateKey].push(reading);
      });

      // Calculate daily aggregates using hourly decrease summation
      const sortedDates = Object.keys(readingsByDate).sort();
      const dailyData: ReadingWithConsumption[] = [];

      sortedDates.forEach((dateKey, dateIndex) => {
        const dayReadings = readingsByDate[dateKey];
        const lastReading = dayReadings[dayReadings.length - 1];

        // Sum all decreases throughout the day (hourly decrease summation)
        let dailyConsumption = 0;
        let hadRefill = false;

        // Process readings within the day
        for (let i = 1; i < dayReadings.length; i++) {
          const prev = dayReadings[i - 1];
          const curr = dayReadings[i];

          if (prev.level_liters != null && curr.level_liters != null) {
            const change = curr.level_liters - prev.level_liters;

            if (change < -NOISE_THRESHOLD) {
              // Fuel decreased by more than noise threshold = consumption
              dailyConsumption += Math.abs(change);
            } else if (change > REFILL_THRESHOLD) {
              // Significant increase = refill detected
              hadRefill = true;
            }
            // Small increases or changes within noise threshold = ignore
          }
        }

        // Handle overnight consumption (previous day's last → today's first)
        if (dateIndex > 0) {
          const prevDateKey = sortedDates[dateIndex - 1];
          const prevDayReadings = readingsByDate[prevDateKey];
          const prevDayLast = prevDayReadings[prevDayReadings.length - 1];
          const todayFirst = dayReadings[0];

          if (prevDayLast.level_liters != null && todayFirst.level_liters != null) {
            const overnightChange = todayFirst.level_liters - prevDayLast.level_liters;
            if (overnightChange < -NOISE_THRESHOLD) {
              dailyConsumption += Math.abs(overnightChange);
            } else if (overnightChange > REFILL_THRESHOLD) {
              hadRefill = true;
            }
          }
        }

        dailyData.push({
          reading_at: lastReading.reading_at,
          level_liters: lastReading.level_liters,
          level_percent: lastReading.level_percent,
          is_online: lastReading.is_online,
          temperature_c: lastReading.temperature_c,
          battery_voltage: lastReading.battery_voltage,
          daily_consumption: dailyConsumption > 0 ? Math.round(dailyConsumption) : null,
          is_refill: hadRefill,
        });
      });

      return dailyData;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!assetId,
  });
}
