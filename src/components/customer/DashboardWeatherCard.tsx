import { motion } from 'framer-motion';
import { useWeatherForecast, useCurrentObservations } from '@/hooks/useWeatherForecast';
import { useAgriculturalIntelligence } from '@/hooks/useAgriculturalIntelligence';
import { useCustomerFeatures } from '@/hooks/useCustomerFeatures';
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
  const { operationsBadges, roadRisk: showRoadRisk, fullWeather } = useCustomerFeatures();
  const { data: weather, isLoading } = useWeatherForecast(lat, lng, 7);
  const { data: observations } = useCurrentObservations(lat, lng);

  // Only fetch agricultural intelligence if we need to show badges
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
  const now = new Date();

  // Priority for current temperature:
  // 1. BOM observations (actual real-time temperature)
  // 2. Hourly forecast for current hour
  // 3. Daily max as fallback
  let currentTemp: number;
  if (observations?.temp != null) {
    // Use actual observed temperature from BOM
    currentTemp = observations.temp;
    console.log('[Weather] Using BOM observations:', observations.temp, '°C from', observations.station_name);
  } else {
    console.log('[Weather] No observations available, falling back to forecast');
    // Fallback to hourly forecast if no observations
    const currentHourIndex = weather.hourly?.time?.findIndex((t: string) => {
      const hourTime = new Date(t);
      return hourTime.getHours() === now.getHours() &&
             hourTime.getDate() === now.getDate();
    }) ?? 0;
    currentTemp = weather.hourly?.temperature_2m?.[currentHourIndex]
      ?? weather.daily.temperature_2m_max[0];
  }

  const today = {
    tempCurrent: currentTemp,
    tempMin: weather.daily.temperature_2m_min[0] ?? 0,
    tempMax: weather.daily.temperature_2m_max[0] ?? 0,
    rain: weather.daily.rain_sum?.[0] ?? 0,
    windMax: observations?.wind_speed_kmh ?? weather.daily.windspeed_10m_max?.[0] ?? 0,
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
  // Note: Append T12:00:00 to parse date as local noon, avoiding UTC midnight timezone issues
  // (new Date("2025-12-11") parses as UTC midnight = previous day in Perth)
  const next7Days = (weather.daily.time || []).slice(0, 7).map((date, i) => ({
    date: new Date(`${date}T12:00:00`),
    tempMax: weather.daily.temperature_2m_max?.[i] ?? 0,
    tempMin: weather.daily.temperature_2m_min?.[i] ?? 0,
    rain: weather.daily.rain_sum?.[i] ?? 0,
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

        {/* 7-Day Forecast - Readable daily breakdown */}
        <motion.div variants={fadeUpItemVariants}>
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Day names row */}
            {next7Days.map((day, i) => (
              <div key={`day-${i}`} className="text-[10px] text-gray-500 font-medium">
                {i === 0 ? 'Today' : format(day.date, 'EEE')}
              </div>
            ))}
            {/* Max temp row */}
            {next7Days.map((day, i) => (
              <div
                key={`temp-${i}`}
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  day.rain > 5 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'
                )}
              >
                {day.tempMax.toFixed(0)}°
              </div>
            ))}
            {/* Rain row - only show amount if >0 */}
            {next7Days.map((day, i) => (
              <div key={`rain-${i}`} className="text-[10px] tabular-nums h-4">
                {day.rain > 0 ? (
                  <span className="text-blue-600 dark:text-blue-400 flex items-center justify-center gap-0.5">
                    <Droplets className="h-2.5 w-2.5" />
                    {day.rain.toFixed(0)}
                  </span>
                ) : (
                  <span className="text-gray-300 dark:text-gray-600">-</span>
                )}
              </div>
            ))}
          </div>
          {/* Summary line */}
          <p className="text-[10px] text-gray-500 text-center mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
            Week total: {totalRain7Days.toFixed(0)}mm rain
            {totalRain7Days > 0 && ` • ${next7Days.filter(d => d.rain > 0).length} rainy days`}
          </p>
        </motion.div>

        {/* Operations Intelligence Badges - Based on customer features */}
        {/* Road Risk: visible to farming + mining customers */}
        {/* Operations: visible to farming customers only */}
        {((showRoadRisk && roadRisk?.riskLevel !== 'low') || (operationsBadges && nextOperation)) && (
          <motion.div variants={fadeUpItemVariants} className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-white/10">
            {showRoadRisk && roadRisk && roadRisk.riskLevel !== 'low' && (
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
            {operationsBadges && nextOperation && (
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
