import { WeatherForecast, DailyWeather, HourlyWeather } from './types';
import { getBOMForecast } from './bom-api';
import { isInAustralia } from './geohash';

export class WeatherAPI {
  private baseUrl = 'https://api.open-meteo.com/v1';

  /**
   * Get weather forecast for a location
   * Uses BOM (Bureau of Meteorology) for Australian locations, Open-Meteo as fallback
   *
   * Hybrid approach for AU:
   * - Days 1-7: BOM data (most accurate for Australia)
   * - Days 8-16: Open-Meteo data (extended range for agricultural planning)
   */
  async getForecast(lat: number, lng: number, days: number = 16): Promise<WeatherForecast> {
    // Try BOM first for Australian coordinates (more accurate for AU)
    if (isInAustralia(lat, lng)) {
      try {
        const bomForecast = await getBOMForecast(lat, lng);
        if (bomForecast) {
          // If requesting more than 7 days, merge BOM (days 1-7) with Open-Meteo (days 8+)
          if (days > 7) {
            console.log('[WeatherAPI] Using hybrid: BOM (days 1-7) + Open-Meteo (days 8-16)');
            const extendedForecast = await this.getOpenMeteoForecast(lat, lng, days);
            return this.mergeForecasts(bomForecast, extendedForecast);
          }

          console.log('[WeatherAPI] Using BOM data for Australian location');
          return bomForecast;
        }
      } catch (error) {
        console.warn('[WeatherAPI] BOM API failed, falling back to Open-Meteo:', error);
      }
    }

    // Fallback to Open-Meteo (or primary for non-AU locations)
    return this.getOpenMeteoForecast(lat, lng, days);
  }

  /**
   * Merge BOM forecast (days 1-7) with Open-Meteo forecast (days 8+)
   * BOM data is more accurate for Australia, Open-Meteo provides extended range
   */
  private mergeForecasts(bom: WeatherForecast, openMeteo: WeatherForecast): WeatherForecast {
    const bomDays = bom.daily.time.length;

    // Merge daily data: BOM for first 7 days, Open-Meteo for remainder
    const mergedDaily: DailyWeather = {
      time: [...bom.daily.time, ...openMeteo.daily.time.slice(bomDays)],
      temperature_2m_max: [...bom.daily.temperature_2m_max, ...openMeteo.daily.temperature_2m_max.slice(bomDays)],
      temperature_2m_min: [...bom.daily.temperature_2m_min, ...openMeteo.daily.temperature_2m_min.slice(bomDays)],
      precipitation_sum: [...bom.daily.precipitation_sum, ...openMeteo.daily.precipitation_sum.slice(bomDays)],
      rain_sum: [...bom.daily.rain_sum, ...openMeteo.daily.rain_sum.slice(bomDays)],
      windspeed_10m_max: [...bom.daily.windspeed_10m_max, ...openMeteo.daily.windspeed_10m_max.slice(bomDays)],
      winddirection_10m_dominant: [...bom.daily.winddirection_10m_dominant, ...openMeteo.daily.winddirection_10m_dominant.slice(bomDays)],
    };

    // For hourly data, calculate hours for BOM days then append Open-Meteo
    const bomHours = bom.hourly.time.length;
    const mergedHourly: HourlyWeather = {
      time: [...bom.hourly.time, ...openMeteo.hourly.time.slice(bomHours)],
      temperature_2m: [...bom.hourly.temperature_2m, ...openMeteo.hourly.temperature_2m.slice(bomHours)],
      precipitation: [...bom.hourly.precipitation, ...openMeteo.hourly.precipitation.slice(bomHours)],
      rain: [...bom.hourly.rain, ...openMeteo.hourly.rain.slice(bomHours)],
      windspeed_10m: [...bom.hourly.windspeed_10m, ...openMeteo.hourly.windspeed_10m.slice(bomHours)],
    };

    return {
      latitude: bom.latitude,
      longitude: bom.longitude,
      timezone: bom.timezone,
      daily: mergedDaily,
      hourly: mergedHourly,
    };
  }

  /**
   * Get forecast from Open-Meteo API (fallback/non-AU)
   */
  private async getOpenMeteoForecast(lat: number, lng: number, days: number): Promise<WeatherForecast> {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,windspeed_10m_max,winddirection_10m_dominant',
      hourly: 'temperature_2m,precipitation,rain,windspeed_10m',
      forecast_days: days.toString(),
      timezone: 'Australia/Perth',
    });

    const response = await fetch(`${this.baseUrl}/forecast?${params}`);
    if (!response.ok) throw new Error('Weather API request failed');

    return response.json();
  }

  async getSoilMoisture(lat: number, lng: number): Promise<any> {
    // Open-Meteo provides soil moisture as hourly data with specific depth ranges
    // Available depths: 0-1cm, 1-3cm, 3-9cm, 9-27cm, 27-81cm
    // Note: BOM doesn't provide soil moisture data, so we always use Open-Meteo
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      hourly: 'soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm',
      forecast_days: '7',
      timezone: 'Australia/Perth',
    });

    const response = await fetch(`${this.baseUrl}/forecast?${params}`);
    if (!response.ok) throw new Error('Soil moisture request failed');

    return response.json();
  }
}

export const weatherAPI = new WeatherAPI();
