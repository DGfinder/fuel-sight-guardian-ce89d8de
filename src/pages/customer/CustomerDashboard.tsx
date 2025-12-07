import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useCustomerAccount,
  useCustomerTanks,
  useCustomerDeliveryRequests,
  useCustomerPortalSummary,
} from '@/hooks/useCustomerAuth';
import {
  useFleetConsumptionChart,
  useFleetHealth,
} from '@/hooks/useCustomerAnalytics';
import { useWeatherForecast } from '@/hooks/useWeatherForecast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ForcePasswordChange } from '@/components/customer/ForcePasswordChange';
import { DashboardWeatherCard } from '@/components/customer/DashboardWeatherCard';
import { WeatherOverlayChart } from '@/components/customer/WeatherOverlayChart';
import { FleetKPICards } from '@/components/customer/FleetKPICards';
import { DeviceHealthCard } from '@/components/customer/DeviceHealthCard';
import { CustomerMapWidget } from '@/components/customer/CustomerMapWidget';
import { IndustryIntelligenceDashboard, IndustryIntelligenceSummary } from '@/components/customer/IndustryIntelligenceDashboard';
import { useCustomerFeatures } from '@/hooks/useCustomerFeatures';
import {
  Fuel,
  Truck,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingDown,
  CalendarDays,
  ArrowRight,
  Activity,
  Battery,
  Signal,
  Droplets,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Default location: Indusolutions business address (used when tank GPS is not set)
const DEFAULT_LOCATION = {
  lat: -32.03549368194498,
  lng: 116.00925491272064,
  name: 'Regional Weather'
};

export default function CustomerDashboard() {
  const { data: customerAccount, isLoading: accountLoading } = useCustomerAccount();
  const { data: tanks, isLoading: tanksLoading } = useCustomerTanks();
  const { data: requests, isLoading: requestsLoading } = useCustomerDeliveryRequests();
  const summary = useCustomerPortalSummary();
  const { data: fleetConsumption, isLoading: chartLoading } = useFleetConsumptionChart(7);
  const { data: fleetHealth, isLoading: healthLoading } = useFleetHealth();
  const { agriculturalIntelligence } = useCustomerFeatures();
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  // Check if password change is required on mount and when account data changes
  useEffect(() => {
    if (customerAccount?.force_password_change) {
      setShowPasswordChange(true);
    }
  }, [customerAccount]);

  // Calculate primary tank for weather data (COMPLEMENTARY - critical tank or first tank)
  // IMPORTANT: All hooks must be called before any conditional returns (Rules of Hooks)
  const primaryTank = useMemo(() => {
    if (!tanks?.length) return null;
    // Prioritize critical tanks (<20% fuel), fallback to first tank
    return tanks.find(t => (t.latest_calibrated_fill_percentage || 0) < 20) || tanks[0];
  }, [tanks]);

  // Weather location: use tank coordinates or fallback to default
  const weatherLocation = useMemo(() => {
    if (primaryTank?.latitude && primaryTank?.longitude) {
      return {
        lat: primaryTank.latitude,
        lng: primaryTank.longitude,
        name: primaryTank.location_id || primaryTank.address1 || 'Primary Location',
        isFallback: false
      };
    }
    return { ...DEFAULT_LOCATION, isFallback: true };
  }, [primaryTank]);

  // Fetch weather data for location (COMPLEMENTARY)
  const { data: weather } = useWeatherForecast(
    weatherLocation.lat,
    weatherLocation.lng,
    7
  );

  // Calculate fleet-wide fuel metrics (PRIMARY - FUEL FIRST!)
  const fleetMetrics = useMemo(() => {
    if (!tanks?.length) return null;

    // Use correct property names from CustomerTank interface
    const totalCapacity = tanks.reduce((sum, t) => sum + (t.asset_profile_water_capacity || 0), 0);
    const currentFuel = tanks.reduce(
      (sum, t) => sum + ((t.latest_calibrated_fill_percentage || 0) / 100 * (t.asset_profile_water_capacity || 0)),
      0
    );
    const dailyConsumption = tanks.reduce((sum, t) => sum + (t.asset_daily_consumption || 0), 0);
    const daysToRun = dailyConsumption > 0 ? currentFuel / dailyConsumption : 0;

    return {
      totalFuelPercent: totalCapacity > 0 ? (currentFuel / totalCapacity) * 100 : 0,
      dailyUse: Math.round(dailyConsumption),
      daysToRun: Math.floor(daysToRun),
      currentFuelLiters: Math.round(currentFuel),
      totalCapacity,
    };
  }, [tanks]);

  // Loading state - after all hooks
  if (accountLoading || tanksLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    );
  }

  // Show force password change dialog if required
  if (showPasswordChange) {
    return (
      <ForcePasswordChange
        onComplete={() => {
          setShowPasswordChange(false);
          // Reload to fetch updated customer account without force flag
          window.location.reload();
        }}
      />
    );
  }

  // Get tanks sorted by fuel level (lowest first)
  const sortedTanks = [...(tanks || [])].sort(
    (a, b) => (a.latest_calibrated_fill_percentage || 0) - (b.latest_calibrated_fill_percentage || 0)
  );

  // Get recent requests
  const recentRequests = (requests || []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome Header with Quick Action */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {customerAccount?.contact_name || customerAccount?.customer_name}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {customerAccount?.company_name || customerAccount?.customer_name}
          </p>
        </div>
        <Link to="/customer/request">
          <Button className="gap-2">
            <Truck className="h-4 w-4" />
            Request Delivery
          </Button>
        </Link>
      </div>

      {/* KPI Cards Row - Full Width */}
      <FleetKPICards summary={summary} fleetMetrics={fleetMetrics} tankCount={tanks?.length || 0} />

      {/* Critical Alert Banner */}
      {summary.criticalTanks > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-red-900 dark:text-red-100 text-lg">
                {summary.criticalTanks} tank{summary.criticalTanks > 1 ? 's' : ''} critically low on fuel
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Immediate action required to avoid running dry. Request delivery now.
              </p>
            </div>
            <Link to="/customer/request">
              <Button variant="destructive" size="lg" className="gap-2">
                <Truck className="h-4 w-4" />
                Request Delivery
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* 7-Day Chart - Full Width */}
      <WeatherOverlayChart
        consumptionData={fleetConsumption || []}
        weatherData={weather?.daily.time.map((date, i) => ({
          date,
          rainfall: weather.daily.rain_sum[i],
          tempMin: weather.daily.temperature_2m_min[i],
          tempMax: weather.daily.temperature_2m_max[i],
        }))}
        totalCapacity={fleetMetrics?.totalCapacity}
        height={300}
      />

      {/* Weather + Device Health + Map - 3 Column Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashboardWeatherCard
          lat={weatherLocation.lat}
          lng={weatherLocation.lng}
          locationName={weatherLocation.name}
          isFallbackLocation={weatherLocation.isFallback}
          tankId={primaryTank?.id}
          tankLevel={primaryTank?.latest_calibrated_fill_percentage}
          dailyConsumption={primaryTank?.asset_daily_consumption}
          capacityLiters={primaryTank?.asset_profile_water_capacity}
          roadProfile={primaryTank?.road_risk_profile}
        />
        <DeviceHealthCard
          devices={fleetHealth || []}
          isLoading={healthLoading}
        />
        {/* Map Widget - shows tank location with weather */}
        {tanks && tanks.length > 0 && (
          <CustomerMapWidget
            tanks={tanks}
            height={220}
            showTitle={true}
          />
        )}
      </div>

      {/* Industry Intelligence - for mining and general customers */}
      {!agriculturalIntelligence && primaryTank && (
        <IndustryIntelligenceDashboard
          tank={primaryTank}
          tanks={tanks || []}
        />
      )}

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Tank Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Tank Status</CardTitle>
            <Link to="/customer/tanks">
              <Button variant="ghost" size="sm" className="gap-1">
                View All <ArrowRight size={16} />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {sortedTanks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No tanks assigned yet</p>
            ) : (
              <div className="space-y-3">
                {sortedTanks.slice(0, 5).map((tank) => (
                  <TankStatusRow key={tank.id} tank={tank} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Recent Requests</CardTitle>
            <Link to="/customer/history">
              <Button variant="ghost" size="sm" className="gap-1">
                View All <ArrowRight size={16} />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : recentRequests.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-3">No delivery requests yet</p>
                <Link to="/customer/request">
                  <Button variant="outline" size="sm">
                    Request Your First Delivery
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentRequests.map((request) => (
                  <RequestStatusRow key={request.id} request={request} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}


// Tank Status Row
function TankStatusRow({ tank }: { tank: any }) {
  const level = tank.latest_calibrated_fill_percentage || 0;
  const urgency = level < 15 ? 'critical' : level < 25 ? 'warning' : 'normal';

  return (
    <Link
      to={`/customer/tanks/${tank.id}`}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      {/* Level indicator */}
      <div
        className={cn(
          'w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm',
          urgency === 'critical' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          urgency === 'warning' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
          urgency === 'normal' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        )}
      >
        {level.toFixed(0)}%
      </div>

      {/* Tank info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{tank.location_id || tank.address1}</p>
        <p className="text-sm text-gray-500 truncate">{tank.address1}</p>
      </div>

      {/* Days remaining */}
      {tank.asset_days_remaining && (
        <div className="text-right">
          <p className="text-sm font-medium">{Math.round(tank.asset_days_remaining)} days</p>
          <p className="text-xs text-gray-500">remaining</p>
        </div>
      )}

      {/* Device status */}
      <div
        className={cn(
          'w-2 h-2 rounded-full',
          tank.device_online ? 'bg-green-500' : 'bg-gray-400'
        )}
        title={tank.device_online ? 'Online' : 'Offline'}
      />
    </Link>
  );
}

// Request Status Row
function RequestStatusRow({ request }: { request: any }) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
    acknowledged: { label: 'Acknowledged', color: 'bg-blue-100 text-blue-800' },
    scheduled: { label: 'Scheduled', color: 'bg-purple-100 text-purple-800' },
    in_progress: { label: 'In Progress', color: 'bg-indigo-100 text-indigo-800' },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
  };

  const status = statusConfig[request.status] || statusConfig.pending;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {request.agbot_locations?.location_id || request.agbot_locations?.address1 || 'Tank'}
        </p>
        <p className="text-sm text-gray-500">
          {new Date(request.created_at).toLocaleDateString()}
        </p>
      </div>
      <Badge className={cn('text-xs', status.color)}>{status.label}</Badge>
    </div>
  );
}


