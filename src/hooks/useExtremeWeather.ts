/**
 * Extreme Weather Hook
 *
 * Detects and returns extreme weather events for mining and general customers.
 */

import { useQuery } from '@tanstack/react-query';
import {
  extremeWeatherDetector,
  type ExtremeWeatherEvent,
  type WeatherSeverity,
} from '@/services/weather/extreme-weather';
import { weatherAPI } from '@/services/weather/weather-api';
import { useCustomerFeatures, type IndustryType } from './useCustomerFeatures';

export interface ExtremeWeatherResult {
  events: ExtremeWeatherEvent[];
  hasActiveAlerts: boolean;
  highestSeverity: WeatherSeverity | null;
  nextEventDate: Date | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to detect extreme weather events based on location and industry type
 */
export function useExtremeWeather(
  lat: number | undefined,
  lng: number | undefined,
  industryTypeOverride?: IndustryType
): ExtremeWeatherResult {
  const { industryType: customerIndustryType, extremeWeatherAlerts } = useCustomerFeatures();
  const industryType = industryTypeOverride || customerIndustryType;

  const { data, isLoading, error } = useQuery({
    queryKey: ['extreme-weather', lat, lng, industryType],
    queryFn: async () => {
      if (!lat || !lng) return [];

      const weather = await weatherAPI.getForecast(lat, lng, 16);
      if (!weather) return [];

      return extremeWeatherDetector.detectEvents(weather, industryType, lat, lng);
    },
    enabled: !!lat && !!lng && extremeWeatherAlerts,
    staleTime: 1000 * 60 * 30, // 30 minutes
    refetchInterval: 1000 * 60 * 60, // Refetch every hour
  });

  const events = data || [];
  const hasActiveAlerts = events.length > 0;
  const highestSeverity = extremeWeatherDetector.getHighestSeverity(events);
  const nextEventDate = extremeWeatherDetector.getNextEventDate(events);

  return {
    events,
    hasActiveAlerts,
    highestSeverity,
    nextEventDate,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Filter events by type
 */
export function useExtremeWeatherByType(
  lat: number | undefined,
  lng: number | undefined,
  type: ExtremeWeatherEvent['type']
): ExtremeWeatherEvent[] {
  const { events } = useExtremeWeather(lat, lng);
  return events.filter((e) => e.type === type);
}

/**
 * Get just heat-related events
 */
export function useExtremeHeat(
  lat: number | undefined,
  lng: number | undefined
): { events: ExtremeWeatherEvent[]; isLoading: boolean } {
  const { events, isLoading } = useExtremeWeather(lat, lng);
  return {
    events: events.filter((e) => e.type === 'extreme_heat'),
    isLoading,
  };
}

/**
 * Get just storm/cyclone events
 */
export function useStormEvents(
  lat: number | undefined,
  lng: number | undefined
): { events: ExtremeWeatherEvent[]; isLoading: boolean } {
  const { events, isLoading } = useExtremeWeather(lat, lng);
  return {
    events: events.filter((e) => ['storm', 'cyclone', 'heavy_rain'].includes(e.type)),
    isLoading,
  };
}

export default useExtremeWeather;
