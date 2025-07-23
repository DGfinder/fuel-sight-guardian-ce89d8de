import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class DatabaseErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to console for debugging
    console.error('DatabaseErrorBoundary caught an error:', error, errorInfo);

    // Only log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // Here you could send error to logging service
      // errorReporter.reportError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private getErrorMessage = (error: Error | null): string => {
    if (!error) return this.props.fallbackMessage || 'An unexpected error occurred';
    
    // Handle specific database-related errors
    if (error.message?.includes('500') || error.message?.includes('Internal Server Error')) {
      return 'Database connection error. The server is temporarily unavailable.';
    }
    
    if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
      return 'You do not have permission to access this data.';
    }
    
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      return 'Network connection error. Please check your internet connection.';
    }
    
    // Handle React-specific errors
    if (error.message?.includes('object with keys')) {
      return 'Data format error. Please refresh the page.';
    }
    
    return error.message || this.props.fallbackMessage || 'An unexpected error occurred';
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.getErrorMessage(this.state.error);
      
      return (
        <Card className="m-4">
          <CardContent className="p-6 text-center space-y-4">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Something went wrong</h3>
              <p className="text-red-600 mt-1">{errorMessage}</p>
            </div>
            <div className="space-x-2">
              <Button onClick={this.handleRetry} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={() => window.location.reload()} variant="default">
                Reload Page
              </Button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-600">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default DatabaseErrorBoundary;