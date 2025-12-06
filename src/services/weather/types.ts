export interface WeatherForecast {
  latitude: number;
  longitude: number;
  timezone: string;
  daily: DailyWeather;
  hourly: HourlyWeather;
}

export interface DailyWeather {
  time: string[]; // ISO dates
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  rain_sum: number[];
  windspeed_10m_max: number[];
  winddirection_10m_dominant: number[];
}

export interface HourlyWeather {
  time: string[];
  temperature_2m: number[];
  precipitation: number[];
  rain: number[];
  windspeed_10m: number[];
}

export interface WeatherAlert {
  type: 'road_risk' | 'harvest_window' | 'spray_window' | 'seeding_window';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  actionRequired: string;
  validFrom: Date;
  validUntil: Date;
}
