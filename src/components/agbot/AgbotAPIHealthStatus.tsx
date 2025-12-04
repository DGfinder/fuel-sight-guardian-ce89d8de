import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  useAtharaAPIHealth, 
  useAtharaAPITest,
  formatTimestamp,
  type AgbotSystemStatus 
} from '@/hooks/useAgbotData';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, Wifi, WifiOff } from 'lucide-react';

interface AgbotAPIHealthStatusProps {
  showFullDetails?: boolean;
  className?: string;
}

export function AgbotAPIHealthStatus({ showFullDetails = false, className }: AgbotAPIHealthStatusProps) {
  const { data: apiHealth, isLoading, refetch } = useAtharaAPIHealth();
  const testAPI = useAtharaAPITest();

  const getStatusIcon = () => {
    if (isLoading) return <RefreshCw className="h-4 w-4 animate-spin" />;
    
    switch (apiHealth?.status) {
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unavailable':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (apiHealth?.status) {
      case 'available':
        return 'bg-green-500';
      case 'error':
        return 'bg-yellow-500';
      case 'unavailable':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    if (isLoading) return 'Checking...';
    
    switch (apiHealth?.status) {
      case 'available':
        return 'Online';
      case 'error':
        return 'Issues';
      case 'unavailable':
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  const getStatusVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    switch (apiHealth?.status) {
      case 'available':
        return 'default';
      case 'error':
        return 'secondary';
      case 'unavailable':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (!showFullDetails) {
    // Compact status indicator
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-sm text-muted-foreground">
          Athara API: {getStatusText()}
        </span>
        {apiHealth?.consecutiveFailures > 0 && (
          <Badge variant="outline" className="text-xs">
            {apiHealth.consecutiveFailures} failures
          </Badge>
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
          Athara API Status
          <Badge variant={getStatusVariant()}>
            {getStatusText()}
          </Badge>
        </CardTitle>
        <CardDescription>
          Real-time connectivity to Athara cellular monitoring API
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
            <p className="text-sm font-medium text-muted-foreground">Consecutive Failures</p>
            <p className="text-lg font-semibold">
              {apiHealth?.consecutiveFailures || 0}
            </p>
          </div>
        </div>

        {/* Last Successful Call */}
        {apiHealth?.lastSuccessfulCall && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Last Successful Call</p>
            <p className="text-sm flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimestamp(apiHealth.lastSuccessfulCall)}
            </p>
          </div>
        )}

        {/* Error Information */}
        {apiHealth?.lastError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Last Error</AlertTitle>
            <AlertDescription className="text-xs font-mono">
              {apiHealth.lastError}
            </AlertDescription>
          </Alert>
        )}

        {/* No Error - System Healthy */}
        {apiHealth?.status === 'available' && !apiHealth?.lastError && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>System Healthy</AlertTitle>
            <AlertDescription>
              API is responding normally. Cellular monitoring data is being received.
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
            onClick={() => testAPI.mutate()}
            disabled={testAPI.isPending}
          >
            <Wifi className={`h-3 w-3 mr-1 ${testAPI.isPending ? 'animate-pulse' : ''}`} />
            Test Connection
          </Button>
        </div>

        {/* Connection Test Results */}
        {testAPI.data && (
          <Alert variant={testAPI.data.success ? "default" : "destructive"}>
            <AlertTitle>Connection Test Result</AlertTitle>
            <AlertDescription>
              {testAPI.data.success ? (
                <>
                  ✅ API is reachable ({testAPI.data.responseTime}ms response time)
                  {testAPI.data.dataCount && ` - ${testAPI.data.dataCount} locations available`}
                </>
              ) : (
                <>❌ Connection failed: {testAPI.data.error}</>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Hook to get combined system status
export function useAgbotSystemStatus(): AgbotSystemStatus {
  const { data: apiHealth } = useAtharaAPIHealth();
  
  // This would integrate with actual data hooks when implemented
  const mockSystemStatus: AgbotSystemStatus = {
    data: [],
    apiHealth: apiHealth || {
      status: 'unknown',
      lastSuccessfulCall: null,
      lastError: null,
      consecutiveFailures: 0
    },
    lastSyncTime: null,
    dataAge: 0,
    hasData: false,
    isStale: false,
    isHealthy: apiHealth?.status === 'available',
    needsAttention: apiHealth?.status === 'unavailable' || (apiHealth?.consecutiveFailures || 0) > 2
  };

  return mockSystemStatus;
}