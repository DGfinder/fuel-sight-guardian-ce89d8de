import { WeatherForecast } from './types';
import { getBOMForecast } from './bom-api';
import { isInAustralia } from './geohash';

export class WeatherAPI {
  private baseUrl = 'https://api.open-meteo.com/v1';

  /**
   * Get weather forecast for a location
   * Uses BOM (Bureau of Meteorology) for Australian locations, Open-Meteo as fallback
   */
  async getForecast(lat: number, lng: number, days: number = 16): Promise<WeatherForecast> {
    // Try BOM first for Australian coordinates (more accurate for AU)
    if (isInAustralia(lat, lng)) {
      try {
        const bomForecast = await getBOMForecast(lat, lng);
        if (bomForecast) {
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
