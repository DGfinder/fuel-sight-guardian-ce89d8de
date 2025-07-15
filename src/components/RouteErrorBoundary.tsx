import React, { Component, ErrorInfo } from 'react';
import { AlertCircle, RefreshCw, Home, Bug, Wifi, Shield } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  routeName?: string;
  showHomeButton?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

type ErrorType = 'network' | 'auth' | 'permission' | 'validation' | 'runtime' | 'unknown';

export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      retryCount: 0
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log error with context
    console.error(`Route Error in ${this.props.routeName || 'Unknown Route'}:`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    // Report to error tracking service if available
    if (typeof window !== 'undefined' && (window as Record<string, unknown>).analytics) {
      ((window as Record<string, unknown>).analytics as { track: (event: string, props: Record<string, unknown>) => void }).track('Route Error', {
        route: this.props.routeName,
        error: error.message,
        retryCount: this.state.retryCount
      });
    }
  }

  private getErrorType(): ErrorType {
    const error = this.state.error;
    if (!error) return 'unknown';

    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'auth';
    }
    if (message.includes('permission') || message.includes('access denied')) {
      return 'permission';
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }
    if (error.name === 'ChunkLoadError' || message.includes('loading chunk')) {
      return 'network';
    }
    
    return 'runtime';
  }

  private getErrorIcon(): React.ReactElement {
    const errorType = this.getErrorType();
    switch (errorType) {
      case 'network':
        return <Wifi className="h-5 w-5" />;
      case 'auth':
      case 'permission':
        return <Shield className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  }

  private getErrorTitle(): string {
    const errorType = this.getErrorType();
    const routeName = this.props.routeName;
    
    switch (errorType) {
      case 'network':
        return 'Connection Error';
      case 'auth':
        return 'Authentication Error';
      case 'permission':
        return 'Permission Error';
      case 'validation':
        return 'Data Validation Error';
      default:
        return `${routeName ? `${routeName} ` : ''}Page Error`;
    }
  }

  private getErrorMessage(): string {
    const error = this.state.error;
    const errorType = this.getErrorType();
    
    switch (errorType) {
      case 'network':
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      case 'auth':
        return 'Your session has expired. Please login again to continue.';
      case 'permission':
        return 'You do not have permission to access this page. Contact your administrator if you believe this is an error.';
      case 'validation':
        return 'Invalid data detected. Please refresh the page and try again.';
      default:
        return error?.message || 'An unexpected error occurred. Please try again.';
    }
  }

  private getErrorBadgeVariant(): "default" | "secondary" | "destructive" | "outline" {
    const errorType = this.getErrorType();
    switch (errorType) {
      case 'network':
        return 'outline';
      case 'auth':
      case 'permission':
        return 'destructive';
      case 'validation':
        return 'secondary';
      default:
        return 'destructive';
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorType = this.getErrorType();
      const isRetryable = this.state.retryCount < 3;
      const shouldShowDetails = process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  {this.getErrorIcon()}
                  {this.getErrorTitle()}
                </CardTitle>
                <Badge variant={this.getErrorBadgeVariant()}>
                  {errorType.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {this.getErrorMessage()}
              </p>

              {this.state.retryCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Retry attempts: {this.state.retryCount}
                </p>
              )}

              {shouldShowDetails && this.state.error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs text-muted-foreground mb-2">
                    Technical Details (Development Only)
                  </summary>
                  <div className="bg-muted p-3 rounded text-xs font-mono space-y-2">
                    <div>
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                    <div>
                      <strong>Route:</strong> {this.props.routeName || 'Unknown'}
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="mt-1 text-xs whitespace-pre-wrap">
                          {this.state.error.stack.slice(0, 500)}
                          {this.state.error.stack.length > 500 ? '...' : ''}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              <div className="flex gap-2 justify-end">
                {this.props.showHomeButton && (
                  <Button
                    onClick={this.handleGoHome}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Home className="h-4 w-4" />
                    Go Home
                  </Button>
                )}
                
                {errorType === 'network' || errorType === 'runtime' ? (
                  <Button
                    onClick={this.handleReload}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reload Page
                  </Button>
                ) : null}

                {isRetryable && (
                  <Button
                    onClick={this.handleRetry}
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                )}

                {!isRetryable && (
                  <Button
                    onClick={this.handleReload}
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reload Page
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}