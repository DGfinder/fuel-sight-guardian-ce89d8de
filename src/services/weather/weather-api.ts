import { WeatherForecast } from './types';

export class WeatherAPI {
  private baseUrl = 'https://api.open-meteo.com/v1';

  async getForecast(lat: number, lng: number, days: number = 16): Promise<WeatherForecast> {
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
