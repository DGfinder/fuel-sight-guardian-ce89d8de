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
    // Open-Meteo provides soil moisture data
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      daily: 'soil_moisture_0_to_10cm,soil_moisture_10_to_40cm',
      forecast_days: '16',
      timezone: 'Australia/Perth',
    });

    const response = await fetch(`${this.baseUrl}/forecast?${params}`);
    if (!response.ok) throw new Error('Soil moisture request failed');

    return response.json();
  }
}

export const weatherAPI = new WeatherAPI();
