import { useWeatherForecast } from '@/hooks/useWeatherForecast';
import { Sun, CloudRain, Cloud, Droplets } from 'lucide-react';
import { format } from 'date-fns';

interface PopupWeatherSectionProps {
  lat?: number;
  lng?: number;
}

export function PopupWeatherSection({ lat, lng }: PopupWeatherSectionProps) {
  const { data: weather, isLoading } = useWeatherForecast(lat, lng, 7);

  // Don't render if no coordinates
  if (!lat || !lng) return null;

  if (isLoading) {
    return (
      <div className="border-t border-gray-100 pt-2 mt-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="animate-pulse bg-gray-200 h-4 w-20 rounded" />
        </div>
      </div>
    );
  }

  if (!weather) return null;

  // Get current hour's temperature from hourly data
  const now = new Date();
  const currentHourIndex = weather.hourly?.time?.findIndex((t: string) => {
    const hourTime = new Date(t);
    return hourTime.getHours() === now.getHours() &&
           hourTime.getDate() === now.getDate();
  }) ?? 0;

  const currentTemp = weather.hourly?.temperature_2m?.[currentHourIndex]
    ?? weather.daily?.temperature_2m_max?.[0];

  const todayRain = weather.daily?.rain_sum?.[0] ?? 0;
  const todayMax = weather.daily?.temperature_2m_max?.[0];
  const todayMin = weather.daily?.temperature_2m_min?.[0];

  // Get weather condition
  const getCondition = () => {
    if (todayRain > 5) return { icon: CloudRain, label: 'Rain', color: 'text-blue-500' };
    if (todayRain > 0) return { icon: Cloud, label: 'Cloudy', color: 'text-gray-400' };
    const hour = now.getHours();
    if (hour >= 18 || hour < 6) return { icon: Sun, label: 'Clear', color: 'text-yellow-400' };
    return { icon: Sun, label: 'Sunny', color: 'text-yellow-500' };
  };

  const condition = getCondition();

  // Mini 7-day forecast icons
  const next7Days = weather.daily?.time?.slice(0, 7).map((date: string, i: number) => ({
    day: i === 0 ? 'T' : format(new Date(date), 'EEEEE'),
    rain: weather.daily?.rain_sum?.[i] ?? 0,
  })) ?? [];

  return (
    <div className="border-t border-gray-100 pt-2 mt-2 space-y-2">
      {/* Current Weather Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <condition.icon className={`h-5 w-5 ${condition.color}`} />
          <div>
            <span className="text-lg font-semibold">{currentTemp?.toFixed(0)}°C</span>
            <span className="text-xs text-gray-500 ml-1">{condition.label}</span>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>{todayMin?.toFixed(0)}° - {todayMax?.toFixed(0)}°</div>
          {todayRain > 0 && (
            <div className="flex items-center justify-end gap-1 text-blue-500">
              <Droplets className="h-3 w-3" />
              {todayRain.toFixed(0)}mm
            </div>
          )}
        </div>
      </div>

      {/* 7-Day Mini Forecast */}
      <div className="flex items-center gap-0.5">
        {next7Days.map((day, i) => (
          <div
            key={i}
            className="flex-1 text-center"
            title={`${day.day}: ${day.rain > 0 ? day.rain.toFixed(0) + 'mm rain' : 'No rain'}`}
          >
            {day.rain > 0 ? (
              <Droplets className="h-3 w-3 mx-auto text-blue-400" />
            ) : (
              <Sun className="h-3 w-3 mx-auto text-yellow-400" />
            )}
            <div className="text-[9px] text-gray-400 mt-0.5">{day.day}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
