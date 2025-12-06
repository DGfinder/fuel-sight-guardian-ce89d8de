import { motion } from 'framer-motion';
import { useWeatherForecast } from '@/hooks/useWeatherForecast';
import { useAgriculturalIntelligence } from '@/hooks/useAgriculturalIntelligence';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CloudRain, Sun, Wind, Droplets, CloudSnow, Cloud, AlertTriangle, TrendingUp } from 'lucide-react';
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
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-2xl bg-gradient-to-br from-white/40 via-white/30 to-white/20 dark:from-gray-900/40 dark:via-gray-900/30 dark:to-gray-900/20 border border-white/30 dark:border-gray-700/30 shadow-2xl h-[400px]">
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-2xl bg-gradient-to-br from-white/40 via-white/30 to-white/20 dark:from-gray-900/40 dark:via-gray-900/30 dark:to-gray-900/20 border border-white/30 dark:border-gray-700/30 shadow-2xl h-[400px]">
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-gray-500">Weather data unavailable</p>
        </div>
      </div>
    );
  }

  // Calculate current conditions (today)
  const today = {
    tempCurrent: weather.daily.temperature_2m_max[0],
    tempMin: weather.daily.temperature_2m_min[0],
    tempMax: weather.daily.temperature_2m_max[0],
    rain: weather.daily.rain_sum[0],
    windMax: weather.daily.windspeed_10m_max[0],
  };

  // Get weather icon based on conditions
  const getWeatherIcon = () => {
    if (today.rain > 5) {
      return <CloudRain className="h-16 w-16 text-blue-500" />;
    } else if (today.rain > 0) {
      return <Cloud className="h-16 w-16 text-gray-400" />;
    } else {
      return <Sun className="h-16 w-16 text-yellow-500" />;
    }
  };

  const getWeatherCondition = () => {
    if (today.rain > 10) return 'Heavy Rain';
    if (today.rain > 5) return 'Light Rain';
    if (today.rain > 0) return 'Cloudy';
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
      className="relative overflow-hidden rounded-2xl backdrop-blur-2xl bg-gradient-to-br from-white/40 via-white/30 to-white/20 dark:from-gray-900/40 dark:via-gray-900/30 dark:to-gray-900/20 border border-white/30 dark:border-gray-700/30 shadow-2xl h-[400px]"
      initial="hidden"
      animate="visible"
      variants={staggerContainerVariants}
      whileHover={{ y: -2, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
      transition={springs.gentle}
    >
      {/* Glass gradient border effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-transparent dark:from-gray-700/10 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col p-6">
        {/* Header */}
        <motion.div variants={fadeUpItemVariants} className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Weather & Operations
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
              {locationName}
              {isFallbackLocation && (
                <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">(regional)</span>
              )}
            </p>
          </div>
          {getWeatherCondition() === 'Sunny' && (
            <motion.div animate={weatherIconVariants.sun}>
              {getWeatherIcon()}
            </motion.div>
          )}
          {getWeatherCondition().includes('Rain') && (
            <motion.div animate={weatherIconVariants.rain}>
              {getWeatherIcon()}
            </motion.div>
          )}
          {getWeatherCondition() === 'Cloudy' && (
            <div>{getWeatherIcon()}</div>
          )}
        </motion.div>

        {/* Current Temperature - Hero Element */}
        <motion.div variants={fadeUpItemVariants} className="mb-6">
          <div className="flex items-baseline gap-2">
            <span className="text-7xl font-extralight tracking-tight tabular-nums">
              {today.tempCurrent.toFixed(0)}
            </span>
            <span className="text-2xl font-light text-gray-500">°C</span>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">{getWeatherCondition()}</p>
        </motion.div>

        {/* Today's Details */}
        <motion.div
          variants={fadeUpItemVariants}
          className="backdrop-blur-lg bg-white/20 dark:bg-gray-800/20 rounded-lg p-3 border border-white/10 mb-4"
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Range</p>
              <p className="text-sm font-semibold tabular-nums">
                {today.tempMin.toFixed(0)}° - {today.tempMax.toFixed(0)}°C
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Droplets className="h-3 w-3 text-blue-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Rain</p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{today.rain.toFixed(0)}mm</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Wind className="h-3 w-3 text-gray-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Wind</p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{today.windMax.toFixed(0)} km/h</p>
            </div>
          </div>
        </motion.div>

        {/* 7-Day Mini Forecast */}
        <motion.div variants={fadeUpItemVariants} className="mb-auto">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            7-Day Outlook
          </h4>
          <div className="flex items-end gap-1 h-16">
            {next7Days.map((day, i) => {
              const maxTemp = Math.max(...next7Days.map((d) => d.tempMax));
              const minTemp = Math.min(...next7Days.map((d) => d.tempMin));
              const range = maxTemp - minTemp || 1;
              const height = ((day.tempMax - minTemp) / range) * 100;

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  {/* Rainfall indicator */}
                  {day.rain > 0 && (
                    <div className="text-blue-500" title={`${day.rain.toFixed(0)}mm rain`}>
                      <Droplets className="h-3 w-3" />
                    </div>
                  )}
                  {/* Temperature bar */}
                  <div className="flex-1 flex items-end w-full">
                    <motion.div
                      className={cn(
                        'w-full rounded-t',
                        today.rain > 5
                          ? 'bg-blue-400/60'
                          : 'bg-gradient-to-t from-yellow-400/60 to-orange-400/60'
                      )}
                      style={{ height: `${height}%` }}
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ delay: i * 0.05, ...springs.gentle }}
                    />
                  </div>
                  {/* Day label */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                    {i === 0 ? 'Now' : format(day.date, 'EEE')[0]}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>7-day total: {totalRain7Days.toFixed(0)}mm</span>
            <span>Max: {Math.max(...next7Days.map((d) => d.tempMax)).toFixed(0)}°C</span>
          </div>
        </motion.div>

        {/* Operations Intelligence Badges */}
        {(roadRisk?.riskLevel !== 'low' || nextOperation) && (
          <motion.div variants={fadeUpItemVariants} className="flex flex-wrap gap-2 mt-4">
            {roadRisk && roadRisk.riskLevel !== 'low' && (
              <div
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                  roadRisk.riskLevel === 'critical' &&
                    'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
                  roadRisk.riskLevel === 'high' &&
                    'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
                  roadRisk.riskLevel === 'moderate' &&
                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
                )}
              >
                <AlertTriangle className="h-3 w-3" />
                Road Risk: {roadRisk.riskLevel}
              </div>
            )}
            {nextOperation && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">
                <TrendingUp className="h-3 w-3" />
                {nextOperation.operation}: {nextOperation.status}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
