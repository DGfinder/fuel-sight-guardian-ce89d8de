import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCustomerTanks, CustomerTank } from '@/hooks/useCustomerAuth';
import { CustomerMapWidget } from '@/components/customer/CustomerMapWidget';
import { useWeatherForecast } from '@/hooks/useWeatherForecast';
import { useRoadRiskProfile } from '@/hooks/useRoadRisk';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { KPICard } from '@/components/ui/KPICard';
import { staggerContainerVariants, fadeUpItemVariants, springs } from '@/lib/motion-variants';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import {
  Cloud,
  CloudRain,
  Sun,
  Wind,
  Thermometer,
  AlertTriangle,
  Tractor,
  HardHat,
  Factory,
  Truck,
  Calendar,
  Droplets,
  Wheat,
  Shovel,
  Building2,
} from 'lucide-react';

// Industry types
type Industry = 'agriculture' | 'mining' | 'construction';

interface IndustryConfig {
  id: Industry;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

const INDUSTRIES: IndustryConfig[] = [
  {
    id: 'agriculture',
    label: 'Agriculture',
    icon: Wheat,
    color: 'green',
    description: 'Farming, cropping, livestock',
  },
  {
    id: 'mining',
    label: 'Mining',
    icon: Factory,
    color: 'orange',
    description: 'Remote sites, haul roads',
  },
  {
    id: 'construction',
    label: 'Construction',
    icon: Building2,
    color: 'blue',
    description: 'Sites, earthworks, concrete',
  },
];

// Detect industry from location/road data
function detectIndustry(
  roadType?: string,
  address?: string,
  lat?: number,
  lng?: number
): Industry {
  const addr = (address || '').toLowerCase();

  // Mining keywords
  if (
    addr.includes('kalgoorlie') ||
    addr.includes('kambalda') ||
    addr.includes('coolgardie') ||
    addr.includes('karratha') ||
    addr.includes('port hedland') ||
    addr.includes('newman') ||
    addr.includes('tom price') ||
    addr.includes('pilbara') ||
    addr.includes('goldfields') ||
    addr.includes('mine') ||
    addr.includes('mining')
  ) {
    return 'mining';
  }

  // Construction keywords
  if (
    addr.includes('construction') ||
    addr.includes('quarry') ||
    addr.includes('concrete') ||
    addr.includes('civil')
  ) {
    return 'construction';
  }

  // Unsealed roads typically mining
  if (roadType === 'unsealed') {
    return 'mining';
  }

  // Default to agriculture (most common in WA grain belt)
  return 'agriculture';
}

// Weather icon helper
function getWeatherIcon(rain: number, wind: number) {
  if (rain > 10) return CloudRain;
  if (rain > 0) return Cloud;
  if (wind > 30) return Wind;
  return Sun;
}

export default function CustomerWeather() {
  const { data: tanks, isLoading: tanksLoading } = useCustomerTanks();

  // Get first tank with coordinates for weather
  const primaryTank = useMemo(() => {
    return tanks?.find(t => t.lat && t.lng);
  }, [tanks]);

  // Get road profile for industry detection
  const { data: roadProfile } = useRoadRiskProfile(primaryTank?.location_id);

  // Detect industry from tank data
  const detectedIndustry = useMemo(() => {
    if (!primaryTank) return 'agriculture';
    return detectIndustry(
      roadProfile?.access_road_type,
      primaryTank.address1,
      primaryTank.lat,
      primaryTank.lng
    );
  }, [primaryTank, roadProfile]);

  // Allow manual override
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const activeIndustry = selectedIndustry || detectedIndustry;

  // Fetch 16-day forecast
  const { data: weather, isLoading: weatherLoading } = useWeatherForecast(
    primaryTank?.lat,
    primaryTank?.lng,
    16
  );

  if (tanksLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!primaryTank) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Weather Intelligence
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            No tank locations available
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Cloud className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              Add tanks with GPS coordinates to see weather intelligence
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const industryConfig = INDUSTRIES.find(i => i.id === activeIndustry)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Weather Intelligence
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            16-day forecast with {industryConfig.label.toLowerCase()} operations insights
          </p>
        </div>

        {/* Industry Selector */}
        <div className="flex gap-2">
          {INDUSTRIES.map((industry) => {
            const Icon = industry.icon;
            const isActive = activeIndustry === industry.id;
            const isDetected = detectedIndustry === industry.id && !selectedIndustry;

            return (
              <Button
                key={industry.id}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedIndustry(industry.id)}
                className={cn(
                  'relative',
                  isActive && industry.color === 'green' && 'bg-green-600 hover:bg-green-700',
                  isActive && industry.color === 'orange' && 'bg-orange-600 hover:bg-orange-700',
                  isActive && industry.color === 'blue' && 'bg-blue-600 hover:bg-blue-700'
                )}
              >
                <Icon className="h-4 w-4 mr-1" />
                {industry.label}
                {isDetected && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full" />
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {weatherLoading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <LoadingSpinner />
        </div>
      ) : weather ? (
        <>
          {/* Weather Summary KPIs + Map */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3">
              <WeatherSummaryKPIs weather={weather} industry={activeIndustry} />
            </div>
            <div className="lg:col-span-1">
              <CustomerMapWidget
                tanks={tanks || []}
                height={180}
                showTitle={true}
              />
            </div>
          </div>

          {/* 16-Day Forecast */}
          <ForecastGrid weather={weather} industry={activeIndustry} />

          {/* Industry-Specific Intelligence */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndustry}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={springs.gentle}
            >
              {activeIndustry === 'agriculture' && (
                <AgricultureIntelligence weather={weather} />
              )}
              {activeIndustry === 'mining' && (
                <MiningIntelligence weather={weather} roadProfile={roadProfile} />
              )}
              {activeIndustry === 'construction' && (
                <ConstructionIntelligence weather={weather} />
              )}
            </motion.div>
          </AnimatePresence>
        </>
      ) : null}
    </div>
  );
}

// Weather Summary KPIs
function WeatherSummaryKPIs({ weather, industry }: { weather: any; industry: Industry }) {
  const next7Days = weather.daily.time.slice(0, 7);
  const totalRain = weather.daily.rain_sum.slice(0, 7).reduce((a: number, b: number) => a + b, 0);
  const maxWind = Math.max(...weather.daily.windspeed_10m_max.slice(0, 7));
  const avgTemp = weather.daily.temperature_2m_max.slice(0, 7).reduce((a: number, b: number) => a + b, 0) / 7;

  // Count good working days based on industry
  const goodDays = next7Days.filter((_: string, i: number) => {
    const rain = weather.daily.rain_sum[i];
    const wind = weather.daily.windspeed_10m_max[i];

    if (industry === 'agriculture') {
      // Spray: wind < 15, no rain. Harvest: no rain
      return rain < 2 && wind < 20;
    }
    if (industry === 'mining') {
      // Road access: rain < threshold
      return rain < 20;
    }
    if (industry === 'construction') {
      // Concrete: no rain, moderate temps. Earthworks: low rain
      return rain < 5;
    }
    return true;
  }).length;

  return (
    <motion.div
      className="grid grid-cols-2 md:grid-cols-4 gap-4"
      initial="hidden"
      animate="visible"
      variants={staggerContainerVariants}
    >
      <motion.div variants={fadeUpItemVariants}>
        <KPICard
          title="7-Day Rain"
          value={`${totalRain.toFixed(0)}mm`}
          icon={CloudRain}
          color={totalRain > 40 ? 'red' : totalRain > 20 ? 'yellow' : 'green'}
          trend={totalRain > 40 ? 'down' : 'neutral'}
          trendValue={totalRain > 40 ? 'Heavy rain forecast' : totalRain > 20 ? 'Moderate rain' : 'Light conditions'}
        />
      </motion.div>
      <motion.div variants={fadeUpItemVariants}>
        <KPICard
          title="Max Wind"
          value={`${maxWind.toFixed(0)} km/h`}
          icon={Wind}
          color={maxWind > 40 ? 'red' : maxWind > 25 ? 'yellow' : 'green'}
          trend={maxWind > 40 ? 'down' : 'neutral'}
          trendValue={maxWind > 40 ? 'Strong winds' : maxWind > 25 ? 'Moderate winds' : 'Calm conditions'}
        />
      </motion.div>
      <motion.div variants={fadeUpItemVariants}>
        <KPICard
          title="Avg Temp"
          value={`${avgTemp.toFixed(0)}°C`}
          icon={Thermometer}
          color={avgTemp > 38 ? 'red' : avgTemp > 32 ? 'yellow' : 'blue'}
          trend="neutral"
          trendValue={avgTemp > 38 ? 'Extreme heat' : avgTemp > 32 ? 'Hot conditions' : 'Comfortable'}
        />
      </motion.div>
      <motion.div variants={fadeUpItemVariants}>
        <KPICard
          title="Good Work Days"
          value={goodDays}
          subtitle="of 7"
          icon={Calendar}
          color={goodDays >= 5 ? 'green' : goodDays >= 3 ? 'yellow' : 'red'}
          trend={goodDays >= 5 ? 'up' : goodDays >= 3 ? 'neutral' : 'down'}
          trendValue={
            industry === 'agriculture' ? 'For field operations' :
            industry === 'mining' ? 'For road access' :
            'For site work'
          }
        />
      </motion.div>
    </motion.div>
  );
}

// 16-Day Forecast Grid
function ForecastGrid({ weather, industry }: { weather: any; industry: Industry }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          16-Day Forecast
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-16 gap-2">
          {weather.daily.time.map((date: string, i: number) => {
            const rain = weather.daily.rain_sum[i];
            const wind = weather.daily.windspeed_10m_max[i];
            const tempMax = weather.daily.temperature_2m_max[i];
            const tempMin = weather.daily.temperature_2m_min[i];
            const Icon = getWeatherIcon(rain, wind);

            // Determine if it's a good day for the industry
            let isGoodDay = true;
            if (industry === 'agriculture') {
              isGoodDay = rain < 2 && wind < 20;
            } else if (industry === 'mining') {
              isGoodDay = rain < 20;
            } else if (industry === 'construction') {
              isGoodDay = rain < 5;
            }

            const d = new Date(date);
            const isToday = i === 0;

            return (
              <motion.div
                key={date}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                className={cn(
                  'p-2 rounded-lg text-center border transition-colors',
                  isToday && 'ring-2 ring-primary',
                  isGoodDay
                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                    : rain > 20
                    ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                    : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                )}
              >
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {isToday ? 'Today' : format(d, 'EEE')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {format(d, 'd/M')}
                </p>
                <Icon className={cn(
                  'h-5 w-5 mx-auto my-1',
                  rain > 10 ? 'text-blue-500' : rain > 0 ? 'text-gray-400' : 'text-yellow-500'
                )} />
                <p className="text-xs font-medium">
                  {tempMax.toFixed(0)}°
                </p>
                <p className="text-xs text-gray-400">
                  {tempMin.toFixed(0)}°
                </p>
                {rain > 0 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    {rain.toFixed(0)}mm
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-200 dark:bg-green-800" />
            <span>Good conditions</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-200 dark:bg-amber-800" />
            <span>Caution</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-200 dark:bg-red-800" />
            <span>Poor conditions</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Agriculture-specific intelligence
function AgricultureIntelligence({ weather }: { weather: any }) {
  const currentMonth = new Date().getMonth() + 1;

  // Find harvest window (Oct-Dec: 7+ dry days)
  const harvestWindow = useMemo(() => {
    if (currentMonth < 9 || currentMonth > 12) return null;

    let consecutiveDry = 0;
    let startIdx = -1;

    for (let i = 0; i < weather.daily.rain_sum.length; i++) {
      if (weather.daily.rain_sum[i] < 2) {
        if (consecutiveDry === 0) startIdx = i;
        consecutiveDry++;
        if (consecutiveDry >= 5) {
          return {
            start: new Date(weather.daily.time[startIdx]),
            end: new Date(weather.daily.time[i]),
            days: consecutiveDry,
          };
        }
      } else {
        consecutiveDry = 0;
      }
    }
    return null;
  }, [weather, currentMonth]);

  // Find spray windows (wind < 15, no rain)
  const sprayDays = useMemo(() => {
    return weather.daily.time.slice(0, 7).map((date: string, i: number) => ({
      date: new Date(date),
      suitable: weather.daily.windspeed_10m_max[i] < 15 && weather.daily.rain_sum[i] < 1,
      wind: weather.daily.windspeed_10m_max[i],
      rain: weather.daily.rain_sum[i],
    })).filter((d: any) => d.suitable);
  }, [weather]);

  // Find seeding window (20mm+ rain event in Apr-Jun)
  const seedingBreak = useMemo(() => {
    if (currentMonth < 3 || currentMonth > 7) return null;

    for (let i = 0; i < weather.daily.rain_sum.length; i++) {
      if (weather.daily.rain_sum[i] >= 20) {
        return {
          date: new Date(weather.daily.time[i]),
          amount: weather.daily.rain_sum[i],
        };
      }
    }
    return null;
  }, [weather, currentMonth]);

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {/* Harvest Window */}
      <Card className={cn(
        harvestWindow
          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
          : 'bg-gray-50 dark:bg-gray-800'
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wheat className="h-5 w-5 text-amber-600" />
            Harvest Window
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentMonth >= 9 && currentMonth <= 12 ? (
            harvestWindow ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-green-600">{harvestWindow.days} day window</Badge>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {format(harvestWindow.start, 'MMM d')} - {format(harvestWindow.end, 'MMM d')}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Dry conditions ideal for harvest. Headers use ~800L/day.
                </p>
                <div className="mt-3 p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-xs">
                  <strong>Fuel Impact:</strong> 2.5x normal consumption
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                No extended dry window in forecast. Monitor daily.
              </p>
            )
          ) : (
            <p className="text-sm text-gray-500">
              Harvest season: Oct-Dec. Check back then.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Spray Conditions */}
      <Card className={cn(
        sprayDays.length > 0
          ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
          : 'bg-gray-50 dark:bg-gray-800'
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-600" />
            Spray Windows
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sprayDays.length > 0 ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-blue-600">{sprayDays.length} good days</Badge>
              </div>
              <div className="space-y-1">
                {sprayDays.slice(0, 3).map((day: any, i: number) => (
                  <p key={i} className="text-sm text-gray-700 dark:text-gray-300">
                    {format(day.date, 'EEEE')} - Wind {day.wind.toFixed(0)}km/h
                  </p>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Optimal: Wind &lt;15km/h, no rain. Spray rigs use ~120L/day.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              No ideal spray conditions this week. Wind or rain interfering.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Seeding Break */}
      <Card className={cn(
        seedingBreak
          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
          : 'bg-gray-50 dark:bg-gray-800'
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tractor className="h-5 w-5 text-green-600" />
            Seeding Break
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentMonth >= 3 && currentMonth <= 7 ? (
            seedingBreak ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-green-600">{seedingBreak.amount.toFixed(0)}mm forecast</Badge>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Break expected {format(seedingBreak.date, 'EEEE, MMM d')}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Seeding typically starts 3-5 days after break. Use ~300L/day.
                </p>
                <div className="mt-3 p-2 bg-green-100 dark:bg-green-900/30 rounded text-xs">
                  <strong>Action:</strong> Order fuel before {format(addDays(seedingBreak.date, 3), 'MMM d')}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Waiting for autumn break (20mm+ rain event).
              </p>
            )
          ) : (
            <p className="text-sm text-gray-500">
              Seeding season: Apr-Jun. Check back then.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Mining-specific intelligence
function MiningIntelligence({ weather, roadProfile }: { weather: any; roadProfile: any }) {
  const threshold = roadProfile?.closure_threshold_mm || 35;
  const closureDuration = roadProfile?.typical_closure_duration_days || 3;

  // Calculate road closure risk
  const roadRisk = useMemo(() => {
    let cumulative = 0;
    let closureDate = null;

    for (let i = 0; i < 7; i++) {
      cumulative += weather.daily.rain_sum[i] || 0;
      if (cumulative >= threshold && !closureDate) {
        closureDate = new Date(weather.daily.time[i]);
      }
    }

    const riskLevel = cumulative >= threshold * 1.2 ? 'critical' :
                      cumulative >= threshold ? 'high' :
                      cumulative >= threshold * 0.7 ? 'moderate' : 'low';

    return {
      cumulative,
      threshold,
      closureDate,
      riskLevel,
      closureDuration,
    };
  }, [weather, threshold, closureDuration]);

  // Find access windows
  const accessWindows = useMemo(() => {
    const windows: { start: Date; end: Date; days: number }[] = [];
    let consecutiveDry = 0;
    let startIdx = -1;

    for (let i = 0; i < weather.daily.rain_sum.length; i++) {
      if (weather.daily.rain_sum[i] < 10) {
        if (consecutiveDry === 0) startIdx = i;
        consecutiveDry++;
      } else {
        if (consecutiveDry >= 2) {
          windows.push({
            start: new Date(weather.daily.time[startIdx]),
            end: new Date(weather.daily.time[i - 1]),
            days: consecutiveDry,
          });
        }
        consecutiveDry = 0;
      }
    }

    if (consecutiveDry >= 2) {
      windows.push({
        start: new Date(weather.daily.time[startIdx]),
        end: new Date(weather.daily.time[weather.daily.time.length - 1]),
        days: consecutiveDry,
      });
    }

    return windows;
  }, [weather]);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Road Closure Risk */}
      <Card className={cn(
        roadRisk.riskLevel === 'critical' && 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
        roadRisk.riskLevel === 'high' && 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
        roadRisk.riskLevel === 'moderate' && 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
        roadRisk.riskLevel === 'low' && 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Road Closure Risk
            <Badge className={cn(
              roadRisk.riskLevel === 'critical' && 'bg-red-600',
              roadRisk.riskLevel === 'high' && 'bg-amber-600',
              roadRisk.riskLevel === 'moderate' && 'bg-yellow-600',
              roadRisk.riskLevel === 'low' && 'bg-green-600'
            )}>
              {roadRisk.riskLevel.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">7-day rainfall forecast</span>
              <span className="font-medium">{roadRisk.cumulative.toFixed(0)}mm</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Closure threshold</span>
              <span className="font-medium">{threshold}mm</span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  roadRisk.riskLevel === 'critical' && 'bg-red-500',
                  roadRisk.riskLevel === 'high' && 'bg-amber-500',
                  roadRisk.riskLevel === 'moderate' && 'bg-yellow-500',
                  roadRisk.riskLevel === 'low' && 'bg-green-500'
                )}
                style={{ width: `${Math.min(100, (roadRisk.cumulative / threshold) * 100)}%` }}
              />
            </div>

            {roadRisk.closureDate && (
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded text-sm">
                <AlertTriangle className="h-4 w-4 inline mr-1 text-red-600" />
                Closure expected: {format(roadRisk.closureDate, 'EEEE, MMM d')}
                <br />
                <span className="text-xs">Typical duration: {closureDuration} days</span>
              </div>
            )}

            {roadRisk.riskLevel === 'critical' && (
              <p className="text-sm text-red-700 dark:text-red-400">
                <strong>Action:</strong> Request urgent delivery within 24 hours
              </p>
            )}
            {roadRisk.riskLevel === 'high' && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>Action:</strong> Schedule delivery before rain event
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Access Windows */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Site Access Windows
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accessWindows.length > 0 ? (
            <div className="space-y-3">
              {accessWindows.slice(0, 3).map((window, i) => (
                <div key={i} className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      {format(window.start, 'MMM d')} - {format(window.end, 'MMM d')}
                    </span>
                    <Badge variant="outline" className="bg-green-100">
                      {window.days} days
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Low rainfall - good road conditions
                  </p>
                </div>
              ))}
              <p className="text-xs text-gray-500">
                Plan deliveries during these windows for best access
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Limited access windows due to persistent rain forecast
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Construction-specific intelligence
function ConstructionIntelligence({ weather }: { weather: any }) {
  // Find concrete pour days (no rain, temp 10-30°C)
  const concreteDays = useMemo(() => {
    return weather.daily.time.slice(0, 14).map((date: string, i: number) => {
      const rain = weather.daily.rain_sum[i];
      const tempMax = weather.daily.temperature_2m_max[i];
      const tempMin = weather.daily.temperature_2m_min[i];
      const suitable = rain < 1 && tempMin > 5 && tempMax < 35;

      return {
        date: new Date(date),
        suitable,
        rain,
        tempMax,
        tempMin,
        reason: !suitable
          ? rain >= 1 ? 'Rain forecast'
          : tempMin <= 5 ? 'Too cold'
          : 'Too hot'
          : 'Good conditions',
      };
    });
  }, [weather]);

  // Find earthworks days (low rain)
  const earthworksDays = useMemo(() => {
    return weather.daily.time.slice(0, 14).map((date: string, i: number) => {
      const rain = weather.daily.rain_sum[i];
      const suitable = rain < 5;

      return {
        date: new Date(date),
        suitable,
        rain,
      };
    });
  }, [weather]);

  const goodConcreteDays = concreteDays.filter((d: any) => d.suitable).length;
  const goodEarthworksDays = earthworksDays.filter((d: any) => d.suitable).length;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Concrete Pours */}
      <Card className={cn(
        goodConcreteDays >= 5
          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
          : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shovel className="h-5 w-5 text-gray-600" />
            Concrete Pour Days
            <Badge className={goodConcreteDays >= 5 ? 'bg-green-600' : 'bg-amber-600'}>
              {goodConcreteDays} of 14
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Requirements: No rain, 5-35°C
            </p>
            <div className="grid grid-cols-7 gap-1">
              {concreteDays.slice(0, 14).map((day: any, i: number) => (
                <div
                  key={i}
                  className={cn(
                    'h-8 rounded flex items-center justify-center text-xs',
                    day.suitable
                      ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                      : 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                  )}
                  title={`${format(day.date, 'EEE d')}: ${day.reason}`}
                >
                  {format(day.date, 'd')}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Generators/pumps use ~150L/day during pours
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Earthworks */}
      <Card className={cn(
        goodEarthworksDays >= 10
          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
          : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <HardHat className="h-5 w-5 text-yellow-600" />
            Earthworks Days
            <Badge className={goodEarthworksDays >= 10 ? 'bg-green-600' : 'bg-amber-600'}>
              {goodEarthworksDays} of 14
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Requirements: Rainfall &lt;5mm
            </p>
            <div className="grid grid-cols-7 gap-1">
              {earthworksDays.slice(0, 14).map((day: any, i: number) => (
                <div
                  key={i}
                  className={cn(
                    'h-8 rounded flex items-center justify-center text-xs',
                    day.suitable
                      ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                      : 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                  )}
                  title={`${format(day.date, 'EEE d')}: ${day.rain.toFixed(0)}mm`}
                >
                  {format(day.date, 'd')}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Excavators/dozers use ~200-400L/day
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Planning */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Delivery Planning
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-medium text-blue-800 dark:text-blue-200">Generators</h4>
              <p className="text-2xl font-bold text-blue-600">~150L/day</p>
              <p className="text-xs text-gray-500">Lights, pumps, site office</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <h4 className="font-medium text-amber-800 dark:text-amber-200">Excavators</h4>
              <p className="text-2xl font-bold text-amber-600">~250L/day</p>
              <p className="text-xs text-gray-500">Per machine in operation</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <h4 className="font-medium text-green-800 dark:text-green-200">Trucks</h4>
              <p className="text-2xl font-bold text-green-600">~100L/day</p>
              <p className="text-xs text-gray-500">Site trucks, loaders</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
