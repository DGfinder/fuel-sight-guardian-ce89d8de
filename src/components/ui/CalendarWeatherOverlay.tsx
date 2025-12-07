import { motion } from 'framer-motion';
import { useWeatherForecast } from '@/hooks/useWeatherForecast';
import { CloudRain, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion-variants';
import { format, isSameDay, isWithinInterval, addDays } from 'date-fns';

interface RefillDate {
  date: Date;
  tankName: string;
  tankId: string;
}

interface CalendarWeatherOverlayProps {
  lat: number;
  lng: number;
  refillDates: RefillDate[];
  className?: string;
}

interface WeatherRisk {
  date: Date;
  rain: number;
  riskLevel: 'high' | 'medium' | 'low';
  message: string;
}

/**
 * Weather overlay for refill calendar
 * Shows weather conditions on predicted refill dates
 */
export function CalendarWeatherOverlay({ lat, lng, refillDates, className }: CalendarWeatherOverlayProps) {
  const { data: weather, isLoading } = useWeatherForecast(lat, lng, 14);

  if (isLoading || !weather || refillDates.length === 0) {
    return null;
  }

  // Map weather to refill dates within 14-day forecast
  const weatherRisks: WeatherRisk[] = [];
  const forecastEnd = addDays(new Date(), 14);

  refillDates.forEach(refill => {
    if (!isWithinInterval(refill.date, { start: new Date(), end: forecastEnd })) {
      return;
    }

    // Find matching forecast day
    const forecastIdx = weather.daily.time.findIndex(d =>
      isSameDay(new Date(d), refill.date)
    );

    if (forecastIdx >= 0) {
      const rain = weather.daily.rain_sum[forecastIdx];
      let riskLevel: 'high' | 'medium' | 'low' = 'low';
      let message = 'Clear conditions';

      if (rain >= 40) {
        riskLevel = 'high';
        message = `${rain.toFixed(0)}mm rain - road closure risk`;
      } else if (rain >= 20) {
        riskLevel = 'medium';
        message = `${rain.toFixed(0)}mm rain - plan ahead`;
      } else if (rain > 0) {
        message = `Light rain (${rain.toFixed(0)}mm)`;
      }

      weatherRisks.push({
        date: refill.date,
        rain,
        riskLevel,
        message,
      });
    }
  });

  const highRiskCount = weatherRisks.filter(r => r.riskLevel === 'high').length;
  const mediumRiskCount = weatherRisks.filter(r => r.riskLevel === 'medium').length;

  if (weatherRisks.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.gentle}
      className={cn(
        'rounded-lg border p-4',
        highRiskCount > 0
          ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
          : mediumRiskCount > 0
          ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
          : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {highRiskCount > 0 ? (
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        ) : mediumRiskCount > 0 ? (
          <CloudRain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        ) : (
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        )}
        <span className={cn(
          'text-sm font-medium',
          highRiskCount > 0 && 'text-amber-800 dark:text-amber-200',
          mediumRiskCount > 0 && !highRiskCount && 'text-blue-800 dark:text-blue-200',
          !highRiskCount && !mediumRiskCount && 'text-green-800 dark:text-green-200'
        )}>
          {highRiskCount > 0
            ? `${highRiskCount} refill${highRiskCount > 1 ? 's' : ''} at risk`
            : mediumRiskCount > 0
            ? 'Weather advisory'
            : 'Clear forecast for refills'}
        </span>
      </div>

      {/* Risk dates */}
      <div className="space-y-2">
        {weatherRisks
          .filter(r => r.riskLevel !== 'low')
          .slice(0, 5)
          .map((risk, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center justify-between text-xs p-2 rounded',
                risk.riskLevel === 'high'
                  ? 'bg-amber-100 dark:bg-amber-900/30'
                  : 'bg-blue-100 dark:bg-blue-900/30'
              )}
            >
              <span className="font-medium">
                {format(risk.date, 'EEE, MMM d')}
              </span>
              <span className={cn(
                risk.riskLevel === 'high'
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-blue-700 dark:text-blue-300'
              )}>
                {risk.message}
              </span>
            </div>
          ))}
      </div>

      {/* Recommendation */}
      {highRiskCount > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
          Consider ordering before weather impacts road access
        </p>
      )}
    </motion.div>
  );
}
