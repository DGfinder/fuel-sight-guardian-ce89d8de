import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HistoricalWeatherRecord {
  date: string;
  temperature_min: number | null;
  temperature_max: number | null;
  temperature_mean: number | null;
  precipitation_sum: number | null;
  precipitation_hours: number | null;
  wind_speed_max: number | null;
  wind_gusts_max: number | null;
  weather_code: number | null;
  location_name: string | null;
}

export interface WeatherHistoryOptions {
  latitude: number;
  longitude: number;
  startDate?: string; // ISO date string YYYY-MM-DD
  endDate?: string;   // ISO date string YYYY-MM-DD
  days?: number;      // Alternative to startDate/endDate - fetch last N days
}

/**
 * Hook to fetch historical weather data from the database
 * Uses stored data from weather_history table (populated by fetch-weather-data edge function)
 *
 * @param options - Query options including coordinates and date range
 * @returns Historical weather records for the location
 */
export function useWeatherHistory(options?: WeatherHistoryOptions) {
  const { latitude, longitude, startDate, endDate, days = 30 } = options || {};

  return useQuery<HistoricalWeatherRecord[]>({
    queryKey: ['weather-history', latitude, longitude, startDate, endDate, days],
    queryFn: async () => {
      if (!latitude || !longitude) {
        return [];
      }

      // Round coordinates to 2 decimal places to match stored data
      const roundedLat = Math.round(latitude * 100) / 100;
      const roundedLng = Math.round(longitude * 100) / 100;

      // Calculate date range
      let queryStartDate: string;
      let queryEndDate: string;

      if (startDate && endDate) {
        queryStartDate = startDate;
        queryEndDate = endDate;
      } else {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        queryStartDate = start.toISOString().split('T')[0];
        queryEndDate = end.toISOString().split('T')[0];
      }

      // Query weather data - use a small tolerance for coordinate matching
      const latMin = roundedLat - 0.01;
      const latMax = roundedLat + 0.01;
      const lngMin = roundedLng - 0.01;
      const lngMax = roundedLng + 0.01;

      const { data, error } = await supabase
        .from('weather_history')
        .select('date, temperature_min, temperature_max, temperature_mean, precipitation_sum, precipitation_hours, wind_speed_max, wind_gusts_max, weather_code, location_name')
        .gte('latitude', latMin)
        .lte('latitude', latMax)
        .gte('longitude', lngMin)
        .lte('longitude', lngMax)
        .gte('date', queryStartDate)
        .lte('date', queryEndDate)
        .order('date', { ascending: true });

      if (error) {
        console.error('Weather history query error:', error);
        throw error;
      }

      return (data || []).map(record => ({
        date: record.date,
        temperature_min: record.temperature_min ? Number(record.temperature_min) : null,
        temperature_max: record.temperature_max ? Number(record.temperature_max) : null,
        temperature_mean: record.temperature_mean ? Number(record.temperature_mean) : null,
        precipitation_sum: record.precipitation_sum ? Number(record.precipitation_sum) : null,
        precipitation_hours: record.precipitation_hours ? Number(record.precipitation_hours) : null,
        wind_speed_max: record.wind_speed_max ? Number(record.wind_speed_max) : null,
        wind_gusts_max: record.wind_gusts_max ? Number(record.wind_gusts_max) : null,
        weather_code: record.weather_code ? Number(record.weather_code) : null,
        location_name: record.location_name,
      }));
    },
    enabled: !!latitude && !!longitude,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - historical data doesn't change
    gcTime: 1000 * 60 * 60 * 48, // 48 hours cache
  });
}

/**
 * Hook to fetch weather correlation statistics for consumption analysis
 * Returns aggregated weather data grouped by week/month for trend analysis
 */
export function useWeatherCorrelation(options?: WeatherHistoryOptions) {
  const { data: weatherHistory, isLoading, error } = useWeatherHistory(options);

  // Calculate weekly aggregates for correlation analysis
  const weeklyAggregates = weatherHistory?.reduce((acc, record) => {
    const date = new Date(record.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!acc[weekKey]) {
      acc[weekKey] = {
        week: weekKey,
        avgTempMin: 0,
        avgTempMax: 0,
        totalRainfall: 0,
        rainyDays: 0,
        count: 0,
      };
    }

    acc[weekKey].avgTempMin += record.temperature_min || 0;
    acc[weekKey].avgTempMax += record.temperature_max || 0;
    acc[weekKey].totalRainfall += record.precipitation_sum || 0;
    if ((record.precipitation_sum || 0) > 0.1) {
      acc[weekKey].rainyDays += 1;
    }
    acc[weekKey].count += 1;

    return acc;
  }, {} as Record<string, { week: string; avgTempMin: number; avgTempMax: number; totalRainfall: number; rainyDays: number; count: number }>);

  const weeklyData = Object.values(weeklyAggregates || {}).map(week => ({
    week: week.week,
    avgTempMin: week.count > 0 ? week.avgTempMin / week.count : null,
    avgTempMax: week.count > 0 ? week.avgTempMax / week.count : null,
    totalRainfall: week.totalRainfall,
    rainyDays: week.rainyDays,
  })).sort((a, b) => a.week.localeCompare(b.week));

  return {
    weeklyData,
    rawData: weatherHistory,
    isLoading,
    error,
  };
}

/**
 * Hook to get rainfall totals for road closure risk assessment
 */
export function useRainfallHistory(options?: WeatherHistoryOptions) {
  const { data: weatherHistory, isLoading, error } = useWeatherHistory({
    ...options,
    days: options?.days || 7, // Default to last 7 days for road risk
  });

  // Calculate rolling rainfall totals
  const rainfallTotals = {
    last24h: 0,
    last48h: 0,
    last7d: 0,
    recentRainEvents: [] as { date: string; amount: number }[],
  };

  if (weatherHistory && weatherHistory.length > 0) {
    const now = new Date();

    weatherHistory.forEach(record => {
      const recordDate = new Date(record.date);
      const daysDiff = Math.floor((now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
      const rainfall = record.precipitation_sum || 0;

      if (daysDiff <= 1) rainfallTotals.last24h += rainfall;
      if (daysDiff <= 2) rainfallTotals.last48h += rainfall;
      if (daysDiff <= 7) rainfallTotals.last7d += rainfall;

      if (rainfall > 1) {
        rainfallTotals.recentRainEvents.push({
          date: record.date,
          amount: rainfall,
        });
      }
    });
  }

  return {
    ...rainfallTotals,
    rawData: weatherHistory,
    isLoading,
    error,
  };
}
