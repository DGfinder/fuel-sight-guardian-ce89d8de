import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCustomerTank, useCustomerTankHistory, useCustomerPreferences } from '@/hooks/useCustomerAuth';
import { useConsumptionChartData, useDeviceHealth } from '@/hooks/useCustomerAnalytics';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export default function CustomerTankDetail() {
  const { tankId } = useParams<{ tankId: string }>();
  const navigate = useNavigate();
  const { data: tank, isLoading: tankLoading } = useCustomerTank(tankId);
  const { data: preferences } = useCustomerPreferences();
  const { data: deviceHealth, isLoading: healthLoading } = useDeviceHealth(tankId);

  const [chartPeriod, setChartPeriod] = useState<number>(preferences?.default_chart_days || 7);
  const { data: chartData, isLoading: chartLoading } = useConsumptionChartData(tankId, chartPeriod);

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

  // Get effective thresholds (from preferences or defaults)
  const criticalThreshold = preferences?.default_critical_threshold_pct || 15;
  const warningThreshold = preferences?.default_warning_threshold_pct || 25;

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

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Current Level */}
        <Card className={cn(urgencyClasses.bg, urgencyClasses.border, 'border')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Current Level</p>
                <p className={cn('text-3xl font-bold mt-1', urgencyClasses.text)}>
                  {(tank.latest_calibrated_fill_percentage || 0).toFixed(0)}%
                </p>
              </div>
              <div className={cn('p-3 rounded-lg', urgencyClasses.bg)}>
                <Fuel size={24} className={urgencyClasses.text} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Days Remaining */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Days Remaining</p>
                <p className="text-2xl font-bold mt-1">
                  {formatDaysRemaining(tank.asset_days_remaining ?? null)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <Clock size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Consumption */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Daily Usage</p>
                <p className="text-2xl font-bold mt-1">
                  {tank.asset_daily_consumption
                    ? `${tank.asset_daily_consumption.toFixed(0)}L`
                    : 'N/A'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                <TrendingDown size={24} className="text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Device Status */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Device Status</p>
                <p className="text-xl font-bold mt-1 flex items-center gap-2">
                  {tank.device_online ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Online
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-gray-400" />
                      Offline
                    </>
                  )}
                </p>
              </div>
              <div
                className={cn(
                  'p-3 rounded-lg',
                  tank.device_online
                    ? 'bg-green-50 dark:bg-green-900/20'
                    : 'bg-gray-50 dark:bg-gray-800'
                )}
              >
                {tank.device_online ? (
                  <Wifi size={24} className="text-green-600 dark:text-green-400" />
                ) : (
                  <WifiOff size={24} className="text-gray-400" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Urgency Alert */}
      {urgency !== 'normal' && urgency !== 'unknown' && (
        <Card
          className={cn(
            'border',
            urgency === 'critical'
              ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
              : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
          )}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Activity
                className={cn(
                  'h-5 w-5',
                  urgency === 'critical'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                )}
              />
              <div className="flex-1">
                <p
                  className={cn(
                    'font-medium',
                    urgency === 'critical'
                      ? 'text-red-800 dark:text-red-200'
                      : 'text-yellow-800 dark:text-yellow-200'
                  )}
                >
                  {urgency === 'critical' ? 'Critical Fuel Level' : 'Low Fuel Warning'}
                </p>
                <p
                  className={cn(
                    'text-sm',
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
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Consumption Chart */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Fuel Consumption History</CardTitle>
                <div className="flex gap-2">
                  {[7, 14, 30, 90].map((days) => (
                    <Button
                      key={days}
                      variant={chartPeriod === days ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setChartPeriod(days)}
                      className="text-xs"
                    >
                      {days}d
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartLoading ? (
                <div className="flex items-center justify-center h-64">
                  <LoadingSpinner />
                </div>
              ) : !chartData || chartData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No consumption data available</p>
                    <p className="text-sm mt-1">Data will appear once readings are collected</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickFormatter={(value) => `${value}%`}
                      label={{ value: 'Fuel Level (%)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '8px 12px',
                      }}
                      formatter={(value: number) => [`${value?.toFixed(1)}%`, 'Fuel Level']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    {/* Warning threshold */}
                    <ReferenceLine
                      y={warningThreshold}
                      stroke="#f59e0b"
                      strokeDasharray="5 5"
                      label={{ value: 'Warning', position: 'right', fontSize: 10, fill: '#f59e0b' }}
                    />
                    {/* Critical threshold */}
                    <ReferenceLine
                      y={criticalThreshold}
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                      label={{ value: 'Critical', position: 'right', fontSize: 10, fill: '#ef4444' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="level"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ fill: '#3b82f6', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tank Details */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tank Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailRow label="Location ID" value={tank.location_id || 'N/A'} />
              <DetailRow label="Address" value={tank.address1 || 'N/A'} />
              {tank.state && <DetailRow label="State" value={tank.state} />}
              {tank.asset_profile_water_capacity && (
                <DetailRow
                  label="Capacity"
                  value={`${tank.asset_profile_water_capacity.toLocaleString()}L`}
                />
              )}
              {tank.asset_serial_number && (
                <DetailRow label="Device Serial" value={tank.asset_serial_number} />
              )}
              <DetailRow
                label="Status"
                value={
                  <Badge className={cn(urgencyClasses.bg, urgencyClasses.text, 'border-0')}>
                    {getUrgencyLabel(urgency)}
                  </Badge>
                }
              />
            </CardContent>
          </Card>

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
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="font-medium text-sm">{value}</span>
    </div>
  );
}
