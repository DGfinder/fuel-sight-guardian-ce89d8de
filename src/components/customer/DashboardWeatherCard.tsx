import { motion } from 'framer-motion';
import { useWeatherForecast } from '@/hooks/useWeatherForecast';
import { useAgriculturalIntelligence } from '@/hooks/useAgriculturalIntelligence';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CloudRain, Sun, Wind, Droplets, Cloud, AlertTriangle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { staggerContainerVariants, fadeUpItemVariants, springs } from '@/lib/motion-variants';
import type { RoadProfile } from '@/services/weather/road-risk-calculator';

interface DashboardWeatherCardProps {
  lat: number;
  lng: number;
  locationName: string;
  isFallbackLocation?: boolean;
  tankId?: string;
  tankLevel?: number;
  dailyConsumption?: number;
  capacityLiters?: number;
  roadProfile?: RoadProfile | null;
}

// Weather icon animation variants
const weatherIconVariants = {
  sun: {
    rotate: [0, 360],
    transition: {
      duration: 20,
      repeat: Infinity,
      ease: 'linear',
    },
  },
  rain: {
    y: [0, 3, 0],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  wind: {
    x: [-2, 2, -2],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export function DashboardWeatherCard({
  lat,
  lng,
  locationName,
  isFallbackLocation,
  tankId,
  tankLevel,
  dailyConsumption,
  capacityLiters,
  roadProfile,
}: DashboardWeatherCardProps) {
  const { data: weather, isLoading } = useWeatherForecast(lat, lng, 7);
  const { data: intelligence } = useAgriculturalIntelligence(
    lat,
    lng,
    tankLevel,
    dailyConsumption,
    capacityLiters,
    roadProfile
  );

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-2xl bg-gradient-to-br from-white/40 via-white/30 to-white/20 dark:from-gray-900/40 dark:via-gray-900/30 dark:to-gray-900/20 border border-white/30 dark:border-gray-700/30 shadow-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-2xl bg-gradient-to-br from-white/40 via-white/30 to-white/20 dark:from-gray-900/40 dark:via-gray-900/30 dark:to-gray-900/20 border border-white/30 dark:border-gray-700/30 shadow-2xl p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
          Weather & Operations
        </h3>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Cloud className="h-10 w-10 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">Weather data loading...</p>
          <p className="text-xs text-gray-400 mt-1">Check your connection</p>
        </div>
      </div>
    );
  }

  // Calculate current conditions
  // Get current hour index from hourly data
  const now = new Date();
  const currentHourIndex = weather.hourly?.time?.findIndex((t: string) => {
    const hourTime = new Date(t);
    return hourTime.getHours() === now.getHours() &&
           hourTime.getDate() === now.getDate();
  }) ?? 0;

  // Use hourly data for current temp if available, otherwise fall back to daily
  const currentTemp = weather.hourly?.temperature_2m?.[currentHourIndex]
    ?? weather.daily.temperature_2m_max[0];

  const today = {
    tempCurrent: currentTemp,
    tempMin: weather.daily.temperature_2m_min[0],
    tempMax: weather.daily.temperature_2m_max[0],
    rain: weather.daily.rain_sum[0],
    windMax: weather.daily.windspeed_10m_max[0],
  };

  const getWeatherCondition = () => {
    if (today.rain > 10) return 'Heavy Rain';
    if (today.rain > 5) return 'Light Rain';
    if (today.rain > 0) return 'Cloudy';
    // Show "Clear" at night (after 6pm or before 6am)
    const hour = now.getHours();
    if (hour >= 18 || hour < 6) return 'Clear';
    return 'Sunny';
  };

  // Next 7 days for mini forecast
  const next7Days = weather.daily.time.slice(0, 7).map((date, i) => ({
    date: new Date(date),
    tempMax: weather.daily.temperature_2m_max[i],
    tempMin: weather.daily.temperature_2m_min[i],
    rain: weather.daily.rain_sum[i],
  }));

  const totalRain7Days = next7Days.reduce((sum, day) => sum + day.rain, 0);

  // Get operations intelligence alerts
  const roadRisk = intelligence?.roadRisk;
  const nextOperation = intelligence?.operations?.[0];

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl backdrop-blur-2xl bg-gradient-to-br from-white/40 via-white/30 to-white/20 dark:from-gray-900/40 dark:via-gray-900/30 dark:to-gray-900/20 border border-white/30 dark:border-gray-700/30 shadow-2xl"
      initial="hidden"
      animate="visible"
      variants={staggerContainerVariants}
      whileHover={{ y: -2, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
      transition={springs.gentle}
    >
      {/* Glass gradient border effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-transparent dark:from-gray-700/10 pointer-events-none" />

      {/* Content - Compact layout */}
      <div className="relative z-10 flex flex-col p-4">
        {/* Header with Current Temp */}
        <motion.div variants={fadeUpItemVariants} className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-light tracking-tight tabular-nums">
                {today.tempCurrent.toFixed(0)}
              </span>
              <span className="text-lg font-light text-gray-500">°C</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">{getWeatherCondition()}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {locationName}
              {isFallbackLocation && (
                <span className="text-amber-600 dark:text-amber-400 ml-1">(regional)</span>
              )}
            </p>
          </div>
          <div className="flex-shrink-0">
            {(getWeatherCondition() === 'Sunny' || getWeatherCondition() === 'Clear') && (
              <motion.div animate={weatherIconVariants.sun}>
                <Sun className="h-12 w-12 text-yellow-500" />
              </motion.div>
            )}
            {getWeatherCondition().includes('Rain') && (
              <motion.div animate={weatherIconVariants.rain}>
                <CloudRain className="h-12 w-12 text-blue-500" />
              </motion.div>
            )}
            {getWeatherCondition() === 'Cloudy' && (
              <Cloud className="h-12 w-12 text-gray-400" />
            )}
          </div>
        </motion.div>

        {/* Today's Details - Compact */}
        <motion.div
          variants={fadeUpItemVariants}
          className="grid grid-cols-3 gap-2 text-center mb-3 py-2 rounded-lg bg-white/10 dark:bg-gray-800/20"
        >
          <div>
            <p className="text-xs text-gray-500">Range</p>
            <p className="text-sm font-medium tabular-nums">
              {today.tempMin.toFixed(0)}°-{today.tempMax.toFixed(0)}°
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
              <Droplets className="h-3 w-3 text-blue-500" /> Rain
            </p>
            <p className="text-sm font-medium tabular-nums">{today.rain.toFixed(0)}mm</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
              <Wind className="h-3 w-3" /> Wind
            </p>
            <p className="text-sm font-medium tabular-nums">{today.windMax.toFixed(0)}km/h</p>
          </div>
        </motion.div>

        {/* 7-Day Mini Forecast - Compact */}
        <motion.div variants={fadeUpItemVariants}>
          <div className="flex items-end gap-0.5 h-12">
            {next7Days.map((day, i) => {
              const maxTemp = Math.max(...next7Days.map((d) => d.tempMax));
              const minTemp = Math.min(...next7Days.map((d) => d.tempMin));
              const range = maxTemp - minTemp || 1;
              const height = ((day.tempMax - minTemp) / range) * 100;

              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  {day.rain > 0 && <Droplets className="h-2 w-2 text-blue-500" />}
                  <div className="flex-1 flex items-end w-full">
                    <motion.div
                      className={cn(
                        'w-full rounded-t',
                        day.rain > 0
                          ? 'bg-blue-400/60'
                          : 'bg-gradient-to-t from-yellow-400/60 to-orange-400/60'
                      )}
                      style={{ height: `${height}%` }}
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ delay: i * 0.03, ...springs.gentle }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {i === 0 ? 'T' : format(day.date, 'EEEEE')}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-500 text-center mt-1">
            7-day: {totalRain7Days.toFixed(0)}mm rain • Max {Math.max(...next7Days.map((d) => d.tempMax)).toFixed(0)}°C
          </p>
        </motion.div>

        {/* Operations Intelligence Badges - Only if relevant */}
        {(roadRisk?.riskLevel !== 'low' || nextOperation) && (
          <motion.div variants={fadeUpItemVariants} className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-white/10">
            {roadRisk && roadRisk.riskLevel !== 'low' && (
              <div
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                  roadRisk.riskLevel === 'critical' && 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
                  roadRisk.riskLevel === 'high' && 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
                  roadRisk.riskLevel === 'moderate' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
                )}
              >
                <AlertTriangle className="h-3 w-3" />
                Road Risk
              </div>
            )}
            {nextOperation && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">
                <TrendingUp className="h-3 w-3" />
                {nextOperation.operation}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
