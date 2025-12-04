import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Wifi, Settings } from 'lucide-react';

interface AgbotErrorBoundaryProps {
  error: Error;
  retry?: () => void;
  showTechnicalDetails?: boolean;
}

export function AgbotErrorBoundary({ error, retry, showTechnicalDetails = false }: AgbotErrorBoundaryProps) {
  const isAPIError = error.message.includes('Athara API') || error.message.includes('API');
  const isAuthError = error.message.includes('authentication') || error.message.includes('401') || error.message.includes('403');
  const isNetworkError = error.message.includes('timeout') || error.message.includes('network') || error.message.includes('fetch');

  const getErrorType = () => {
    if (isAuthError) return 'Authentication';
    if (isNetworkError) return 'Network';
    if (isAPIError) return 'API';
    return 'System';
  };

  const getErrorIcon = () => {
    if (isAuthError) return <Settings className="h-5 w-5" />;
    if (isNetworkError) return <Wifi className="h-5 w-5" />;
    return <AlertTriangle className="h-5 w-5" />;
  };

  const getErrorSolutions = () => {
    if (isAuthError) {
      return [
        'Check VITE_ATHARA_API_KEY environment variable',
        'Verify API key is valid and active',
        'Contact system administrator for API access'
      ];
    }
    
    if (isNetworkError) {
      return [
        'Check internet connectivity',
        'Verify Athara API endpoint is reachable',
        'Check for firewall or proxy issues',
        'Try again in a few minutes'
      ];
    }
    
    if (isAPIError) {
      return [
        'Athara API service may be temporarily unavailable',
        'Check system status with API provider',
        'Data will resume when service is restored'
      ];
    }

    return [
      'Unexpected system error occurred',
      'Try refreshing the page',
      'Contact support if problem persists'
    ];
  };

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          {getErrorIcon()}
          {getErrorType()} Error
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Agbot Data Unavailable</AlertTitle>
          <AlertDescription>
            Cannot load cellular monitoring data. This is a production system with no fallback data.
          </AlertDescription>
        </Alert>

        {/* User-friendly error explanation */}
        <div>
          <h4 className="font-medium mb-2">What's happening:</h4>
          <p className="text-sm text-muted-foreground mb-3">
            {isAuthError && 'The system cannot authenticate with the Athara API. This typically means the API key is missing or invalid.'}
            {isNetworkError && 'The system cannot reach the Athara API service. This could be due to network connectivity issues.'}
            {isAPIError && !isAuthError && !isNetworkError && 'The Athara API service is not responding normally. This may be a temporary service outage.'}
            {!isAPIError && 'An unexpected error occurred while trying to load agbot data.'}
          </p>
        </div>

        {/* Solutions */}
        <div>
          <h4 className="font-medium mb-2">Possible solutions:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            {getErrorSolutions().map((solution, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-xs mt-1">•</span>
                <span>{solution}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Technical details (collapsible) */}
        {showTechnicalDetails && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">Technical Details</summary>
            <div className="mt-2 p-3 bg-muted rounded text-xs font-mono break-all">
              <strong>Error Type:</strong> {error.name}<br />
              <strong>Message:</strong> {error.message}<br />
              {error.stack && (
                <>
                  <strong>Stack Trace:</strong><br />
                  <pre className="whitespace-pre-wrap">{error.stack}</pre>
                </>
              )}
            </div>
          </details>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          {retry && (
            <Button onClick={retry} variant="outline" size="sm">
              <RefreshCw className="h-3 w-3 mr-1" />
              Try Again
            </Button>
          )}
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            size="sm"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh Page
          </Button>
        </div>

        {/* Production safety notice */}
        <Alert>
          <AlertDescription className="text-xs">
            <strong>Production Safety:</strong> This system does not provide mock or fallback data. 
            All agbot data comes directly from the Athara API. When the API is unavailable, 
            no data will be shown to prevent confusion with outdated or fake information.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}