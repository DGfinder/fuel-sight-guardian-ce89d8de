import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Activity,
  Zap,
  TrendingUp,
  Bell,
  BellOff,
  Timer,
  Database,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAgbotSyncLogs } from '@/hooks/useAgbotData';
import { formatDistanceToNow, format } from 'date-fns';

interface WebhookHealthMetrics {
  lastWebhookTime: Date | null;
  minutesSinceLastWebhook: number;
  successRate24h: number;
  totalWebhooks24h: number;
  successfulWebhooks24h: number;
  isWebhookOverdue: boolean;
  expectedNextWebhook: Date | null;
  averageResponseTime: number;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
}

const AtharaWebhookMonitor = () => {
  const [notifications, setNotifications] = useState(true);
  const [lastNotificationTime, setLastNotificationTime] = useState<Date | null>(null);
  
  // Fetch recent sync logs (last 48 hours for better analysis)
  const { data: syncLogs, isLoading, refetch } = useAgbotSyncLogs(48);

  // Calculate webhook health metrics
  const healthMetrics = useMemo((): WebhookHealthMetrics => {
    if (!syncLogs || syncLogs.length === 0) {
      return {
        lastWebhookTime: null,
        minutesSinceLastWebhook: 0,
        successRate24h: 0,
        totalWebhooks24h: 0,
        successfulWebhooks24h: 0,
        isWebhookOverdue: false,
        expectedNextWebhook: null,
        averageResponseTime: 0,
        status: 'unknown'
      };
    }

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Filter logs from last 24 hours
    const recent24hLogs = syncLogs.filter(log => 
      new Date(log.started_at) > last24Hours
    );
    
    const webhookLogs = recent24hLogs.filter(log => 
      log.sync_type === 'gasbot_webhook' || log.sync_type === 'webhook'
    );
    
    const successfulWebhooks = webhookLogs.filter(log => 
      log.sync_status === 'success'
    );
    
    // Get the most recent webhook
    const lastWebhook = syncLogs.find(log => 
      log.sync_type === 'gasbot_webhook' || log.sync_type === 'webhook'
    );
    
    const lastWebhookTime = lastWebhook ? new Date(lastWebhook.started_at) : null;
    const minutesSinceLastWebhook = lastWebhookTime ? 
      Math.floor((now.getTime() - lastWebhookTime.getTime()) / (1000 * 60)) : 0;
    
    // Expected webhook interval (60 minutes + 10 minute tolerance)
    const isWebhookOverdue = minutesSinceLastWebhook > 70;
    
    // Calculate expected next webhook (every hour)
    const expectedNextWebhook = lastWebhookTime ? 
      new Date(lastWebhookTime.getTime() + 60 * 60 * 1000) : null;
    
    // Success rate calculation
    const successRate24h = webhookLogs.length > 0 ? 
      (successfulWebhooks.length / webhookLogs.length) * 100 : 0;
    
    // Average response time
    const responseTimes = recent24hLogs
      .filter(log => log.sync_duration_ms && log.sync_duration_ms > 0)
      .map(log => log.sync_duration_ms);
    
    const averageResponseTime = responseTimes.length > 0 ?
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;
    
    // Determine overall health status
    let status: WebhookHealthMetrics['status'] = 'healthy';
    
    if (!lastWebhookTime) {
      status = 'unknown';
    } else if (minutesSinceLastWebhook > 120) { // 2+ hours
      status = 'critical';
    } else if (isWebhookOverdue || successRate24h < 90) {
      status = 'warning';
    }
    
    return {
      lastWebhookTime,
      minutesSinceLastWebhook,
      successRate24h,
      totalWebhooks24h: webhookLogs.length,
      successfulWebhooks24h: successfulWebhooks.length,
      isWebhookOverdue,
      expectedNextWebhook,
      averageResponseTime,
      status
    };
  }, [syncLogs]);

  // Browser notification system
  useEffect(() => {
    if (!notifications || !healthMetrics.lastWebhookTime) return;
    
    const { status, isWebhookOverdue, minutesSinceLastWebhook } = healthMetrics;
    
    // Only send notification if webhook is overdue and we haven't notified recently
    if (isWebhookOverdue && (!lastNotificationTime || 
        Date.now() - lastNotificationTime.getTime() > 30 * 60 * 1000)) { // 30 min cooldown
      
      if (Notification.permission === 'granted') {
        new Notification('⚠️ Athara Webhook Alert', {
          body: `No webhook received for ${minutesSinceLastWebhook} minutes. Expected every hour.`,
          icon: '/favicon.ico',
          tag: 'webhook-alert'
        });
        setLastNotificationTime(new Date());
      }
    }
  }, [healthMetrics, notifications, lastNotificationTime]);

  // Request notification permission on mount
  useEffect(() => {
    if (notifications && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [notifications]);

  const getStatusColor = (status: WebhookHealthMetrics['status']) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: WebhookHealthMetrics['status']) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'critical': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: WebhookHealthMetrics['status']) => {
    switch (status) {
      case 'healthy': return <Badge variant="default" className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'warning': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'critical': return <Badge variant="destructive">Critical</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  return (
    <div className="space-y-6">
      {/* Main Status Card */}
      <Card className={`border-l-4 ${
        healthMetrics.status === 'healthy' ? 'border-green-500 bg-green-50' :
        healthMetrics.status === 'warning' ? 'border-yellow-500 bg-yellow-50' :
        healthMetrics.status === 'critical' ? 'border-red-500 bg-red-50' :
        'border-gray-300'
      }`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                {healthMetrics.lastWebhookTime ? <Wifi className="w-5 h-5 text-blue-600" /> : <WifiOff className="w-5 h-5 text-gray-400" />}
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Athara Webhook Monitor
                  {getStatusIcon(healthMetrics.status)}
                  {getStatusBadge(healthMetrics.status)}
                </CardTitle>
                <CardDescription>
                  Monitoring hourly JSON data from Athara/Gasbot API
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNotifications(!notifications)}
              >
                {notifications ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                {notifications ? 'Alerts On' : 'Alerts Off'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Last Webhook */}
            <div className="text-center p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center justify-center mb-2">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">Last Webhook</p>
              {healthMetrics.lastWebhookTime ? (
                <>
                  <p className={`text-lg font-bold ${getStatusColor(healthMetrics.status)}`}>
                    {formatDistanceToNow(healthMetrics.lastWebhookTime, { addSuffix: true })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {format(healthMetrics.lastWebhookTime, 'HH:mm:ss')}
                  </p>
                </>
              ) : (
                <p className="text-lg font-bold text-gray-400">Never</p>
              )}
            </div>

            {/* Next Expected */}
            <div className="text-center p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center justify-center mb-2">
                <Timer className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-sm text-gray-600">Next Expected</p>
              {healthMetrics.expectedNextWebhook ? (
                <p className="text-lg font-bold text-purple-600">
                  {format(healthMetrics.expectedNextWebhook, 'HH:mm')}
                </p>
              ) : (
                <p className="text-lg font-bold text-gray-400">Unknown</p>
              )}
            </div>

            {/* Success Rate */}
            <div className="text-center p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">Success Rate (24h)</p>
              <p className="text-lg font-bold text-green-600">
                {healthMetrics.successRate24h.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">
                {healthMetrics.successfulWebhooks24h}/{healthMetrics.totalWebhooks24h} successful
              </p>
            </div>

            {/* Response Time */}
            <div className="text-center p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center justify-center mb-2">
                <Zap className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-sm text-gray-600">Avg Response</p>
              <p className="text-lg font-bold text-orange-600">
                {formatDuration(healthMetrics.averageResponseTime)}
              </p>
            </div>
          </div>

          {/* Progress bar for time until next webhook */}
          {healthMetrics.lastWebhookTime && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Time since last webhook</span>
                <span className={`font-medium ${getStatusColor(healthMetrics.status)}`}>
                  {healthMetrics.minutesSinceLastWebhook} min / 60 min
                </span>
              </div>
              <Progress 
                value={Math.min(100, (healthMetrics.minutesSinceLastWebhook / 60) * 100)}
                className={`h-3 ${
                  healthMetrics.status === 'critical' ? '[&>div]:bg-red-500' :
                  healthMetrics.status === 'warning' ? '[&>div]:bg-yellow-500' :
                  '[&>div]:bg-green-500'
                }`}
              />
            </div>
          )}

          {/* Status Alerts */}
          {healthMetrics.status === 'critical' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Critical: Webhook Failure</AlertTitle>
              <AlertDescription>
                No webhook received for {healthMetrics.minutesSinceLastWebhook} minutes. 
                Expected hourly updates. Check Athara/Gasbot configuration.
              </AlertDescription>
            </Alert>
          )}

          {healthMetrics.status === 'warning' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning: Webhook Issue</AlertTitle>
              <AlertDescription>
                {healthMetrics.isWebhookOverdue 
                  ? `Webhook is ${healthMetrics.minutesSinceLastWebhook - 60} minutes late. Next webhook expected soon.`
                  : `Success rate is ${healthMetrics.successRate24h.toFixed(1)}% in last 24 hours.`
                }
              </AlertDescription>
            </Alert>
          )}

          {healthMetrics.status === 'healthy' && healthMetrics.lastWebhookTime && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Healthy: Webhooks Active</AlertTitle>
              <AlertDescription>
                Webhooks are arriving on schedule. Last received {formatDistanceToNow(healthMetrics.lastWebhookTime, { addSuffix: true })}.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Recent Webhook History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Recent Webhook Activity
          </CardTitle>
          <CardDescription>
            Last 10 webhook attempts from Athara/Gasbot
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Loading webhook history...
            </div>
          ) : syncLogs && syncLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncLogs.slice(0, 10).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.started_at), 'MM/dd HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {log.sync_status === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : log.sync_status === 'partial' ? (
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <Badge 
                            variant={
                              log.sync_status === 'success' ? 'default' :
                              log.sync_status === 'partial' ? 'secondary' : 'destructive'
                            }
                            className="text-xs"
                          >
                            {log.sync_status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.sync_type || 'sync'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-1">
                          <div>📍 {log.locations_processed || 0} locations</div>
                          <div>🏭 {log.assets_processed || 0} assets</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.sync_duration_ms ? formatDuration(log.sync_duration_ms) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {log.error_message ? (
                          <span className="text-red-600">
                            {log.error_message.substring(0, 50)}...
                          </span>
                        ) : (
                          'Success'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No webhook history found</p>
              <p className="text-sm">Webhooks will appear here once Athara starts sending data</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AtharaWebhookMonitor;