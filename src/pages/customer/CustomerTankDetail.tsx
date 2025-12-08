import React, { useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCustomerTank, useCustomerPreferences } from '@/hooks/useCustomerAuth';
import { useDeviceHealth, useTankReadingsWithConsumption } from '@/hooks/useCustomerAnalytics';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { KPICard } from '@/components/ui/KPICard';
import { DetailCard } from '@/components/ui/DetailCard';
import {
  calculateUrgency,
  calculateUrgencyWithFallback,
  getUrgencyClasses,
  getUrgencyLabel,
  formatDaysRemaining,
  calculatePredictedRefillDate,
} from '@/lib/urgency-calculator';
import {
  ArrowLeft,
  Fuel,
  Clock,
  TrendingDown,
  TrendingUp,
  Calendar,
  Truck,
  MapPin,
  Activity,
  Wifi,
  WifiOff,
  Hash,
  MapPinned,
  Gauge,
  RefreshCw,
  BarChart3,
  ClipboardEdit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { staggerContainerVariants, glowRingVariants, springs } from '@/lib/motion-variants';
import { TankConsumptionChart } from '@/components/customer/TankConsumptionChart';
import { WeatherWidget } from '@/components/customer/WeatherWidget';
import { AgIntelligenceDashboard } from '@/components/customer/AgIntelligenceDashboard';
import { IndustryIntelligenceDashboard } from '@/components/customer/IndustryIntelligenceDashboard';
import { CustomerMapWidget } from '@/components/customer/CustomerMapWidget';
import { FuelCostWidget } from '@/components/customer/FuelCostWidget';
import { useRoadRiskProfile } from '@/hooks/useRoadRisk';
import { useCustomerFeatures, type IndustryType } from '@/hooks/useCustomerFeatures';

export default function CustomerTankDetail() {
  const { tankId } = useParams<{ tankId: string }>();
  const navigate = useNavigate();
  const { data: tank, isLoading: tankLoading } = useCustomerTank(tankId);
  const { data: preferences } = useCustomerPreferences();
  const { data: deviceHealth, isLoading: healthLoading } = useDeviceHealth(tankId);

  // Road risk profile for agricultural intelligence
  const { data: roadProfile } = useRoadRiskProfile(tankId);

  // Feature flags - use tank's industry type to determine features
  // This ensures features match the tank, not the logged-in user's account
  const { agriculturalIntelligence } = useCustomerFeatures(
    tank?.industry_type as IndustryType | undefined
  );

  // Get consumption readings for delivery stats (90 days for good refill frequency)
  const { data: consumptionReadings } = useTankReadingsWithConsumption(tank?.asset_id, 90);

  // Calculate delivery stats from consumption readings
  const deliveryStats = useMemo(() => {
    if (!consumptionReadings || consumptionReadings.length === 0) {
      return { lastDelivery: null, avgDaysBetweenFills: null, consumptionTrend: null };
    }

    // Find refill events (is_refill = true means fuel was added)
    const refills = consumptionReadings
      .filter(r => r.is_refill)
      .sort((a, b) => new Date(b.reading_at).getTime() - new Date(a.reading_at).getTime());

    const lastDelivery = refills.length > 0 ? new Date(refills[0].reading_at) : null;

    // Calculate average days between refills
    let avgDaysBetweenFills: number | null = null;
    if (refills.length >= 2) {
      const intervals: number[] = [];
      for (let i = 0; i < refills.length - 1; i++) {
        const daysDiff = (new Date(refills[i].reading_at).getTime() - new Date(refills[i + 1].reading_at).getTime()) / (1000 * 60 * 60 * 24);
        intervals.push(daysDiff);
      }
      avgDaysBetweenFills = Math.round(intervals.reduce((sum, d) => sum + d, 0) / intervals.length);
    }

    // Calculate consumption trend (compare last 7 days vs previous 7 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const recentConsumption = consumptionReadings
      .filter(r => !r.is_refill && r.daily_consumption && new Date(r.reading_at) >= sevenDaysAgo)
      .map(r => r.daily_consumption || 0);
    const previousConsumption = consumptionReadings
      .filter(r => !r.is_refill && r.daily_consumption && new Date(r.reading_at) >= fourteenDaysAgo && new Date(r.reading_at) < sevenDaysAgo)
      .map(r => r.daily_consumption || 0);

    let consumptionTrend: { direction: 'up' | 'down' | 'stable'; percent: number } | null = null;
    if (recentConsumption.length > 0 && previousConsumption.length > 0) {
      const recentAvg = recentConsumption.reduce((sum, c) => sum + c, 0) / recentConsumption.length;
      const previousAvg = previousConsumption.reduce((sum, c) => sum + c, 0) / previousConsumption.length;
      const percentChange = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

      consumptionTrend = {
        direction: Math.abs(percentChange) < 5 ? 'stable' : percentChange > 0 ? 'up' : 'down',
        percent: Math.abs(Math.round(percentChange)),
      };
    }

    return { lastDelivery, avgDaysBetweenFills, consumptionTrend };
  }, [consumptionReadings]);

  if (tankLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!tank) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Tank Not Found
        </h2>
        <p className="text-gray-500 mb-4">
          This tank may not be assigned to your account.
        </p>
        <Link to="/customer/tanks">
          <Button variant="outline">Back to Tanks</Button>
        </Link>
      </div>
    );
  }

  // Use fallback urgency calculation for manual dip tanks (no days remaining data)
  const urgency = calculateUrgencyWithFallback(
    tank.asset_days_remaining,
    tank.latest_calibrated_fill_percentage
  );
  const urgencyClasses = getUrgencyClasses(urgency);
  const predictedDate = calculatePredictedRefillDate(tank.asset_days_remaining ?? null);

  // Check if this is a manual dip tank (no telemetry device)
  const isManualDipTank = tank.source_type === 'dip' || tank.source_type === 'manual';
  const hasTelemetry = tank.source_type === 'agbot' || tank.source_type === 'smartfill';

  // Calculate current litres for display
  const fuelLevel = tank.latest_calibrated_fill_percentage || 0;
  const currentLitres = tank.asset_current_level_liters ||
    (fuelLevel / 100) * (tank.asset_profile_water_capacity || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tank.location_id || tank.address1 || 'Tank Details'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {tank.address1}
            {tank.state && `, ${tank.state}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Record Dip button for manual dip tanks */}
          {isManualDipTank && tank.access_level !== 'read' && (
            <Link to={`/customer/tanks/${tank.id}/record-dip`}>
              <Button variant="outline" className="gap-2">
                <ClipboardEdit size={16} />
                Record Dip
              </Button>
            </Link>
          )}
          {tank.access_level !== 'read' && (
            <Link to={`/customer/request?tank=${tank.id}`}>
              <Button className="gap-2">
                <Truck size={16} />
                Request Delivery
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Status Cards - Now using KPICard with animations */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        initial="hidden"
        animate="visible"
        variants={staggerContainerVariants}
      >
        <KPICard
          title="Current Level"
          value={`${Math.round(fuelLevel)}%`}
          subtitle={currentLitres > 0 ? `${Math.round(currentLitres).toLocaleString()}L` : undefined}
          icon={Fuel}
          color={urgency === 'critical' ? 'red' : urgency === 'warning' ? 'yellow' : 'green'}
          alert={urgency === 'critical' || urgency === 'warning'}
          trend={urgency === 'critical' ? 'down' : urgency === 'warning' ? 'down' : 'neutral'}
          trendValue={
            urgency === 'critical'
              ? 'Critically low'
              : urgency === 'warning'
              ? 'Low fuel'
              : 'Good level'
          }
        />
        <KPICard
          title={isManualDipTank ? "Days to Min" : "Days Remaining"}
          value={isManualDipTank
            ? formatDaysRemaining(tank.asset_days_remaining ?? null)
            : (tank.asset_days_remaining ? `${tank.asset_days_remaining} days` : '—')}
          icon={Clock}
          color="blue"
          trend="neutral"
          trendValue={
            tank.asset_days_remaining && tank.asset_days_remaining < 7
              ? 'Order soon'
              : 'Adequate supply'
          }
        />
        <KPICard
          title="Daily Usage"
          value={tank.asset_daily_consumption ? tank.asset_daily_consumption.toFixed(0) : 'N/A'}
          subtitle={tank.asset_daily_consumption ? 'L/day' : ''}
          icon={TrendingDown}
          color="blue"
          trend="neutral"
          trendValue="Average consumption"
        />
        <KPICard
          title={isManualDipTank ? 'Data Source' : 'Device Status'}
          value={isManualDipTank ? 'Manual Entry' : (tank.device_online ? 'Online' : 'Offline')}
          icon={isManualDipTank ? ClipboardEdit : (tank.device_online ? Wifi : WifiOff)}
          color={isManualDipTank ? 'blue' : (tank.device_online ? 'green' : 'gray')}
          alert={!isManualDipTank && !tank.device_online}
          trend="neutral"
          trendValue={isManualDipTank ? 'Dip readings' : (tank.device_online ? 'Connected' : 'Not reporting')}
        />
      </motion.div>

      {/* Agricultural Intelligence Dashboard - for farming customers ONLY */}
      {agriculturalIntelligence && tank.lat && tank.lng && tank.latest_calibrated_fill_percentage && tank.asset_daily_consumption && tank.asset_profile_water_capacity && (
        <AgIntelligenceDashboard
          lat={tank.lat}
          lng={tank.lng}
          tankId={tank.id}
          tankLevel={tank.latest_calibrated_fill_percentage}
          dailyConsumption={tank.asset_daily_consumption}
          capacityLiters={tank.asset_profile_water_capacity}
          roadProfile={roadProfile}
          tank={tank}
        />
      )}

      {/* Industry Intelligence Dashboard - for mining and general customers */}
      {!agriculturalIntelligence && (
        <IndustryIntelligenceDashboard
          tank={tank}
          tanks={[tank]}
        />
      )}

      {/* Urgency Alert - Now with pulse animation */}
      {urgency !== 'normal' && urgency !== 'unknown' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
        >
          <Card
            className={cn(
              'relative overflow-hidden border-2',
              urgency === 'critical'
                ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 ring-2 ring-red-500/20 shadow-lg'
                : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 ring-2 ring-yellow-500/20 shadow-lg'
            )}
          >
            {/* Pulse effect */}
            {urgency === 'critical' && (
              <motion.div
                className="absolute inset-0 rounded-lg"
                animate={glowRingVariants.critical}
              />
            )}
            {urgency === 'warning' && (
              <motion.div
                className="absolute inset-0 rounded-lg"
                animate={glowRingVariants.low}
              />
            )}
            <CardContent className="pt-4 relative z-10">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Activity
                    className={cn(
                      'h-5 w-5',
                      urgency === 'critical'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-yellow-600 dark:text-yellow-400'
                    )}
                  />
                </motion.div>
                <div className="flex-1">
                  <p
                    className={cn(
                      'font-semibold',
                      urgency === 'critical'
                        ? 'text-red-800 dark:text-red-200'
                        : 'text-yellow-800 dark:text-yellow-200'
                    )}
                  >
                    {urgency === 'critical' ? 'Critical Fuel Level' : 'Low Fuel Warning'}
                  </p>
                  <p
                    className={cn(
                      'text-sm mt-0.5',
                      urgency === 'critical'
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-yellow-700 dark:text-yellow-300'
                    )}
                  >
                    {predictedDate
                      ? `Estimated to need refill by ${predictedDate.toLocaleDateString('en-AU', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}`
                      : 'Consider requesting a delivery soon'}
                  </p>
                </div>
                {tank.access_level !== 'read' && (
                  <Link to={`/customer/request?tank=${tank.id}`}>
                    <Button
                      variant={urgency === 'critical' ? 'destructive' : 'default'}
                      size="sm"
                    >
                      Request Delivery
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Manual Dip Info Card - Show when consumption data is missing */}
      {isManualDipTank && !tank.asset_daily_consumption && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <ClipboardEdit className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">
                  Manual Dip Tank
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Consumption data and days remaining will become available after recording several dip readings over time.
                  This allows us to calculate your usage patterns.
                </p>
                <Link to={`/customer/tanks/${tank.id}/record-dip`} className="inline-block mt-2">
                  <Button variant="outline" size="sm" className="gap-2 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800">
                    <ClipboardEdit size={14} />
                    Record a Dip Reading
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid - Chart + Tank Info */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Consumption Chart */}
        <div className="lg:col-span-2">
          <TankConsumptionChart
            assetId={tank?.asset_id}
            tankId={tank?.id}
            sourceType={tank?.source_type}
            defaultPeriod={(preferences?.default_chart_days as 7 | 14 | 30 | 90) || 7}
            capacityLiters={tank?.asset_profile_water_capacity}
            warningThresholdPct={preferences?.default_warning_threshold_pct || 25}
            criticalThresholdPct={preferences?.default_critical_threshold_pct || 15}
          />
        </div>

        {/* Tank Details Sidebar - Compact */}
        <div className="space-y-4">
          <DetailCard
            title="Tank Information"
            variant="glass"
            sections={[
              {
                items: [
                  {
                    label: 'Location ID',
                    value: tank.location_id || 'N/A',
                    icon: MapPinned,
                  },
                  {
                    label: 'Address',
                    value: tank.address1 || 'N/A',
                    icon: MapPin,
                  },
                  ...(tank.asset_profile_water_capacity
                    ? [
                        {
                          label: 'Capacity',
                          value: `${tank.asset_profile_water_capacity.toLocaleString()}L`,
                          icon: Gauge,
                        },
                      ]
                    : []),
                  {
                    label: 'Status',
                    value: (
                      <Badge className={cn(urgencyClasses.bg, urgencyClasses.text, 'border-0')}>
                        {getUrgencyLabel(urgency)}
                      </Badge>
                    ),
                    icon: Activity,
                  },
                  // Delivery Stats
                  ...(deliveryStats.lastDelivery
                    ? [
                        {
                          label: 'Last Delivery',
                          value: deliveryStats.lastDelivery.toLocaleDateString('en-AU', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          }),
                          icon: Truck,
                        },
                      ]
                    : []),
                  ...(deliveryStats.avgDaysBetweenFills
                    ? [
                        {
                          label: 'Refill Frequency',
                          value: `Every ~${deliveryStats.avgDaysBetweenFills} days`,
                          icon: RefreshCw,
                        },
                      ]
                    : []),
                ],
              },
            ]}
          />

          {/* Predicted Refill */}
          {predictedDate && (
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Predicted Refill Date
                    </p>
                    <p className="font-medium text-blue-800 dark:text-blue-200">
                      {predictedDate.toLocaleDateString('en-AU', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Secondary Content Row - Below Chart */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Fuel Cost Estimate */}
        {tank.asset_daily_consumption && tank.asset_daily_consumption > 0 && (
          <FuelCostWidget
            dailyConsumption={tank.asset_daily_consumption}
            currentLevelLiters={currentLitres}
            daysRemaining={tank.asset_days_remaining ?? null}
            productType={tank.product_type}
            assetId={tank.asset_id}
          />
        )}

        {/* Location Map */}
        {tank.lat && tank.lng && (
          <CustomerMapWidget
            tanks={[tank]}
            height={220}
            showTitle={true}
          />
        )}

        {/* Weather Forecast */}
        {tank.lat && tank.lng && (
          <WeatherWidget
            lat={tank.lat}
            lng={tank.lng}
            locationName={tank.location_id || tank.address1 || 'Tank Location'}
          />
        )}
      </div>
    </div>
  );
}
