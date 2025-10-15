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
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { useAgbotModal } from '@/contexts/AgbotModalContext';
import { 
  usePercentageColor, 
  formatTimestamp 
} from '@/hooks/useAgbotData';
import { useAgbotLocationAnalytics } from '@/hooks/useAgbotAnalytics';
import { Button } from '@/components/ui/button';

export default function AgbotDetailsModal() {
  const { selectedLocation, open, closeModal } = useAgbotModal();
  const { data: analytics, isLoading: analyticsLoading } = useAgbotLocationAnalytics(selectedLocation);
  
  const mainAsset = selectedLocation?.assets?.[0];
  const allAssets = selectedLocation?.assets || [];
  const isOnline = selectedLocation?.location_status === 2 && (mainAsset?.device_online ?? false);
  const percentage = selectedLocation?.latest_calibrated_fill_percentage ?? mainAsset?.latest_calibrated_fill_percentage;
  const percentageColor = usePercentageColor(percentage);

  if (!selectedLocation) return null;

  return (
    <Dialog open={open} onOpenChange={closeModal}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
              <Badge variant={isOnline ? "default" : "secondary"}>
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
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
                  <div className={`text-6xl font-bold ${percentageColor}`}>
                    {percentage !== null && percentage !== undefined 
                      ? `${percentage.toFixed(1)}%` 
                      : 'No Data'
                    }
                  </div>
                  {percentage !== null && percentage !== undefined && (
                    <Progress value={percentage} className="h-4" />
                  )}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-muted-foreground">Status</div>
                      <div className={`font-semibold ${
                        percentage === null || percentage === undefined ? 'text-gray-500' :
                        percentage < 20 ? 'text-red-600' : 
                        percentage < 50 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {percentage === null || percentage === undefined ? 'No Data' :
                         percentage < 20 ? 'Low Fuel' : 
                         percentage < 50 ? 'Medium' : 'Good'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground">Calibrated</div>
                      <div className="font-semibold">
                        {percentage !== null && percentage !== undefined ? `${percentage.toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground">Raw Reading</div>
                      <div className="font-semibold">
                        {mainAsset?.latest_raw_fill_percentage !== null && mainAsset?.latest_raw_fill_percentage !== undefined 
                          ? `${mainAsset.latest_raw_fill_percentage.toFixed(1)}%` 
                          : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {isOnline ? 
                      <Wifi className="h-8 w-8 text-green-500" /> : 
                      <WifiOff className="h-8 w-8 text-red-500" />
                    }
                    <div>
                      <div className="font-semibold">Connection Status</div>
                      <div className={`text-sm ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                        {isOnline ? 'Connected' : 'Disconnected'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-blue-500" />
                    <div>
                      <div className="font-semibold">Last Reading</div>
                      <div className="text-sm text-muted-foreground">
                        {formatTimestamp(selectedLocation.latest_telemetry)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

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
            {analyticsLoading ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading analytics...</p>
                </CardContent>
              </Card>
            ) : analytics ? (
              <>
                {/* Consumption Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5" />
                      Consumption Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {(() => {
                            // Estimate tank capacity based on common fuel tank sizes (50,000L average)
                            const estimatedCapacity = 50000; // litres - can be improved with actual capacity data
                            const dailyLitres = (analytics.rolling_avg_pct_per_day / 100) * estimatedCapacity;
                            return dailyLitres >= 1 ? `${dailyLitres.toFixed(0)}L` : `${analytics.rolling_avg_pct_per_day.toFixed(2)}%`;
                          })()}
                        </div>
                        <div className="text-sm text-muted-foreground">Daily Consumption</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {(() => {
                            const estimatedCapacity = 50000;
                            const dailyLitres = (analytics.rolling_avg_pct_per_day / 100) * estimatedCapacity;
                            return dailyLitres >= 1 ? 'estimated litres per day' : 'percentage points per day';
                          })()}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {(() => {
                            const estimatedCapacity = 50000;
                            const yesterdayLitres = (analytics.prev_day_pct_used / 100) * estimatedCapacity;
                            return yesterdayLitres >= 1 ? `${yesterdayLitres.toFixed(0)}L` : `${analytics.prev_day_pct_used.toFixed(2)}%`;
                          })()}
                        </div>
                        <div className="text-sm text-muted-foreground">Yesterday's Usage</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {(() => {
                            const estimatedCapacity = 50000;
                            const yesterdayLitres = (analytics.prev_day_pct_used / 100) * estimatedCapacity;
                            return yesterdayLitres >= 1 ? 'estimated litres consumed' : 'percentage points consumed';
                          })()}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${
                          analytics.days_to_critical_level === null ? 'text-gray-500' :
                          analytics.days_to_critical_level <= 7 ? 'text-red-600' :
                          analytics.days_to_critical_level <= 14 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {analytics.days_to_critical_level?.toFixed(1) || 'N/A'}
                        </div>
                        <div className="text-sm text-muted-foreground">Days to Critical</div>
                        <div className="text-xs text-gray-500 mt-1">until reaching 20%</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Performance Scores
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Efficiency Score</span>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(100, analytics.efficiency_score)} className="w-20 h-2" />
                          <span className={`text-sm font-semibold ${
                            analytics.efficiency_score >= 80 ? 'text-green-600' :
                            analytics.efficiency_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {analytics.efficiency_score.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Data Reliability</span>
                        <div className="flex items-center gap-2">
                          <Progress value={analytics.data_reliability_score} className="w-20 h-2" />
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
                        <Activity className="h-5 w-5" />
                        Consumption Trend
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Velocity: </span>
                        <span className={analytics.consumption_velocity > 0 ? 'text-red-600' : 
                                       analytics.consumption_velocity < 0 ? 'text-green-600' : 'text-gray-600'}>
                          {analytics.consumption_velocity > 0 ? '+' : ''}{analytics.consumption_velocity.toFixed(2)}%/day
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {analytics.consumption_velocity > 0 ? 'Consumption accelerating' :
                         analytics.consumption_velocity < 0 ? 'Consumption decelerating' : 'Consumption stable'}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Refill Analysis */}
                {analytics.last_refill_date && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Refill Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
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
                        <div className="flex items-center gap-2 p-2 rounded-md bg-yellow-50 border border-yellow-200">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm text-yellow-800">
                            Unusual consumption pattern detected - usage is higher than normal
                          </span>
                        </div>
                      )}
                      {analytics.potential_leak_alert && (
                        <div className="flex items-center gap-2 p-2 rounded-md bg-red-50 border border-red-200">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="text-sm text-red-800">
                            Potential leak detected - consistently high consumption rate
                          </span>
                        </div>
                      )}
                      {analytics.device_connectivity_alert && (
                        <div className="flex items-center gap-2 p-2 rounded-md bg-orange-50 border border-orange-200">
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
              <div className="space-y-4">
                {/* Show available current data even when analytics aren't available */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      Current Status & Available Data
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className={`text-3xl font-bold ${percentageColor}`}>
                          {percentage !== null && percentage !== undefined 
                            ? `${percentage.toFixed(1)}%` 
                            : 'No Data'
                          }
                        </div>
                        <div className="text-sm text-muted-foreground">Current Fuel Level</div>
                        <div className="text-xs text-gray-500 mt-1">calibrated reading</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-medium">
                          {formatTimestamp(selectedLocation.latest_telemetry)}
                        </div>
                        <div className="text-sm text-muted-foreground">Last Reading</div>
                        {selectedLocation.latest_telemetry && (
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(selectedLocation.latest_telemetry).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {mainAsset && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-2">Device Information</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Device:</span>
                            <div className="font-medium">{mainAsset.device_sku_name || 'Unknown'}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status:</span>
                            <div className={`font-medium ${mainAsset.device_online ? 'text-green-600' : 'text-red-600'}`}>
                              {mainAsset.device_online ? 'Reliable' : 'Unreliable'}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Serial:</span>
                            <div className="font-medium">{mainAsset.device_serial_number || 'Unknown'}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Raw Reading:</span>
                            <div className="font-medium">
                              {mainAsset.latest_raw_fill_percentage !== null && mainAsset.latest_raw_fill_percentage !== undefined 
                                ? `${mainAsset.latest_raw_fill_percentage.toFixed(1)}%` 
                                : 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6 text-center">
                    <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics Unavailable</h3>
                    <p className="text-gray-600 text-sm">
                      Historical analytics require at least 2 days of readings. Data collection is ongoing and analytics will be available once sufficient data is collected.
                    </p>
                    <div className="mt-3 text-xs text-gray-500">
                      Check the History tab to see available raw data points.
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Device Tab */}
          <TabsContent value="device" className="space-y-4">
            {allAssets.map((asset, index) => (
              <Card key={asset.asset_guid}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Signal className="h-5 w-5" />
                      Device {index + 1}
                      {allAssets.length === 1 && " (Primary)"}
                    </div>
                    <Badge variant={asset.device_online ? "default" : "secondary"}>
                      {asset.device_online ? 'Online' : 'Offline'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
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
                      <span className="text-muted-foreground">Model Label:</span>
                      <div className="font-medium">{asset.device_model_label || 'Unknown'}</div>
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

                  {/* Asset Profile Info */}
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Asset Profile</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
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

                  {/* Latest Reading Info */}
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Latest Reading</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Calibrated:</span>
                        <div className="font-medium">
                          {asset.latest_calibrated_fill_percentage !== null && asset.latest_calibrated_fill_percentage !== undefined
                            ? `${asset.latest_calibrated_fill_percentage.toFixed(1)}%`
                            : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Raw:</span>
                        <div className="font-medium">
                          {asset.latest_raw_fill_percentage !== null && asset.latest_raw_fill_percentage !== undefined
                            ? `${asset.latest_raw_fill_percentage.toFixed(1)}%`
                            : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Timestamp:</span>
                        <div className="font-medium">
                          {formatTimestamp(asset.latest_telemetry_event_timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
                <div className="grid grid-cols-2 gap-4 text-sm">
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
                    <div className="grid grid-cols-2 gap-4 text-sm">
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
                    <div className="grid grid-cols-2 gap-4 text-sm">
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
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Reading History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Historical Data Coming Soon</p>
                  <p className="text-sm">
                    Fuel level trends and historical readings will be displayed here when available.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}