import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Signal,
  MapPin,
  Wifi,
  WifiOff,
  Activity,
  Info,
  Gauge,
  Clock,
  Zap,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  X,
  Droplets,
  Fuel,
  Battery,
  Thermometer,
  Radio,
  Container,
  Ruler,
  Waves
} from 'lucide-react';
import { format } from 'date-fns';
import { useAgbotModal } from '@/contexts/AgbotModalContext';
import {
  usePercentageColor,
  formatTimestamp
} from '@/hooks/useAgbotData';
import { useAgbotLocationAnalytics } from '@/hooks/useAgbotAnalytics';
import { Button } from '@/components/ui/button';
import { useAgbotReadingHistory } from '@/hooks/useAgbotReadingHistory';
import { AgbotReadingHistory } from '@/components/AgbotReadingHistory';
import { AgbotReadingCharts } from '@/components/AgbotReadingCharts';
import {
  DEFAULT_TANK_CAPACITY,
  getDataFreshnessStatus,
  getDataFreshnessLabel,
  getDataFreshnessColor,
  isCapacityEstimated
} from '@/constants/tankThresholds';

export default function AgbotDetailsModal() {
  const { selectedLocation, open, closeModal } = useAgbotModal();
  const { data: analytics, isLoading: analyticsLoading } = useAgbotLocationAnalytics(selectedLocation);

  // Fetch reading history for the History tab
  const { data: historyData, isLoading: historyLoading } = useAgbotReadingHistory({
    locationId: selectedLocation?.id || '',
    enabled: open && !!selectedLocation?.id,
    days: 30,
  });

  const mainAsset = selectedLocation?.assets?.[0];
  const allAssets = selectedLocation?.assets || [];
  const percentage = selectedLocation?.latest_calibrated_fill_percentage ?? mainAsset?.latest_calibrated_fill_percentage;
  const percentageColor = usePercentageColor(percentage);

  // Calculate liters and capacity (matching AgbotTable logic)
  const capacityFromName = mainAsset?.asset_profile_name?.match(/[\d,]+/)?.[0]?.replace(/,/g, '');
  const capacityFromRawData = selectedLocation?.raw_data?.AssetProfileWaterCapacity;
  const capacity = capacityFromRawData ||
                   mainAsset?.asset_profile_water_capacity ||
                   mainAsset?.asset_refill_capacity_litres ||
                   (capacityFromName ? parseInt(capacityFromName) : DEFAULT_TANK_CAPACITY);
  const currentLitres = percentage !== null && percentage !== undefined && capacity
    ? Math.round((percentage / 100) * capacity)
    : null;
  const commodity = mainAsset?.asset_profile_commodity || 'Unknown';

  // Data freshness calculation for push-based API
  const lastReadingTime = selectedLocation?.latest_telemetry;
  const dataFreshnessStatus = getDataFreshnessStatus(lastReadingTime);
  const dataFreshnessLabel = getDataFreshnessLabel(dataFreshnessStatus);
  const dataFreshnessColorClass = getDataFreshnessColor(dataFreshnessStatus);
  const capacityIsEstimated = isCapacityEstimated(capacity);

  if (!selectedLocation) return null;

  return (
    <Dialog open={open} onOpenChange={closeModal}>
      <DialogContent className="bg-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">
                {selectedLocation.location_id || 'Unknown Location'}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {selectedLocation.customer_name} • Agbot Cellular Monitoring
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`border ${dataFreshnessColorClass}`}>
                {dataFreshnessLabel}
              </Badge>
              {capacityIsEstimated && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                  ⚠️ Estimated Capacity
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={closeModal}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="device">Device</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Fuel Level Display */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Current Fuel Level
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  {/* Commodity Badge */}
                  <div className="flex justify-center mb-2">
                    <Badge
                      variant="outline"
                      className={`text-sm ${commodity === 'Diesel' ? 'border-amber-500 text-amber-700' : 'border-blue-500 text-blue-700'}`}
                    >
                      {commodity === 'Diesel' ? <Fuel className="h-3 w-3 mr-1" /> : <Droplets className="h-3 w-3 mr-1" />}
                      {commodity}
                    </Badge>
                  </div>

                  {/* Primary Display: LITRES */}
                  {currentLitres !== null ? (
                    <div>
                      <div className={`text-6xl font-bold ${percentageColor}`}>
                        {Math.round(currentLitres).toLocaleString()} L
                      </div>
                      <div className="text-xl text-muted-foreground mt-1">
                        ({percentage?.toFixed(1)}%)
                      </div>
                      {capacity > 0 && (
                        <div className="text-sm text-muted-foreground mt-2">
                          of {capacity.toLocaleString()} L capacity
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-6xl font-bold text-gray-500">
                      {percentage !== null && percentage !== undefined
                        ? `${percentage.toFixed(1)}%`
                        : 'No Data'
                      }
                    </div>
                  )}

                  {percentage !== null && percentage !== undefined && (
                    <Progress value={percentage} className="h-4" />
                  )}

                  {/* Capacity Breakdown */}
                  {currentLitres !== null && capacity > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                      <div className="text-center">
                        <div className="text-muted-foreground text-sm">Remaining</div>
                        <div className="font-semibold text-green-600">
                          {Math.round(currentLitres).toLocaleString()} L
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground text-sm">Used</div>
                        <div className="font-semibold text-gray-600">
                          {Math.round(capacity - currentLitres).toLocaleString()} L
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-4 border-t">
                    <div className="text-center">
                      <div className="text-muted-foreground">Fill Status</div>
                      <div className={`font-semibold ${
                        percentage === null || percentage === undefined ? 'text-gray-500' :
                        percentage < 20 ? 'text-red-600' :
                        percentage < 50 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {percentage === null || percentage === undefined ? 'No Data' :
                         percentage < 20 ? 'Low' :
                         percentage < 50 ? 'Medium' : 'Good'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground">Raw Sensor</div>
                      <div className="font-semibold text-gray-600">
                        {mainAsset?.latest_raw_fill_percentage !== null && mainAsset?.latest_raw_fill_percentage !== undefined
                          ? `${mainAsset.latest_raw_fill_percentage.toFixed(1)}%`
                          : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Freshness Status Card */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className={`h-8 w-8 ${
                    dataFreshnessStatus === 'recent' ? 'text-green-500' :
                    dataFreshnessStatus === 'stale' ? 'text-yellow-500' : 'text-red-500'
                  }`} />
                  <div className="flex-1">
                    <div className="font-semibold">Data Status</div>
                    <div className="text-sm text-muted-foreground">
                      {formatTimestamp(selectedLocation.latest_telemetry)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Push-based cellular reporting
                    </div>
                  </div>
                  <Badge className={`border ${dataFreshnessColorClass}`}>
                    {dataFreshnessLabel}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Installation Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Installation Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Badge variant={selectedLocation.installation_status === 2 ? "default" : "secondary"}>
                    {selectedLocation.installation_status_label || 'Unknown'}
                  </Badge>
                  <Badge variant={selectedLocation.location_status === 2 ? "default" : "secondary"}>
                    {selectedLocation.location_status_label || 'Unknown'}
                  </Badge>
                  {selectedLocation.disabled && (
                    <Badge variant="destructive">Disabled</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            {/* TIER 1: Always Show - Current Tank Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Fuel className="h-5 w-5 text-blue-600" />
                  Current Tank Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Current Litres - Primary Display */}
                  <div className="text-center">
                    {currentLitres !== null ? (
                      <>
                        <div className={`text-5xl font-bold ${percentageColor}`}>
                          {Math.round(currentLitres).toLocaleString()}
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mt-1">
                          LITRES ({commodity})
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {percentage?.toFixed(1)}% of capacity
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={`text-5xl font-bold ${percentageColor}`}>
                          {percentage !== null && percentage !== undefined
                            ? `${percentage.toFixed(1)}%`
                            : 'N/A'
                          }
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mt-1">
                          FUEL LEVEL
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          calibrated reading
                        </div>
                      </>
                    )}
                  </div>

                  {/* Tank Capacity */}
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-700">
                      {capacity.toLocaleString()}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground mt-1">
                      CAPACITY (L)
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      total tank size
                    </div>
                  </div>

                  {/* Last Reading */}
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-700">
                      {formatTimestamp(selectedLocation.latest_telemetry)}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground mt-1">
                      LAST READING
                    </div>
                    {selectedLocation.latest_telemetry && (
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(selectedLocation.latest_telemetry).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Visual Progress Bar */}
                {percentage !== null && percentage !== undefined && (
                  <div className="mt-6">
                    <Progress value={percentage} className="h-4" />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Empty (0L)</span>
                      <span className="font-semibold">Critical: 20% ({Math.round(capacity * 0.2).toLocaleString()}L)</span>
                      <span>Full ({capacity.toLocaleString()}L)</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* TIER 2: Basic Analytics - Show when we have historical data */}
            {historyData && historyData.readings && historyData.readings.length > 0 && (
              <>
                {/* Simple Calculations from Available Data */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-green-600" />
                      Available Data Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {historyData.readings.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Data Points</div>
                        <div className="text-xs text-gray-500 mt-1">
                          readings collected
                        </div>
                      </div>

                      {/* Litres Above Critical */}
                      {currentLitres !== null && percentage !== null && percentage > 20 && (
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${
                            percentage <= 30 ? 'text-red-600' : percentage <= 50 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {Math.round(currentLitres - (capacity * 0.2)).toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">Litres Above Critical</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {Math.round(capacity * 0.2).toLocaleString()}L is critical
                          </div>
                        </div>
                      )}

                      {/* Latest Reading Info */}
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {historyData.readings[0]?.calibrated_fill_percentage?.toFixed(1) || 'N/A'}%
                        </div>
                        <div className="text-sm text-muted-foreground">Latest Reading</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {historyData.readings[0]?.reading_timestamp
                            ? format(new Date(historyData.readings[0].reading_timestamp), 'MMM d, h:mm a')
                            : 'N/A'}
                        </div>
                      </div>

                      {/* Oldest Reading for Comparison */}
                      {historyData.readings.length > 1 && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {historyData.readings[historyData.readings.length - 1]?.calibrated_fill_percentage?.toFixed(1) || 'N/A'}%
                          </div>
                          <div className="text-sm text-muted-foreground">Oldest Reading</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {historyData.readings[historyData.readings.length - 1]?.reading_timestamp
                              ? format(new Date(historyData.readings[historyData.readings.length - 1].reading_timestamp), 'MMM d')
                              : 'N/A'}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Charts - Always show when we have readings */}
                {historyData.readings.length > 0 && (
                  <AgbotReadingCharts
                    readings={historyData.readings}
                    isLoading={historyLoading}
                    showLitres={true}
                  />
                )}
              </>
            )}

            {/* TIER 3: Advanced Analytics - Show when we have 2+ days of data */}
            {analytics && historyData && historyData.readings && historyData.readings.length >= 2 ? (
              <>
                {/* Consumption Metrics in LITRES */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                      Diesel Consumption Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Daily Consumption in Litres */}
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">
                          {capacity > 0
                            ? `${Math.round((analytics.rolling_avg_pct_per_day / 100) * capacity).toLocaleString()}L`
                            : `${analytics.rolling_avg_pct_per_day.toFixed(2)}%`
                          }
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mt-1">
                          DAILY CONSUMPTION
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {capacity > 0 ? `${analytics.rolling_avg_pct_per_day.toFixed(2)}% per day` : 'percentage per day'}
                        </div>
                      </div>

                      {/* Yesterday's Consumption */}
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600">
                          {capacity > 0
                            ? `${Math.round((analytics.prev_day_pct_used / 100) * capacity).toLocaleString()}L`
                            : `${analytics.prev_day_pct_used.toFixed(2)}%`
                          }
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mt-1">
                          YESTERDAY'S USAGE
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {capacity > 0 ? `${analytics.prev_day_pct_used.toFixed(2)}% consumed` : 'percentage consumed'}
                        </div>
                      </div>

                      {/* Days to Critical */}
                      <div className="text-center">
                        <div className={`text-3xl font-bold ${
                          analytics.days_to_critical_level === null ? 'text-gray-500' :
                          analytics.days_to_critical_level <= 7 ? 'text-red-600' :
                          analytics.days_to_critical_level <= 14 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {analytics.days_to_critical_level !== null
                            ? analytics.days_to_critical_level.toFixed(1)
                            : 'N/A'
                          }
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mt-1">
                          DAYS TO CRITICAL
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          until reaching 20%
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Performance & Trend Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-600" />
                        Performance Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Efficiency Score</span>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(100, analytics.efficiency_score)} className="w-24 h-2" />
                          <span className={`text-sm font-semibold ${
                            analytics.efficiency_score >= 80 ? 'text-green-600' :
                            analytics.efficiency_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {analytics.efficiency_score.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Data Reliability</span>
                        <div className="flex items-center gap-2">
                          <Progress value={analytics.data_reliability_score} className="w-24 h-2" />
                          <span className={`text-sm font-semibold ${
                            analytics.data_reliability_score >= 90 ? 'text-green-600' :
                            analytics.data_reliability_score >= 70 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {analytics.data_reliability_score.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-green-600" />
                        Consumption Trend
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        {analytics.consumption_trend === 'increasing' ? (
                          <TrendingUp className="h-5 w-5 text-red-500" />
                        ) : analytics.consumption_trend === 'decreasing' ? (
                          <TrendingDown className="h-5 w-5 text-green-500" />
                        ) : (
                          <div className="h-5 w-5 bg-gray-400 rounded-full" />
                        )}
                        <span className="capitalize font-medium">{analytics.consumption_trend}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Velocity: </span>
                        <span className={analytics.consumption_velocity > 0 ? 'text-red-600' :
                                       analytics.consumption_velocity < 0 ? 'text-green-600' : 'text-gray-600'}>
                          {analytics.consumption_velocity > 0 ? '+' : ''}
                          {capacity > 0
                            ? `${Math.round((analytics.consumption_velocity / 100) * capacity)}L/day`
                            : `${analytics.consumption_velocity.toFixed(2)}%/day`
                          }
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {analytics.consumption_velocity > 0 ? 'Usage accelerating' :
                         analytics.consumption_velocity < 0 ? 'Usage decelerating' : 'Usage stable'}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Refill Analysis */}
                {analytics.last_refill_date && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Refill Patterns
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-lg font-semibold">
                            {formatTimestamp(analytics.last_refill_date)}
                          </div>
                          <div className="text-sm text-muted-foreground">Last Refill</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold">
                            {analytics.refill_frequency_days?.toFixed(1) || 'N/A'} days
                          </div>
                          <div className="text-sm text-muted-foreground">Avg Refill Frequency</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold">
                            {analytics.predicted_next_refill
                              ? formatTimestamp(analytics.predicted_next_refill)
                              : 'N/A'
                            }
                          </div>
                          <div className="text-sm text-muted-foreground">Predicted Next Refill</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Alerts Section */}
                {(analytics.unusual_consumption_alert || analytics.potential_leak_alert || analytics.device_connectivity_alert) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        Alerts & Warnings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {analytics.unusual_consumption_alert && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-50 border border-yellow-200">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm text-yellow-800">
                            Unusual consumption pattern detected - diesel usage is higher than normal
                          </span>
                        </div>
                      )}
                      {analytics.potential_leak_alert && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 border border-red-200">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="text-sm text-red-800">
                            Potential leak detected - consistently high consumption rate
                          </span>
                        </div>
                      )}
                      {analytics.device_connectivity_alert && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-orange-50 border border-orange-200">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <span className="text-sm text-orange-800">
                            Device connectivity issues - data reliability below 80%
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              /* Show info message when advanced analytics aren't available yet */
              historyData && historyData.readings && historyData.readings.length > 0 && historyData.readings.length < 2 && (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Info className="h-10 w-10 text-blue-400 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Advanced Analytics Coming Soon</h3>
                    <p className="text-gray-600 text-sm">
                      {historyData.readings.length} reading collected. Advanced analytics including consumption trends,
                      refill predictions, and alerts will be available once we have 2+ days of data.
                    </p>
                    <div className="mt-3 text-xs text-gray-500">
                      Keep monitoring to unlock detailed insights about your diesel consumption.
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </TabsContent>

          {/* Device Tab */}
          <TabsContent value="device" className="space-y-4">
            {allAssets.map((asset, index) => {
              const assetData = historyData?.asset || asset;
              const latestReading = historyData?.readings?.[0];

              return (
                <div key={asset.asset_guid} className="space-y-4">
                  {/* Device Health Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-green-600" />
                        Device Health Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Battery Voltage */}
                        <div className="flex items-center gap-3">
                          <Battery className="h-5 w-5 text-blue-600" />
                          <div className="flex-1">
                            <div className="text-sm text-muted-foreground">Battery Voltage</div>
                            <div className="font-semibold">
                              {assetData?.device_battery_voltage
                                ? `${assetData.device_battery_voltage.toFixed(1)}V`
                                : latestReading?.device_battery_voltage
                                ? `${latestReading.device_battery_voltage.toFixed(1)}V`
                                : 'N/A'}
                            </div>
                            {(assetData?.device_battery_voltage || latestReading?.device_battery_voltage) && (
                              <Progress
                                value={((assetData?.device_battery_voltage || latestReading?.device_battery_voltage || 0) / 4) * 100}
                                className="h-2 mt-1"
                              />
                            )}
                          </div>
                        </div>

                        {/* Temperature */}
                        <div className="flex items-center gap-3">
                          <Thermometer className="h-5 w-5 text-orange-600" />
                          <div className="flex-1">
                            <div className="text-sm text-muted-foreground">Temperature</div>
                            <div className="font-semibold">
                              {assetData?.device_temperature
                                ? `${assetData.device_temperature.toFixed(0)}°C`
                                : latestReading?.device_temperature
                                ? `${latestReading.device_temperature.toFixed(0)}°C`
                                : 'N/A'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {assetData?.device_temperature && assetData.device_temperature > 60 ? 'High' :
                               assetData?.device_temperature && assetData.device_temperature > 45 ? 'Warm' : 'Normal'}
                            </div>
                          </div>
                        </div>

                        {/* Device State */}
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <div className="flex-1">
                            <div className="text-sm text-muted-foreground">Device State</div>
                            <div className="font-semibold">
                              {assetData?.device_state || latestReading?.device_state || 'Unknown'}
                            </div>
                          </div>
                        </div>

                        {/* Last Contact */}
                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 text-gray-600" />
                          <div className="flex-1">
                            <div className="text-sm text-muted-foreground">Last Contact</div>
                            <div className="font-semibold">
                              {formatTimestamp(asset.latest_telemetry_event_timestamp)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Push-based cellular
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tank Specifications */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Container className="h-5 w-5 text-blue-600" />
                        Tank Specifications
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Commodity:</span>
                          <div className="font-medium flex items-center gap-1">
                            {assetData?.asset_profile_commodity === 'Diesel' ? <Fuel className="h-4 w-4" /> : <Droplets className="h-4 w-4" />}
                            {assetData?.asset_profile_commodity || 'Unknown'}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Capacity:</span>
                          <div className="font-medium">
                            {(assetData?.asset_profile_water_capacity || capacity || 0).toLocaleString()} L
                          </div>
                        </div>
                        {assetData?.asset_refill_capacity_litres && (
                          <div>
                            <span className="text-muted-foreground">Refill Threshold:</span>
                            <div className="font-medium text-amber-600">
                              {assetData.asset_refill_capacity_litres.toLocaleString()} L
                            </div>
                          </div>
                        )}
                        {currentLitres !== null && capacity > 0 && (
                          <div>
                            <span className="text-muted-foreground">Available Space:</span>
                            <div className="font-medium text-blue-600">
                              {Math.round(capacity - currentLitres).toLocaleString()} L
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Max Depth:</span>
                          <div className="font-medium">
                            {assetData?.asset_profile_max_depth
                              ? `${assetData.asset_profile_max_depth.toFixed(2)}m`
                              : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Max Pressure:</span>
                          <div className="font-medium">
                            {assetData?.asset_profile_max_pressure
                              ? `${assetData.asset_profile_max_pressure.toFixed(0)} kPa`
                              : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Max Pressure (Bar):</span>
                          <div className="font-medium">
                            {assetData?.asset_profile_max_pressure_bar
                              ? `${assetData.asset_profile_max_pressure_bar.toFixed(2)} bar`
                              : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Current Sensor Readings */}
                  {latestReading && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Gauge className="h-5 w-5 text-purple-600" />
                          Current Sensor Readings
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Ruler className="h-4 w-4 text-gray-500" />
                            <div>
                              <span className="text-muted-foreground">Depth Reading:</span>
                              <div className="font-medium">
                                {latestReading.asset_depth || latestReading.tank_depth
                                  ? `${(latestReading.asset_depth || latestReading.tank_depth)?.toFixed(2)}m`
                                  : 'N/A'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Waves className="h-4 w-4 text-gray-500" />
                            <div>
                              <span className="text-muted-foreground">Pressure:</span>
                              <div className="font-medium">
                                {latestReading.asset_pressure || latestReading.tank_pressure
                                  ? `${(latestReading.asset_pressure || latestReading.tank_pressure)?.toFixed(1)} kPa`
                                  : 'N/A'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Waves className="h-4 w-4 text-gray-500" />
                            <div>
                              <span className="text-muted-foreground">Pressure (Bar):</span>
                              <div className="font-medium">
                                {latestReading.asset_pressure_bar
                                  ? `${latestReading.asset_pressure_bar.toFixed(2)} bar`
                                  : 'N/A'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Thermometer className="h-4 w-4 text-gray-500" />
                            <div>
                              <span className="text-muted-foreground">Device Temp:</span>
                              <div className="font-medium">
                                {latestReading.device_temperature
                                  ? `${latestReading.device_temperature.toFixed(0)}°C`
                                  : 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Technical Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Signal className="h-5 w-5" />
                        Technical Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Network ID:</span>
                          <div className="font-medium">{assetData?.device_network_id || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Device SKU:</span>
                          <div className="font-medium">{assetData?.device_sku || asset.device_sku_name || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Helmet Serial:</span>
                          <div className="font-medium">{assetData?.helmet_serial_number || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Model:</span>
                          <div className="font-medium">{asset.device_sku_name || 'Unknown'}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Serial Number:</span>
                          <div className="font-medium">{asset.device_serial_number || 'Unknown'}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Device ID:</span>
                          <div className="font-medium">{asset.device_id || 'Unknown'}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Activation Date:</span>
                          <div className="font-medium">
                            {asset.device_activation_date
                              ? format(new Date(asset.device_activation_date), 'PPP')
                              : 'Unknown'}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Subscription ID:</span>
                          <div className="font-medium">{asset.subscription_id || 'Unknown'}</div>
                        </div>
                      </div>

                      {/* Asset Profile */}
                      <div className="pt-4 border-t">
                        <h4 className="font-medium mb-2">Asset Profile</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Asset Name:</span>
                            <div className="font-medium">{asset.asset_profile_name || 'Unknown'}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Asset Serial:</span>
                            <div className="font-medium">{asset.asset_serial_number || 'Unknown'}</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </TabsContent>

          {/* Location Tab */}
          <TabsContent value="location" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Address Line 1:</span>
                    <div className="font-medium">{selectedLocation.address1 || 'Not specified'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Address Line 2:</span>
                    <div className="font-medium">{selectedLocation.address2 || 'Not specified'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">State:</span>
                    <div className="font-medium">{selectedLocation.state || 'Not specified'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Postcode:</span>
                    <div className="font-medium">{selectedLocation.postcode || 'Not specified'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Country:</span>
                    <div className="font-medium">{selectedLocation.country || 'Not specified'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Customer:</span>
                    <div className="font-medium">{selectedLocation.customer_name || 'Unknown'}</div>
                  </div>
                </div>

                {/* GPS Coordinates */}
                {(selectedLocation.lat && selectedLocation.lng) && (
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">GPS Coordinates</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Latitude:</span>
                        <div className="font-medium">{selectedLocation.lat.toFixed(6)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Longitude:</span>
                        <div className="font-medium">{selectedLocation.lng.toFixed(6)}</div>
                      </div>
                    </div>
                    {/* TODO: Add map component here if needed */}
                  </div>
                )}

                {/* Reported GPS from devices */}
                {mainAsset && (mainAsset.latest_reported_lat || mainAsset.latest_reported_lng) && (
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Latest Reported GPS</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Device Latitude:</span>
                        <div className="font-medium">
                          {mainAsset.latest_reported_lat?.toFixed(6) || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Device Longitude:</span>
                        <div className="font-medium">
                          {mainAsset.latest_reported_lng?.toFixed(6) || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            {/* Historical Reading Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Reading History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AgbotReadingHistory
                  locationId={selectedLocation.id}
                  days={30}
                />
              </CardContent>
            </Card>

            {/* Charts Section */}
            {historyData && historyData.readings.length > 0 && (
              <AgbotReadingCharts
                readings={historyData.readings}
                isLoading={historyLoading}
                showLitres={!!selectedLocation.water_capacity}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}