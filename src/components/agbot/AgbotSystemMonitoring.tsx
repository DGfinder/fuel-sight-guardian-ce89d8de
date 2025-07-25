import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AgbotAPIHealthStatus } from './AgbotAPIHealthStatus';
import { 
  useAgbotLocations, 
  useAgbotSyncLogs,
  formatTimestamp 
} from '@/hooks/useAgbotData';
import { 
  Database, 
  Activity, 
  AlertTriangle, 
  Clock, 
  CheckCircle,
  XCircle,
  RefreshCw,
  WifiOff
} from 'lucide-react';

export function AgbotSystemMonitoring() {
  const { data: locations, isLoading: locationsLoading, error: locationsError } = useAgbotLocations();
  const { data: syncLogs, isLoading: logsLoading } = useAgbotSyncLogs(5);

  const systemStats = {
    totalLocations: locations?.length || 0,
    totalAssets: locations?.flatMap(l => l.assets || []).length || 0,
    onlineDevices: locations?.flatMap(l => l.assets || []).filter(a => a.device_online).length || 0,
    offlineDevices: locations?.flatMap(l => l.assets || []).filter(a => !a.device_online).length || 0,
    lowFuelLocations: locations?.filter(l => l.latest_calibrated_fill_percentage < 20).length || 0
  };

  const deviceReliability = systemStats.totalAssets > 0 
    ? Math.round((systemStats.onlineDevices / systemStats.totalAssets) * 100)
    : 0;

  const getReliabilityColor = () => {
    if (deviceReliability >= 90) return 'text-green-600';
    if (deviceReliability >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getReliabilityBadge = () => {
    if (deviceReliability >= 90) return 'default';
    if (deviceReliability >= 70) return 'secondary';
    return 'destructive';
  };

  const lastSync = syncLogs?.[0];
  const isRecentSync = lastSync && new Date(lastSync.started_at).getTime() > Date.now() - (60 * 60 * 1000); // Last hour

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{systemStats.totalLocations}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Device Reliability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className={`text-2xl font-bold ${getReliabilityColor()}`}>
                {deviceReliability}%
              </span>
              <Badge variant={getReliabilityBadge()}>
                {systemStats.onlineDevices}/{systemStats.totalAssets}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {systemStats.onlineDevices} online, {systemStats.offlineDevices} offline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Fuel Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <AlertTriangle className={`h-4 w-4 ${systemStats.lowFuelLocations > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
              <span className={`text-2xl font-bold ${systemStats.lowFuelLocations > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {systemStats.lowFuelLocations}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Locations below 20%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {lastSync ? (
                <>
                  {lastSync.sync_status === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : lastSync.sync_status === 'partial' ? (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {formatTimestamp(lastSync.started_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lastSync.locations_processed || 0} locations
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">No sync data</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Health Status */}
      <AgbotAPIHealthStatus showFullDetails={true} />

      {/* Data Loading States and Errors */}
      {locationsError && (
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Data Loading Error</AlertTitle>
          <AlertDescription>
            <p className="mb-2">Failed to load Agbot location data:</p>
            <code className="text-xs bg-destructive/10 p-1 rounded">
              {locationsError.message}
            </code>
            <p className="mt-2 text-sm">
              This is expected if the Athara API is unavailable. No mock data is provided in production.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {locationsLoading && (
        <Alert>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertTitle>Loading Data</AlertTitle>
          <AlertDescription>
            Fetching latest cellular monitoring data from Athara API...
          </AlertDescription>
        </Alert>
      )}

      {!locationsLoading && !locationsError && systemStats.totalLocations === 0 && (
        <Alert>
          <Database className="h-4 w-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>
            No cellular monitoring locations found. This could mean:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>No devices are currently deployed</li>
              <li>API authentication issues</li>
              <li>Network connectivity problems</li>
              <li>Athara API service is temporarily unavailable</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Recent Sync History */}
      {syncLogs && syncLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Sync Activity
            </CardTitle>
            <CardDescription>
              Latest data synchronization attempts with Athara API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {syncLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {log.sync_status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : log.sync_status === 'partial' ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    ) : log.sync_status === 'running' ? (
                      <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {log.sync_type === 'manual' ? 'Manual Sync' : 
                         log.sync_type === 'manual_api_sync' ? 'API Sync' : 
                         'Scheduled Sync'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimestamp(log.started_at)}
                        {log.sync_duration_ms && ` • ${log.sync_duration_ms}ms`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={
                      log.sync_status === 'success' ? 'default' : 
                      log.sync_status === 'partial' ? 'secondary' : 
                      'destructive'
                    }>
                      {log.sync_status}
                    </Badge>
                    {log.locations_processed > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {log.locations_processed} locations
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Status Summary */}
      {!locationsLoading && systemStats.totalLocations > 0 && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>System Operational</AlertTitle>
          <AlertDescription>
            Monitoring {systemStats.totalLocations} locations with {systemStats.totalAssets} cellular devices. 
            {deviceReliability >= 90 ? ' All systems performing normally.' : 
             deviceReliability >= 70 ? ' Some devices may need attention.' : 
             ' Multiple devices require immediate attention.'}
            {!isRecentSync && ' Data may be stale - consider triggering a manual sync.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}