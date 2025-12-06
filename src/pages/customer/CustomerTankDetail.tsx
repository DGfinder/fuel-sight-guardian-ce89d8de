import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCustomerTank, useCustomerPreferences } from '@/hooks/useCustomerAuth';
import { useDeviceHealth } from '@/hooks/useCustomerAnalytics';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { KPICard } from '@/components/ui/KPICard';
import { DetailCard } from '@/components/ui/DetailCard';
import {
  calculateUrgency,
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
  Calendar,
  Truck,
  MapPin,
  Activity,
  Wifi,
  WifiOff,
  Hash,
  MapPinned,
  Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { staggerContainerVariants, glowRingVariants, springs } from '@/lib/motion-variants';
import { TankConsumptionChart } from '@/components/customer/TankConsumptionChart';
import { WeatherWidget } from '@/components/customer/WeatherWidget';
import { AgIntelligenceDashboard } from '@/components/customer/AgIntelligenceDashboard';
import { useRoadRiskProfile } from '@/hooks/useRoadRisk';

export default function CustomerTankDetail() {
  const { tankId } = useParams<{ tankId: string }>();
  const navigate = useNavigate();
  const { data: tank, isLoading: tankLoading } = useCustomerTank(tankId);
  const { data: preferences } = useCustomerPreferences();
  const { data: deviceHealth, isLoading: healthLoading } = useDeviceHealth(tankId);

  // Road risk profile for agricultural intelligence
  const { data: roadProfile } = useRoadRiskProfile(tankId);

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

  const urgency = calculateUrgency(tank.asset_days_remaining ?? null);
  const urgencyClasses = getUrgencyClasses(urgency);
  const predictedDate = calculatePredictedRefillDate(tank.asset_days_remaining ?? null);

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
        {tank.access_level !== 'read' && (
          <Link to={`/customer/request?tank=${tank.id}`}>
            <Button className="gap-2">
              <Truck size={16} />
              Request Delivery
            </Button>
          </Link>
        )}
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
          value={`${(tank.latest_calibrated_fill_percentage || 0).toFixed(0)}%`}
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
          title="Days Remaining"
          value={formatDaysRemaining(tank.asset_days_remaining ?? null)}
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
          title="Device Status"
          value={tank.device_online ? 'Online' : 'Offline'}
          icon={tank.device_online ? Wifi : WifiOff}
          color={tank.device_online ? 'green' : 'gray'}
          alert={!tank.device_online}
          trend={tank.device_online ? 'neutral' : 'down'}
          trendValue={tank.device_online ? 'Connected' : 'Not reporting'}
        />
      </motion.div>

      {/* Agricultural Intelligence Dashboard */}
      {tank.lat && tank.lng && tank.latest_calibrated_fill_percentage && tank.asset_daily_consumption && tank.asset_profile_water_capacity && (
        <AgIntelligenceDashboard
          lat={tank.lat}
          lng={tank.lng}
          tankId={tank.id}
          tankLevel={tank.latest_calibrated_fill_percentage}
          dailyConsumption={tank.asset_daily_consumption}
          capacityLiters={tank.asset_profile_water_capacity}
          roadProfile={roadProfile}
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

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Consumption Chart */}
        <div className="lg:col-span-2">
          <TankConsumptionChart
            assetId={tank?.asset_id}
            defaultPeriod={(preferences?.default_chart_days as 7 | 14 | 30 | 90) || 7}
            capacityLiters={tank?.asset_profile_water_capacity}
            warningThresholdPct={preferences?.default_warning_threshold_pct || 25}
            criticalThresholdPct={preferences?.default_critical_threshold_pct || 15}
          />
        </div>

        {/* Tank Details - Now using DetailCard */}
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
                  ...(tank.state
                    ? [
                        {
                          label: 'State',
                          value: tank.state,
                        },
                      ]
                    : []),
                  ...(tank.asset_profile_water_capacity
                    ? [
                        {
                          label: 'Capacity',
                          value: `${tank.asset_profile_water_capacity.toLocaleString()}L`,
                          icon: Gauge,
                        },
                      ]
                    : []),
                  ...(tank.asset_serial_number
                    ? [
                        {
                          label: 'Device Serial',
                          value: tank.asset_serial_number,
                          icon: Hash,
                          copyable: true,
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
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location Map Placeholder */}
          {tank.lat && tank.lng && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-gray-500">
                  <MapPin size={16} />
                  <span className="text-sm">
                    {tank.lat.toFixed(4)}, {tank.lng.toFixed(4)}
                  </span>
                </div>
              </CardContent>
            </Card>
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
    </div>
  );
}
