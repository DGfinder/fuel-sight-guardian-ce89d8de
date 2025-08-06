import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AgbotWebhookHealthStatus } from './AgbotWebhookHealthStatus';
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
  Webhook,
  Signal,
  TrendingUp,
  Globe
} from 'lucide-react';

export function AgbotWebhookMonitoring() {
  const { data: locations, isLoading: locationsLoading, error: locationsError } = useAgbotLocations();
  const { data: syncLogs, isLoading: logsLoading } = useAgbotSyncLogs(10);

  const systemStats = {
    totalLocations: locations?.length || 0,
    totalAssets: locations?.flatMap(l => l.assets || []).length || 0,
    onlineDevices: locations?.flatMap(l => l.assets || []).filter(a => a.device_online).length || 0,
    offlineDevices: locations?.flatMap(l => l.assets || []).filter(a => !a.device_online).length || 0,
    lowFuelLocations: locations?.filter(l => l.latest_calibrated_fill_percentage < 20).length || 0
  };

  // Webhook-specific analytics
  const getWebhookAnalytics = () => {
    if (!syncLogs) return { webhookLogs: [], successRate: 0, avgProcessingTime: 0, lastSuccessfulWebhook: null };

    const webhookLogs = syncLogs.filter(log => log.sync_type === 'gasbot_webhook');
    const successfulWebhooks = webhookLogs.filter(log => log.sync_status === 'success');
    const successRate = webhookLogs.length > 0 ? Math.round((successfulWebhooks.length / webhookLogs.length) * 100) : 0;
    
    const processingTimes = webhookLogs
      .filter(log => log.sync_duration_ms)
      .map(log => log.sync_duration_ms);
    
    const avgProcessingTime = processingTimes.length > 0
      ? Math.round(processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length)
      : 0;

    const lastSuccessfulWebhook = successfulWebhooks[0];

    return {
      webhookLogs,
      successRate,
      avgProcessingTime,
      lastSuccessfulWebhook
    };
  };

  const webhookAnalytics = getWebhookAnalytics();
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

  const getSuccessRateColor = () => {
    if (webhookAnalytics.successRate >= 95) return 'text-green-600';
    if (webhookAnalytics.successRate >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSuccessRateBadge = () => {
    if (webhookAnalytics.successRate >= 95) return 'default';
    if (webhookAnalytics.successRate >= 80) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      {/* Webhook Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Data Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{systemStats.totalLocations}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receiving webhook data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Webhook Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className={`text-2xl font-bold ${getSuccessRateColor()}`}>
                {webhookAnalytics.successRate}%
              </span>
              <Badge variant={getSuccessRateBadge()}>
                {webhookAnalytics.webhookLogs.filter(l => l.sync_status === 'success').length}/
                {webhookAnalytics.webhookLogs.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Recent webhook processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Processing Speed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{webhookAnalytics.avgProcessingTime}</span>
              <span className="text-sm text-muted-foreground">ms</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average processing time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Data Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {webhookAnalytics.lastSuccessfulWebhook ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">
                      {formatTimestamp(webhookAnalytics.lastSuccessfulWebhook.started_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {webhookAnalytics.lastSuccessfulWebhook.assets_processed || 0} tanks processed
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">No webhook data</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Device Health (unchanged from original) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              Total Devices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Signal className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{systemStats.totalAssets}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cellular monitoring devices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Webhook Health Status - Full Details */}
      <AgbotWebhookHealthStatus showFullDetails={true} />

      {/* Data Loading States and Errors */}
      {locationsError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Data Loading Error</AlertTitle>
          <AlertDescription>
            <p className="mb-2">Failed to load Gasbot location data:</p>
            <code className="text-xs bg-destructive/10 p-1 rounded">
              {locationsError.message}
            </code>
            <p className="mt-2 text-sm">
              This could indicate webhook processing issues or database connectivity problems.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {locationsLoading && (
        <Alert>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertTitle>Loading Data</AlertTitle>
          <AlertDescription>
            Loading latest webhook data from database...
          </AlertDescription>
        </Alert>
      )}

      {!locationsLoading && !locationsError && systemStats.totalLocations === 0 && (
        <Alert>
          <Webhook className="h-4 w-4" />
          <AlertTitle>No Webhook Data Available</AlertTitle>
          <AlertDescription>
            No data received from Gasbot webhooks. This could mean:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Webhook is not configured in Gasbot dashboard</li>
              <li>Webhook authentication issues</li>
              <li>Network connectivity problems</li>
              <li>Gasbot webhook service is not sending data</li>
            </ul>
            <div className="mt-3 p-2 bg-muted rounded text-xs">
              <strong>Webhook URL:</strong> https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Recent Webhook Activity */}
      {webhookAnalytics.webhookLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Webhook Activity
            </CardTitle>
            <CardDescription>
              Latest webhook receptions and processing results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {webhookAnalytics.webhookLogs.slice(0, 5).map((log) => (
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
                        Webhook Data Received
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
                    <div className="text-xs text-muted-foreground mt-1 space-x-2">
                      {log.locations_processed > 0 && (
                        <span>{log.locations_processed} locations</span>
                      )}
                      {log.assets_processed > 0 && (
                        <span>{log.assets_processed} tanks</span>
                      )}
                    </div>
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
          <AlertTitle>Webhook System Operational</AlertTitle>
          <AlertDescription>
            Receiving data for {systemStats.totalLocations} locations with {systemStats.totalAssets} cellular devices via Gasbot webhooks. 
            {webhookAnalytics.successRate >= 95 ? ' All webhooks processing normally.' : 
             webhookAnalytics.successRate >= 80 ? ' Some webhook processing issues detected.' : 
             ' Webhook processing requires immediate attention.'}
            {deviceReliability >= 90 ? ' All devices performing well.' : 
             deviceReliability >= 70 ? ' Some devices may need attention.' : 
             ' Multiple devices require immediate attention.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Webhook Configuration Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Webhook Configuration
          </CardTitle>
          <CardDescription>
            Configure these settings in your Gasbot dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-muted-foreground">Webhook URL</p>
                <code className="text-xs bg-muted p-2 rounded block mt-1">
                  https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook
                </code>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Authentication</p>
                <code className="text-xs bg-muted p-2 rounded block mt-1">
                  Bearer FSG-gasbot-webhook-2025
                </code>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-muted-foreground">Method</p>
                <code className="text-xs bg-muted p-2 rounded block mt-1">POST</code>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Content Type</p>
                <code className="text-xs bg-muted p-2 rounded block mt-1">application/json</code>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}