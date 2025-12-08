/**
 * Bureau of Meteorology (BOM) Weather API Service
 * Uses the unofficial BOM API at api.weather.bom.gov.au
 *
 * Note: This API powers weather.bom.gov.au and is widely used by
 * Home Assistant, OpenHAB, and other projects despite the terms.
 */

import { WeatherForecast, DailyWeather, HourlyWeather } from './types';
import { encodeGeohash, isInAustralia } from './geohash';

const BOM_API_BASE = 'https://api.weather.bom.gov.au/v1';

// Cache for forecasts (3-hour TTL as BOM updates ~4x/day)
const CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours in ms
const forecastCache = new Map<string, { data: WeatherForecast; timestamp: number }>();

interface BOMForecastDay {
  date: string;
  temp_max: number | null;
  temp_min: number | null;
  icon_descriptor: string;
  short_text: string | null;
  extended_text: string | null;
  rain: {
    chance: number;
    amount: {
      min: number;
      max: number | null;
      units: string;
    };
  };
  fire_danger: string | null;
  uv: {
    max_index: number | null;
  };
}

interface BOMForecastResponse {
  data: BOMForecastDay[];
  metadata: {
    forecast_region: string;
    issue_time: string;
  };
}

interface BOMHourlyForecast {
  time: string;
  temp: number | null;
  rain: {
    amount: { min: number; max: number | null };
    chance: number;
  };
  wind: {
    speed_kilometre: number | null;
    direction: string;
  };
}

interface BOMHourlyResponse {
  data: BOMHourlyForecast[];
}

/**
 * Fetch weather forecast from BOM API
 */
export async function getBOMForecast(lat: number, lng: number): Promise<WeatherForecast | null> {
  // Only use BOM for Australian coordinates
  if (!isInAustralia(lat, lng)) {
    return null;
  }

  const geohash = encodeGeohash(lat, lng, 7);

  // Check cache first
  const cached = forecastCache.get(geohash);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Fetch daily and hourly forecasts in parallel
    const [dailyResponse, hourlyResponse] = await Promise.all([
      fetch(`${BOM_API_BASE}/locations/${geohash}/forecasts/daily`),
      fetch(`${BOM_API_BASE}/locations/${geohash}/forecasts/hourly`).catch(() => null),
    ]);

    if (!dailyResponse.ok) {
      console.warn(`[BOM API] Daily forecast failed for geohash ${geohash}:`, dailyResponse.status);
      return null;
    }

    const dailyData: BOMForecastResponse = await dailyResponse.json();

    // Process hourly data if available
    let hourlyData: BOMHourlyResponse | null = null;
    if (hourlyResponse?.ok) {
      hourlyData = await hourlyResponse.json();
    }

    // Convert BOM response to our standard format
    const forecast = convertBOMToWeatherForecast(lat, lng, dailyData, hourlyData);

    // Cache the result
    forecastCache.set(geohash, {
      data: forecast,
      timestamp: Date.now(),
    });

    console.log(`[BOM API] Forecast loaded for ${dailyData.metadata.forecast_region} (geohash: ${geohash})`);
    return forecast;

  } catch (error) {
    console.error('[BOM API] Error fetching forecast:', error);
    return null;
  }
}

/**
 * Convert BOM API response to our standard WeatherForecast format
 */
function convertBOMToWeatherForecast(
  lat: number,
  lng: number,
  daily: BOMForecastResponse,
  hourly: BOMHourlyResponse | null
): WeatherForecast {
  const days = daily.data;

  // Build daily weather arrays
  const dailyWeather: DailyWeather = {
    time: days.map(d => d.date.split('T')[0]), // Extract date portion
    temperature_2m_max: days.map(d => d.temp_max ?? 0),
    temperature_2m_min: days.map(d => d.temp_min ?? 0),
    precipitation_sum: days.map(d => d.rain.amount.max ?? d.rain.amount.min ?? 0),
    rain_sum: days.map(d => d.rain.amount.max ?? d.rain.amount.min ?? 0),
    windspeed_10m_max: [], // Will be filled from hourly if available
    winddirection_10m_dominant: [],
  };

  // Build hourly weather arrays (or empty if not available)
  let hourlyWeather: HourlyWeather = {
    time: [],
    temperature_2m: [],
    precipitation: [],
    rain: [],
    windspeed_10m: [],
  };

  if (hourly?.data) {
    hourlyWeather = {
      time: hourly.data.map(h => h.time),
      temperature_2m: hourly.data.map(h => h.temp ?? 0),
      precipitation: hourly.data.map(h => h.rain?.amount?.max ?? h.rain?.amount?.min ?? 0),
      rain: hourly.data.map(h => h.rain?.amount?.max ?? h.rain?.amount?.min ?? 0),
      windspeed_10m: hourly.data.map(h => h.wind?.speed_kilometre ?? 0),
    };

    // Calculate daily max wind speed from hourly data
    const dailyWindMax: number[] = [];
    for (const day of dailyWeather.time) {
      const dayHours = hourly.data.filter(h => h.time.startsWith(day));
      const maxWind = Math.max(...dayHours.map(h => h.wind?.speed_kilometre ?? 0), 0);
      dailyWindMax.push(maxWind);
    }
    dailyWeather.windspeed_10m_max = dailyWindMax;
  }

  return {
    latitude: lat,
    longitude: lng,
    timezone: 'Australia/Perth',
    daily: dailyWeather,
    hourly: hourlyWeather,
  };
}

/**
 * Get the forecast region name for a location
 */
export async function getBOMForecastRegion(lat: number, lng: number): Promise<string | null> {
  if (!isInAustralia(lat, lng)) {
    return null;
  }

  const geohash = encodeGeohash(lat, lng, 7);

  try {
    const response = await fetch(`${BOM_API_BASE}/locations/${geohash}/forecasts/daily`);
    if (!response.ok) return null;

    const data: BOMForecastResponse = await response.json();
    return data.metadata.forecast_region;
  } catch {
    return null;
  }
}

/**
 * Search for a location by name
 */
export async function searchBOMLocation(query: string): Promise<{
  geohash: string;
  name: string;
  state: string;
} | null> {
  try {
    const response = await fetch(`${BOM_API_BASE}/locations?search=${encodeURIComponent(query)}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.data || data.data.length === 0) return null;

    const location = data.data[0];
    return {
      geohash: location.geohash,
      name: location.name,
      state: location.state,
    };
  } catch {
    return null;
  }
}

/**
 * Clear the forecast cache
 */
export function clearBOMCache(): void {
  forecastCache.clear();
}

/**
 * Get cache statistics
 */
export function getBOMCacheStats(): { size: number; entries: string[] } {
  return {
    size: forecastCache.size,
    entries: Array.from(forecastCache.keys()),
  };
}
