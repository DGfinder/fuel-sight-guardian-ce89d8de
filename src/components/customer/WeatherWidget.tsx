import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWeatherForecast } from '@/hooks/useWeatherForecast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CloudRain, Sun, Wind, Droplets } from 'lucide-react';
import { format } from 'date-fns';

interface WeatherWidgetProps {
  lat: number;
  lng: number;
  locationName: string;
}

export function WeatherWidget({ lat, lng, locationName }: WeatherWidgetProps) {
  const { data: weather, isLoading } = useWeatherForecast(lat, lng, 7);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (!weather) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-gray-500">Weather data unavailable</p>
        </CardContent>
      </Card>
    );
  }

  // Next 7 days summary
  // Note: Append T12:00:00 to parse date as local noon, avoiding UTC midnight timezone issues
  // (new Date("2025-12-11") parses as UTC midnight = previous day in Perth)
  const next7Days = weather.daily.time.slice(0, 7).map((date, i) => ({
    date: new Date(`${date}T12:00:00`),
    tempMax: weather.daily.temperature_2m_max[i],
    tempMin: weather.daily.temperature_2m_min[i],
    rain: weather.daily.rain_sum[i],
    windMax: weather.daily.windspeed_10m_max[i],
  }));

  const totalRain7Days = next7Days.reduce((sum, day) => sum + day.rain, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sun className="h-5 w-5 text-yellow-500" />
          7-Day Weather Forecast
        </CardTitle>
        <p className="text-sm text-gray-500">{locationName}</p>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <SummaryCard
            icon={<Droplets className="h-4 w-4" />}
            label="Total Rain"
            value={`${totalRain7Days.toFixed(0)}mm`}
            color="blue"
          />
          <SummaryCard
            icon={<Sun className="h-4 w-4" />}
            label="Max Temp"
            value={`${Math.max(...next7Days.map(d => d.tempMax)).toFixed(0)}°C`}
            color="orange"
          />
          <SummaryCard
            icon={<Wind className="h-4 w-4" />}
            label="Max Wind"
            value={`${Math.max(...next7Days.map(d => d.windMax)).toFixed(0)} km/h`}
            color="gray"
          />
        </div>

        {/* Daily forecast */}
        <div className="space-y-2">
          {next7Days.map((day, i) => (
            <DayForecastRow key={i} day={day} isToday={i === 0} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20',
    gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800',
  };

  return (
    <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
      <div className={`inline-flex p-1.5 rounded-lg mb-1 ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-bold mt-0.5">{value}</p>
    </div>
  );
}

function DayForecastRow({ day, isToday }: { day: { date: Date; tempMin: number; tempMax: number; rain: number; windMax: number }; isToday: boolean }) {
  return (
    <div className="flex items-center justify-between p-2 rounded border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
      <div className="flex-1">
        <p className="text-sm font-medium">
          {isToday ? 'Today' : format(day.date, 'EEE, MMM d')}
        </p>
        <p className="text-xs text-gray-500">
          {day.tempMin.toFixed(0)}° - {day.tempMax.toFixed(0)}°C
        </p>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {day.rain > 0 && (
          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <CloudRain className="h-4 w-4" />
            <span>{day.rain.toFixed(0)}mm</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-gray-500">
          <Wind className="h-4 w-4" />
          <span>{day.windMax.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}
