import { useQuery } from '@tanstack/react-query';
import { weatherAPI } from '@/services/weather/weather-api';
import type { WeatherForecast } from '@/services/weather/types';

export function useWeatherForecast(lat?: number, lng?: number, days: number = 16) {
  return useQuery<WeatherForecast>({
    queryKey: ['weather-forecast', lat, lng, days],
    queryFn: () => {
      if (!lat || !lng) throw new Error('Location required');
      return weatherAPI.getForecast(lat, lng, days);
    },
    enabled: !!lat && !!lng,
    staleTime: 1000 * 60 * 60, // 1 hour (weather doesn't change that fast)
    gcTime: 1000 * 60 * 60 * 2, // 2 hours
  });
}

export function useSoilMoisture(lat?: number, lng?: number) {
  return useQuery({
    queryKey: ['soil-moisture', lat, lng],
    queryFn: () => {
      if (!lat || !lng) throw new Error('Location required');
      return weatherAPI.getSoilMoisture(lat, lng);
    },
    enabled: !!lat && !!lng,
    staleTime: 1000 * 60 * 60 * 6, // 6 hours
  });
}
