/**
 * Agbot Predictions Page
 * Predictive analytics dashboard for device health, consumption forecasting, and anomaly detection
 */

import React, { useState, useMemo } from 'react';
import { useAgbotPredictions } from '@/hooks/useAgbotPredictions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Activity,
  AlertTriangle,
  Battery,
  BatteryWarning,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Fuel,
  Signal,
  SignalZero,
  Thermometer,
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Droplets,
  CalendarDays
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import {
  DeviceHealthPrediction,
  ConsumptionForecast,
  AnomalyReport,
  FleetHealthScore,
  Anomaly
} from '@/utils/agbotPredictions';

// ============================================
// SUMMARY CARDS
// ============================================

function FleetHealthCard({ health }: { health: FleetHealthScore }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <Card className={cn('border-2', getScoreBg(health.overallScore))}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Fleet Health</p>
            <p className={cn('text-3xl font-bold', getScoreColor(health.overallScore))}>
              {health.overallScore}%
            </p>
          </div>
          <Activity className={cn('h-10 w-10', getScoreColor(health.overallScore))} />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {health.devicesHealthy} healthy, {health.devicesAtRisk} at risk
        </p>
      </CardContent>
    </Card>
  );
}

function AtRiskCard({ count, critical }: { count: number; critical: number }) {
  return (
    <Card className={cn(
      'border-2',
      critical > 0 ? 'bg-red-50 border-red-200' : count > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">At Risk Devices</p>
            <p className={cn('text-3xl font-bold', critical > 0 ? 'text-red-600' : count > 0 ? 'text-yellow-600' : 'text-green-600')}>
              {count + critical}
            </p>
          </div>
          <AlertTriangle className={cn('h-10 w-10', critical > 0 ? 'text-red-600' : count > 0 ? 'text-yellow-600' : 'text-green-600')} />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {critical > 0 ? `${critical} critical` : 'No critical issues'}
        </p>
      </CardContent>
    </Card>
  );
}

function AnomaliesCard({ count }: { count: number }) {
  return (
    <Card className={cn(
      'border-2',
      count > 5 ? 'bg-red-50 border-red-200' : count > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Active Anomalies</p>
            <p className={cn('text-3xl font-bold', count > 5 ? 'text-red-600' : count > 0 ? 'text-yellow-600' : 'text-green-600')}>
              {count}
            </p>
          </div>
          <AlertCircle className={cn('h-10 w-10', count > 5 ? 'text-red-600' : count > 0 ? 'text-yellow-600' : 'text-green-600')} />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {count === 0 ? 'All systems normal' : 'Requires attention'}
        </p>
      </CardContent>
    </Card>
  );
}

function RefillsDueCard({ count }: { count: number }) {
  return (
    <Card className={cn(
      'border-2',
      count > 5 ? 'bg-red-50 border-red-200' : count > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Refills Due (7d)</p>
            <p className={cn('text-3xl font-bold', count > 5 ? 'text-red-600' : count > 0 ? 'text-yellow-600' : 'text-green-600')}>
              {count}
            </p>
          </div>
          <Droplets className={cn('h-10 w-10', count > 5 ? 'text-red-600' : count > 0 ? 'text-yellow-600' : 'text-green-600')} />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {count === 0 ? 'No immediate refills needed' : `${count} tanks need refill`}
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================
// DEVICE HEALTH LIST
// ============================================

function DeviceHealthList({
  devices,
  searchTerm
}: {
  devices: DeviceHealthPrediction[];
  searchTerm: string;
}) {
  const filtered = useMemo(() => {
    if (!searchTerm) return devices;
    const lower = searchTerm.toLowerCase();
    return devices.filter(d => d.locationName.toLowerCase().includes(lower));
  }, [devices, searchTerm]);

  // Sort: offline first, then by voltage anomaly, then by name
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Offline devices first
      const aOffline = a.offlineFrequency > 0.5;
      const bOffline = b.offlineFrequency > 0.5;
      if (aOffline !== bOffline) return aOffline ? -1 : 1;

      // Then by voltage issues (low voltage first)
      const aVoltage = a.batteryPrediction.currentVoltage ?? 999;
      const bVoltage = b.batteryPrediction.currentVoltage ?? 999;
      if (aVoltage < 3.5 || bVoltage < 3.5) {
        return aVoltage - bVoltage;
      }

      // Then alphabetically
      return a.locationName.localeCompare(b.locationName);
    });
  }, [filtered]);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No devices found {searchTerm && 'matching your search'}
      </div>
    );
  }

  // Helper to determine device status
  // Note: AgBot devices typically run at ~3.5V (solar powered), so only flag truly low voltage
  const getDeviceStatus = (device: DeviceHealthPrediction) => {
    const isOffline = device.offlineFrequency > 0.5;
    const voltage = device.batteryPrediction.currentVoltage;
    const hasLowVoltage = voltage !== null && voltage < 3.2; // Critical: likely to fail soon
    const hasVoltageWarning = voltage !== null && voltage < 3.4 && voltage >= 3.2; // Warning: below normal
    const hasHighTemp = device.temperatureAvg !== null && device.temperatureAvg > 55; // High temp threshold
    const hasTempVariance = device.temperatureVariance > 20; // Excessive temperature swings

    if (isOffline) return { status: 'offline', color: 'red', label: 'Offline' };
    if (hasLowVoltage) return { status: 'critical', color: 'red', label: 'Low Voltage' };
    if (hasVoltageWarning || hasHighTemp) return { status: 'warning', color: 'amber', label: 'Warning' };
    if (hasTempVariance) return { status: 'check', color: 'amber', label: 'Check Temp' };
    return { status: 'operational', color: 'green', label: 'Operational' };
  };

  return (
    <div className="space-y-2">
      {sorted.map(device => {
        const status = getDeviceStatus(device);
        const voltage = device.batteryPrediction.currentVoltage;

        return (
          <div
            key={device.assetId}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border',
              status.color === 'red' ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800' :
              status.color === 'amber' ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800' :
              'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
            )}
          >
            {/* Device Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Status indicator */}
              <div className={cn(
                'w-3 h-3 rounded-full flex-shrink-0',
                status.color === 'red' ? 'bg-red-500' :
                status.color === 'amber' ? 'bg-amber-500' :
                'bg-green-500'
              )} />

              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {device.locationName}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {/* Online/Offline */}
                  <span className={cn(
                    'flex items-center gap-1',
                    device.offlineFrequency > 0.5 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                  )}>
                    {device.offlineFrequency > 0.5 ? (
                      <><SignalZero className="h-3 w-3" /> Offline</>
                    ) : (
                      <><Signal className="h-3 w-3" /> Online</>
                    )}
                  </span>

                  {/* Voltage */}
                  {voltage !== null && (
                    <span className={cn(
                      'flex items-center gap-1',
                      voltage < 3.2 ? 'text-red-600 dark:text-red-400' :
                      voltage < 3.4 ? 'text-amber-600 dark:text-amber-400' :
                      'text-gray-500 dark:text-gray-400'
                    )}>
                      <Battery className="h-3 w-3" />
                      {voltage.toFixed(2)}V
                    </span>
                  )}

                  {/* Temperature */}
                  {device.temperatureAvg !== null && (
                    <span className={cn(
                      'flex items-center gap-1',
                      device.temperatureAvg > 55 ? 'text-red-600 dark:text-red-400' :
                      device.temperatureVariance > 20 ? 'text-amber-600 dark:text-amber-400' :
                      'text-gray-500 dark:text-gray-400'
                    )}>
                      <Thermometer className="h-3 w-3" />
                      {device.temperatureAvg.toFixed(0)}°C
                      {device.temperatureVariance > 15 && (
                        <span className="text-[10px]">(±{device.temperatureVariance.toFixed(0)}°)</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <Badge
              variant="outline"
              className={cn(
                'flex-shrink-0',
                status.color === 'red' ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300' :
                status.color === 'amber' ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300' :
                'bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300'
              )}
            >
              {status.label}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// CONSUMPTION FORECAST TABLE
// ============================================

function ConsumptionForecastTable({
  forecasts,
  searchTerm
}: {
  forecasts: ConsumptionForecast[];
  searchTerm: string;
}) {
  const filtered = useMemo(() => {
    if (!searchTerm) return forecasts;
    const lower = searchTerm.toLowerCase();
    return forecasts.filter(f => f.locationName.toLowerCase().includes(lower));
  }, [forecasts, searchTerm]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Sort by days remaining (lowest first)
      const aDays = a.daysRemaining ?? 999;
      const bDays = b.daysRemaining ?? 999;
      return aDays - bDays;
    });
  }, [filtered]);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No forecasts found {searchTerm && 'matching your search'}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Location</TableHead>
          <TableHead className="text-center">Level</TableHead>
          <TableHead className="text-center">Days Left</TableHead>
          <TableHead className="text-center">Consumption</TableHead>
          <TableHead>Refill By</TableHead>
          <TableHead className="text-center">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.slice(0, 15).map(forecast => (
          <TableRow key={forecast.assetId}>
            <TableCell className="font-medium">{forecast.locationName}</TableCell>
            <TableCell className="text-center">
              <span className={cn(
                'font-semibold',
                forecast.currentLevel <= 20 ? 'text-red-600' :
                forecast.currentLevel <= 30 ? 'text-yellow-600' : 'text-green-600'
              )}>
                {forecast.currentLevel.toFixed(0)}%
              </span>
            </TableCell>
            <TableCell className="text-center">
              <span className={cn(
                'font-semibold',
                forecast.daysRemaining !== null && forecast.daysRemaining <= 3 ? 'text-red-600' :
                forecast.daysRemaining !== null && forecast.daysRemaining <= 7 ? 'text-yellow-600' : 'text-gray-700'
              )}>
                {forecast.daysRemaining !== null ? forecast.daysRemaining : '-'}
              </span>
            </TableCell>
            <TableCell className="text-center text-gray-600">
              {forecast.avgDailyConsumption.toFixed(1)}%/day
            </TableCell>
            <TableCell>
              {forecast.optimalRefillDate ? (
                <span className={cn(
                  forecast.optimalRefillDate <= new Date() ? 'text-red-600 font-semibold' : 'text-gray-600'
                )}>
                  {format(forecast.optimalRefillDate, 'MMM d')}
                </span>
              ) : '-'}
            </TableCell>
            <TableCell className="text-center">
              <Badge variant={
                forecast.urgency === 'critical' ? 'destructive' :
                forecast.urgency === 'warning' ? 'secondary' : 'default'
              }>
                {forecast.urgency}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============================================
// ANOMALY ALERT LIST
// ============================================

function AnomalyAlertList({
  reports,
  searchTerm
}: {
  reports: AnomalyReport[];
  searchTerm: string;
}) {
  const allAnomalies = useMemo(() => {
    const anomalies: (Anomaly & { risk: AnomalyReport['overallRiskLevel'] })[] = [];

    for (const report of reports) {
      for (const anomaly of report.anomalies) {
        anomalies.push({ ...anomaly, risk: report.overallRiskLevel });
      }
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      return anomalies.filter(a => a.locationName.toLowerCase().includes(lower));
    }

    return anomalies;
  }, [reports, searchTerm]);

  const sorted = useMemo(() => {
    return [...allAnomalies].sort((a, b) => {
      // Sort by severity (high first)
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [allAnomalies]);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
        <p className="text-gray-500">No anomalies detected</p>
        <p className="text-sm text-gray-400">All systems operating normally</p>
      </div>
    );
  }

  const getAnomalyIcon = (type: Anomaly['type']) => {
    switch (type) {
      case 'sudden_drop': return <TrendingDown className="h-5 w-5 text-red-500" />;
      case 'unusual_rate': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'sensor_drift': return <Activity className="h-5 w-5 text-blue-500" />;
      case 'night_consumption': return <Clock className="h-5 w-5 text-purple-500" />;
      default: return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-3">
      {sorted.slice(0, 10).map(anomaly => (
        <Card key={anomaly.id} className={cn(
          'border-l-4',
          anomaly.severity === 'high' ? 'border-l-red-500 bg-red-50' :
          anomaly.severity === 'medium' ? 'border-l-yellow-500 bg-yellow-50' : 'border-l-blue-500 bg-blue-50'
        )}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {getAnomalyIcon(anomaly.type)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{anomaly.locationName}</h4>
                  <Badge variant={
                    anomaly.severity === 'high' ? 'destructive' :
                    anomaly.severity === 'medium' ? 'secondary' : 'outline'
                  }>
                    {anomaly.severity}
                  </Badge>
                </div>
                <p className="text-sm text-gray-700 mt-1">{anomaly.description}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDistanceToNow(anomaly.timestamp, { addSuffix: true })}
                </p>
                <p className="text-sm text-blue-700 mt-2 font-medium">
                  {anomaly.recommendation}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function AgbotPredictions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const { data, isLoading, error, refetch, isRefetching } = useAgbotPredictions({ days: 30 });

  if (error) {
    return (
      <div className="p-6">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900">Error Loading Predictions</h3>
            <p className="text-red-700 mt-2">{(error as Error).message}</p>
            <Button onClick={() => refetch()} variant="outline" className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Fleet Predictions</h1>
          <p className="text-gray-500 dark:text-gray-400">Predictive analytics and health monitoring for AgBot tanks</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/agbot/calendar">
            <Button variant="outline">
              <CalendarDays className="h-4 w-4 mr-2" />
              Refill Calendar
            </Button>
          </Link>
          <Button onClick={() => refetch()} variant="outline" disabled={isRefetching}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-24 bg-gray-100" />
            </Card>
          ))}
        </div>
      ) : data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FleetHealthCard health={data.fleetHealth} />
          <AtRiskCard count={data.fleetHealth.devicesAtRisk} critical={data.fleetHealth.devicesCritical} />
          <AnomaliesCard count={data.fleetHealth.activeAnomalies} />
          <RefillsDueCard count={data.fleetHealth.refillsDueThisWeek} />
        </div>
      )}

      {/* Search and Tabs */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="health">Device Health</TabsTrigger>
                <TabsTrigger value="consumption">Consumption</TabsTrigger>
                <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-32 bg-gray-100" />
            </Card>
          ))}
        </div>
      ) : data && (
        <>
          {(activeTab === 'all' || activeTab === 'health') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Battery className="h-5 w-5" />
                  Device Health Alerts
                </CardTitle>
                <CardDescription>
                  Devices with potential issues or maintenance needs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DeviceHealthList
                  devices={data.deviceHealth.filter(d => d.overallHealth !== 'good' || activeTab === 'health')}
                  searchTerm={searchTerm}
                />
              </CardContent>
            </Card>
          )}

          {(activeTab === 'all' || activeTab === 'consumption') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Fuel className="h-5 w-5" />
                  Consumption Forecasts
                </CardTitle>
                <CardDescription>
                  Predicted fuel levels and refill scheduling
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConsumptionForecastTable
                  forecasts={data.consumptionForecasts}
                  searchTerm={searchTerm}
                />
              </CardContent>
            </Card>
          )}

          {(activeTab === 'all' || activeTab === 'anomalies') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Anomaly Detection
                </CardTitle>
                <CardDescription>
                  Unusual patterns and potential issues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnomalyAlertList
                  reports={data.anomalyReports}
                  searchTerm={searchTerm}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
