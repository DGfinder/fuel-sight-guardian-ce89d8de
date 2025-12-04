import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  useAgbotSyncLogs,
  formatTimestamp
} from '@/hooks/useAgbotData';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, Webhook, Globe } from 'lucide-react';

interface AgbotWebhookHealthStatusProps {
  showFullDetails?: boolean;
  className?: string;
}

export function AgbotWebhookHealthStatus({ showFullDetails = false, className }: AgbotWebhookHealthStatusProps) {
  const { data: syncLogs, isLoading, refetch } = useAgbotSyncLogs(5);

  // Calculate webhook health based on recent webhook activity
  const getWebhookHealth = () => {
    if (!syncLogs || syncLogs.length === 0) {
      return {
        status: 'unknown' as const,
        lastWebhook: null,
        recentWebhooks: 0,
        failedWebhooks: 0,
        avgProcessingTime: 0
      };
    }

    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    // Filter for webhook-type logs
    const webhookLogs = syncLogs.filter(log => log.sync_type === 'gasbot_webhook');
    const recentWebhooks = webhookLogs.filter(log => 
      new Date(log.started_at).getTime() > oneHourAgo
    );
    const failedWebhooks = recentWebhooks.filter(log => 
      log.sync_status === 'error' || log.sync_status === 'failed'
    );

    const lastWebhook = webhookLogs[0];
    const timeSinceLastWebhook = lastWebhook 
      ? now - new Date(lastWebhook.started_at).getTime()
      : null;

    // Calculate average processing time
    const processingTimes = webhookLogs
      .filter(log => log.sync_duration_ms)
      .map(log => log.sync_duration_ms)
      .slice(0, 10); // Last 10 webhooks

    const avgProcessingTime = processingTimes.length > 0
      ? Math.round(processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length)
      : 0;

    // Determine status
    let status: 'healthy' | 'warning' | 'error' | 'stale' | 'unknown' = 'unknown';
    
    if (timeSinceLastWebhook === null) {
      status = 'unknown';
    } else if (timeSinceLastWebhook > 2 * 60 * 60 * 1000) { // More than 2 hours
      status = 'stale';
    } else if (failedWebhooks.length > recentWebhooks.length * 0.5) { // More than 50% failed
      status = 'error';
    } else if (failedWebhooks.length > 0) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    return {
      status,
      lastWebhook,
      recentWebhooks: recentWebhooks.length,
      failedWebhooks: failedWebhooks.length,
      avgProcessingTime,
      timeSinceLastWebhook
    };
  };

  const webhookHealth = getWebhookHealth();

  const getStatusIcon = () => {
    if (isLoading) return <RefreshCw className="h-4 w-4 animate-spin" />;
    
    switch (webhookHealth.status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'stale':
        return <Clock className="h-4 w-4 text-orange-500" />;
      default:
        return <Webhook className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (webhookHealth.status) {
      case 'healthy':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      case 'stale':
        return 'bg-orange-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    if (isLoading) return 'Checking...';
    
    switch (webhookHealth.status) {
      case 'healthy':
        return 'Active';
      case 'warning':
        return 'Issues';
      case 'error':
        return 'Failing';
      case 'stale':
        return 'Stale';
      default:
        return 'Unknown';
    }
  };

  const getStatusVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    switch (webhookHealth.status) {
      case 'healthy':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'error':
        return 'destructive';
      case 'stale':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatTimeAgo = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ago`;
    }
    return `${minutes}m ago`;
  };

  if (!showFullDetails) {
    // Compact status indicator with animated pulse
    const isHealthy = webhookHealth.status === 'healthy';
    const isWarning = webhookHealth.status === 'warning' || webhookHealth.status === 'stale';

    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Animated pulse indicator */}
        <span className="relative flex h-2.5 w-2.5">
          {isHealthy && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            isHealthy ? 'bg-green-500' :
            isWarning ? 'bg-yellow-500' :
            webhookHealth.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
          }`}></span>
        </span>

        <span className={`text-sm font-medium ${
          isHealthy ? 'text-green-600' :
          isWarning ? 'text-yellow-600' :
          webhookHealth.status === 'error' ? 'text-red-600' : 'text-gray-500'
        }`}>
          {isHealthy ? 'LIVE' : getStatusText()}
        </span>

        {webhookHealth.lastWebhook && (
          <span className="text-sm text-muted-foreground">
            • {formatTimestamp(webhookHealth.lastWebhook.started_at)}
          </span>
        )}
      </div>
    );
  }

  // Full details card
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Gasbot Webhook Status
          <Badge variant={getStatusVariant()}>
            {getStatusText()}
          </Badge>
        </CardTitle>
        <CardDescription>
          Real-time data reception from Gasbot webhook endpoint
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <p className="text-lg font-semibold">{getStatusText()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Recent Webhooks (1h)</p>
            <p className="text-lg font-semibold">
              {webhookHealth.recentWebhooks}
            </p>
          </div>
        </div>

        {/* Last Webhook */}
        {webhookHealth.lastWebhook && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Last Webhook</p>
              <p className="text-sm flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {webhookHealth.timeSinceLastWebhook && formatTimeAgo(webhookHealth.timeSinceLastWebhook)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Processing</p>
              <p className="text-sm">
                {webhookHealth.avgProcessingTime}ms
              </p>
            </div>
          </div>
        )}

        {/* Status Alerts */}
        {webhookHealth.status === 'healthy' && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Webhook Active</AlertTitle>
            <AlertDescription>
              Gasbot is successfully sending data to your webhook endpoint. Data is current and processing normally.
            </AlertDescription>
          </Alert>
        )}

        {webhookHealth.status === 'warning' && (
          <Alert variant="default">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Processing Issues</AlertTitle>
            <AlertDescription>
              Some recent webhooks failed to process. {webhookHealth.failedWebhooks} of {webhookHealth.recentWebhooks} recent webhooks had errors.
            </AlertDescription>
          </Alert>
        )}

        {webhookHealth.status === 'error' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Webhook Failures</AlertTitle>
            <AlertDescription>
              High rate of webhook processing failures. Check webhook endpoint and processing logic.
            </AlertDescription>
          </Alert>
        )}

        {webhookHealth.status === 'stale' && (
          <Alert variant="destructive">
            <AlertTitle>No Recent Data</AlertTitle>
            <AlertDescription>
              No webhooks received in the last 2 hours. Check Gasbot webhook configuration:
              <br />
              <code className="text-xs mt-2 block bg-muted p-2 rounded">
                https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook
              </code>
            </AlertDescription>
          </Alert>
        )}

        {webhookHealth.status === 'unknown' && (
          <Alert>
            <Webhook className="h-4 w-4" />
            <AlertTitle>No Webhook Data</AlertTitle>
            <AlertDescription>
              No webhook activity found. Configure Gasbot to send data to:
              <br />
              <code className="text-xs mt-2 block bg-muted p-2 rounded">
                https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook
              </code>
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook', '_blank')}
          >
            <Globe className="h-3 w-3 mr-1" />
            Test Endpoint
          </Button>
        </div>

        {/* Webhook Configuration Info */}
        <Alert>
          <AlertTitle>Webhook Configuration</AlertTitle>
          <AlertDescription className="text-xs space-y-1">
            <div><strong>URL:</strong> https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook</div>
            <div><strong>Method:</strong> POST</div>
            <div><strong>Auth:</strong> Bearer FSG-gasbot-webhook-2025</div>
            <div><strong>Expected Frequency:</strong> Hourly updates</div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}