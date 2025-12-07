import { motion } from 'framer-motion';
import { useWeatherForecast } from '@/hooks/useWeatherForecast';
import { CloudRain, Sun, AlertTriangle, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion-variants';

interface WeatherStripProps {
  lat: number;
  lng: number;
  context?: 'delivery' | 'general';
  className?: string;
}

/**
 * Compact weather strip for secondary pages
 * Shows 3-day forecast with delivery-relevant alerts
 */
export function WeatherStrip({ lat, lng, context = 'general', className }: WeatherStripProps) {
  const { data: weather, isLoading } = useWeatherForecast(lat, lng, 3);

  if (isLoading || !weather) {
    return null; // Don't show loading state for compact component
  }

  const next3Days = weather.daily.time.slice(0, 3).map((date, i) => ({
    date: new Date(date),
    rain: weather.daily.rain_sum[i],
    tempMax: weather.daily.temperature_2m_max[i],
  }));

  const totalRain = next3Days.reduce((sum, day) => sum + day.rain, 0);
  const hasRainRisk = totalRain >= 20; // 20mm+ could affect unsealed roads
  const hasSevereRain = totalRain >= 40; // 40mm+ likely road closures

  // Delivery context messaging
  const getDeliveryMessage = () => {
    if (hasSevereRain) {
      return { text: 'Road closure risk - order now', type: 'warning' as const };
    }
    if (hasRainRisk) {
      return { text: 'Rain forecast - plan ahead', type: 'info' as const };
    }
    return { text: 'Good delivery conditions', type: 'success' as const };
  };

  const deliveryInfo = context === 'delivery' ? getDeliveryMessage() : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.gentle}
      className={cn(
        'flex items-center gap-4 px-4 py-2 rounded-lg text-sm',
        hasSevereRain
          ? 'bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
          : hasRainRisk
          ? 'bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
          : 'bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700',
        className
      )}
    >
      {/* Weather icon */}
      {hasSevereRain ? (
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
      ) : hasRainRisk ? (
        <CloudRain className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
      ) : (
        <Sun className="h-4 w-4 text-yellow-500 flex-shrink-0" />
      )}

      {/* 3-day summary */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {next3Days.map((day, i) => (
          <div key={i} className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 dark:text-gray-400">
              {i === 0 ? 'Today' : i === 1 ? 'Tom' : day.date.toLocaleDateString('en-AU', { weekday: 'short' })}
            </span>
            {day.rain > 0 ? (
              <span className="text-blue-600 dark:text-blue-400 font-medium">{day.rain.toFixed(0)}mm</span>
            ) : (
              <span className="text-gray-400">{day.tempMax.toFixed(0)}°</span>
            )}
          </div>
        ))}
      </div>

      {/* Delivery context message */}
      {deliveryInfo && (
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-medium',
          deliveryInfo.type === 'warning' && 'text-amber-700 dark:text-amber-400',
          deliveryInfo.type === 'info' && 'text-blue-700 dark:text-blue-400',
          deliveryInfo.type === 'success' && 'text-green-700 dark:text-green-400'
        )}>
          <Truck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{deliveryInfo.text}</span>
        </div>
      )}
    </motion.div>
  );
}
